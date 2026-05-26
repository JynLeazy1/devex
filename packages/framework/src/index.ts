// @devex/framework — public entry point.
//
// Re-exports the framework's four public surfaces:
//
//   - constructs/  L3 + L2 CDK Constructs (PythonLambdaApi, PythonLambdaRoute)
//                   plus the GoldenPathTagsAspect that enforces FinOps tagging.
//   - workflows/   Type-safe `NormalJob` factories that compose the PR pipeline
//                   (workIdValidationJob, smallTestsJob, contractValidationJob,
//                    cdkSynthJob, doraSummaryJob).
//   - profiles/    The polyglot StackProfile discriminated union — Python,
//                   Go, TypeScript, and Clojure variants.
//   - contracts/   Zod schemas shared in lockstep with the Python CLI:
//                   DoraEvent + AuditEvent, both extending BaseEvent.
//
// Skeleton state (D2): all types and class signatures exist. Construct and
// factory bodies throw `not implemented in the PoC skeleton`. Implementation
// lands in D3.

export * from './constructs'
export * from './workflows'
export * from './profiles'
export * from './contracts'

export const FRAMEWORK_VERSION = '0.1.0'
