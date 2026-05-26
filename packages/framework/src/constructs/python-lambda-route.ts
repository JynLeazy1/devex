// PythonLambdaRoute — L2 Construct that provisions one HTTP endpoint backed
// by a Python Lambda.
//
// Replaces the 15-line repeated pattern from transactionify's monolithic
// stack (lambda.Function + grant + HttpLambdaIntegration + addRoutes) with
// a single typed Construct.

import * as cdk from 'aws-cdk-lib'
import * as apigwv2 from 'aws-cdk-lib/aws-apigatewayv2'
import * as apigwv2_integrations from 'aws-cdk-lib/aws-apigatewayv2-integrations'
import * as lambda from 'aws-cdk-lib/aws-lambda'
import { Construct } from 'constructs'

import { assertNever } from '../profiles'
import type { PythonLambdaRouteProps } from './props'
import type { HttpMethod, RoutePermission } from './route-definition'

/** Default Lambda memory in MB. Tuned for typical Python handlers. */
const DEFAULT_MEMORY_MB = 256

/** Default Lambda timeout in seconds. Forces sane upper bound on cold paths. */
const DEFAULT_TIMEOUT_SECONDS = 10

// TODO(post-PoC): set `logRetention: logs.RetentionDays.ONE_MONTH` and
// `tracing: lambda.Tracing.ACTIVE` once we move to explicit `logGroup` Construct
// (CDK deprecated `logRetention` because it spawns a custom resource).

/**
 * Maps our `PythonRuntime` string to the CDK enum. Type-safe — adding a new
 * runtime to the union without updating this map is a compile error.
 */
const PYTHON_RUNTIME_MAP: Record<'3.11' | '3.12', lambda.Runtime> = {
  '3.11': lambda.Runtime.PYTHON_3_11,
  '3.12': lambda.Runtime.PYTHON_3_12,
}

/**
 * Maps our `HttpMethod` string union to the CDK enum.
 */
const HTTP_METHOD_MAP: Record<HttpMethod, apigwv2.HttpMethod> = {
  GET: apigwv2.HttpMethod.GET,
  POST: apigwv2.HttpMethod.POST,
  PUT: apigwv2.HttpMethod.PUT,
  PATCH: apigwv2.HttpMethod.PATCH,
  DELETE: apigwv2.HttpMethod.DELETE,
}

/**
 * Applies the route's declared DynamoDB permission to a Lambda. Permission
 * declarations in `RouteDefinition` are kept narrow (`read`/`write`/`readwrite`)
 * so handlers cannot accidentally get broader access than they declared.
 */
function grantTableAccess(
  table: { grantReadData: (fn: lambda.IFunction) => unknown
           grantWriteData: (fn: lambda.IFunction) => unknown
           grantReadWriteData: (fn: lambda.IFunction) => unknown },
  fn: lambda.IFunction,
  permission: RoutePermission,
): void {
  switch (permission) {
    case 'read':
      table.grantReadData(fn)
      return
    case 'write':
      table.grantWriteData(fn)
      return
    case 'readwrite':
      table.grantReadWriteData(fn)
      return
    default:
      assertNever(permission)
  }
}

export class PythonLambdaRoute extends Construct {
  /**
   * The Lambda function backing this route. Exposed so consumers can grant
   * additional permissions, hook event sources, or override resource policy.
   */
  public readonly lambdaFunction: lambda.Function

  constructor(scope: Construct, id: string, props: PythonLambdaRouteProps) {
    super(scope, id)

    const { route, runtime, sourcePath, table, httpApi, authorizer } = props

    // 1. Create the Lambda function with Golden Path defaults.
    this.lambdaFunction = new lambda.Function(this, 'Fn', {
      runtime: PYTHON_RUNTIME_MAP[runtime],
      handler: route.handler,
      code: lambda.Code.fromAsset(sourcePath),
      memorySize: route.memorySize ?? DEFAULT_MEMORY_MB,
      timeout: cdk.Duration.seconds(route.timeoutSeconds ?? DEFAULT_TIMEOUT_SECONDS),
      environment: {
        TABLE_NAME: table.tableName,
      },
    })

    // 2. Grant the declared DynamoDB permission — narrow by default.
    grantTableAccess(table, this.lambdaFunction, route.permission)

    // 3. Wire the Lambda to the HTTP API as an integration + route.
    const integration = new apigwv2_integrations.HttpLambdaIntegration(
      'Integration',
      this.lambdaFunction,
    )

    const shouldAuth = route.requiresAuth !== false
    httpApi.addRoutes({
      path: route.path,
      methods: [HTTP_METHOD_MAP[route.method]],
      integration,
      ...(shouldAuth && authorizer ? { authorizer } : {}),
    })
  }
}
