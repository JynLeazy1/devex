"""Pure tests for devex hook installer."""

from __future__ import annotations

import os
import stat
from pathlib import Path

import pytest

from devex.hooks import (
    DEVEX_MARKER,
    InstallOutcome,
    UninstallOutcome,
    install_pre_push,
    install_prepare_commit_msg,
    is_devex_managed,
    uninstall_pre_push,
    uninstall_prepare_commit_msg,
)


@pytest.fixture
def repo(tmp_path: Path) -> Path:
    """A bare-minimum 'repo' (just the .git/hooks layout we need)."""
    (tmp_path / ".git" / "hooks").mkdir(parents=True)
    return tmp_path


class TestInstall:
    def test_creates_hook_when_none_exists(self, repo: Path) -> None:
        result = install_pre_push(repo)
        hook = repo / ".git" / "hooks" / "pre-push"

        assert result.outcome == InstallOutcome.INSTALLED
        assert hook.exists()
        assert DEVEX_MARKER in hook.read_text()
        # Executable bit set
        assert os.access(hook, os.X_OK)

    def test_replaces_existing_devex_hook_idempotently(self, repo: Path) -> None:
        install_pre_push(repo)
        result = install_pre_push(repo)
        assert result.outcome == InstallOutcome.REPLACED_DEVEX_HOOK

    def test_refuses_existing_non_devex_hook(self, repo: Path) -> None:
        hook = repo / ".git" / "hooks" / "pre-push"
        hook.write_text("#!/bin/bash\necho 'my custom hook'\n")

        result = install_pre_push(repo)
        assert result.outcome == InstallOutcome.REFUSED_EXISTING
        assert "my custom hook" in hook.read_text()

    def test_force_overwrites_non_devex_hook(self, repo: Path) -> None:
        hook = repo / ".git" / "hooks" / "pre-push"
        hook.write_text("#!/bin/bash\necho 'my custom hook'\n")

        result = install_pre_push(repo, force=True)
        assert result.outcome == InstallOutcome.OVERWROTE_FOREIGN
        assert DEVEX_MARKER in hook.read_text()

    def test_creates_hooks_dir_if_missing(self, tmp_path: Path) -> None:
        (tmp_path / ".git").mkdir()
        result = install_pre_push(tmp_path)
        assert result.outcome == InstallOutcome.INSTALLED
        assert result.path.parent.exists()


class TestUninstall:
    def test_removes_devex_managed_hook(self, repo: Path) -> None:
        install_pre_push(repo)
        result = uninstall_pre_push(repo)
        assert result.outcome == UninstallOutcome.REMOVED
        assert not result.path.exists()

    def test_skips_non_devex_hook(self, repo: Path) -> None:
        hook = repo / ".git" / "hooks" / "pre-push"
        hook.write_text("#!/bin/bash\necho custom\n")

        result = uninstall_pre_push(repo)
        assert result.outcome == UninstallOutcome.SKIPPED_NOT_DEVEX
        assert hook.exists()
        assert "custom" in hook.read_text()

    def test_skips_when_no_hook_present(self, repo: Path) -> None:
        result = uninstall_pre_push(repo)
        assert result.outcome == UninstallOutcome.SKIPPED_NOT_PRESENT


class TestIsDevexManaged:
    def test_true_for_devex_hook(self, repo: Path) -> None:
        install_pre_push(repo)
        assert is_devex_managed(repo / ".git" / "hooks" / "pre-push")

    def test_false_for_custom_hook(self, repo: Path) -> None:
        hook = repo / ".git" / "hooks" / "pre-push"
        hook.write_text("#!/bin/bash\necho custom\n")
        assert not is_devex_managed(hook)

    def test_false_for_nonexistent(self, repo: Path) -> None:
        assert not is_devex_managed(repo / ".git" / "hooks" / "pre-push")


class TestPrePushWithChecks:
    def test_default_hook_does_not_include_check(self, repo: Path) -> None:
        install_pre_push(repo)
        content = (repo / ".git" / "hooks" / "pre-push").read_text()
        assert "validate --no-commits" in content
        assert "devex check" not in content

    def test_with_checks_appends_devex_check(self, repo: Path) -> None:
        install_pre_push(repo, with_checks=True)
        content = (repo / ".git" / "hooks" / "pre-push").read_text()
        assert "validate --no-commits" in content
        assert " check" in content  # devex check (absolute path prefixed)


class TestPrepareCommitMsgHook:
    def test_installs_prepare_commit_msg(self, repo: Path) -> None:
        result = install_prepare_commit_msg(repo)
        hook = repo / ".git" / "hooks" / "prepare-commit-msg"

        assert result.outcome == InstallOutcome.INSTALLED
        assert result.name == "prepare-commit-msg"
        assert hook.exists()
        assert DEVEX_MARKER in hook.read_text()
        assert "devex hooks commit-msg-inject" in hook.read_text()

    def test_uninstalls_prepare_commit_msg(self, repo: Path) -> None:
        install_prepare_commit_msg(repo)
        result = uninstall_prepare_commit_msg(repo)
        assert result.outcome == UninstallOutcome.REMOVED

    def test_install_pre_push_and_prepare_commit_msg_are_independent(
        self, repo: Path
    ) -> None:
        install_pre_push(repo)
        install_prepare_commit_msg(repo)
        assert (repo / ".git" / "hooks" / "pre-push").exists()
        assert (repo / ".git" / "hooks" / "prepare-commit-msg").exists()

        # Uninstalling one does not affect the other
        uninstall_pre_push(repo)
        assert not (repo / ".git" / "hooks" / "pre-push").exists()
        assert (repo / ".git" / "hooks" / "prepare-commit-msg").exists()
