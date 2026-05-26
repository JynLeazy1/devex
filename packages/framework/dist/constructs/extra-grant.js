"use strict";
// ExtraGrant — declarative shape for a Lambda that needs DynamoDB access
// but is NOT exposed as an HTTP API route.
//
// Use cases the typed prop covers:
//   - Provisioning workers invoked via SDK (e.g., from a CLI tool that
//     registers a new tenant by writing the initial DynamoDB records).
//   - Scheduled jobs triggered by EventBridge (cron, periodic cleanups).
//   - Internal callers reached via Lambda invoke, not HTTP.
//
// The consumer creates the EventBridge rule / SQS subscription / etc.
// AFTER instantiating `PythonLambdaApi` — the L3 only owns the Lambda's
// creation and table grant. Consumers reach the Lambda via
// `api.extraGrantLambdas.get(grant.id)`.
Object.defineProperty(exports, "__esModule", { value: true });
