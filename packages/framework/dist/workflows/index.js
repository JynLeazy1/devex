"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.integrationPromoteJob = exports.doraSummaryJob = exports.cdkSynthJob = exports.contractValidationJob = exports.smallTestsJob = exports.workIdValidationJob = void 0;
var work_id_validation_1 = require("./work-id-validation");
Object.defineProperty(exports, "workIdValidationJob", { enumerable: true, get: function () { return work_id_validation_1.workIdValidationJob; } });
var small_tests_1 = require("./small-tests");
Object.defineProperty(exports, "smallTestsJob", { enumerable: true, get: function () { return small_tests_1.smallTestsJob; } });
var contract_validation_1 = require("./contract-validation");
Object.defineProperty(exports, "contractValidationJob", { enumerable: true, get: function () { return contract_validation_1.contractValidationJob; } });
var cdk_synth_1 = require("./cdk-synth");
Object.defineProperty(exports, "cdkSynthJob", { enumerable: true, get: function () { return cdk_synth_1.cdkSynthJob; } });
var dora_summary_1 = require("./dora-summary");
Object.defineProperty(exports, "doraSummaryJob", { enumerable: true, get: function () { return dora_summary_1.doraSummaryJob; } });
var integration_promote_1 = require("./integration-promote");
Object.defineProperty(exports, "integrationPromoteJob", { enumerable: true, get: function () { return integration_promote_1.integrationPromoteJob; } });
