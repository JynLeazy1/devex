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
     * Regex source string for Work IDs. Validated by `devex validate` (Python `re`),
     * by `new RegExp(...)` in workflow generators (JS), AND by `grep -qE` in the
     * generated bash workflow YAML (POSIX ERE). Must therefore be **POSIX ERE
     * compatible**.
     *
     * **Avoid**: `\d`, `\w`, `\s`, `\b` — only supported in JS/Python regex, treated
     * as literal characters by POSIX ERE. Real-world consequence: a pattern with
     * `\d+` matches `FIN-123` in `devex validate` (passes locally) but the CI
     * `workIdValidationJob` rejects it. We hit this on PR #2 (FIN-124).
     *
     * **Use**: POSIX character classes — `[0-9]`, `[A-Za-z0-9]`, `[[:space:]]`.
     *
     * See: `DEFAULT_WORK_ID_PATTERN` for the framework-supplied safe default.
     *
     * Examples (POSIX-safe):
     *   - 'FIN-[0-9]+'         (Jira project FIN)
     *   - '[A-Z][A-Z0-9]*-[0-9]+'  (generic — matches DEFAULT_WORK_ID_PATTERN)
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
/**
 * Framework-supplied default Work ID regex. **POSIX ERE compatible** — works
 * in:
 *   - JavaScript `new RegExp(DEFAULT_WORK_ID_PATTERN)`
 *   - Python `re.compile(DEFAULT_WORK_ID_PATTERN)`
 *   - bash `grep -qE "$DEFAULT_WORK_ID_PATTERN"`
 *
 * Matches: any uppercase prefix followed by `-` followed by digits.
 *   - 'FIN-123' ✓
 *   - 'ABC-9'   ✓
 *   - 'fin-123' ✗ (lowercase)
 *   - 'FIN'     ✗ (no dash + digits)
 *
 * Consumers can override `profile.workIdPattern` to be project-specific
 * (e.g., 'FIN-[0-9]+' for a single Jira project) but must stay POSIX-safe.
 */
export declare const DEFAULT_WORK_ID_PATTERN: "[A-Z][A-Z0-9]*-[0-9]+";
//# sourceMappingURL=_base.d.ts.map