# Contributing to `devex`

`devex` is **inner-source**: any engineering team in the org can contribute. The platform team curates, but is **not** the bottleneck. This guide is the contract — read it once, and you can ship a feature without waiting for someone to walk you through it.

---

## Quick start (5 minutes)

```bash
git clone https://github.com/<user>/devex
cd devex

# Workspace setup — links framework and CLI for local development
pnpm install

# Framework (TypeScript)
cd packages/framework
pnpm test          # 91 tests
pnpm typecheck     # strict TS
pnpm build         # emits dist/

# CLI (Python)
cd ../cli
uv venv --python 3.11
uv pip install -e ".[dev]"
pytest             # 91 tests
ruff check src
mypy src
```

The CI pipeline runs all of the above. If it passes locally, it passes in CI.

---

## What kind of change are you making?

| You want to… | Read section |
|---|---|
| Add a new language to `StackProfile` (Go, Clojure, …) | [Add a new language](#add-a-new-language) |
| Add a new workflow factory | [Add a workflow factory](#add-a-workflow-factory) |
| Modify a CDK Construct | [Modify a Construct](#modify-a-construct) |
| Add a new CLI command | [Add a CLI command](#add-a-cli-command) |
| Change a shared schema (DORA, Audit) | [Shared contracts](#shared-contracts) |
| Make a breaking change to anything public | [RFC process](#rfc-process) |

---

## Add a new language

**Worked example: implementing the Go branch of `smallTestsJob`.**

The `StackProfile` discriminated union already declares `GoLambdaProfile`, but its `smallTestsJob` branch throws `out of PoC scope`. Adding real support is the most common inner-source contribution.

### Step 1: Read the typed contract

The Go profile is declared in [`packages/framework/src/profiles/go-lambda-api.ts`](./packages/framework/src/profiles/go-lambda-api.ts). It already has the fields you'll need (`goVersion`, `runtime`, `sourcePath`, `testCommand`, `lintCommands`). If you need to add a field, that's a separate concern — see [Shared contracts](#shared-contracts).

### Step 2: Implement the Go branch of `smallTestsJob`

Open [`packages/framework/src/workflows/small-tests.ts`](./packages/framework/src/workflows/small-tests.ts). The switch is the contract:

```typescript
switch (profile.language) {
  case 'python':
    return smallTestsJobPython(profile)
  case 'go':                                  // ← your branch
    return smallTestsJobGo(profile)          // ← write this
  case 'typescript':
  case 'clojure':
    throw new Error(OUT_OF_POC_SCOPE(profile.language))
  default:
    assertNever(profile)
}
```

Add the implementation:

```typescript
function smallTestsJobGo(profile: GoLambdaProfile): NormalJob {
  const job = new NormalJob('small-tests', {
    'runs-on': 'ubuntu-latest',
    'timeout-minutes': 10,
  })

  job.addStep(new Step({ name: 'Checkout', uses: 'actions/checkout@v4' }))

  job.addStep(new Step({
    name: 'Setup Go',
    uses: 'actions/setup-go@v5',
    with: {
      'go-version': profile.goVersion,
      cache: true,
    },
  }))

  job.addStep(new Step({
    name: 'Install lint tools',
    run: 'go install honnef.co/go/tools/cmd/staticcheck@latest',
  }))

  job.addStep(new Step({
    name: 'Run tests',
    'working-directory': profile.sourcePath,
    run: profile.testCommand,
  }))

  return job
}
```

### Step 3: Write tests

Add a `describe` block to [`packages/framework/tests/workflows/factories.test.ts`](./packages/framework/tests/workflows/factories.test.ts) following the python branch's pattern:

```typescript
describe('smallTestsJob (Go)', () => {
  const job = smallTestsJob(goProfile)

  it('uses actions/setup-go with profile-declared goVersion', () => {
    const setup = (job.job.steps ?? []).find((s) =>
      s.uses?.startsWith('actions/setup-go'),
    )
    expect(setup).toBeDefined()
    expect((setup?.with as Record<string, unknown>)?.['go-version']).toBe(goProfile.goVersion)
  })

  // ... at least 3 more behavior tests
})
```

**Minimum coverage:** 3 behavior tests + 1 fixture-based smoke (a complete Go profile constructed, factory called without throwing).

### Step 4: Update the documentation

In the README's implementation status table, change the Go row from "⏭️ Deferred" to "✅ Real (Go via setup-go@v5)".

### Step 5: Open the PR

PR title and at least one commit message must include a Work ID matching `[A-Z]+-\d+`. Two reviewers required — see [PR review](#pr-review-process).

---

## Add a workflow factory

A workflow factory is a function that returns a `NormalJob`. Lives in `packages/framework/src/workflows/<your-name>.ts`.

**When to add a new factory vs extend an existing one:**

| New factory if… | Extend existing if… |
|---|---|
| It's a distinct pipeline stage (e.g., security-scan) | You want a step variation (use `.addStep()` from the consumer) |
| It has a different `needs` topology | You want to make an existing step conditional |
| It has a different language matrix | It's a parameter, not a structural change |

**Skeleton:**

```typescript
// packages/framework/src/workflows/security-scan.ts
import { NormalJob, Step } from '@github-actions-workflow-ts/lib'
import type { StackProfile } from '../profiles'

export function securityScanJob(profile: StackProfile): NormalJob {
  const job = new NormalJob('security-scan', {
    'runs-on': 'ubuntu-latest',
    'timeout-minutes': 10,
  })
  // … steps
  return job
}
```

Export from `packages/framework/src/workflows/index.ts`. Document the pipeline position (which jobs typically `needs:` it) in the JSDoc and the workflows README.

**Test requirements:** at least 5 behavior tests covering: job name, runner, step ordering, language-specific behavior if any, and an artifact upload if relevant.

---

## Modify a Construct

CDK Constructs (`PythonLambdaApi`, `PythonLambdaRoute`, `GoldenPathTagsAspect`) are the public API surface most likely to cause breaking changes for existing consumers. Tread carefully.

| Change type | What's required |
|---|---|
| **Add an optional prop** (`?:`) | Tests for the new prop's default and explicit values. No RFC. |
| **Add a required prop** | Breaking change — RFC + deprecation cycle. Provide a sane default in the major-version transition. |
| **Rename a prop** | Breaking change. Document the migration in the release notes. |
| **Change runtime defaults** | RFC if it affects existing stacks (e.g., Python 3.11 → 3.13). |
| **Change Aspect severity behavior** | RFC — affects whether existing consumers' CI passes. |

CDK assertion tests (`aws-cdk-lib/assertions`) are mandatory for any Construct change — see [`packages/framework/tests/constructs/python-lambda-api.test.ts`](./packages/framework/tests/constructs/python-lambda-api.test.ts) for the patterns.

---

## Add a CLI command

CLI commands live in `packages/cli/src/devex/__main__.py`. The pattern is:

1. **Pure functions first** (in `packages/cli/src/devex/<feature>/`). No `typer`, no I/O. Unit-test in isolation.
2. **CLI wrapper second** (in `__main__.py`). Wires Typer's args to the pure functions. Integration tests via `CliRunner`.

Example:

```python
# packages/cli/src/devex/auditing/diff.py
def diff_audit_logs(left: list[AuditEvent], right: list[AuditEvent]) -> list[AuditEvent]:
    """Pure. Easily unit-testable."""
    ...

# packages/cli/src/devex/__main__.py
@audit_app.command("diff")
def audit_diff(left_path: Path, right_path: Path) -> None:
    """Thin wrapper — parses inputs, calls diff_audit_logs, prints output."""
    ...
```

**Exit code conventions:**
- `0` — success
- `1` — the command ran but found issues (validation failures, etc.)
- `2` — usage error (bad flags, not in a git repo, etc.)

**Test requirements:** unit tests for pure functions (target 100% line coverage), CLI integration tests for at least the happy path and one error path.

---

## Shared contracts

`DoraEvent` and `AuditEvent` schemas live in **two** places and must stay in lockstep:

| Side | Location |
|---|---|
| TypeScript (Zod) | [`packages/framework/src/contracts/`](./packages/framework/src/contracts/) |
| Python (Pydantic) | [`packages/cli/src/devex/contracts/`](./packages/cli/src/devex/contracts/) |

**Rules:**

1. **Add a field**: must add it in BOTH languages in the same PR. CI will fail if you don't.
2. **Rename or remove a field**: bump `SCHEMA_VERSION` (currently `"1.0"`) and document the migration. RFC required.
3. **Change a regex or constraint**: must be applied to both implementations. Cross-validation tests in `tests/contracts/test_cross_language.py` (TBD) will be added in v0.2 to enforce this automatically.

The lockstep rules are also documented in [`packages/framework/src/contracts/README.md`](./packages/framework/src/contracts/README.md).

---

## RFC process

Required for **breaking changes** to any public API:

- Removing or renaming exports
- Renaming Construct props
- Renaming workflow factory names
- Renaming or removing CLI flags
- Bumping `SCHEMA_VERSION`
- Changing Aspect default behavior

**How to file an RFC:**

1. Open a PR adding `docs/rfcs/<n>-<title>.md` with sections: **Summary**, **Motivation**, **Proposed change**, **Migration path**, **Drawbacks**, **Alternatives considered**.
2. PR sits open for **5 business days** for inner-source comments.
3. Two maintainer approvals required to merge.
4. Implementation PRs can begin in parallel under a `--unstable` flag.

**Trivial additive changes (new prop with default, new factory, new CLI subcommand) skip the RFC** — open the implementation PR directly.

---

## Test requirements

| Change type | Tests required |
|---|---|
| Pure function (validators, templates, schema) | 100% line coverage. Edge cases explicit. |
| CDK Construct | `aws-cdk-lib/assertions` for resource shape; tests for each prop combination |
| Workflow factory | Shape assertions on returned `NormalJob` (step count, names, env vars, conditions) |
| CLI command | `CliRunner` integration test for happy path + at least one error path |
| Shared contract | Schema validation positive AND negative cases. Mirror tests in both languages. |

The CI pipeline runs:
- `pnpm typecheck` (TS strict)
- `pnpm test` (Jest)
- `ruff check src tests` (Python lint)
- `mypy src` (Python types, strict mode)
- `pytest` (Python tests)

**A PR that doesn't pass all of the above does not merge.** No exceptions for "I'll fix it later".

---

## Code style

### TypeScript

- Strict mode (`tsconfig.strict: true`)
- Avoid `any` — use `unknown` + narrowing if uncertain
- Default formatter: Prettier (planned for v0.2 — pin a config and run on save)
- Imports ordered: `node:` builtins → third-party → relative
- Single quotes, no semicolons (matches existing code)

### Python

- Type hints mandatory (`mypy --strict` clean)
- `ruff` formatter conventions (line length 100)
- `from __future__ import annotations` at the top of every file
- Functions are pure unless they touch git, filesystem, or network — these go in dedicated modules
- Docstrings for every public function; one-line for trivial, multi-line for non-obvious

### Comments

- **Do not** add comments narrating the rationale for a change ("migrated from X to Y because…"). That belongs in commit messages and PR descriptions.
- **Do** add comments explaining non-obvious behavior of the current code (subtle invariants, framework quirks, workarounds).
- TODO comments are acceptable when they describe future state ("TODO(post-PoC): switch to logGroup explicit").

### Commits and branches

- Branch name must match `[A-Z]+-\d+` somewhere (e.g., `feat/FIN-123-add-go-profile`).
- Each commit subject must include the Work ID.
- The pre-push hook (installed via `devex hooks install`) enforces this locally.
- Optional: `devex hooks install --auto-inject` auto-prepends the Work ID from your branch name to commit messages that lack one.

---

## PR review process

- **Two-reviewer rule** is enforced by branch protection on `main`.
- **CODEOWNERS** (TBD) routes reviews to a rotating maintainer + one IC from an unrelated consumer team.
- The framework eats its own dog food — every PR to the monorepo runs the same PR pipeline that consumer repos run.
- Reviewers focus on:
  1. **Correctness** — tests cover the change
  2. **Backward compatibility** — existing consumers don't break
  3. **API ergonomics** — does this make the typical use-case easier?

PRs that introduce a breaking change without a linked RFC are closed with a request to file one first.

---

## Release process

`devex` uses **semver** strictly:

| Version | What changed |
|---|---|
| Patch (0.1.0 → 0.1.1) | Bug fixes, no API changes |
| Minor (0.1.0 → 0.2.0) | New props, new factories, new commands — all additive |
| Major (1.0.0 → 2.0.0) | Breaking changes accumulated since the previous major |

While `0.x`, minor versions are allowed to break minor-to-minor (PoC stage). At `1.0`, breaking changes require an RFC + major bump.

**Tagging:**

```bash
git tag v0.2.0
git push origin v0.2.0
```

The CI release pipeline (TBD in v0.2) will:
1. Verify all tests pass
2. Generate release notes from the commit log
3. Publish a GitHub release pointing at the monorepo path

**Deprecation policy:**

- Mark deprecated APIs with JSDoc `@deprecated` (TS) or `warnings.warn(..., DeprecationWarning)` (Python).
- Deprecated APIs continue to work for **2 minor versions** (or 6 months, whichever is longer).
- The release notes call out every deprecation explicitly.

---

## Maintainer rotation

The "Framework Maintainer" is a rotating role:

- **1 person from the platform team** (permanent)
- **1 IC from a consumer team** (3-month rotation)

The consumer-team rotation ensures real users have skin in the game. Maintainers:

- Triage incoming PRs (target: response within 2 business days)
- Curate the RFC backlog
- Approve releases
- Run a weekly office hour for inner-source contributors

To volunteer for the next rotation, open an issue with the `maintainer-rotation` label.

---

## Getting help

- **Quick questions**: `#devex-help` on Slack (TBD).
- **Discussion of larger ideas**: an issue with the `discussion` label.
- **Bug reports**: an issue with the `bug` label and a minimal repro.
- **Office hours**: weekly, time TBD by the current rotation.

---

## License

By contributing, you agree your changes are released under the [MIT License](./LICENSE).
