// Props types for the PoC Constructs.
//
// These are the typed contracts consumers see when they instantiate the
// Construct. Implementation lives in `python-lambda-api.ts` and
// `python-lambda-route.ts` (D2.5).

import type * as apigwv2 from 'aws-cdk-lib/aws-apigatewayv2'
import type * as apigwv2_authorizers from 'aws-cdk-lib/aws-apigatewayv2-authorizers'
import type * as dynamodb from 'aws-cdk-lib/aws-dynamodb'

import type { EnvironmentConfig } from './environment-config'
import type { GoldenPathTagsSeverity } from './golden-path-tags-aspect'
import type { GoldenPathTags } from './golden-path-tags'
import type { RouteDefinition } from './route-definition'

/**
 * Optional configuration for the DynamoDB table that backs the service.
 * If omitted, the Construct creates a standard single-table design
 * (PK + SK string, TTL attribute `ttl`, PAY_PER_REQUEST billing).
 */
export interface TableConfig {
  /**
   * Partition key attribute name. Default: `PK`.
   */
  readonly partitionKeyName?: string

  /**
   * Sort key attribute name. Default: `SK`. Pass `null` for a partition-key-only table.
   */
  readonly sortKeyName?: string | null

  /**
   * TTL attribute name. Default: `ttl`. Pass `null` to disable TTL.
   */
  readonly ttlAttributeName?: string | null
}

/**
 * Props for the top-level Construct that provisions an entire Python Lambda
 * API stack (HTTP API + DynamoDB + authorizer Lambda + one Lambda per route).
 */
export interface PythonLambdaApiProps {
  /**
   * Service slug. Used for resource naming. Must match
   * `StackProfile.serviceName` for the deploying repo.
   */
  readonly serviceName: string

  /**
   * Required FinOps tags. Enforced by `GoldenPathTagsAspect` — missing keys
   * fail `cdk synth`.
   */
  readonly tags: GoldenPathTags

  /**
   * Which environment this stack instance targets.
   */
  readonly environment: EnvironmentConfig

  /**
   * Path to the Python source directory, relative to the CDK app's CWD.
   * Mirrors transactionify's pattern of one shared bundle for all Lambdas.
   * Example: `'src/python'`
   */
  readonly sourcePath: string

  /**
   * Python runtime. Golden Path enforces a modern interpreter.
   */
  readonly runtime: '3.11' | '3.12'

  /**
   * Lambda handler for the authorizer (used by every authenticated route).
   * Set to `null` to deploy without an authorizer (public API).
   */
  readonly authorizerHandler: string | null

  /**
   * The endpoints to provision.
   */
  readonly routes: readonly RouteDefinition[]

  /**
   * Optional DynamoDB table customization. Defaults follow the
   * single-table pattern from transactionify.
   */
  readonly tableConfig?: TableConfig

  /**
   * Severity for the `GoldenPathTagsAspect`. When omitted, the Construct uses
   * the Aspect's default (`'warning'`). Consumers typically thread
   * `profile.tagSeverity` through from their `devex.profile.ts`.
   */
  readonly tagSeverity?: GoldenPathTagsSeverity
}

/**
 * Props for the per-route sub-Construct. Consumers don't normally instantiate
 * this directly — `PythonLambdaApi` creates one per `RouteDefinition`. Exposed
 * for advanced cases (e.g., adding a route to an externally-managed HTTP API).
 */
export interface PythonLambdaRouteProps {
  /**
   * The HTTP API to attach the route to. Uses the concrete `HttpApi` class
   * (not `IHttpApi`) because `addRoutes()` lives on the class, not the
   * interface. Consumers using `HttpApi.fromHttpApiAttributes(...)` get back
   * an `HttpApi` instance, so this restriction is non-blocking in practice.
   */
  readonly httpApi: apigwv2.HttpApi

  /**
   * The DynamoDB table to grant access against. Uses the interface — `ITable`
   * is broadly compatible with both newly-created and imported tables.
   */
  readonly table: dynamodb.ITable

  /**
   * Source path passed to `lambda.Code.fromAsset(...)`.
   */
  readonly sourcePath: string

  /**
   * Python runtime version, propagated from the parent Construct.
   */
  readonly runtime: '3.11' | '3.12'

  /**
   * The endpoint declaration.
   */
  readonly route: RouteDefinition

  /**
   * Authorizer to attach when `route.requiresAuth` is not `false`.
   * Pass `null` to skip authorization for this route.
   */
  readonly authorizer: apigwv2_authorizers.HttpLambdaAuthorizer | null
}
