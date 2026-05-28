# Submission — DevEx Platform Code Challenge

> **Author:** Jorge Flores (`jynleazy@gmail.com`) · **Date:** 2026-05-26
> **Challenge:** Staff Engineer, DevEx Platform · **Reference repo:** [`rrgarciach/transactionify`](https://github.com/rrgarciach/transactionify)
> **Scope:** Proof of Concept — architectural integration, distribution strategy, and "wiring" over feature-completeness.

---

## What this submission is

A polyglot **Golden Path ecosystem** for an engineering org scaling from a handful of teams to 10+. Two independently distributable products:

| Product | Language | Distribution | Role |
|---|---|---|---|
| `devex-cli` | Python 3.11+ | `uv tool install` from Git | Developer touchpoint — scaffold, validate, hooks |
| `@devex/framework` | TypeScript 5+ | `pnpm add` from Git | CDK Constructs + GitHub Actions workflow factories |

Coupled only by **shared contracts** (DORA event, Audit event, Work ID regex) defined once and consumed by both, with a contract validation job preventing schema drift.

---

## Where to start

Open files in this order; ~30 minutes total.

1. **[`JynLeazy1/transactionify` — PR pipeline running green in public CI](https://github.com/JynLeazy1/transactionify/pulls?q=is%3Apr)** — the integration case study running end-to-end. The fork carries **5 merged PRs** spanning four Work IDs (FIN-123, FIN-124, RUFF-125, TEST-126) plus **PROV-127** open with **5/5 jobs SUCCESS** in CI (work-id-validation · small-tests · contract-validation · cdk-synth · dora-summary). These PRs document the adoption journey, including the bugs the first adopter (me) found and the iterative framework fixes that closed them. **This is the strongest single piece of evidence** — open the `FIN-123` PR's "Files changed" tab to see the initial adoption diff (187 → 67 lines, -64% pure refactor), then the `PROV-127` PR to see `extraGrants` restoring `provisioningLambda` parity (final state: 84 lines, -55% with full upstream feature parity).
2. **[`adr/ADR-001-devex-golden-path-ecosystem.pdf`](./adr/ADR-001-devex-golden-path-ecosystem.pdf)** (2 pages) — the architectural answer to the four challenge questions: Homologation, Scalability, Shift-Left, plus Distribution and Plus criteria.
3. **[`README.md`](./README.md)** — what the ecosystem looks like to a developer, how to install, end-to-end flow, and exact test commands. Install referenced as `pnpm add "github:JynLeazy1/devex#v0.1.0&path:/packages/framework"` (immutable tag).
4. **Code spot-checks (suggested):**
   - [`packages/framework/src/profiles/index.ts`](./packages/framework/src/profiles/index.ts) — the `StackProfile` discriminated union (polyglot extensibility point).
   - [`packages/framework/src/constructs/python-lambda-api.ts`](./packages/framework/src/constructs/python-lambda-api.ts) — the L3 Construct that collapses 188 lines of CDK into one prop bag.
   - [`packages/framework/src/constructs/golden-path-tags-aspect.ts`](./packages/framework/src/constructs/golden-path-tags-aspect.ts) — FinOps tag enforcement via CDK Aspect (priority `READONLY`).
   - [`packages/cli/src/devex/__main__.py`](./packages/cli/src/devex/__main__.py) — the CLI surface (Typer; one file, clear command boundaries).
   - [`packages/cli/src/devex/check/profile_reader.py`](./packages/cli/src/devex/check/profile_reader.py) — regex parser for `devex.profile.ts`. One bug caught and fixed mid-challenge (commented-out lines were leaking values); three additional silent-failure modes (template-literal interpolation, block comments inside string literals, multiple exports) documented in [Honest Scope](#honest-scope-known-gaps--reconsiderations) with migration path to a Node-side `resolve-profile` helper.

---

## How to reproduce / run the tests

Prerequisites: `uv` ([install](https://astral.sh/uv/install.sh)), `pnpm` ([install](https://pnpm.io/installation)), Node 18+, Python 3.11+.

```bash
cd devex

# Install workspace deps
pnpm install

# CLI tests (Python · 142 tests)
cd packages/cli
uv venv && source .venv/bin/activate
uv pip install -e ".[dev]"
pytest                                   # → 142 passed

# Framework tests (TypeScript · 112 tests)
cd ../framework
pnpm test                                # → 112 passed
```

**254 tests total** pass on a clean clone.

### Try the CLI end-to-end (no AWS account needed)

```bash
# Install the CLI as a tool (pin to a release in production adoption)
uv tool install "git+https://github.com/JynLeazy1/devex@v0.1.0#subdirectory=packages/cli"
# or from a local checkout for evaluation:
# uv tool install "git+file://$(realpath ./packages/cli)"

# Scaffold a fresh repo
mkdir /tmp/demo && cd /tmp/demo && git init
devex init --team platform
# → devex.profile.ts + workflows/pr.wac.ts
# → auto-detects service name from cwd; auto-detects repo URL from git remote (or placeholder)

devex hooks install --auto-inject --with-checks
# → installs pre-push (validates Work ID + runs `devex check`)
# → installs prepare-commit-msg (auto-prepends Work ID from branch)

git checkout -b feat/FIN-123-add-balance
git commit --allow-empty -m "Add balance endpoint"
# → committed as "FIN-123 Add balance endpoint" (hook injected the ID)

devex validate --no-commits             # Work ID validation
devex check                              # runs lint+test commands from the profile
devex dora emit --stage small-tests --status success --work-id FIN-123 --dry-run
devex audit emit --action pr-merged --target "PR #42" --reason "approved by 2 reviewers" \
                 --work-id FIN-123 --team platform --repo https://github.com/org/svc \
                 --actor jorge --git-sha abc1234
# → each prints a Pydantic-validated event matching the shared schema
```

---

## Mapping to the challenge

| Required capability | Where it lives | Status |
|---|---|---|
| **ADR (≈2 pages)** answering Homologation, Scalability, Shift-Left, Architecture | [`adr/ADR-001-...pdf`](./adr/ADR-001-devex-golden-path-ecosystem.pdf) | ✅ 2-page PDF + architecture in README |
| **CLI** (Python, `uv tool install` from Git) | [`packages/cli/`](./packages/cli/) | ✅ 142 tests, 6 commands (validate, init, check, hooks, dora emit, audit emit) |
| **Framework** (TypeScript, `pnpm add` from Git) | [`packages/framework/`](./packages/framework/) | ✅ 112 tests, CDK Constructs + workflow factories + `extraGrants` for non-route Lambdas |
| **Polyglot support** | `StackProfile` discriminated union ([`profiles/`](./packages/framework/src/profiles/)) | ✅ Python implemented; Go/TS/Clojure scaffolded with `assertNever` exhaustiveness |
| **Universal Work ID enforcement** (branch / commits / PR title) | `devex validate` + `workIdValidationJob` (factory) | ✅ Two layers: pre-push hook + PR pipeline |
| **Two-reviewer rule automation** | PR pipeline jobs (work-id, small-tests, contracts, cdk-synth) emitted as required status checks; branch protection rule is a one-time org-level governance step (GitHub Ruleset + custom property selector, set once by the platform team, opt-in implicit via `devex init`). | 🟡 PR-pipeline jobs shape-correct as required-checks targets; org Ruleset setup is the one-time governance step. CODEOWNERS scaffolding post-PoC. See [Honest Scope](#honest-scope-known-gaps--reconsiderations). |
| **SOC 2 audit trail** | `AuditEvent` schema (Zod + Pydantic, lockstep); same event stream as DORA; CLI emitter via `devex audit emit` | ✅ Schema + cross-language contract test + CLI emitter |
| **DORA metrics** | `DoraEvent` schema + `devex dora emit` + `doraSummaryJob` factory | 🟡 Shape-correct schema + emitted at every PR-pipeline stage. **Canonical DORA metrics (Deployment Frequency, Lead Time, MTTR, Change Failure Rate) are not yet computable** — they require `integration-deploy-prod` events, gated on the deferred Integration Pipeline. PR-stage health metrics (Failure Rate, Cycle Time, Per-Stage Flakiness) ARE comparable Python⇄Go today. See [Honest Scope](#honest-scope-known-gaps--reconsiderations). |
| **FinOps governance** | `GoldenPathTagsAspect` (configurable `severity`) | 🟡 Implementation works for the PoC integration case; documented limitations on the Aspect's mid-pass `renderTags()` read (regression test captures false-positives with N≥3 routes) and substring `/ServiceRole` skip (catches custom-named roles). Migration target: `Validations.of().addValidation()` at end-of-synth — see [Honest Scope](#honest-scope-known-gaps--reconsiderations). |
| **Shift-Left** (defects caught left of CI) | 4-layer strategy (ADR-001 §4): IDE → pre-push → PR pipeline → integration (deferred) | ✅ L1–L3 shipped; L4 designed |
| **Distribution from Git (no registry)** | `uv tool install` + `pnpm add github:...#v0.1.0&path:...` | 🟡 Architecture is shape-correct (Git as install medium); five operational disciplines (install pinning, tag immutability via protection rules, repo-hosting durability, fork lifecycle policy, semver enforcement) require setup beyond the PoC. See [Honest Scope](#honest-scope-known-gaps--reconsiderations). |
| **Single source of truth (monorepo)** | This directory | ✅ Two packages, one ADR, one contract module per language |

### "Plus" criteria delivered

| Plus criterion | Where | Notes |
|---|---|---|
| **AWS Kiro / Spec-Driven Development** | [`.kiro/steering/`](./.kiro/steering/) | Steering files documenting Golden Path constraints for AI-assisted development. Reviewer can open the project in Kiro IDE and immediately get framework-aware suggestions. |
| **Pre-Push Validation managed by CLI** | `devex check` + `devex hooks install --with-checks` | Reads `testCommand` / `lintCommands` from `devex.profile.ts`, runs lint then tests fail-fast, exits 1 on failure, exits 0 on success. Warns loudly when the regex parser can't find the fields (imports for values, fully missing fields); some hand-edited profile shapes pass silently — documented in [Honest Scope](#honest-scope-known-gaps--reconsiderations). |
| **Integration Case Study** (beyond Plus) | [`JynLeazy1/transactionify`](https://github.com/JynLeazy1/transactionify) | 5 PRs merged to `main` spanning four Work IDs (FIN-123, FIN-124, RUFF-125, TEST-126) plus PROV-127 open with 5/5 green CI. The adoption journey doubles as live evidence of the shift-left loop: bugs in the framework were caught by the consumer's CI and fixed via inner-source PRs back to the monorepo (e.g., FIN-124 fixed a POSIX-ERE incompatibility in `workIdPattern`; PROV-127 added `extraGrants` to restore the side-car `provisioningLambda` use case that the initial refactor had to drop). |

Amazon Q Developer integration was considered but deferred — two Plus criteria + the public Integration Case Study already shipped.

---

## Notable design decisions

Pulled from the ADR.

- **Two products, not one.** A single CLI in either language imposes friction on the other audience. Polyglot teams need a CLI in their terminal *and* type-checked CDK in their stack — different audiences, different tools.
- **Discriminated union for polyglot.** `StackProfile` with a `language` discriminator + `assertNever` exhaustiveness. Adding Go = one new profile object + stub handlers; the TypeScript compiler enforces that every consumer handles it. **Not** a class hierarchy, **not** a string-keyed map.
- **Mirror contracts, not codegen.** Hand-written Zod (TS) and Pydantic (Python) with a CI round-trip validation job. The schemas are small and stable; the cost of drift discipline is lower than the cost of a generator + build step + debugging generated code.
- **Hook-as-gift, not hook-as-moat.** Pre-push is bypassable with `--no-verify`. The actual moat is branch protection + required status checks. Punishing a developer trying to push in a power outage is bad DX; re-validating at the PR pipeline keeps the guarantee.
- **Auto-detect, not require.** `devex init` reads `git remote get-url origin` for `--repo-url` and `Path.cwd().name` for `--service-name`. Zero required flags for the common case. Friction is the enemy of adoption.
- **Auto-inject Work IDs, not reject.** A `prepare-commit-msg` hook auto-prepends the Work ID from the branch name. "Fix-on-write" is better DX than "reject-and-retry".
- **UNIX exit codes.** `0` = ok or true no-op; `1` = partial state needing action; `2` = misuse (e.g., `--no-branch --no-commits` validates nothing — refuses to silently pass).

---

## What's deferred and why

This is a Proof of Concept. The following are deliberately out of PoC scope:

- **Integration Pipeline** (Sandbox → Staging → Prod promotion). Multi-env scaffolding exists (Pattern A: one Stack instance per env in `bin/`); the workflow factories for promotion are designed but not implemented. Canonical DORA metrics depend on this layer.
- **Go / TypeScript / Clojure `smallTestsJob` branches**. The `StackProfile` contract is typed for all four; only the Python branch is implemented. Adding a new language is the inner-source contributor's first PR.
- **DORA dashboard (storage + visualization)**. The framework defines the event schema; storage and visualization are org-specific and live downstream of the CI emit.
- **Amazon Q Developer integration**. Kiro steering files cover the AWS-native AI tooling category.

---

## Honest Scope: Known Gaps & Reconsiderations

This section names what the green checkmarks above hide. Each gap is paired with a migration path and a concrete trigger — not "post-PoC" handwave, an observable signal. Read this before the demo; it is the audit I would do if I were the evaluator.

### "DORA metrics" — schema shape vs canonical metrics

The schema is in lockstep across Zod and Pydantic; the round-trip contract test in CI prevents drift. What is overclaimed by a green checkmark elsewhere: **none of the four canonical DORA metrics (Deployment Frequency, Lead Time for Changes, MTTR, Change Failure Rate) is computable from what the PoC emits today.** All four depend on `integration-deploy-prod` events, which the deferred Integration Pipeline produces. What IS comparable Python⇄Go today: PR Pipeline Failure Rate, PR Cycle Time, Per-Stage Flakiness — all derivable from the existing emission set with the same schema and the same contract guarantees. The factory currently named `doraSummaryJob` emits PR-pipeline summary, not canonical DORA; the rename to `pipelineSummaryJob` (with `doraSummaryJob` reserved for the deploy emitter) is a one-day breaking change PR with a `@deprecated` alias and `CHANGELOG` entry. Production-readiness of canonical DORA also needs explicit `event_id` (per-emission unique for at-least-once + dedup) plus `correlation_key` (derived from `work_id`+`stage`+`git_sha` for exactly-once metric semantics). The current schema supports correlation_key derivation; explicit event_id is debt. Trigger to ship: first `integration-deploy-prod` event consumer.

### Packaging Maturity — Git-as-distribution operational disciplines

The architecture (install from Git, no registry, internal forks as first-class consumers) is shape-correct. Five disciplines that the PoC does not encode and that a production adoption requires: **(1)** Install commands should always be pinned to a tag or SHA; the README has been updated to `@v0.1.0` everywhere. Without pinning, two developers adopting weeks apart get different CLIs silently — the bug class the Golden Path is supposed to eliminate. **(2)** Git tags are mutable; `v0.1.0` can be force-moved. Mitigation is GitHub Tag Protection Rules (one-time org setup) plus signed tags plus SHA-pinning for strict-compliance consumers. **(3)** The current repo lives under a personal GitHub account; production-ready hosting is an org account with multiple admins plus an optional private-registry indirection layer (Verdaccio / JFrog / GitHub Packages) so the Git URL is implementation detail behind a stable name. **(4)** Internal forks are supported in the Git model but require an operational playbook — forks of feature-in-development must open the upstream PR same-day (24-48h platform-team SLA), forks divergent long-term must be scoped-renamed in a private registry under RFC. **(5)** Semver-strict is policy declared but not historically demonstrated (no breaking change has been made yet). The disciplined `0.x` rule: minor bumps may break but should retain a `@deprecated` alias for at least one minor before removal.

### `GoldenPathTagsAspect` — three documented latencies

The Aspect works for the PoC's integration case; the regression test in `framework/tests/constructs/python-lambda-api.test.ts` captures three failure modes. **(a)** The `/ServiceRole` skip is a substring match on the node path — it false-negatives on consumer-created `iam.Role(this, 'CustomServiceRoleForFoo')` and false-positives on auto-created roles named with other suffixes (`ExecutionRole`, `LambdaRole`). Correct implementation is structural (`node instanceof iam.CfnRole && isAutoCreatedServiceRole(node)`). **(b)** Unknown tag shapes return an empty Set from `_extractTagKeys`; the actual behavior is fail-closed (warnings emit for all required keys not found via walk-up), but the comment describes it as "no-op for that resource" which is misleading. The real gap is missing diagnostic distinction — "tags missing" and "tag shape unparseable" emit the same warning, so the operator cannot tell consumer non-compliance from framework gap. Fix: separate diagnostic code `devex::unknown-tag-shape`. **(c)** The walk-up via `renderTags()` mid-aspect-pass depends on no third-party MUTATING aspect altering tag state at priority 200-999 — a contract not documented. With `tagSeverity: 'warning'` this is no-op; with `tagSeverity: 'error'` (recommended for production via `devex init --strict-tags`) it becomes silent enforcement bypass. Migration target for all three: replace mid-aspect read with `Validations.of(node).addValidation({ validate: () => [...] })` callback that runs end-of-synth, after every aspect has applied. Eliminates ordering dependency entirely. Trigger: any consumer enabling `--strict-tags` in production.

### `devex check` — regex parser fail modes

The parser is robust for the profile shape `devex init` produces and falls back loudly on imports for field values (correct). Hand-edited profiles can fail silently in three cases the parser does not detect: template-string interpolation (`testCommand: \`pytest --python ${runtime}\``) extracts a literal `${runtime}` string that bash silently expands to empty; block comments inside string literals (`testCommand: 'curl https://example.com/*/foo'`) get partially stripped, mutating the URL; multiple profile exports in one file silently pick the first match. Concrete fix for the template-literal case (the one the ADR overclaims as "falls back to a warning"): three lines detecting `${` in the extracted value and warn + fallback. The other two cases require structural parsing — migration target is `npx @devex/framework resolve-profile`, a Node binary in the framework that imports the `.ts` via `ts-node`/`tsx` and emits resolved commands as JSON. Trigger: first defect report from a real consumer where the parser fails silently on a non-typo profile.

### `dora emit` / `audit emit` collector path — narrow exception clause

The `emit_to_collector` helper in both `dora/emitter.py` and `audit/emitter.py` catches `urllib.error.URLError` and wraps it as `CollectorError` for a friendly user-facing error. But Python's networking exception hierarchy has two parallel branches: `OSError` (covering `URLError`, `TimeoutError`, `ConnectionRefusedError`, `socket.gaierror`) and `http.client.HTTPException` (covering `RemoteDisconnected`, `BadStatusLine`, `IncompleteRead`). The current except clause only catches the first branch. Real-world reproduction: pointing `--collector-url` at a misbehaving server (e.g., `nc -l 8080` which accepts the connection then closes without an HTTP response) raises `http.client.RemoteDisconnected`, escapes the except clause, and the CLI dumps a raw Python traceback to stderr instead of "error: Failed to POST to ...". Same shape for `TimeoutError` when the server hangs. The dead `except json.JSONDecodeError` clause is leftover from a refactor and never fires because nothing in the try block parses JSON. Concrete fix: change `except urllib.error.URLError` to `except (OSError, http.client.HTTPException)`, remove the dead json handler, drop the unused `import json`. Two-file change, ~5 lines total. Tests should mock `urllib.request.urlopen` to raise `RemoteDisconnected` and `TimeoutError`, asserting `CollectorError` is raised with a friendly message. The unit tests today cover `build_event` and `emit_to_stdout` but not the collector path — that gap is what let this slip. Trigger: first consumer running `--collector-url` against a real (potentially misbehaving) collector in production.

### Polyglot extensibility — N hand-edits per new language

The ADR §3 claim "one new file, no core changes" is overstated. Adding Go is approximately: one new file (`src/profiles/go-lambda-api.ts`) plus N≈3-5 deterministic hand-edits in factories (`smallTestsJob`, `cdkSynthJob`, `contractValidationJob`, possibly `cdk-synth.ts`, possibly a new `GoLambdaApi` Construct). The TypeScript compiler enumerates the call-sites via `assertNever` errors, so discovery cost is zero; the edits themselves are not. Mitigation: a planned `devex add-language <name>` codemod that scaffolds the stub at every call-site, reducing the edits to zero. Trigger to ship: when the second language adoption is funded (estimated post-PoC quarter when Go or TS shop adopts).

### `doraSummaryJob` — naming overload

The current factory emits a per-PR summary event. The name `doraSummaryJob` is forward-looking — it WILL emit canonical DORA events when wired into Integration Pipeline. Today it emits PR-pipeline summary, which is a different (and useful) thing. Rename plan: introduce `pipelineSummaryJob` for current scope, keep `doraSummaryJob` as alias with `@deprecated` warning, reserve `doraSummaryJob` for the deploy-stage emitter that lands with Integration Pipeline. One-day PR including CHANGELOG and consumer migration note.

### Mirror schemas vs codegen — scaling axis

The mirror discipline (hand-written Zod + Pydantic, kept in lockstep by CI round-trip test and the R1 rule in `.kiro/steering/05-ai-review-rules.md`) scales with **shared-type count and drift incident rate**, not with adopting-team count. With 2 shared types today (DoraEvent, AuditEvent) and zero drift incidents, mirror is the right model and plausibly stays right at 10+ teams. Triggers to reconsider toward codegen (JSII or equivalent): shared-type count exceeds ~15, OR drift incidents (post-merge fixes after R1 missed) exceed 3 per quarter, OR mirror-review time per type-change exceeds 20 minutes consistently. None of the three is hit today.

### What this section is NOT

This is not a list of bugs introduced in the PoC. It is an audit of the boundary between what the architecture promises and what the PoC delivers operationally. The architectural choices remain defended in their conditionals; the operational gaps are flagged with paths and triggers. Production adoption is gated on closing the disciplines named here, not on rearchitecting.

---

## What was excluded from this submission

For a clean reviewer experience, the following dev artifacts were deliberately left out (kept in the development repo, not part of the deliverable):

- `reference-transactionify/` — pristine upstream baseline, kept for comparison during development.
- `transactionify-copy/` — local sandbox used for testing the CLI end-to-end.
- The refactored consumer is published separately at [`JynLeazy1/transactionify`](https://github.com/JynLeazy1/transactionify) — multi-env Stack (**187 → 67 lines pure refactor, 84 lines with `extraGrants` restoration of `provisioningLambda`**), `.wac.ts` workflows, generated YAML pipeline.
- `notes/` — D1-phase research notes (CDK, uv, pnpm, workflow-ts spike).
- `00-analysis.md` — initial challenge analysis (5-layer needs breakdown, strategic insights).

---

## Time and scope notes

- **5-day deadline** (2026-05-21 → 2026-05-26); post-deadline iteration was interview prep, not feature work (the documents and code visible on `main` reflect the deadline state plus the honest-audit and inner-source PRs documented above).
- **254 automated tests** across both packages on a clean clone (142 Python + 112 TypeScript).

---

## Questions or feedback

Happy to walk through any of the design decisions or live-demo the end-to-end flow. — Jorge
