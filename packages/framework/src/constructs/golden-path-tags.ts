// Golden Path FinOps tags — required on every resource the framework provisions.
//
// Inspired by what `transactionify`'s monolithic stack hardcodes inline. The
// framework lifts these into a typed contract enforced via a CDK Aspect at
// `cdk synth` time, so a missing tag fails the synthesis (shift-left).
//
// Tag keys use the `finops:` prefix to match common multi-cloud cost allocation
// conventions (AWS Cost Allocation Tags + GCP labels + Azure tags all support
// the `prefix:value` convention).

/**
 * The set of tags every Golden Path resource must carry. All keys are required;
 * leaving any out is a hard error at `cdk synth` time.
 *
 * - `finops:Project`: the broad initiative (e.g., 'Transactionify')
 * - `finops:Service`: the specific service within the project (e.g., 'Transactionify API')
 * - `finops:Team`: the owning team slug (matches StackProfile.team and DORA event.team)
 * - `finops:Owner`: a named human or service account responsible (e.g., 'jorge.flores')
 * - `project-type`: a coarse classification used by cost dashboards ('api', 'worker', 'job', ...)
 */
export interface GoldenPathTags {
  readonly 'finops:Project': string
  readonly 'finops:Service': string
  readonly 'finops:Team': string
  readonly 'finops:Owner': string
  readonly 'project-type': ProjectType
}

/**
 * Coarse classification used by org-wide cost dashboards. Add new values via
 * inner-source PR if needed.
 */
export type ProjectType = 'api' | 'worker' | 'job' | 'data-pipeline' | 'static-site'

/**
 * The set of required tag keys, as a runtime-iterable constant. Used by the
 * enforcing CDK Aspect to know what to check for.
 */
export const REQUIRED_TAG_KEYS = [
  'finops:Project',
  'finops:Service',
  'finops:Team',
  'finops:Owner',
  'project-type',
] as const satisfies ReadonlyArray<keyof GoldenPathTags>

export type RequiredTagKey = (typeof REQUIRED_TAG_KEYS)[number]
