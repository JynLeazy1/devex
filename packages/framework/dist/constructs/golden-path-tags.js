"use strict";
// Golden Path FinOps tags — required on every resource the framework provisions.
//
// Inspired by what `transactionify`'s monolithic stack hardcodes inline. The
// framework lifts these into a typed contract enforced via a CDK Aspect at
// `cdk synth` time, so a missing tag fails the synthesis (shift-left).
//
// Tag keys use the `finops:` prefix to match common multi-cloud cost allocation
// conventions (AWS Cost Allocation Tags + GCP labels + Azure tags all support
// the `prefix:value` convention).
Object.defineProperty(exports, "__esModule", { value: true });
exports.REQUIRED_TAG_KEYS = void 0;
/**
 * The set of required tag keys, as a runtime-iterable constant. Used by the
 * enforcing CDK Aspect to know what to check for.
 */
exports.REQUIRED_TAG_KEYS = [
    'finops:Project',
    'finops:Service',
    'finops:Team',
    'finops:Owner',
    'project-type',
];
