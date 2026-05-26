/**
 * Fields present on every StackProfile, regardless of language.
 *
 * These are the cross-cutting facts a workflow generator needs to know about
 * any service, in any language.
 */
export interface BaseProfile {
    /**
     * Discriminator. The framework switches on this field everywhere a
     * language-specific decision is made.
     */
    readonly language: 'python' | 'go' | 'typescript' | 'clojure';
    /**
     * Slug of the service. Used for resource naming, CDK stack IDs, audit log
     * `team` field. Lowercase + hyphens only.
     */
    readonly serviceName: string;
    /**
     * Owning team slug. Mirrors `tags.finops:Team`. Used as `team` in DORA and
     * audit events.
     */
    readonly team: string;
    /**
     * Repository URL of the service. Used as `repo` in DORA and audit events.
     */
    readonly repoUrl: string;
    /**
     * Regex source string for Work IDs. Validated by `devex validate` and by
     * the `workIdValidationJob` workflow factory.
     *
     * Examples:
     *   - 'FIN-\\d+'        (Jira project FIN)
     *   - '[A-Z]+-\\d+'    (any uppercase prefix + digits — generic default)
     */
    readonly workIdPattern: string;
    /**
     * AWS region where the service deploys. CDK uses this; workflows pass it
     * as the `AWS_REGION` env var.
     */
    readonly awsRegion: string;
    /**
     * FinOps-tag enforcement severity, threaded into `GoldenPathTagsAspect`
     * by the Construct. Optional — defaults to `'warning'` (graduated rollout).
     * Teams ready for strict enforcement set `'error'` and `cdk synth` blocks
     * on missing tags. Scaffolded by `devex init --strict-tags`.
     */
    readonly tagSeverity?: 'warning' | 'error';
}
//# sourceMappingURL=_base.d.ts.map