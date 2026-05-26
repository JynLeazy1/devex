# Glossary

Domain terms used throughout the codebase. When an AI assistant encounters
these, treat them with the specific meaning here, not the generic one.

## Golden Path

The opinionated, recommended way to build/deploy/operate a service in this
org. Encoded as the combination of `@devex/framework` (CDK + workflows) and
`devex-cli` (validation + scaffolding). Adopting the Golden Path = adopting
both products.

## Stack Profile

A typed object describing a team's stack language, runtime, package manager,
and pipeline conventions. Defined as a TypeScript discriminated union in
`packages/framework/src/profiles/`. Today: `PythonLambdaProfile` fully
implemented; `GoLambdaProfile`, `TypescriptLambdaProfile`, `ClojureLambdaProfile`
typed but workflow factory bodies throw `out of PoC scope`.

## Work ID

A project-wide identifier (e.g., `FIN-123`, `PAY-9876`) propagated through
branch names, commit messages, and PR titles for end-to-end traceability.
Default regex pattern: `[A-Z][A-Z0-9]*-\d+`. Org-specific via
`DEVEX_WORK_ID_PATTERN` env var or `--pattern` flag.

## DORA

DevOps Research and Assessment — the four metrics:
- Deployment Frequency
- Lead Time for Changes
- Change Failure Rate (CFR)
- Mean Time to Restore (MTTR)

The framework emits `DoraEvent` JSON per pipeline stage, intended for an
org-wide collector that computes these metrics.

## DoraEvent / AuditEvent

The two structured event schemas defined in both TypeScript (Zod) and
Python (Pydantic). Lockstep contract: any change applies to both
languages in the same PR. See `packages/framework/src/contracts/README.md`.

## GoldenPathTagsAspect

A CDK Aspect that validates every taggable resource carries the 5 required
FinOps tags (`finops:Project`, `finops:Service`, `finops:Team`, `finops:Owner`,
`project-type`). Configurable severity: `'warning'` (default — surfaces at
synth time but doesn't block) or `'error'` (blocks `cdk synth`).

## Inner-Source

Open-source-style contribution model **within the org**. Any team can
propose changes to `devex` via PR; the platform team reviews but does not
gatekeep. Two-reviewer rule + CODEOWNERS rotation. See `CONTRIBUTING.md`.

## Pipeline stages

The 5 jobs that compose the PR pipeline (in execution order):

| Stage name | Validates |
|---|---|
| `work-id-validation` | Branch + commits + PR title carry Work IDs |
| `small-tests` | Unit + property-based tests + coverage threshold |
| `contract-validation` | OpenAPI spec is well-formed (static validation) |
| `cdk-synth` | CDK code synthesizes (triggers `GoldenPathTagsAspect`) |
| `dora-summary` | Emits the DoraEvent (always runs, even on upstream failure) |

## L1 / L2 / L3 Constructs (CDK)

CDK abstraction levels:

- **L1** — auto-generated CloudFormation wrappers (`CfnFunction`, `CfnTable`)
- **L2** — idiomatic resource wrappers with sensible defaults (`lambda.Function`,
  `dynamodb.Table`)
- **L3** — opinionated patterns combining multiple L2s (`PythonLambdaApi` is L3,
  `PythonLambdaRoute` is L2)

The Golden Path framework provides L3 patterns; L2 escape hatches are
documented in `packages/framework/README.md`.

## EnvironmentConfig

The typed object passed to `PythonLambdaApi` to declare which environment
the stack instance targets (sandbox / staging / prod) and what monitoring
tier to use. Read by the Construct; not auto-detected from CDK context
(deliberate — keeps Constructs testable).

## RouteDefinition

Declarative shape for one HTTP endpoint backed by a Python Lambda. Fields:
`path`, `method`, `handler`, `permission` (`'read'|'write'|'readwrite'`),
optional `requiresAuth`, `memorySize`, `timeoutSeconds`. Consumed by
`PythonLambdaApi.props.routes[]`.

## `.wac.ts`

File extension for source workflows that compile to YAML via
`@github-actions-workflow-ts`. Must export each `Workflow` instance.
Generated YAML is committed under `.github/workflows/` with a
"do-not-modify" header.

## `prepare-commit-msg` / `pre-push`

The two Git hooks the framework manages:
- `pre-push` — runs `devex validate --no-commits` before allowing a push
- `prepare-commit-msg` — opt-in via `--auto-inject`; prepends the branch's
  Work ID to commit messages that lack one

Both are installed with the marker comment `# Managed by devex` so they
can be identified and replaced/removed without affecting custom hooks.

## TODO(post-PoC)

Convention used for inline TODOs that describe future improvements with
specific direction. Distinguished from generic `TODO` (which we avoid).
These are tracked via code search, not a separate TODO.md.

## Out of PoC scope

A specific kind of "deferred" — items that are typed-contracted but not
implemented in the PoC because (a) PoC scope was bounded deliberately and
(b) inner-source contributions are expected to fill them in. Examples:
the Go / TypeScript / Clojure branches of `smallTestsJob`.
