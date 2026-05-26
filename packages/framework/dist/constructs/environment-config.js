"use strict";
// EnvironmentConfig — the typed contract that consumer stacks pass to
// PythonLambdaApi to declare which environment they're deploying to.
//
// The framework does NOT read AWS account/region from CDK context. Consumers
// pass them explicitly via this object. This keeps the Constructs testable
// (no implicit state) and forces the consumer to be deliberate about
// environment configuration.
Object.defineProperty(exports, "__esModule", { value: true });
