// DORA event schema — emitted at each pipeline stage to feed Deployment
// Frequency, Lead Time for Changes, Change Failure Rate, and MTTR dashboards.
//
// The Python CLI's equivalent lives at `packages/cli/src/devex/contracts/dora.py`.
// Keys and types MUST stay in lockstep.

import { z } from 'zod'

import { BaseEventSchema } from './_base'

/**
 * Stages emitted across the Golden Path pipelines. The first 5 belong to the
 * PR Pipeline (PoC scope). The last 5 belong to the Integration Pipeline
 * (designed, deferred to roadmap — see ADR-001 §4).
 */
export const StageSchema = z.enum([
  // PR Pipeline
  'work-id-validation',
  'small-tests',
  'contract-validation',
  'cdk-synth',
  'dora-summary',
  // Integration Pipeline (future)
  'build',
  'sandbox-deploy',
  'staging-deploy',
  'prod-deploy',
  'smoke-tests',
])
export type Stage = z.infer<typeof StageSchema>

/**
 * Terminal status of a pipeline stage.
 *
 * - `started`: stage began (paired with a later `success`/`failure`)
 * - `success`: stage completed without errors
 * - `failure`: stage completed with an error (counts toward CFR)
 * - `skipped`: stage was conditional and did not run
 * - `cancelled`: stage was interrupted (e.g., new commit pushed)
 */
export const StatusSchema = z.enum([
  'started',
  'success',
  'failure',
  'skipped',
  'cancelled',
])
export type Status = z.infer<typeof StatusSchema>

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
export const DoraEventSchema = BaseEventSchema.extend({
  stage: StageSchema,
  status: StatusSchema,
  /**
   * Duration of the stage in milliseconds. Null for `started` events (the
   * paired `success`/`failure` event carries the final duration).
   */
  duration_ms: z.number().int().nonnegative().nullable(),
  /**
   * Free-text reason. Required for non-success outcomes (`failure`, `skipped`,
   * `cancelled`); null for `started` and `success`.
   */
  reason: z.string().nullable(),
})

export type DoraEvent = z.infer<typeof DoraEventSchema>
