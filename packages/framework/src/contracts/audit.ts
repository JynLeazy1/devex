// SOC 2 audit event schema — emitted whenever a Golden Path action takes place
// that an auditor needs to trace (who/what/when/why).
//
// The Python CLI's equivalent lives at `packages/cli/src/devex/contracts/audit.py`.
// Keys and types MUST stay in lockstep.

import { z } from 'zod'

import { BaseEventSchema } from './_base'

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
export const AuditActionSchema = z.enum([
  'commit-pushed',
  'pr-opened',
  'pr-merged',
  'pipeline-started',
  'pipeline-completed',
  'deploy-initiated',
  'deploy-completed',
  'config-changed',
])
export type AuditAction = z.infer<typeof AuditActionSchema>

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
export const AuditEventSchema = BaseEventSchema.extend({
  action: AuditActionSchema,
  /**
   * What was acted upon — environment name, resource ARN, PR number, etc.
   * Free-form string but should be unambiguous in context of `action`.
   */
  target: z.string().min(1, 'target must not be empty'),
  /**
   * Why the action happened. Required by SOC 2 — every audit record needs a
   * traceable justification, even if it's automatically generated.
   */
  reason: z.string().min(1, 'reason must not be empty'),
})

export type AuditEvent = z.infer<typeof AuditEventSchema>
