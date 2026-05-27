# ADR-001: DevEx Golden Path Ecosystem

> **Status:** Final · **Author:** Jorge Flores · **Date:** 2026-05-26
>
> **Decision.** Build a polyglot Golden Path as two independently distributable packages — `devex-cli` (Python, `uv tool install`) and `@devex/framework` (TypeScript, `pnpm add`) — homologating the lifecycle across 10+ teams without putting the platform team in the critical path.
>
> **Context.** Org scaling from a handful of teams to 10+. DORA metrics are not comparable across teams. SOC 2 audit is painful because each team owns CI/CD differently. The current platform team is a bottleneck for every CI/CD change.

## 1. Architecture overview

> The full architecture diagram lives in the project [README](../README.md#architecture-at-a-glance).

**Key properties.** Two products with separate versioning, install commands, and consumers — coupled only by shared schemas (DORA event, Work ID regex, audit log) defined once in the monorepo and consumed by both. A single Git tag releases CLI + Framework atomically; cross-cutting changes are one PR. The `StackProfile` discriminated union (`python-lambda-api`, `go-lambda-api`, …) is the only place a language is named — adding Go means one new profile plus stub implementations, **not** a framework fork. DORA and audit events use a standardized schema; the framework defines the contract, the org's existing pipelines define storage.

## 2. Homologation

Adoption is engineered, not requested.

| Lever                | Mechanism |
|----------------------|-----------|
| **Lower the cost**   | `devex init` scaffolds the entire Golden Path in one command (workflows, lint configs, hooks, branch protection) and auto-detects `repo-url` from `git remote` plus `service-name` from the working directory — zero required flags. Time-to-first-green-PR drops from days to under 10 minutes. |
| **Self-enforce**     | Four checkpoints fire before the platform team is involved: (1) IDE lint/format/type-check on save; (2) pre-push hook calls `devex validate` plus optional `devex check` for test/lint; (3) generated PR pipeline re-runs validation, contract checks, and `cdk synth` with FinOps-tag enforcement; (4) branch protection blocks merges without required status checks. **Checkpoint 4 requires a one-time org-level governance step** — a GitHub Ruleset with required-status-checks list (or Terraform equivalent) keyed by a `devex-adopted` custom property that `devex init` sets on adoption. The platform team configures the ruleset once per org; consumer teams don't need admin scope. Until that one-time setup is done, the PR pipeline jobs are emitted but not enforced as required checks. |
| **Migrate safely**   | `devex init --migrate` runs inspect-only by default for existing repos. `--apply` writes incremental PRs the team reviews. Eventual convergence, never big-bang. Reruns are idempotent (UNIX exit codes: `0` = ok or no-op, `1` = partial state, `2` = misuse). |
| **Friction-free DX** | Work IDs auto-inject into commit messages via `prepare-commit-msg` (developer never types `KAN-123:` again). Hooks bake the absolute `devex` path at install time so they survive Git's sanitized `PATH`. The pre-push hook is bypassable with `--no-verify` — the PR pipeline re-validates and cannot be bypassed. |

**Anti-patterns rejected:** voluntary adoption (fails at scale), big-bang migration (kills trust), mandatory training (if the CLI needs a class, we've failed at DX), hook-as-moat (treat hooks as gifts to the developer; let branch protection be the moat).

## 3. Scalability — keeping the platform team out of the critical path

Three mechanisms make the platform team scale sub-linearly with team count.

- **Extension over modification.** Every Construct and workflow factory accepts override hooks (`smallTestsJob(profile).addStep(customStep)`, `props.lambdaOverrides`). Teams customize without forking. The `StackProfile` discriminated union with `assertNever` exhaustiveness means adding a language is additive, never invasive — the TypeScript compiler enumerates deterministically the call-sites the contributor must extend (`smallTestsJob`, `cdkSynthJob`, `contractValidationJob`; typically N≈3-5 hand-edits) plus one new profile file. A planned `devex add-language <name>` codemod reduces the edits to zero by scaffolding the stub at each call-site.
- **Inner-source.** Any team can PR the monorepo. The framework's own pipeline is the gate; review goes to a rotating maintainer (1 platform + 1 IC from consumer teams). Breaking changes require a 5-day RFC; additive changes don't.
- **Platform team's actual job:** maintain contracts, curate inner-source contributions, run the upgrade path (semver, deprecation). **Not:** write per-team CI/CD, debug per-team failures, gatekeep custom infra.

## 4. Shift-Left strategy

Defects detected where they are cheapest. Four layers, ordered left-to-right; each layer's bypass is re-caught at the next:

1. **IDE / Local** — lint, format, type-check on save, configured by `devex init` (no new tools, just enforced configs).
2. **Pre-push hook** — `devex validate` checks Work ID in branch/commits/PR title; `devex check` runs lint then tests (fail-fast). Bypassable with `--no-verify` — re-validated at L3.
3. **PR Pipeline** — full lint, unit + property-based tests, contract validation against `openapi.yaml`, `cdk synth` with FinOps tag enforcement via Aspects (priority `READONLY`), DORA + audit event emission. Required status check on `main`.
4. **Integration Pipeline (designed, deferred)** — promotion across Sandbox → Staging → Prod. Multi-env is already structured (Pattern A: one `Stack` instance per env in `bin/`); the PoC ships the PR pipeline only.

**Auditability is a dividend, not an afterthought.** Every stage emits one structured JSON event with shared keys (`work_id`, `team`, `repo`, `stage`, `status`, `actor`, `timestamp`, `git_sha`, `framework_version`). The same event stream feeds DORA dashboards and SOC 2 audit — one primitive, two consumers.

**Scope of "DORA" today vs at Integration Pipeline activation.** The PR-pipeline stages emitted today (`work-id-validation`, `small-tests`, `contract-validation`, `cdk-synth`, `dora-summary` — the last is currently a PR-pipeline summary, not a canonical DORA event) support comparable Python⇄Go metrics: PR Pipeline Failure Rate, PR Cycle Time, Per-Stage Flakiness. **The four canonical DORA metrics** (Deployment Frequency, Lead Time for Changes, MTTR, Change Failure Rate) require `integration-deploy-prod` events, which are gated on the Integration Pipeline (deferred). The schema is shape-correct for both; the emission set today covers the PR-stage subset only. Production-readiness of canonical DORA additionally requires explicit `event_id` (per-emission unique) plus `correlation_key` (derived from `work_id`+`stage`+`git_sha`) for exactly-once metric semantics — the current schema supports derivation but doesn't enforce the field.

## 5. Distribution and contracts

Both products install from Git directly (`uv tool install` for the CLI, `pnpm add github:` for the framework — exact commands in the [README](../README.md#quick-start)) — no registry overhead, branches and tags work out of the box, internal forks are first-class consumers.

Shared contracts (DORA event, Work ID regex, audit event) live in the monorepo as **mirror modules** — hand-written Zod (TS) and Pydantic (Python), kept in lockstep by contribution rules and a round-trip contract validation job in CI. No code generation: the cost (drift discipline) is lower than the cost of a generator dependency, a build step, and debugging generated code. The mirror model scales with **shared-type count** (currently 2: DoraEvent, AuditEvent), not with team count — codegen (JSII or equivalent) becomes worth its cost when cardinality exceeds ~15 types or when drift incidents recur >3/quarter, neither of which scale linearly with adoption.

`devex check` reads `testCommand`/`lintCommands` from `devex.profile.ts` via a small regex parser (with TS-comment stripping). This is intentionally pragmatic for the PoC — robust enough for the file `devex init` produces. Hand-edited profiles fail with mixed loud/silent modes today: imports for field values fall back loudly to a warning + explicit `--test`/`--lint` flags (correct); template-string interpolation, block comments inside string literals, and multiple profile exports in one file currently pass through the parser silently (debt — detection of the `${` interpolation marker is a 3-line fix planned for next iteration). Post-PoC migration target: a `pnpm devex:checks` helper packaged as `npx @devex/framework resolve-profile` that imports `./devex.profile.ts` via `ts-node`/`tsx` and emits resolved commands as JSON — full TypeScript semantics, no regex layer. Trigger: first defect report from a real consumer where the parser fails silently on a non-typo profile.

## 6. Plus criteria delivered

Two of the optional challenge "Plus" criteria are shipped — **Kiro steering files** and **Pre-Push Validation** (`devex check`); details in the [README Implementation Status](../README.md#implementation-status). The **Integration Case Study** in [`JynLeazy1/transactionify`](https://github.com/JynLeazy1/transactionify) — 5 PRs documenting the adoption journey, latest fully green in CI — operates as live evidence of the shift-left loop the ADR describes.

## 7. When to reconsider

The architecture has explicit migration triggers, not fixed thresholds:

- **Mirror schemas → codegen.** When the shared-type count exceeds ~15, OR drift incidents (PRs that pass R1 review but break the round-trip test post-merge) exceed 3 per quarter, OR mirror-review time per type-change exceeds 20 minutes consistently. None scale with team count; all scale with schema dynamics.
- **`devex check` regex parser → `resolve-profile` helper.** First real-world defect report on a non-typo profile.
- **`GoldenPathTagsAspect` mid-aspect `renderTags()` read → `Validations.of().addValidation()` callback at end-of-synth.** Eliminates dependency on Aspect ordering (third-party `cdk-nag`-style validators or any custom MUTATING aspect at priority 200-999 currently risks bypass). Already documented as latent in the regression test for the false-positive route warnings.
- **`devex init` ruleset application via custom property** vs current "platform team applies once": triggered when an org reaches ~5 adopting teams and the manual one-time-per-org setup becomes a bottleneck.

---

> **Appendix — Reference impact on `transactionify`.** Before: 187-line monolithic CDK Stack, no CI/CD, `openapi.yaml` not validated, FinOps tags inline, no DORA. After: ~76-line Stack using `PythonLambdaApi`, generated 5-stage PR pipeline, contract validation enforced, tags fail `cdk synth` if missing, PR-pipeline events emitted per stage, multi-env scaffolding (Sandbox/Staging/Prod) ready. `extraGrants` prop for side-car Lambdas (`provisioningLambda` use case) added via inner-source PR from the consumer mid-adoption. Open roadmap items: Integration Pipeline (prod-deploy events that close the canonical DORA loop), Amazon Q Developer integration, multi-cloud profiles.
