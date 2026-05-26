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
    readonly 'finops:Project': string;
    readonly 'finops:Service': string;
    readonly 'finops:Team': string;
    readonly 'finops:Owner': string;
    readonly 'project-type': ProjectType;
}
/**
 * Coarse classification used by org-wide cost dashboards. Add new values via
 * inner-source PR if needed.
 */
export type ProjectType = 'api' | 'worker' | 'job' | 'data-pipeline' | 'static-site';
/**
 * The set of required tag keys, as a runtime-iterable constant. Used by the
 * enforcing CDK Aspect to know what to check for.
 */
export declare const REQUIRED_TAG_KEYS: readonly ["finops:Project", "finops:Service", "finops:Team", "finops:Owner", "project-type"];
export type RequiredTagKey = (typeof REQUIRED_TAG_KEYS)[number];
//# sourceMappingURL=golden-path-tags.d.ts.map