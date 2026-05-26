// Type-level tests for the Construct props.
//
// These tests don't exercise behavior (no Construct classes implemented yet —
// that's D2.5). They verify that the type contracts compile and that
// REQUIRED_TAG_KEYS stays in sync with GoldenPathTags.

import {
  REQUIRED_TAG_KEYS,
  type EnvironmentConfig,
  type GoldenPathTags,
  type PythonLambdaApiProps,
  type RouteDefinition,
} from '../../src/constructs'

const validTags: GoldenPathTags = {
  'finops:Project': 'Transactionify',
  'finops:Service': 'Transactionify API',
  'finops:Team': 'transactionify',
  'finops:Owner': 'jorge.flores',
  'project-type': 'api',
}

const validEnv: EnvironmentConfig = {
  stage: 'sandbox',
  account: '111111111111',
  region: 'us-east-1',
  monitoring: 'basic',
}

const validRoute: RouteDefinition = {
  path: '/api/v1/accounts',
  method: 'POST',
  handler: 'transactionify.handlers.api.rest.account.create.main.handler',
  permission: 'readwrite',
}

const validApiProps: PythonLambdaApiProps = {
  serviceName: 'transactionify',
  tags: validTags,
  environment: validEnv,
  sourcePath: 'src/python',
  runtime: '3.12',
  authorizerHandler: 'transactionify.handlers.authorizer.main.handler',
  routes: [validRoute],
}

describe('Construct types', () => {
  describe('GoldenPathTags', () => {
    it('REQUIRED_TAG_KEYS matches the GoldenPathTags interface keys', () => {
      // The interface keys must exactly match REQUIRED_TAG_KEYS (no drift).
      // If a key is added to GoldenPathTags without updating REQUIRED_TAG_KEYS
      // (or vice versa), this test fails.
      const interfaceKeys = Object.keys(validTags).sort()
      const constantKeys = [...REQUIRED_TAG_KEYS].sort()
      expect(interfaceKeys).toEqual(constantKeys)
    })

    it('accepts all valid project types', () => {
      const types: GoldenPathTags['project-type'][] = [
        'api',
        'worker',
        'job',
        'data-pipeline',
        'static-site',
      ]
      expect(types).toHaveLength(5)
    })
  })

  describe('EnvironmentConfig', () => {
    it('accepts the three stages', () => {
      const stages: EnvironmentConfig['stage'][] = ['sandbox', 'staging', 'prod']
      expect(stages).toHaveLength(3)
    })
  })

  describe('RouteDefinition', () => {
    it('allows optional requiresAuth, memorySize, timeoutSeconds', () => {
      const customized: RouteDefinition = {
        ...validRoute,
        requiresAuth: false,
        memorySize: 512,
        timeoutSeconds: 30,
      }
      expect(customized.requiresAuth).toBe(false)
    })
  })

  describe('PythonLambdaApiProps', () => {
    it('compiles for a typical transactionify-shaped declaration', () => {
      expect(validApiProps.serviceName).toBe('transactionify')
      expect(validApiProps.routes).toHaveLength(1)
    })

    it('allows authorizerHandler=null for public APIs', () => {
      const publicApi: PythonLambdaApiProps = {
        ...validApiProps,
        authorizerHandler: null,
      }
      expect(publicApi.authorizerHandler).toBeNull()
    })
  })
})
