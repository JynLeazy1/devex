# Shared contracts — TypeScript ⇄ Python lockstep

This directory defines event schemas that **both** the framework (`@devex/framework`, TS) and the CLI (`devex-cli`, Python) emit and consume. The two implementations must stay in lockstep.

## The two schemas

| Schema | Purpose | Consumer |
|---|---|---|
| `DoraEvent` | One per pipeline stage. Feeds Deployment Frequency, Lead Time, Change Failure Rate, MTTR. | DORA dashboard |
| `AuditEvent` | One per actionable lifecycle event (commit, merge, deploy, …). Carries who/what/when/why. | SOC 2 audit log |

Both extend `BaseEvent`, which carries the shared cross-cutting fields: `schema_version`, `work_id`, `team`, `repo`, `actor`, `timestamp`, `git_sha`, `framework_version`.

## Mirrored files

| TypeScript | Python |
|---|---|
| `_base.ts` → `BaseEventSchema` | `_base.py` → `BaseEvent` (Pydantic) |
| `dora.ts` → `DoraEventSchema` | `dora.py` → `DoraEvent` |
| `audit.ts` → `AuditEventSchema` | `audit.py` → `AuditEvent` |
| `index.ts` → re-exports | `__init__.py` → re-exports |

## Lockstep rules

1. **Keys must match exactly**. `snake_case` in both languages (TS uses `snake_case` here deliberately, because the wire format is JSON consumed by tools that expect snake_case — Python, jq, log analyzers).
2. **Types must be equivalent**. TS `number` ↔ Python `int`/`float`; TS `string` ↔ Python `str`; TS `T | null` ↔ Python `T | None`; TS enums ↔ Python `Enum`.
3. **`SCHEMA_VERSION` must match** in both implementations. Bump together for any breaking field change.
4. **Validation must be equivalent**. If the TS Zod schema rejects an input, the Python Pydantic model must too (and vice versa). Cross-validation tests live in `tests/contracts/test_cross_language.py` (TBD).

## When you need to change a schema

1. Modify both TS and Python files in the same PR.
2. Bump `SCHEMA_VERSION` if the change is **non-additive** (renamed field, changed type, removed value from enum).
3. Update consumer code (workflow factories that emit, CLI that emits) and their tests.
4. Document the migration in the PR description.
5. Tag a new framework + CLI release together.

## Why a runtime validator (Zod / Pydantic) instead of plain types?

These events travel as JSON through CI pipelines, GitHub Actions outputs, log files, and queue messages. A type system catches mistakes at compile time, but a malformed JSON arriving at runtime would silently corrupt DORA metrics or audit logs.

By validating with Zod (TS) and Pydantic (Python), we get:

- Compile-time safety (`type DoraEvent = z.infer<typeof DoraEventSchema>` / `class DoraEvent(BaseModel)`).
- Runtime rejection of bad input with clear error messages.
- A single source of truth: the schema *is* the contract; the type is derived.

## Where these events are emitted in the framework

- **DORA**: by the `doraSummaryJob` workflow factory at the end of every PR pipeline run; by individual factory steps for finer granularity.
- **Audit**: by `devex` CLI commands (`devex hooks install`, `devex init`, `devex dora emit`); by workflow factories on lifecycle boundaries.

See [ADR-001 §4](../../../../adr/ADR-001-devex-golden-path-ecosystem.md) for the broader rationale.
