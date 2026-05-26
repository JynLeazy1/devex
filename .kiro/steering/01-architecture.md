# Architecture context

## What this project is

`devex` is a **Golden Path ecosystem** for ~10 polyglot engineering teams: a
Python CLI (`devex-cli`) plus a TypeScript framework (`@devex/framework`).
Together they homologate the development lifecycle (Work ID conventions,
CDK Constructs, GitHub Actions pipelines, DORA event emission) without
making the platform team a bottleneck.

The two products are **independently distributable** but share schemas:

- `devex-cli` — installed via `uv tool install` from Git
- `@devex/framework` — installed via `pnpm add` from Git

Both live in this monorepo; a single Git tag releases them atomically.

## Repository tree (relevant paths)

```
packages/cli/                       # Python CLI
  src/devex/
    __main__.py                     # Typer entry; all subcommands wired here
    contracts/                      # Pydantic schemas (DoraEvent, AuditEvent)
    validation/                     # Pure Work ID validators + git layer
    hooks/                          # Git hook installer (pre-push, prepare-commit-msg)
    init/                           # Scaffolding templates + write logic
    dora/                           # DORA event emitter (Pydantic)
  tests/                            # pytest suite; CliRunner integration tests

packages/framework/                 # TypeScript framework
  src/
    constructs/                     # PythonLambdaApi (L3), PythonLambdaRoute (L2),
                                    # GoldenPathTagsAspect (FinOps enforcement)
    workflows/                      # 5 factory functions returning NormalJob
    profiles/                       # StackProfile discriminated union (4 langs)
    contracts/                      # Zod schemas (mirror of Python contracts/)
  tests/                            # Jest; aws-cdk-lib/assertions for Constructs

adr/                                # Design records (ADR-001)
.kiro/steering/                     # This directory
```

## The pipeline contract

The PR pipeline that consumers generate from `pr.wac.ts` runs in this order:

1. **`workIdValidationJob`** — regex-checks branch / commits / PR title
2. **`smallTestsJob`** — language-specific (today: Python only). Coverage upload conditional
3. **`contractValidationJob`** — `openapi-spec-validator` against `profile.openApiPath`
4. **`cdkSynthJob`** — runs `cdk synth`; fires `GoldenPathTagsAspect`
5. **`doraSummaryJob`** — `if: always()`; emits structured `DoraEvent` JSON

Each factory takes a `StackProfile` and returns a `NormalJob`. The consumer
composes them in `workflows/pr.wac.ts`, then `npx gwf build` generates
`.github/workflows/pr.yml`.

## The Constructs contract

`PythonLambdaApi` (L3) provisions an entire AWS service in ~10 lines:
- DynamoDB single-table (PK + SK + TTL)
- API Gateway v2 HTTP API
- Authorizer Lambda (optional, via `authorizerHandler` prop)
- N route Lambdas (one per `RouteDefinition` in `props.routes`)
- FinOps tags via `cdk.Tags.of()` + `GoldenPathTagsAspect` enforcement

`PythonLambdaRoute` (L2) is the per-endpoint Construct, exposed for escape-hatch
scenarios where consumers need to add a single route to an externally-managed
HttpApi.

## Cross-language contract

`DoraEvent` and `AuditEvent` schemas are defined in **TWO** languages:

- TypeScript (Zod) in `packages/framework/src/contracts/`
- Python (Pydantic v2) in `packages/cli/src/devex/contracts/`

These MUST stay in lockstep. Any change to one requires the same change in the
other, in the same PR. Schema changes that are non-additive (rename, remove,
change constraint) bump `SCHEMA_VERSION` (currently `"1.0"`) and require an RFC.

## Design pillars (from ADR-001)

1. **Homologation** — `devex init --team X` produces a working Golden Path in seconds.
2. **Scalability** — Constructs and factories accept override hooks; platform team
   scales sub-linearly via inner-source.
3. **Shift-Left** — IDE → pre-push hook → PR pipeline → branch protection. Each
   layer catches what the previous let through.
4. **Auditability** — DORA events and SOC 2 audit logs use the SAME schema.
   Drift between TS and Python schemas is a compile error.

## What's out of scope (do not propose without an RFC)

- DORA dashboard storage / visualization
- Multi-cloud support (AWS-only)
- Integration Pipeline (sandbox → staging → prod automation; designed in ADR
  §4.4 but deferred)
- Real Go / TypeScript / Clojure `smallTestsJob` branches (typed contracts
  exist; bodies are `out of PoC scope` until inner-source contributions implement)
