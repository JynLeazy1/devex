// Workflow factories — typed building blocks consumers compose into their
// own `.wac.ts` files to generate `.github/workflows/*.yml`.
//
// The Golden Path PR pipeline composes these five jobs in this order:
//
//   1. workIdValidationJob   (pre-flight; everything else `needs` it)
//   2. smallTestsJob          (unit + property-based + coverage)
//   3. contractValidationJob  (schemathesis vs openapi.yaml)
//   4. cdkSynthJob            (compile + GoldenPathTagsAspect enforcement)
//   5. doraSummaryJob         (always runs; emits DORA + audit events)
//
// Consumer usage (in their service repo):
//
//   // workflows/pr.wac.ts
//   import { Workflow } from '@github-actions-workflow-ts/lib'
//   import {
//     workIdValidationJob, smallTestsJob, contractValidationJob,
//     cdkSynthJob, doraSummaryJob,
//   } from '@devex/framework/workflows'
//   import { profile } from '../devex.profile'
//
//   export const pr = new Workflow('pr', {
//     name: 'PR Pipeline (Golden Path)',
//     on: { pull_request: { branches: ['main'] } },
//   })
//     .addJob(workIdValidationJob(profile))
//     .addJob(smallTestsJob(profile))
//     .addJob(contractValidationJob(profile))
//     .addJob(cdkSynthJob(profile))
//     .addJob(doraSummaryJob(profile))
//
// Skeleton scope (D2.6): all five throw `Not implemented` until D3. Consumer
// `.wac.ts` files written against this API compile, but `npx gwf build` will
// fail at the first factory invocation with a clear error pointing to D3.

export { workIdValidationJob } from './work-id-validation'
export { smallTestsJob } from './small-tests'
export { contractValidationJob } from './contract-validation'
export { cdkSynthJob } from './cdk-synth'
export { doraSummaryJob } from './dora-summary'
export {
  integrationPromoteJob,
  type IntegrationEnvironment,
} from './integration-promote'
