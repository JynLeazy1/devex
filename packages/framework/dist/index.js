"use strict";
// @devex/framework — public entry point.
//
// Re-exports the framework's four public surfaces:
//
//   - constructs/  L3 + L2 CDK Constructs (PythonLambdaApi, PythonLambdaRoute)
//                   plus the GoldenPathTagsAspect that enforces FinOps tagging.
//   - workflows/   Type-safe `NormalJob` factories that compose the PR pipeline
//                   (workIdValidationJob, smallTestsJob, contractValidationJob,
//                    cdkSynthJob, doraSummaryJob).
//   - profiles/    The polyglot StackProfile discriminated union — Python,
//                   Go, TypeScript, and Clojure variants.
//   - contracts/   Zod schemas shared in lockstep with the Python CLI:
//                   DoraEvent + AuditEvent, both extending BaseEvent.
//
// Skeleton state (D2): all types and class signatures exist. Construct and
// factory bodies throw `not implemented in the PoC skeleton`. Implementation
// lands in D3.
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FRAMEWORK_VERSION = void 0;
__exportStar(require("./constructs"), exports);
__exportStar(require("./workflows"), exports);
__exportStar(require("./profiles"), exports);
__exportStar(require("./contracts"), exports);
exports.FRAMEWORK_VERSION = '0.1.0';
