"""Pure file-system helpers for `devex hooks install / uninstall`.

Two managed hooks:

- **pre-push** — runs `devex validate --no-commits` to enforce branch + PR title
  conventions before code leaves the developer machine.
- **prepare-commit-msg** (opt-in via `--auto-inject`) — invokes
  `devex hooks commit-msg-inject` to prepend the branch's Work ID to commit
  messages that lack one.

Marker line is checked to identify devex-managed hooks: we never overwrite or
delete hooks the user wrote by hand without `--force`.
"""

from __future__ import annotations

import shlex
import shutil
import stat
import sys
from dataclasses import dataclass
from enum import Enum
from pathlib import Path

#: Marker line embedded in every devex-managed hook so we can identify them.
DEVEX_MARKER = "# Managed by devex — do not edit. Run 'devex hooks uninstall' to remove."


def _devex_invocation() -> str:
    """Shell-quoted command to invoke devex from inside a Git hook.

    Git runs hooks with a sanitized PATH, so we cannot rely on `devex` being
    resolvable. We bake the absolute path at install time. If the binary is
    moved (uv tool upgrade, OS reinstall), the user must run
    `devex hooks install` again.
    """
    devex_path = shutil.which("devex")
    if devex_path:
        return shlex.quote(devex_path)
    return f"{shlex.quote(sys.executable)} -m devex"


def _render_pre_push(*, with_checks: bool = False) -> str:
    devex = _devex_invocation()
    lines = [
        "#!/usr/bin/env bash",
        DEVEX_MARKER,
        "set -e",
        f"{devex} validate --no-commits",
    ]
    if with_checks:
        # When --with-checks is enabled, the hook also runs `devex check`
        # which reads testCommand/lintCommands from devex.profile.ts.
        lines.append(f"{devex} check")
    return "\n".join(lines) + "\n"


def _render_prepare_commit_msg() -> str:
    return (
        "#!/usr/bin/env bash\n"
        f"{DEVEX_MARKER}\n"
        f'exec {_devex_invocation()} hooks commit-msg-inject "$@"\n'
    )


class InstallOutcome(Enum):
    INSTALLED = "installed"
    REPLACED_DEVEX_HOOK = "replaced devex-managed hook"
    REFUSED_EXISTING = "refused (existing non-devex hook)"
    OVERWROTE_FOREIGN = "overwrote foreign hook (--force)"


class UninstallOutcome(Enum):
    REMOVED = "removed"
    SKIPPED_NOT_DEVEX = "skipped (hook is not devex-managed)"
    SKIPPED_NOT_PRESENT = "skipped (no hook installed)"


@dataclass(frozen=True)
class HookResult:
    name: str
    path: Path
    outcome: InstallOutcome | UninstallOutcome


def hooks_dir(repo_root: Path) -> Path:
    """Return `<repo_root>/.git/hooks/`."""
    return repo_root / ".git" / "hooks"


def is_devex_managed(path: Path) -> bool:
    """True if the hook file was authored by `devex hooks install`."""
    if not path.exists():
        return False
    try:
        content = path.read_text(encoding="utf-8")
    except (OSError, UnicodeDecodeError):
        return False
    return DEVEX_MARKER in content


def _install_hook(
    hook_name: str,
    template: str,
    repo_root: Path,
    *,
    force: bool = False,
) -> HookResult:
    target = hooks_dir(repo_root) / hook_name

    if target.exists():
        if is_devex_managed(target):
            outcome = InstallOutcome.REPLACED_DEVEX_HOOK
        elif force:
            outcome = InstallOutcome.OVERWROTE_FOREIGN
        else:
            return HookResult(
                name=hook_name, path=target, outcome=InstallOutcome.REFUSED_EXISTING
            )
    else:
        outcome = InstallOutcome.INSTALLED

    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(template, encoding="utf-8")
    target.chmod(target.stat().st_mode | stat.S_IXUSR | stat.S_IXGRP | stat.S_IXOTH)
    return HookResult(name=hook_name, path=target, outcome=outcome)


def _uninstall_hook(hook_name: str, repo_root: Path) -> HookResult:
    target = hooks_dir(repo_root) / hook_name

    if not target.exists():
        return HookResult(
            name=hook_name, path=target, outcome=UninstallOutcome.SKIPPED_NOT_PRESENT
        )

    if not is_devex_managed(target):
        return HookResult(
            name=hook_name, path=target, outcome=UninstallOutcome.SKIPPED_NOT_DEVEX
        )

    target.unlink()
    return HookResult(name=hook_name, path=target, outcome=UninstallOutcome.REMOVED)


# Public per-hook entry points — kept around so existing callers stay stable.


def install_pre_push(
    repo_root: Path, *, force: bool = False, with_checks: bool = False
) -> HookResult:
    return _install_hook(
        "pre-push",
        _render_pre_push(with_checks=with_checks),
        repo_root,
        force=force,
    )


def install_prepare_commit_msg(repo_root: Path, *, force: bool = False) -> HookResult:
    return _install_hook(
        "prepare-commit-msg",
        _render_prepare_commit_msg(),
        repo_root,
        force=force,
    )


def uninstall_pre_push(repo_root: Path) -> HookResult:
    return _uninstall_hook("pre-push", repo_root)


def uninstall_prepare_commit_msg(repo_root: Path) -> HookResult:
    return _uninstall_hook("prepare-commit-msg", repo_root)
