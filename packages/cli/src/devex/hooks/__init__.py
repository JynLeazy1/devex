"""Git hook management — `devex hooks install / uninstall`."""

from devex.hooks.installer import (
    DEVEX_MARKER,
    HookResult,
    InstallOutcome,
    UninstallOutcome,
    hooks_dir,
    install_pre_push,
    install_prepare_commit_msg,
    is_devex_managed,
    uninstall_pre_push,
    uninstall_prepare_commit_msg,
)

__all__ = [
    "DEVEX_MARKER",
    "HookResult",
    "InstallOutcome",
    "UninstallOutcome",
    "hooks_dir",
    "install_pre_push",
    "install_prepare_commit_msg",
    "is_devex_managed",
    "uninstall_pre_push",
    "uninstall_prepare_commit_msg",
]
