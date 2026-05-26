// integrationPromoteJob — Sandbox → Staging → Prod promotion (deferred).
//
// Pipeline position: NOT part of the PR pipeline. Runs from a separate
// `integration.wac.ts` workflow triggered by tag/branch push to `main`.
//
// Designed shape (deferred — see ADR §4 layer 4):
//
//   workflows/integration.wac.ts:
//     const promoteSandbox = integrationPromoteJob(profile, 'sandbox')
//     const promoteStaging = integrationPromoteJob(profile, 'staging').needs([promoteSandbox])
//     const promoteProd    = integrationPromoteJob(profile, 'prod').needs([promoteStaging])
//
// Per-environment expected behavior (when implemented):
//   1. Checkout, setup-uv (mirrors small-tests)
//   2. `cdk deploy ${profile.serviceName}-${env}` with environment-specific
//      AWS creds via OIDC (no long-lived secrets).
//   3. Smoke test against the deployed endpoint (HTTP 200 on a health route).
//   4. Emit DoraEvent `stage='deploy', status='success'|'failure'` and
//      AuditEvent `action='deploy-completed'` for SOC 2.
//   5. Manual approval gate before `prod` (GitHub Actions `environment:` config).
//
// This function exists so consumers can already type-check an
// `integration.wac.ts` file written against the documented API. The factory
// itself throws `out of PoC scope`; implementation lands post-PoC.

import { NormalJob } from '@github-actions-workflow-ts/lib'

import type { StackProfile } from '../profiles'

export type IntegrationEnvironment = 'sandbox' | 'staging' | 'prod'

const OUT_OF_POC_SCOPE = (env: IntegrationEnvironment): string =>
  `integrationPromoteJob('${env}'): Integration Pipeline (Sandbox → Staging → Prod ` +
  'promotion) is designed but out of the PoC scope — see ADR §4 layer 4 and the ' +
  'comment header of this file for the implementation contract.'

export function integrationPromoteJob(
  _profile: StackProfile,
  env: IntegrationEnvironment,
): NormalJob {
  throw new Error(OUT_OF_POC_SCOPE(env))
}
