import { z } from 'zod';
/**
 * Stages emitted across the Golden Path pipelines. The first 5 belong to the
 * PR Pipeline (PoC scope). The last 5 belong to the Integration Pipeline
 * (designed, deferred to roadmap — see ADR-001 §4).
 */
export declare const StageSchema: z.ZodEnum<{
    "work-id-validation": "work-id-validation";
    "small-tests": "small-tests";
    "contract-validation": "contract-validation";
    "cdk-synth": "cdk-synth";
    "dora-summary": "dora-summary";
    build: "build";
    "sandbox-deploy": "sandbox-deploy";
    "staging-deploy": "staging-deploy";
    "prod-deploy": "prod-deploy";
    "smoke-tests": "smoke-tests";
}>;
export type Stage = z.infer<typeof StageSchema>;
/**
 * Terminal status of a pipeline stage.
 *
 * - `started`: stage began (paired with a later `success`/`failure`)
 * - `success`: stage completed without errors
 * - `failure`: stage completed with an error (counts toward CFR)
 * - `skipped`: stage was conditional and did not run
 * - `cancelled`: stage was interrupted (e.g., new commit pushed)
 */
export declare const StatusSchema: z.ZodEnum<{
    started: "started";
    success: "success";
    failure: "failure";
    skipped: "skipped";
    cancelled: "cancelled";
}>;
export type Status = z.infer<typeof StatusSchema>;
/**
 * DORA event — one per stage transition.
 *
 * Designed so that downstream consumers (the org's DORA dashboard) can compute
 * the four DORA metrics by aggregating these events:
 *
 * - **Deployment Frequency**: count of `stage=prod-deploy, status=success` per period
 * - **Lead Time for Changes**: `timestamp` of `prod-deploy success` minus `timestamp`
 *   of first commit (same `work_id`)
 * - **Change Failure Rate**: ratio of `prod-deploy failure` to total `prod-deploy`
 * - **MTTR**: time from `prod-deploy failure` to next `prod-deploy success` for
 *   the same `work_id` (or the rollback's work_id)
 */
export declare const DoraEventSchema: z.ZodObject<{
    schema_version: z.ZodLiteral<"1.0">;
    work_id: z.ZodString;
    team: z.ZodString;
    repo: z.ZodURL;
    actor: z.ZodString;
    timestamp: z.ZodString;
    git_sha: z.ZodString;
    framework_version: z.ZodString;
    stage: z.ZodEnum<{
        "work-id-validation": "work-id-validation";
        "small-tests": "small-tests";
        "contract-validation": "contract-validation";
        "cdk-synth": "cdk-synth";
        "dora-summary": "dora-summary";
        build: "build";
        "sandbox-deploy": "sandbox-deploy";
        "staging-deploy": "staging-deploy";
        "prod-deploy": "prod-deploy";
        "smoke-tests": "smoke-tests";
    }>;
    status: z.ZodEnum<{
        started: "started";
        success: "success";
        failure: "failure";
        skipped: "skipped";
        cancelled: "cancelled";
    }>;
    duration_ms: z.ZodNullable<z.ZodNumber>;
    reason: z.ZodNullable<z.ZodString>;
}, z.core.$strip>;
export type DoraEvent = z.infer<typeof DoraEventSchema>;
//# sourceMappingURL=dora.d.ts.map