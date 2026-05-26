# devex-cli

> The developer-facing component of the [devex Golden Path ecosystem](../../README.md).

A Python CLI distributed via `uv` that automates Git conventions, scaffolds new repositories, and emits standardized DORA telemetry from local and CI environments.

---

## Install

```bash
uv tool install "git+https://github.com/<user>/devex#subdirectory=packages/cli"
```

Pin to a specific version:

```bash
uv tool install "git+https://github.com/<user>/devex@v0.1.0#subdirectory=packages/cli"
```

---

## Commands (PoC scope)

| Command | Purpose |
|---|---|
| `devex --help` | Show help |
| `devex --version` | Show installed version |
| `devex validate` | Validate Work ID in branch / commits / PR title (shift-left enforcement) |
| `devex init --profile <profile>` | Scaffold the Golden Path in a new or existing repo |
| `devex hooks install` | Install pre-push Git hook |
| `devex hooks uninstall` | Remove managed pre-push hook |
| `devex dora emit` | Emit a structured DORA event (used by CI) |

---

## Development

```bash
cd packages/cli
uv pip install -e ".[dev]"
pytest
ruff check .
mypy src
```

---

## Distribution

This package is distributed **only** via Git (not published to PyPI in PoC stage). See the [root README](../../README.md) for the full ecosystem context.
