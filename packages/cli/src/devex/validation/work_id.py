"""Pure validators for Work ID conventions.

Shared regex contract with the framework's `workIdValidationJob` workflow
factory — the CLI runs the same checks locally that the PR pipeline runs in CI.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

# POSIX ERE-compatible (works in JS RegExp, Python re, AND bash grep -qE).
# Mirror of `DEFAULT_WORK_ID_PATTERN` in @devex/framework's profiles/_base.ts.
DEFAULT_WORK_ID_PATTERN = r"[A-Z][A-Z0-9]*-[0-9]+"


@dataclass(frozen=True)
class ValidationIssue:
    """A single Work ID violation."""

    target: str
    value: str
    pattern: str

    def render(self) -> str:
        return (
            f"[{self.target}] '{self.value}' does not contain a Work ID matching "
            f"pattern: {self.pattern}"
        )


def _check(target: str, value: str, pattern: re.Pattern[str]) -> ValidationIssue | None:
    if pattern.search(value):
        return None
    return ValidationIssue(target=target, value=value, pattern=pattern.pattern)


def validate_branch(branch: str, pattern: re.Pattern[str]) -> ValidationIssue | None:
    """Return an issue if `branch` does not contain a Work ID, else None."""
    return _check("branch", branch, pattern)


def validate_commits(
    messages: dict[str, str], pattern: re.Pattern[str]
) -> list[ValidationIssue]:
    """Return one ValidationIssue per commit whose subject lacks a Work ID.

    Args:
        messages: dict of `sha → first line of commit message`.
        pattern: compiled Work ID regex.
    """
    issues: list[ValidationIssue] = []
    for sha, subject in messages.items():
        issue = _check(f"commit:{sha[:7]}", subject, pattern)
        if issue is not None:
            issues.append(issue)
    return issues


def validate_pr_title(title: str, pattern: re.Pattern[str]) -> ValidationIssue | None:
    """Return an issue if `title` lacks a Work ID, else None."""
    return _check("pr-title", title, pattern)


def inject_work_id(
    message: str,
    branch: str | None,
    pattern: re.Pattern[str],
) -> str | None:
    """Prepend the branch's Work ID to `message` if the message lacks one.

    Returns the rewritten message, or None when no change is needed:

    - message already has a Work ID → None
    - branch is None (detached HEAD) → None
    - branch has no Work ID → None

    Used by the `prepare-commit-msg` hook to auto-inject Work IDs into
    commit messages when the developer's branch name already contains the
    ticket reference.
    """
    if pattern.search(message):
        return None
    if branch is None:
        return None

    match = pattern.search(branch)
    if not match:
        return None

    work_id = match.group(0)
    return f"{work_id} {message}"
