"""CLI-level tests for `devex init` exit codes + repo-url resolution."""

from __future__ import annotations

import os
import subprocess
from collections.abc import Iterator
from pathlib import Path

import pytest
from typer.testing import CliRunner

from devex.__main__ import app

runner = CliRunner()


@pytest.fixture
def in_tmp_dir(tmp_path: Path) -> Iterator[Path]:
    cwd = Path.cwd()
    os.chdir(tmp_path)
    try:
        yield tmp_path
    finally:
        os.chdir(cwd)


def _init_args(repo_url: str = "https://github.com/org/demo") -> list[str]:
    return [
        "init",
        "--service-name",
        "demo",
        "--team",
        "platform",
        "--repo-url",
        repo_url,
    ]


def _init_args_no_url() -> list[str]:
    return ["init", "--service-name", "demo", "--team", "platform"]


def _init_args_no_name(repo_url: str = "https://github.com/org/demo") -> list[str]:
    return ["init", "--team", "platform", "--repo-url", repo_url]


def _git(repo: Path, *args: str) -> None:
    subprocess.run(
        ["git", *args],
        cwd=repo,
        check=True,
        env={**os.environ},
        capture_output=True,
    )


# ---------- Exit-code semantics --------------------------------------------------


def test_fresh_init_creates_all_files_and_exits_0(in_tmp_dir: Path) -> None:
    result = runner.invoke(app, _init_args())
    assert result.exit_code == 0, result.stdout
    assert (in_tmp_dir / "devex.profile.ts").exists()
    assert (in_tmp_dir / "workflows" / "pr.wac.ts").exists()


def test_idempotent_rerun_exits_0_with_all_skipped(in_tmp_dir: Path) -> None:
    """Running init twice in a row: second run skips both files, but
    nothing went wrong — UNIX-style idempotency."""
    runner.invoke(app, _init_args())  # first run creates everything
    result = runner.invoke(app, _init_args())  # second run finds it all
    assert result.exit_code == 0, result.stdout
    assert "exists, use --force" in result.stdout


def test_partial_state_exits_1_with_warning(in_tmp_dir: Path) -> None:
    """If devex.profile.ts already exists but workflows/ doesn't, init creates
    one and skips the other — partial state, exit 1 with warning."""
    (in_tmp_dir / "devex.profile.ts").write_text("// pre-existing")

    result = runner.invoke(app, _init_args())
    assert result.exit_code == 1
    assert "partial state" in (result.stdout + (result.stderr or ""))
    # The pre-existing file was preserved (skipped, not overwritten)
    assert (in_tmp_dir / "devex.profile.ts").read_text() == "// pre-existing"
    # The missing file got created
    assert (in_tmp_dir / "workflows" / "pr.wac.ts").exists()


def test_force_overwrites_and_exits_0(in_tmp_dir: Path) -> None:
    """--force converts skips into overwrites — exit 0."""
    (in_tmp_dir / "devex.profile.ts").write_text("// pre-existing")

    result = runner.invoke(app, [*_init_args(), "--force"])
    assert result.exit_code == 0
    # File was overwritten with framework template
    assert "serviceName" in (in_tmp_dir / "devex.profile.ts").read_text()


def test_dry_run_writes_nothing_and_exits_0(in_tmp_dir: Path) -> None:
    """--dry-run never writes; even if all would be skipped, exit 0."""
    (in_tmp_dir / "devex.profile.ts").write_text("// pre-existing")

    result = runner.invoke(app, [*_init_args(), "--dry-run"])
    assert result.exit_code == 0
    # Pre-existing file untouched, no workflows dir created
    assert (in_tmp_dir / "devex.profile.ts").read_text() == "// pre-existing"
    assert not (in_tmp_dir / "workflows").exists()


# ---------- Repo URL resolution --------------------------------------------------


def test_auto_detects_repo_url_from_git_origin(in_tmp_dir: Path) -> None:
    """When --repo-url is omitted but `origin` remote exists, detect it."""
    _git(in_tmp_dir, "init", "--initial-branch=main")
    _git(in_tmp_dir, "remote", "add", "origin", "git@github.com:my-org/demo.git")

    result = runner.invoke(app, _init_args_no_url())
    assert result.exit_code == 0, result.stdout
    profile = (in_tmp_dir / "devex.profile.ts").read_text()
    # SSH form normalized to https + .git stripped
    assert "repoUrl: 'https://github.com/my-org/demo'" in profile


def test_uses_placeholder_when_no_remote_configured(in_tmp_dir: Path) -> None:
    """In a fresh git repo with no remote, fall back to a TODO placeholder."""
    _git(in_tmp_dir, "init", "--initial-branch=main")

    result = runner.invoke(app, _init_args_no_url())
    assert result.exit_code == 0, result.stdout
    profile = (in_tmp_dir / "devex.profile.ts").read_text()
    assert "TODO-org" in profile
    combined = result.stdout + (result.stderr or "")
    assert "placeholder" in combined.lower()


def test_uses_placeholder_outside_git_repo(in_tmp_dir: Path) -> None:
    """Without a Git repo at all, still falls back to a placeholder."""
    result = runner.invoke(app, _init_args_no_url())
    assert result.exit_code == 0, result.stdout
    profile = (in_tmp_dir / "devex.profile.ts").read_text()
    assert "TODO-org" in profile


def test_explicit_repo_url_overrides_auto_detect(in_tmp_dir: Path) -> None:
    """When --repo-url is provided, the remote is ignored (no auto-detect)."""
    _git(in_tmp_dir, "init", "--initial-branch=main")
    _git(in_tmp_dir, "remote", "add", "origin", "git@github.com:auto-detected/repo.git")

    result = runner.invoke(
        app,
        _init_args(repo_url="https://github.com/explicit/override"),
    )
    assert result.exit_code == 0, result.stdout
    profile = (in_tmp_dir / "devex.profile.ts").read_text()
    assert "repoUrl: 'https://github.com/explicit/override'" in profile
    assert "auto-detected" not in profile


# ---------- Service-name resolution ----------------------------------------------


def test_service_name_inferred_from_cwd(tmp_path: Path) -> None:
    """When --service-name is omitted, fall back to the current directory name."""
    target = tmp_path / "billing-api"
    target.mkdir()
    cwd = Path.cwd()
    os.chdir(target)
    try:
        result = runner.invoke(app, _init_args_no_name())
    finally:
        os.chdir(cwd)

    assert result.exit_code == 0, result.stdout
    profile = (target / "devex.profile.ts").read_text()
    assert "serviceName: 'billing-api'" in profile
    assert "Inferred service name" in result.stdout


def test_explicit_service_name_overrides_inferred(tmp_path: Path) -> None:
    """When --service-name is given, the cwd name is NOT used."""
    target = tmp_path / "billing-api"
    target.mkdir()
    cwd = Path.cwd()
    os.chdir(target)
    try:
        result = runner.invoke(
            app,
            [
                "init",
                "--service-name",
                "explicit-name",
                "--team",
                "platform",
                "--repo-url",
                "https://github.com/org/x",
            ],
        )
    finally:
        os.chdir(cwd)

    assert result.exit_code == 0, result.stdout
    profile = (target / "devex.profile.ts").read_text()
    assert "serviceName: 'explicit-name'" in profile
    assert "billing-api" not in profile
