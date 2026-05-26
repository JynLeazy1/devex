import { z } from 'zod';
/**
 * Actions worth recording for compliance review.
 *
 * - `commit-pushed`: a commit landed on a Golden Path repo (pre-push validation passed)
 * - `pr-opened`: PR was opened on a Golden Path branch
 * - `pr-merged`: PR was merged after the two-reviewer rule
 * - `pipeline-started` / `pipeline-completed`: a workflow run boundary
 * - `deploy-initiated` / `deploy-completed`: a deployment to any environment
 * - `config-changed`: the team's `devex.profile.ts` or workflow files changed
 */
export declare const AuditActionSchema: z.ZodEnum<{
    "commit-pushed": "commit-pushed";
    "pr-opened": "pr-opened";
    "pr-merged": "pr-merged";
    "pipeline-started": "pipeline-started";
    "pipeline-completed": "pipeline-completed";
    "deploy-initiated": "deploy-initiated";
    "deploy-completed": "deploy-completed";
    "config-changed": "config-changed";
}>;
export type AuditAction = z.infer<typeof AuditActionSchema>;
/**
 * Audit event — the SOC 2 "who/what/when/why" record.
 *
 * Maps to the four audit pillars as follows:
 *
 * - **Who**:  `actor` (from BaseEvent)
 * - **What**: `action` + `target` (e.g. action='deploy-completed', target='prod')
 * - **When**: `timestamp` (from BaseEvent)
 * - **Why**:  `reason` (free-text justification)
 *
 * `reason` is mandatory and non-empty — the auditor must be able to answer
 * "why did this happen" for every record. For automated events, the system
 * supplies a justification (e.g., 'PR #123 merged by two approvers').
 */
export declare const AuditEventSchema: z.ZodObject<{
    schema_version: z.ZodLiteral<"1.0">;
    work_id: z.ZodString;
    team: z.ZodString;
    repo: z.ZodURL;
    actor: z.ZodString;
    timestamp: z.ZodString;
    git_sha: z.ZodString;
    framework_version: z.ZodString;
    action: z.ZodEnum<{
        "commit-pushed": "commit-pushed";
        "pr-opened": "pr-opened";
        "pr-merged": "pr-merged";
        "pipeline-started": "pipeline-started";
        "pipeline-completed": "pipeline-completed";
        "deploy-initiated": "deploy-initiated";
        "deploy-completed": "deploy-completed";
        "config-changed": "config-changed";
    }>;
    target: z.ZodString;
    reason: z.ZodString;
}, z.core.$strip>;
export type AuditEvent = z.infer<typeof AuditEventSchema>;
//# sourceMappingURL=audit.d.ts.map