# Code conventions

## Python (CLI)

- Python 3.11+ only. Do not use features deprecated in 3.11.
- `from __future__ import annotations` at the top of every module that has
  type hints.
- `mypy --strict` must pass. Avoid `Any`; use `unknown`-equivalent narrowing.
- `ruff` formats and lints (line length 100).
- Type hints are mandatory on every public function and method.
- Use `|` syntax for union types (`str | None`), not `Optional[str]`.

### Typer-specific

- CLI commands use Typer's `typer.Option(...)` with explicit help strings.
- For boolean flags, use `--flag/--no-flag` paired syntax in a single Option.
- For required arguments, use `...` (Ellipsis) as the first arg of `typer.Option`.
- Mark internal subcommands (invoked by hooks, not users) with `hidden=True`.
- Exit codes: 0 = success, 1 = command found violations, 2 = usage/env error.
- Use `raise typer.Exit(code=N)` — never `sys.exit(N)`.
- Use `rich.markup.escape()` when interpolating user-visible strings that
  contain square brackets (which Rich would otherwise interpret as markup).

### File structure

- Pure functions (no I/O) live in modules named for the domain (`validation`,
  `init`, `dora`, `hooks`).
- I/O-touching code is isolated in dedicated submodules (e.g., `validation/git.py`).
- The CLI entry (`__main__.py`) is a thin wrapper over the pure modules.

## TypeScript (framework)

- TypeScript 5.0+ in strict mode.
- Target ES2022, module CommonJS (matches CDK's runtime).
- No `any`; use `unknown` + narrowing or proper generics.
- Single quotes, no semicolons.
- Imports ordered: `node:` builtins → third-party → relative.
- Use `readonly` on every interface field unless mutability is required.
- Prefer `as const satisfies T` over plain `as const` to validate the const
  against `T` without losing literal types.

### Type-only imports

When importing only for types, use `import type` to avoid runtime overhead
and clarify intent:

```typescript
import type { StackProfile } from '../profiles'
import { NormalJob } from '@github-actions-workflow-ts/lib'
```

### CDK Constructs

- Class extends `Construct`; constructor signature is always
  `(scope: Construct, id: string, props: SomeProps)`.
- Call `super(scope, id)` first, before any `this.*` access.
- Expose useful internal resources as `public readonly` for escape-hatch access.
- Use `cdk.Tags.of(this).add(...)` for tag application — do not set tags
  directly on CfnResource children.
- Register Aspects with explicit priority when ordering matters:
  `cdk.Aspects.of(this).add(aspect, { priority: cdk.AspectPriority.READONLY })`

### `@github-actions-workflow-ts` usage

- Workflow source files: `workflows/*.wac.ts` extension is required by the CLI.
- Workflows MUST be exported to be generated: `export const myWorkflow = new Workflow(...)`
- Steps are reusable via TypeScript imports — share common steps across jobs.
- Use the typed action wrappers (`ActionsCheckoutV4`, `ActionsSetupNodeV4`,
  etc.) when available for autocomplete and version safety.

## Testing

| Change type | Required tests |
|---|---|
| Pure function | 100% line coverage; explicit edge cases |
| CDK Construct | `aws-cdk-lib/assertions`: template assertions for resources, properties, counts, outputs |
| Workflow factory | Shape assertions on `NormalJob`: step count, names, env vars, conditions, ordering |
| CLI command | `CliRunner` integration: happy path + at least one error path |
| Shared contract change | Positive + negative validation cases. Mirror tests in both languages. |

## Commits and branches

- Branch names match `[A-Z]+-\d+` somewhere (e.g., `feat/FIN-123-add-balance`).
- Commit subjects must contain the Work ID.
- The `devex` CLI's pre-push hook enforces these locally.
- `devex hooks install --auto-inject` auto-prepends Work IDs from branch names.

## Comments

- **Do not** narrate the journey of a change ("migrated from X to Y because…").
  That belongs in commit messages and PR descriptions.
- **Do** explain non-obvious WHY of the current code (subtle invariants,
  framework quirks, workarounds).
- `TODO(post-PoC):` comments are acceptable when they describe future state
  with a specific direction.

## What NOT to do

- Don't use `print()` for CLI output — use `console.print()` / `err_console.print()`.
- Don't import `git` from non-`validation/` modules in the CLI.
- Don't add fields to `StackProfile` without updating BOTH the type AND every
  factory's `switch` statement.
- Don't bake AWS account IDs into source — they should come from env or CDK context.
- Don't write tests that depend on the user's actual git config.
- Don't add a new boolean flag to a CLI command without `--flag/--no-flag` paired syntax.
