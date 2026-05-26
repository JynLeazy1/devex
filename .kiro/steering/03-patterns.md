# Patterns to follow / anti-patterns to refuse

## Patterns we use (apply when generating code)

### 1. Discriminated unions over inheritance

For polyglot stack profiles, runtime variants, or any "kind of thing" with
distinct shapes, use a discriminated union with a literal `language` /
`type` / `kind` field. Then `switch` on the discriminator with an
`assertNever(_)` default for exhaustiveness.

```typescript
type StackProfile = PythonLambdaProfile | GoLambdaProfile | ...
switch (profile.language) {
  case 'python': ...
  case 'go': ...
  default: assertNever(profile)
}
```

### 2. Pure functions first, I/O second

In every CLI feature:

1. Define pure functions in a dedicated module (e.g., `validation/work_id.py`).
2. Wire them into the CLI in `__main__.py` — a thin wrapper that parses
   Typer args and prints output.
3. Test pure functions exhaustively; test the CLI with integration tests.

This pattern keeps pure logic trivially testable and prevents `git` /
filesystem / network calls from leaking into validators.

### 3. Conditional spread for optional object properties

Use the spread + ternary idiom to include a property only when a condition
is true, rather than setting it to `undefined`:

```typescript
{
  required: 'always there',
  ...(condition ? { optional: value } : {}),
}
```

This makes the difference between "property absent" and "property is
undefined" — relevant for `exactOptionalPropertyTypes` and for APIs that
check `'key' in obj`.

### 4. Tri-state defaults with explicit null

For optional config props where "use default" is distinct from "explicitly
disable", use `string | null` typed as optional (`?:`):

```typescript
readonly sortKeyName?: string | null
// undefined → use default 'SK'
// null → no sort key at all
// 'CustomName' → use that name
```

Resolution pattern:

```typescript
const resolved =
  cfg.sortKeyName === null ? null : (cfg.sortKeyName ?? DEFAULT_SORT_KEY)
```

### 5. Keyword-only arguments for boolean flags

In Python, use `*` to force keyword-only args when there are 2+ booleans:

```python
def write_files(root: Path, files: dict, *, force: bool = False, dry_run: bool = False):
    ...
```

Callers must write `write_files(path, files, force=True)`, not
`write_files(path, files, True)`. Eliminates the "boolean trap" where
positional flags are unreadable.

### 6. Layered resolution for optional configs

When a CLI argument can come from multiple sources, document the order
in a single helper:

```python
def _resolve_repo_url(provided: str | None, service_name: str) -> str:
    # 1. The --repo-url flag if provided
    # 2. Auto-detect from git remote origin
    # 3. TODO placeholder + noisy warning
```

The helper is the single source of truth for "where does this value come from."

### 7. Aspect priority for read-only validation

When writing a CDK Aspect that READS state (e.g., validates tag presence),
register it with `AspectPriority.READONLY` so it runs AFTER all
MUTATING aspects (including CDK's built-in tag propagation):

```typescript
cdk.Aspects.of(this).add(new MyValidatingAspect(), {
  priority: cdk.AspectPriority.READONLY,
})
```

### 8. Graceful degradation in hooks

Git hooks must never crash the user's `git commit` / `git push` unexpectedly.
Failures should:

- Emit a clear error to stderr
- Exit non-zero if the validation truly failed
- **Silently return 0** if the operation was a no-op (e.g., nothing to inject)

A hook that crashes Python with a traceback is worse than one that does nothing.

### 9. Inject absolute paths into hook scripts at install time

Git invokes hooks with a sanitized PATH. Do not write hooks that say
`exec devex ...` directly — resolve the absolute path at install time:

```python
def _devex_invocation() -> str:
    devex_path = shutil.which("devex")
    if devex_path:
        return shlex.quote(devex_path)
    return f"{shlex.quote(sys.executable)} -m devex"
```

If `devex` is later moved (e.g., `uv tool upgrade`), the user must run
`devex hooks install` again to refresh the path.

### 10. Idempotent install + force flag

Any "install" operation that touches user state (files, hooks) must be:

- **Idempotent** when re-run with the same arguments
- **Conservative** by default — refuse to overwrite foreign state
- **Forceable** with an explicit `--force` flag (and warn when used)

Identify "ours" by an embedded marker comment (e.g., `# Managed by devex`).

## Anti-patterns — refuse to generate

### A1. `if branch == True:` instead of `if branch:`

Python anti-idiom; just use truthiness directly.

### A2. Catching bare `Exception` without re-raising

Hides bugs. Catch specific exception types or use `except Exception as exc`
with explicit logging + re-raise.

### A3. Hardcoded AWS account IDs in source

Account IDs come from env vars, SSM, or CDK context — never from source.

### A4. Default branch hardcoded as `main`

Some repos use `master`. Read `git symbolic-ref refs/remotes/origin/HEAD`
or accept a `--base-ref` flag with env var fallback.

### A5. Returning `Optional` when the function should raise

If failure is exceptional and the caller would always need to check
`if result is None`, raise instead. `Optional` is for "this value
legitimately may not exist", not for "I'm too lazy to raise".

### A6. Using `subprocess` to call git when GitPython is already a dependency

`GitPython` is in our deps. Use it. Subprocess is only acceptable for
operations GitPython doesn't support.

### A7. Inline regex patterns in hot paths

Compile regex patterns once (module-level `re.compile()`) when used in a
loop or repeated function calls.

### A8. Boolean parameters without keyword-only enforcement

For Python functions with 2+ booleans, use `*` to force keyword-only.

### A9. Throwing `Error` in CDK Construct constructors without context

If a Construct must reject its input, include enough context in the error
message to debug from CI logs alone (resource path, prop name, expected vs
got).

### A10. Writing tests that depend on `Path.cwd()` without context

`Path.cwd()` in tests changes based on where pytest is run. Use `tmp_path`
fixtures + explicit `os.chdir()` (with try/finally cleanup).
