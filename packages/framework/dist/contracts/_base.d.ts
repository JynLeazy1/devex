import { z } from 'zod';
/**
 * Schema version of all framework events. Bump this when introducing a
 * breaking change to the event shape — consumers (DORA dashboards, audit log
 * stores) discriminate on this field for migration.
 */
export declare const SCHEMA_VERSION: "1.0";
/**
 * Fields present on every framework event.
 *
 * - `schema_version`: discriminator for migration
 * - `work_id`: cross-cutting traceability (Jira/Linear ticket)
 * - `team`: owning team slug (matches `tags.finops:Team`)
 * - `repo`: repository URL of the service
 * - `actor`: who triggered the event (usually GitHub username or service account)
 * - `timestamp`: when the event occurred (UTC ISO-8601)
 * - `git_sha`: commit SHA being acted upon
 * - `framework_version`: version of `@devex/framework` that emitted the event
 */
export declare const BaseEventSchema: z.ZodObject<{
    schema_version: z.ZodLiteral<"1.0">;
    work_id: z.ZodString;
    team: z.ZodString;
    repo: z.ZodURL;
    actor: z.ZodString;
    timestamp: z.ZodString;
    git_sha: z.ZodString;
    framework_version: z.ZodString;
}, z.core.$strip>;
export type BaseEvent = z.infer<typeof BaseEventSchema>;
//# sourceMappingURL=_base.d.ts.map