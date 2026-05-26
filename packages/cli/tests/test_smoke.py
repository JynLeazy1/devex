"""Smoke tests — verify the CLI is wired up and entry points exist."""

from __future__ import annotations

from typer.testing import CliRunner

from devex import __version__
from devex.__main__ import app


runner = CliRunner()


def test_version_flag_returns_zero() -> None:
    result = runner.invoke(app, ["--version"])
    assert result.exit_code == 0
    assert __version__ in result.stdout


def test_help_lists_core_commands() -> None:
    result = runner.invoke(app, ["--help"])
    assert result.exit_code == 0
    for cmd in ("validate", "init", "hooks", "dora", "audit", "check"):
        assert cmd in result.stdout


def test_validate_with_no_checks_enabled_exits_2() -> None:
    """Disabling every validation surface is misuse — refuse to silently pass."""
    result = runner.invoke(app, ["validate", "--no-branch", "--no-commits"])
    assert result.exit_code == 2
