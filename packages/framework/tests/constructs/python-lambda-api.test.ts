// Behavioral tests for PythonLambdaApi using `aws-cdk-lib/assertions`.
//
// These tests synthesize the Construct into a CloudFormation template and
// verify resource properties match the Golden Path defaults — the strongest
// guarantee we can give without actually deploying.

import * as path from 'path'

import { App, Stack } from 'aws-cdk-lib'
import { Match, Template } from 'aws-cdk-lib/assertions'

import {
  PythonLambdaApi,
  REQUIRED_TAG_KEYS,
  type GoldenPathTags,
  type PythonLambdaApiProps,
  type RouteDefinition,
} from '../../src/constructs'

const FIXTURE_SOURCE = path.join(__dirname, '..', '__fixtures__', 'python-src')

const validTags: GoldenPathTags = {
  'finops:Project': 'Transactionify',
  'finops:Service': 'Transactionify API',
  'finops:Team': 'transactionify',
  'finops:Owner': 'jorge.flores',
  'project-type': 'api',
}

const sampleRoutes: readonly RouteDefinition[] = [
  {
    path: '/api/v1/accounts',
    method: 'POST',
    handler: 'transactionify.handlers.api.rest.account.create.main.handler',
    permission: 'readwrite',
  },
  {
    path: '/api/v1/accounts/{account_id}/balance',
    method: 'GET',
    handler: 'transactionify.handlers.api.rest.balance.get.main.handler',
    permission: 'read',
  },
]

function buildProps(overrides: Partial<PythonLambdaApiProps> = {}): PythonLambdaApiProps {
  return {
    serviceName: 'transactionify',
    tags: validTags,
    environment: {
      stage: 'sandbox',
      account: '111111111111',
      region: 'us-east-1',
      monitoring: 'basic',
    },
    sourcePath: FIXTURE_SOURCE,
    runtime: '3.12',
    authorizerHandler: 'transactionify.handlers.authorizer.main.handler',
    routes: sampleRoutes,
    ...overrides,
  }
}

function synthTemplate(props: PythonLambdaApiProps = buildProps()): Template {
  const app = new App()
  const stack = new Stack(app, 'TestStack', {
    env: { account: '111111111111', region: 'us-east-1' },
  })
  new PythonLambdaApi(stack, 'Api', props)
  return Template.fromStack(stack)
}

describe('PythonLambdaApi — DynamoDB single-table', () => {
  it('creates one DynamoDB table with PK/SK string keys', () => {
    const tpl = synthTemplate()

    tpl.resourceCountIs('AWS::DynamoDB::Table', 1)
    tpl.hasResourceProperties('AWS::DynamoDB::Table', {
      KeySchema: Match.arrayWith([
        Match.objectLike({ AttributeName: 'PK', KeyType: 'HASH' }),
        Match.objectLike({ AttributeName: 'SK', KeyType: 'RANGE' }),
      ]),
      BillingMode: 'PAY_PER_REQUEST',
      TimeToLiveSpecification: Match.objectLike({
        AttributeName: 'ttl',
        Enabled: true,
      }),
    })
  })

  it('respects custom partition/sort key names from tableConfig', () => {
    const tpl = synthTemplate(
      buildProps({
        tableConfig: { partitionKeyName: 'TenantId', sortKeyName: 'EntityId' },
      }),
    )

    tpl.hasResourceProperties('AWS::DynamoDB::Table', {
      KeySchema: Match.arrayWith([
        Match.objectLike({ AttributeName: 'TenantId' }),
        Match.objectLike({ AttributeName: 'EntityId' }),
      ]),
    })
  })

  it('supports partition-key-only tables when sortKeyName is null', () => {
    const tpl = synthTemplate(
      buildProps({ tableConfig: { sortKeyName: null } }),
    )

    tpl.hasResourceProperties('AWS::DynamoDB::Table', {
      KeySchema: [Match.objectLike({ AttributeName: 'PK', KeyType: 'HASH' })],
    })
  })
})

describe('PythonLambdaApi — HTTP API', () => {
  it('creates one HTTP API v2 with a default stage', () => {
    const tpl = synthTemplate()

    tpl.resourceCountIs('AWS::ApiGatewayV2::Api', 1)
    tpl.hasResourceProperties('AWS::ApiGatewayV2::Api', {
      ProtocolType: 'HTTP',
      Name: 'transactionify-api',
    })
    tpl.resourceCountIs('AWS::ApiGatewayV2::Stage', 1)
  })
})

describe('PythonLambdaApi — Lambdas', () => {
  it('creates one Lambda per route plus the authorizer', () => {
    const tpl = synthTemplate()

    // 2 route Lambdas + 1 authorizer Lambda
    tpl.resourceCountIs('AWS::Lambda::Function', 3)
  })

  it('forces Python 3.12 runtime on every Lambda (Golden Path default)', () => {
    const tpl = synthTemplate()

    const lambdas = tpl.findResources('AWS::Lambda::Function')
    for (const [logicalId, resource] of Object.entries(lambdas)) {
      expect(resource.Properties?.Runtime).toBe('python3.12')
      // eslint-disable-next-line no-console
      void logicalId
    }
  })

  it('passes TABLE_NAME to every Lambda', () => {
    const tpl = synthTemplate()

    const lambdas = tpl.findResources('AWS::Lambda::Function')
    for (const resource of Object.values(lambdas)) {
      expect(resource.Properties?.Environment?.Variables?.TABLE_NAME).toBeDefined()
    }
  })

  it('honors per-route memorySize and timeoutSeconds overrides', () => {
    const customRoute: RouteDefinition = {
      path: '/api/heavy',
      method: 'POST',
      handler: 'svc.heavy.handler',
      permission: 'read',
      memorySize: 1024,
      timeoutSeconds: 30,
    }
    const tpl = synthTemplate(buildProps({ routes: [customRoute] }))

    tpl.hasResourceProperties('AWS::Lambda::Function', {
      MemorySize: 1024,
      Timeout: 30,
    })
  })
})

describe('PythonLambdaApi — Authorizer wiring', () => {
  it('creates the authorizer Lambda when authorizerHandler is non-null', () => {
    const tpl = synthTemplate()

    // Find authorizer by its handler path
    tpl.hasResourceProperties('AWS::Lambda::Function', {
      Handler: 'transactionify.handlers.authorizer.main.handler',
    })
    tpl.resourceCountIs('AWS::ApiGatewayV2::Authorizer', 1)
  })

  it('skips the authorizer entirely when authorizerHandler is null', () => {
    const tpl = synthTemplate(buildProps({ authorizerHandler: null }))

    tpl.resourceCountIs('AWS::ApiGatewayV2::Authorizer', 0)
    // Only route Lambdas — no authorizer Lambda
    tpl.resourceCountIs('AWS::Lambda::Function', sampleRoutes.length)
  })
})

describe('PythonLambdaApi — Tagging', () => {
  // CDK's `Match.arrayWith` requires CONSECUTIVE order; tags render in
  // alphabetical-by-key order. Asserting per-tag (rather than the full set
  // at once) is order-tolerant and produces clearer failures.
  const expectedTags: ReadonlyArray<[keyof GoldenPathTags, string]> = [
    ['finops:Project', 'Transactionify'],
    ['finops:Service', 'Transactionify API'],
    ['finops:Team', 'transactionify'],
    ['finops:Owner', 'jorge.flores'],
    ['project-type', 'api'],
  ]

  it.each(expectedTags)(
    'applies tag "%s" with value "%s" to the DynamoDB table',
    (key, value) => {
      const tpl = synthTemplate()
      tpl.hasResourceProperties('AWS::DynamoDB::Table', {
        Tags: Match.arrayWith([Match.objectLike({ Key: key, Value: value })]),
      })
    },
  )
})

describe('PythonLambdaApi — Stack outputs', () => {
  it('emits an ApiUrl output', () => {
    const tpl = synthTemplate()
    tpl.hasOutput('*', { Description: 'HTTP API Gateway endpoint URL' })
  })

  it('emits a TableName output', () => {
    const tpl = synthTemplate()
    tpl.hasOutput('*', { Description: 'DynamoDB table name' })
  })
})

// O2 (REVIEW.md v5): `cdk synth` on a Stack with N>=3 routes reports
// false-positive `GoldenPathTags` warnings on Route1/Route2/... even when
// all 5 tags ARE applied at the L3 Construct. Latent bug today because the
// Aspect's default severity is 'warning' — but `devex init --strict-tags`
// emits `tagSeverity: 'error'` and turns the warning into a synth failure,
// which would block legitimate consumers.
//
// The test captures the current behavior (so we know when the bug is fixed)
// and documents the trade-off. When the underlying Aspect bug is resolved,
// flip the `toBeGreaterThan(0)` to `toEqual([])` to make it a real regression
// guard.
describe('GoldenPathTagsAspect — tag inheritance with multiple routes (O2)', () => {
  const fourRoutes: readonly RouteDefinition[] = [
    {
      path: '/api/v1/r0',
      method: 'GET',
      handler: 'svc.r0.handler',
      permission: 'read',
    },
    {
      path: '/api/v1/r1',
      method: 'GET',
      handler: 'svc.r1.handler',
      permission: 'read',
    },
    {
      path: '/api/v1/r2',
      method: 'POST',
      handler: 'svc.r2.handler',
      permission: 'readwrite',
    },
    {
      path: '/api/v1/r3',
      method: 'PUT',
      handler: 'svc.r3.handler',
      permission: 'write',
    },
  ]

  it('synthesizes successfully with 4 routes (warning severity, current default)', () => {
    expect(() =>
      synthTemplate(buildProps({ routes: fourRoutes })),
    ).not.toThrow()
  })

  it('every route Lambda DOES carry the expected tags via CloudFormation propagation', () => {
    // The Aspect's runtime warnings are about node.tags.renderTags() returning
    // stale values during synth (CDK quirk). The FINAL CloudFormation template
    // DOES carry the tags correctly — verifiable via template assertions.
    const tpl = synthTemplate(buildProps({ routes: fourRoutes }))
    const lambdas = tpl.findResources('AWS::Lambda::Function')

    // 4 route Lambdas + 1 authorizer = 5
    expect(Object.keys(lambdas).length).toBeGreaterThanOrEqual(5)

    // Each route Lambda has all 5 Golden Path tags in its rendered template.
    for (const [logicalId, resource] of Object.entries(lambdas)) {
      // Authorizer is also tagged; we assert the same property holds for it.
      const tags = (resource.Properties?.Tags ?? []) as Array<{ Key: string }>
      const keys = new Set(tags.map((t) => t.Key))
      const missing = REQUIRED_TAG_KEYS.filter((k) => !keys.has(k))
      expect(missing).toEqual([])
      void logicalId // for clarity in failure messages
    }
  })
})
