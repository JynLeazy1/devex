"use strict";
// Shared base for all framework event schemas.
//
// This file defines the fields that every event (DORA, audit, future) must carry.
// The Python CLI's equivalent lives at `packages/cli/src/devex/contracts/_base.py`
// and MUST keep the same field names and types in lockstep with this file.
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseEventSchema = exports.SCHEMA_VERSION = void 0;
const zod_1 = require("zod");
/**
 * Schema version of all framework events. Bump this when introducing a
 * breaking change to the event shape — consumers (DORA dashboards, audit log
 * stores) discriminate on this field for migration.
 */
exports.SCHEMA_VERSION = '1.0';
/**
 * ISO-8601 datetime with timezone offset. Examples:
 *   '2026-05-23T14:32:11Z'
 *   '2026-05-23T14:32:11+00:00'
 */
const IsoDatetime = zod_1.z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/, 'must be an ISO-8601 datetime with timezone');
/**
 * Git commit SHA (7 to 40 hex chars). Accepts both short and full SHAs.
 */
const GitSha = zod_1.z
    .string()
    .regex(/^[0-9a-f]{7,40}$/, 'must be a 7-40 char hex git SHA');
/**
 * Default Work ID pattern. Validates the GENERAL shape (uppercase letters,
 * dash, digits — e.g. 'FIN-123', 'JIRA-9999'). Org-specific patterns are
 * enforced elsewhere by `devex validate` against the configured regex.
 */
const WorkId = zod_1.z
    .string()
    .regex(/^[A-Z][A-Z0-9]*-\d+$/, "must look like 'PREFIX-123'");
/**
 * Semver string (major.minor.patch with optional prerelease/build).
 */
const Semver = zod_1.z
    .string()
    .regex(/^\d+\.\d+\.\d+(-[0-9A-Za-z-.]+)?(\+[0-9A-Za-z-.]+)?$/, 'must be valid semver');
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
exports.BaseEventSchema = zod_1.z.object({
    schema_version: zod_1.z.literal(exports.SCHEMA_VERSION),
    work_id: WorkId,
    team: zod_1.z.string().min(1, 'team must not be empty'),
    repo: zod_1.z.url('repo must be a valid URL'),
    actor: zod_1.z.string().min(1, 'actor must not be empty'),
    timestamp: IsoDatetime,
    git_sha: GitSha,
    framework_version: Semver,
});
