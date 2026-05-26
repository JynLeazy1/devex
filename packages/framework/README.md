# @devex/framework

> The platform-consumed component of the [devex Golden Path ecosystem](../../README.md).

A TypeScript framework distributed via `pnpm` that provides typed AWS CDK Constructs, GitHub Actions workflow factories, and shared schemas for DORA telemetry and audit logging.

---

## Install

```bash
pnpm add "github:<user>/devex#path:/packages/framework"
```

Pin to a version:

```bash
pnpm add "github:<user>/devex#v0.1.0&path:/packages/framework"
```

---

## What's inside

| Module | Exports | Purpose |
|---|---|---|
| `@devex/framework` (root) | `PythonLambdaApi`, `PythonLambdaRoute`, `GoldenPathTags` | CDK Constructs (L3) for the `python-lambda-api` profile |
| `@devex/framework/workflows` | `smallTestsJob`, `contractValidationJob`, `cdkSynthJob`, `workIdValidationJob`, `doraSummaryJob` | Type-safe `NormalJob` factories for the PR pipeline |
| `@devex/framework/profiles` | `StackProfile` (discriminated union), per-language profile types | The polyglot abstraction |
| `@devex/framework/contracts` | `DoraEvent`, `AuditEvent` schemas | Shared with the Python CLI |

---

## Usage example

### In your CDK stack (`lib/your-stack.ts`)

```typescript
import { PythonLambdaApi } from '@devex/framework'

export class YourStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props)

    new PythonLambdaApi(this, 'Api', {
      serviceName: 'your-service',
      tags: { /* FinOps tags — enforced */ },
      environment: { stage: 'sandbox', /* ... */ },
      routes: [
        { path: '/api/v1/items', method: 'GET', handler: '...', permission: 'read' },
      ],
    })
  }
}
```

### In your CI workflow (`workflows/pr.wac.ts`)

```typescript
import { Workflow } from '@github-actions-workflow-ts/lib'
import { smallTestsJob, contractValidationJob, cdkSynthJob } from '@devex/framework/workflows'
import { profile } from '../devex.profile'

export const pr = new Workflow('pr', {
  name: 'PR Pipeline',
  on: { pull_request: { branches: ['main'] } },
})
  .addJob(smallTestsJob(profile))
  .addJob(contractValidationJob(profile))
  .addJob(cdkSynthJob(profile))
```

Then run `npx gwf build` to generate `.github/workflows/pr.yml`.

---

## Development

```bash
cd packages/framework
pnpm install
pnpm build         # tsc → dist/
pnpm test          # jest
pnpm typecheck     # tsc --noEmit
```

---

## Distribution

This package is distributed **only** via Git (not published to npm in PoC stage). The `prepare` lifecycle script compiles TypeScript to `dist/` automatically when consumers install from Git, so they do not need TypeScript locally.
