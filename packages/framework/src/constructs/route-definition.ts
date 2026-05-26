// RouteDefinition — declarative shape for one HTTP endpoint backed by a Lambda.
//
// Consumers pass an array of these to PythonLambdaApi. The Construct instantiates
// one PythonLambdaRoute per definition.

/**
 * HTTP methods the framework supports. Mirrors the subset of API Gateway v2
 * methods that make sense for typed routes.
 */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

/**
 * Permission grant for the Lambda against the shared DynamoDB table.
 *
 * - `read`:      `table.grantReadData(lambda)`
 * - `write`:     `table.grantWriteData(lambda)`
 * - `readwrite`: `table.grantReadWriteData(lambda)`
 *
 * Explicit declaration prevents the common bug of granting read/write when
 * the handler only needs read.
 */
export type RoutePermission = 'read' | 'write' | 'readwrite'

export interface RouteDefinition {
  /**
   * API Gateway path. Path parameters use `{param}` syntax.
   * Example: `/api/v1/accounts/{account_id}/balance`
   */
  readonly path: string

  /**
   * HTTP method for the route.
   */
  readonly method: HttpMethod

  /**
   * Lambda handler identifier in `module.path:function_name` notation
   * (Python convention). Example:
   *   'transactionify.handlers.api.rest.account.create.main.handler'
   */
  readonly handler: string

  /**
   * Permission this handler needs against the DynamoDB table. The Construct
   * grants exactly this — never more.
   */
  readonly permission: RoutePermission

  /**
   * Whether this route requires the API's authorizer. Defaults to `true`
   * (Golden Path: authenticated by default). Set to `false` only for
   * public endpoints (health checks, OpenAPI spec serving).
   */
  readonly requiresAuth?: boolean

  /**
   * Per-route override for Lambda memory size (MB). The Construct applies
   * a sane default (256 MB) when omitted.
   */
  readonly memorySize?: number

  /**
   * Per-route override for Lambda timeout (seconds). The Construct applies
   * a sane default (10 s) when omitted.
   */
  readonly timeoutSeconds?: number
}
