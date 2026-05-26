// Public entry point for Constructs and their type contracts.
//
// Implementation of the actual Constructs is added incrementally:
//   D2.5 — class skeletons (this exports them once they exist)
//   D3   — full implementation
//
// What's exported now: only the types/interfaces consumers need to declare
// their props. Construct classes are added below as they land.

export {
  REQUIRED_TAG_KEYS,
  type GoldenPathTags,
  type ProjectType,
  type RequiredTagKey,
} from './golden-path-tags'

export type {
  EnvironmentConfig,
  Stage as EnvironmentStage,
  MonitoringTier,
} from './environment-config'

export type {
  RouteDefinition,
  HttpMethod,
  RoutePermission,
} from './route-definition'

export type {
  PythonLambdaApiProps,
  PythonLambdaRouteProps,
  TableConfig,
} from './props'

// Construct classes — skeleton in D2.5, full implementation in D3
export { PythonLambdaApi } from './python-lambda-api'
export { PythonLambdaRoute } from './python-lambda-route'
export { GoldenPathTagsAspect } from './golden-path-tags-aspect'
