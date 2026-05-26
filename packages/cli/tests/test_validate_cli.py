"""CLI-level integration tests for `devex validate`.

These tests build a real Git repo in a tmp dir, then invoke the CLI via
Typer's `CliRunner`. Verifies exit codes, output messages, and pattern
overrides via env vars.
"""

from __future__ import annotations

import os
import subprocess
from collections.abc import Iterator
from pathlib import Path

import pytest
from typer.testing import CliRunner

from devex.__main__ import app

runner = CliRunner()


def _git(repo: Path, *args: str, env: dict[str, str] | None = None) -> None:
    full_env = {**os.environ, **(env or {})}
    subprocess.run(
        ["git", *args],
        cwd=repo,
        check=True,
        env=full_env,
        capture_output=True,
    )


@pytest.fixture
def repo(tmp_path: Path) -> Iterator[Path]:
    repo_path = tmp_path / "repo"
    repo_path.mkdir()
    _git(repo_path, "init", "--initial-branch=main")
    _git(repo_path, "config", "user.email", "test@example.com")
    _git(repo_path, "config", "user.name", "Test")
    (repo_path / "README.md").write_text("# test\n")
    _git(repo_path, "add", ".")
    _git(repo_path, "commit", "-m", "FIN-1 initial commit")

    cwd = Path.cwd()
    os.chdir(repo_path)
    try:
        yield repo_path
    finally:
        os.chdir(cwd)


def test_validate_exits_2_outside_git_repo(tmp_path: Path) -> None:
    cwd = Path.cwd()
    os.chdir(tmp_path)
    try:
        result = runner.invoke(app, ["validate", "--no-commits"])
    finally:
        os.chdir(cwd)
    assert result.exit_code == 2
    assert "not inside a git repository" in result.stdout.lower() or "not inside" in (result.stderr or "").lower()


def test_validate_passes_on_compliant_branch(repo: Path) -> None:
    _git(repo, "checkout", "-b", "feat/FIN-123-balance")
    result = runner.invoke(app, ["validate", "--no-commits"])
    assert result.exit_code == 0, result.stdout
    assert "passed" in result.stdout.lower()


def test_validate_fails_on_branch_without_work_id(repo: Path) -> None:
    _git(repo, "checkout", "-b", "random-branch")
    result = runner.invoke(app, ["validate", "--no-commits"])
    assert result.exit_code == 1
    assert "random-branch" in result.stdout


def test_validate_with_all_checks_disabled_exits_2(repo: Path) -> None:
    """With --no-branch --no-commits and no --pr-title, NO check is enabled.
    The CLI refuses to silently pass — that would mask a broken pre-push hook
    where someone removed all the flags 'to make it stop bothering me'."""
    _git(repo, "checkout", "-b", "random-branch")
    result = runner.invoke(app, ["validate", "--no-branch", "--no-commits"])
    assert result.exit_code == 2
    assert "no validations enabled" in (result.stdout + (result.stderr or ""))


def test_validate_with_only_pr_title_still_validates(repo: Path) -> None:
    """If at least one check is enabled (here only --pr-title via flag), the
    command runs normally — the safeguard is only for the all-disabled case."""
    _git(repo, "checkout", "-b", "random-branch")  # would fail branch if validated
    result = runner.invoke(
        app,
        [
            "validate",
            "--no-branch",
            "--no-commits",
            "--pr-title",
            "FIN-1 add feature",
        ],
    )
    assert result.exit_code == 0
    assert "pr-title" in result.stdout  # acknowledges which check ran


def test_validate_pr_title_passes_when_id_present(repo: Path) -> None:
    result = runner.invoke(
        app,
        [
            "validate",
            "--no-branch",
            "--no-commits",
            "--pr-title",
            "FIN-456 Add some feature",
        ],
    )
    assert result.exit_code == 0


def test_validate_pr_title_fails_without_id(repo: Path) -> None:
    result = runner.invoke(
        app,
        [
            "validate",
            "--no-branch",
            "--no-commits",
            "--pr-title",
            "Add some feature without id",
        ],
    )
    assert result.exit_code == 1
    assert "pr-title" in result.stdout


def test_validate_pr_title_from_env_var(repo: Path) -> None:
    result = runner.invoke(
        app,
        ["validate", "--no-branch", "--no-commits"],
        env={"GITHUB_PR_TITLE": "no work id here"},
    )
    assert result.exit_code == 1


def test_custom_pattern_via_flag(repo: Path) -> None:
    _git(repo, "checkout", "-b", "DATA-1234-process")
    result = runner.invoke(
        app,
        ["validate", "--no-commits", "--pattern", r"DATA-\d{4}"],
    )
    assert result.exit_code == 0


def test_custom_pattern_via_env_var(repo: Path) -> None:
    _git(repo, "checkout", "-b", "DATA-1234-process")
    result = runner.invoke(
        app,
        ["validate", "--no-commits"],
        env={"DEVEX_WORK_ID_PATTERN": r"DATA-\d{4}"},
    )
    assert result.exit_code == 0


def test_validate_warns_and_skips_commits_when_base_ref_missing(repo: Path) -> None:
    result = runner.invoke(
        app,
        ["validate", "--no-branch", "--base-ref", "nonexistent-ref"],
    )
    # Commits validation degrades to a warning — no violations to report
    assert result.exit_code == 0
