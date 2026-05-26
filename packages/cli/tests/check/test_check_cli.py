"""CLI integration tests for `devex check`."""

from __future__ import annotations

import os
from collections.abc import Iterator
from pathlib import Path

import pytest
from typer.testing import CliRunner

from devex.__main__ import app

runner = CliRunner()

_PROFILE_WITH_PASSING_CHECKS = """\
testCommand: 'true',
lintCommands: ['true', 'true'],
"""

_PROFILE_WITH_FAILING_LINT = """\
testCommand: 'true',
lintCommands: ['true', 'false', 'true'],
"""


@pytest.fixture
def in_tmp_dir(tmp_path: Path) -> Iterator[Path]:
    cwd = Path.cwd()
    os.chdir(tmp_path)
    try:
        yield tmp_path
    finally:
        os.chdir(cwd)


def test_passes_when_all_commands_succeed(in_tmp_dir: Path) -> None:
    (in_tmp_dir / "devex.profile.ts").write_text(_PROFILE_WITH_PASSING_CHECKS)

    result = runner.invoke(app, ["check"])
    assert result.exit_code == 0, result.stdout
    assert "All checks passed" in result.stdout


def test_exits_1_on_failing_lint(in_tmp_dir: Path) -> None:
    (in_tmp_dir / "devex.profile.ts").write_text(_PROFILE_WITH_FAILING_LINT)

    result = runner.invoke(app, ["check"])
    assert result.exit_code == 1
    combined = result.stdout + (result.stderr or "")
    assert "lint failed" in combined


def test_explicit_flags_override_profile(in_tmp_dir: Path) -> None:
    # Profile says all-pass; --test override forces a failure
    (in_tmp_dir / "devex.profile.ts").write_text(_PROFILE_WITH_PASSING_CHECKS)

    result = runner.invoke(app, ["check", "--test", "false"])
    assert result.exit_code == 1


def test_no_profile_and_no_flags_is_noop(in_tmp_dir: Path) -> None:
    result = runner.invoke(app, ["check"])
    assert result.exit_code == 0
    assert "No check commands configured" in result.stdout


def test_unparseable_profile_warns_and_returns_zero(in_tmp_dir: Path) -> None:
    """An empty/malformed profile must warn but not fail — the hook should
    not block pushes when the profile is hand-edited."""
    (in_tmp_dir / "devex.profile.ts").write_text("// just a comment\n")

    result = runner.invoke(app, ["check"])
    assert result.exit_code == 0
    combined = result.stdout + (result.stderr or "")
    assert "could not parse" in combined.lower()


def test_only_lint_flag_runs_just_that(in_tmp_dir: Path) -> None:
    # Profile has its own commands, but --lint should be the only thing run
    (in_tmp_dir / "devex.profile.ts").write_text(_PROFILE_WITH_FAILING_LINT)

    result = runner.invoke(app, ["check", "--lint", "true"])
    assert result.exit_code == 0
    # Profile's failing lints were NOT used
    assert "false" not in (result.stdout + (result.stderr or ""))
