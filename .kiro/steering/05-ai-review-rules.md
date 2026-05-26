# AI review rules

Specific instructions for AI assistants when reviewing PRs against this
codebase. Apply these as hard rules, not suggestions.

## Hard requirements — block the PR if violated

### R1. Cross-language schema lockstep

If a PR modifies `packages/framework/src/contracts/` OR
`packages/cli/src/devex/contracts/`, it MUST modify the other in the same
PR. The schemas mirror each other; touching only one creates drift.

Comment to leave: "This PR changes the [TS|Python] schema but not the
mirrored [Python|TS] one. Update `<the other path>` in the same PR or split."

### R2. New Construct prop without test

Any addition of a public prop to a CDK Construct in
`packages/framework/src/constructs/` requires:

- A test in `packages/framework/tests/constructs/` that exercises the new
  prop with at least one non-default value
- An assertion that the resulting template reflects the prop

### R3. Breaking change without RFC

Renaming a public export, removing a prop, changing a default value that
affects existing consumers, OR bumping `SCHEMA_VERSION` — any of these
require a linked RFC document under `docs/rfcs/` (TBD in v0.2).

Recognize a breaking change by these signals:
- Renaming exported types/functions
- Removing fields from props interfaces
- Changing function signatures (other than adding optional args)
- Removing CLI flags or env vars

### R4. Hardcoded AWS account or region in source

Account IDs and region strings belong in `EnvironmentConfig` props, env
vars, or CDK context — never inline in `lib/`. If a PR adds a literal
12-digit account ID outside `bin/transactionify.ts` (consumer-side env
config), flag it.

### R5. Boolean param without keyword-only enforcement

In Python, any function with 2+ `bool` parameters MUST use `*` to make
them keyword-only:

```python
def foo(a: int, *, flag1: bool = False, flag2: bool = False): ...
```

Flag any PR introducing positional boolean params without the `*`.

### R6. Untyped `dict` or `Any` in new Python code

`mypy --strict` is the standard. Reject:
- `def foo(data: dict)` — needs `dict[str, X]`
- `def foo(data: Any)` — needs proper typing or `unknown`-equivalent
  (`object` + narrowing)

Exception: third-party APIs that return `Any` are fine to narrow at the
boundary.

## Style preferences — comment but don't block

### S1. Comment narrating a change

If a PR adds a comment like:

```python
# Switched from X to Y because Y is faster
```

…leave a comment suggesting it be moved to the PR description instead:
the rationale for the change doesn't survive the change. The CURRENT
code should be self-explanatory; HISTORICAL context belongs in commit
messages.

### S2. New TODO without context

A TODO comment like `# TODO: fix this` is noise. Suggest format:

```python
# TODO(post-PoC): use AspectPriority.READONLY here once CDK 3.x ships
# (currently incompatible with our minimum 2.168 peer dep range).
```

A TODO without an actor or specific direction is just future debt.

### S3. Duplicated regex / pattern

If a PR adds a regex that duplicates one already in `validation/work_id.py`
or `contracts/_base.py`, suggest importing the existing constant instead.

### S4. New workflow factory without JSDoc

Workflow factories in `packages/framework/src/workflows/` must have JSDoc
explaining:
- Pipeline position (which stage)
- Language dependence (`INDEPENDENT` or `DEPENDENT`)
- What the implementation does (or "not implemented in PoC" if stub)

### S5. New CLI subcommand without help string

Every `typer.Option` and `typer.Argument` in `__main__.py` must have an
explicit `help=` string. The CLI is end-user-facing; cryptic flags are a
bug.

## What to actively praise

When you see these patterns done correctly, call them out — positive
reinforcement matters for inner-source contributors:

- Pure functions split from I/O wrappers
- Discriminated unions with `assertNever` exhaustiveness
- Test files mirroring the source structure
- Layered resolution helpers (`_resolve_repo_url`, `_resolve_service_name`)
- Conditional spread (`...(cond ? {key} : {})`) used to omit optional props
- `as const satisfies T` for typed string-literal lists
- Aspects registered with explicit priority
- Idempotent install/uninstall pairs

## Scope of this file

These rules apply to the `devex` monorepo. Consumer repos (services using
`@devex/framework`) have their own conventions — these rules are about the
framework and CLI source themselves.

## Updating the rules

When a recurring review comment surfaces 3+ times, propose adding it here
via a small PR. The goal is institutional knowledge encoded as automation,
not human-by-human teaching.
