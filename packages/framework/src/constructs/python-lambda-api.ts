// PythonLambdaApi — L3 Construct that provisions an entire Python Lambda
// API stack (HTTP API + DynamoDB + authorizer + N routes).
//
// Replaces a transactionify-shaped 188-line monolithic Stack with one ~10-line
// declaration. The L3 holds the opinionated Golden Path: single-table DynamoDB
// (PK/SK + TTL), HTTP API v2, optional Lambda authorizer, FinOps tag aspect.

import * as cdk from 'aws-cdk-lib'
import * as apigwv2 from 'aws-cdk-lib/aws-apigatewayv2'
import * as apigwv2_authorizers from 'aws-cdk-lib/aws-apigatewayv2-authorizers'
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb'
import * as lambda from 'aws-cdk-lib/aws-lambda'
import { Construct } from 'constructs'

import { GoldenPathTagsAspect } from './golden-path-tags-aspect'
import type { PythonLambdaApiProps } from './props'
import { PythonLambdaRoute } from './python-lambda-route'

const PYTHON_RUNTIME_MAP: Record<'3.11' | '3.12', lambda.Runtime> = {
  '3.11': lambda.Runtime.PYTHON_3_11,
  '3.12': lambda.Runtime.PYTHON_3_12,
}

/** Default table partition key name (matches transactionify's single-table pattern). */
const DEFAULT_PARTITION_KEY = 'PK'
const DEFAULT_SORT_KEY = 'SK'
const DEFAULT_TTL_ATTRIBUTE = 'ttl'

export class PythonLambdaApi extends Construct {
  public readonly httpApi: apigwv2.HttpApi
  public readonly table: dynamodb.Table
  public readonly authorizer: apigwv2_authorizers.HttpLambdaAuthorizer | null
  public readonly routes: readonly PythonLambdaRoute[]

  constructor(scope: Construct, id: string, props: PythonLambdaApiProps) {
    super(scope, id)

    // 1. Apply Golden Path FinOps tags to the entire subtree. The
    //    GoldenPathTagsAspect (next step) validates these reach every
    //    taggable resource at synth time.
    for (const [key, value] of Object.entries(props.tags)) {
      cdk.Tags.of(this).add(key, value)
    }

    // 2. Register the tag-enforcement Aspect at READONLY priority so it runs
    //    AFTER CDK's built-in Tag-propagation aspects (which are MUTATING,
    //    priority 200). Without this, our aspect races the tag propagation
    //    and reports false negatives on resources whose tags haven't been
    //    pushed down yet.
    cdk.Aspects.of(this).add(new GoldenPathTagsAspect(), {
      priority: cdk.AspectPriority.READONLY,
    })

    // 3. Single-table DynamoDB (matches transactionify's pattern).
    this.table = this.createTable(props)

    // 4. HTTP API v2 (cheaper than REST v1, matches transactionify).
    this.httpApi = new apigwv2.HttpApi(this, 'HttpApi', {
      apiName: `${props.serviceName}-api`,
      createDefaultStage: true,
    })

    // 5. Authorizer Lambda (optional). When null, the API is fully public.
    this.authorizer = this.createAuthorizer(props)

    // 6. Per-route Constructs — one PythonLambdaRoute per RouteDefinition.
    this.routes = props.routes.map((route, index) => {
      // Stable, debuggable IDs: e.g., 'Route0', 'Route1', ...
      // (Logical IDs are append-only — never renumber after deployment.)
      return new PythonLambdaRoute(this, `Route${index}`, {
        httpApi: this.httpApi,
        table: this.table,
        sourcePath: props.sourcePath,
        runtime: props.runtime,
        route,
        authorizer: this.authorizer,
      })
    })

    // 7. CloudFormation outputs — mirrors transactionify's behavior.
    new cdk.CfnOutput(this, 'ApiUrl', {
      value: this.httpApi.apiEndpoint,
      description: 'HTTP API Gateway endpoint URL',
    })
    new cdk.CfnOutput(this, 'TableName', {
      value: this.table.tableName,
      description: 'DynamoDB table name',
    })
  }

  private createTable(props: PythonLambdaApiProps): dynamodb.Table {
    const cfg = props.tableConfig ?? {}
    const partitionKeyName = cfg.partitionKeyName ?? DEFAULT_PARTITION_KEY
    const sortKeyName =
      cfg.sortKeyName === null ? null : (cfg.sortKeyName ?? DEFAULT_SORT_KEY)
    const ttlAttributeName =
      cfg.ttlAttributeName === null
        ? undefined
        : (cfg.ttlAttributeName ?? DEFAULT_TTL_ATTRIBUTE)

    return new dynamodb.Table(this, 'Table', {
      partitionKey: { name: partitionKeyName, type: dynamodb.AttributeType.STRING },
      ...(sortKeyName !== null
        ? { sortKey: { name: sortKeyName, type: dynamodb.AttributeType.STRING } }
        : {}),
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      ...(ttlAttributeName !== undefined ? { timeToLiveAttribute: ttlAttributeName } : {}),
    })
  }

  private createAuthorizer(
    props: PythonLambdaApiProps,
  ): apigwv2_authorizers.HttpLambdaAuthorizer | null {
    if (props.authorizerHandler === null) {
      return null
    }

    const authorizerLambda = new lambda.Function(this, 'AuthorizerLambda', {
      runtime: PYTHON_RUNTIME_MAP[props.runtime],
      handler: props.authorizerHandler,
      code: lambda.Code.fromAsset(props.sourcePath),
      environment: {
        TABLE_NAME: this.table.tableName,
      },
    })
    this.table.grantReadData(authorizerLambda)

    return new apigwv2_authorizers.HttpLambdaAuthorizer(
      'Authorizer',
      authorizerLambda,
      {
        identitySource: ['$request.header.Authorization'],
        resultsCacheTtl: cdk.Duration.minutes(0),
        responseTypes: [apigwv2_authorizers.HttpLambdaResponseType.SIMPLE],
      },
    )
  }
}
