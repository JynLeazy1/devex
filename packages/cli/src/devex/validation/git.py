"""Thin wrapper around GitPython for the validate command.

Isolated here so the pure validators in `work_id.py` don't import `git`,
keeping them trivially testable without a real repo.
"""

from __future__ import annotations

import re
from pathlib import Path

import git


class NotAGitRepoError(Exception):
    """Raised when the working directory (or any ancestor) is not a Git repo."""


def open_repo(path: Path | None = None) -> git.Repo:
    """Open the Git repo containing `path` (or CWD if None).

    Raises:
        NotAGitRepoError: if no Git repo is found in `path` or its ancestors.
    """
    try:
        return git.Repo(path or Path.cwd(), search_parent_directories=True)
    except git.InvalidGitRepositoryError as exc:
        raise NotAGitRepoError(
            f"Not inside a Git repository: {path or Path.cwd()}"
        ) from exc


def current_branch(repo: git.Repo) -> str | None:
    """Return the active branch name, or None when HEAD is detached."""
    try:
        return repo.active_branch.name
    except TypeError:
        return None


def normalize_git_url(url: str) -> str:
    """Convert any Git URL form to a clean `https://host/owner/repo` shape.

    Handles:
      - `git@github.com:owner/repo.git`  → `https://github.com/owner/repo`
      - `https://github.com/owner/repo.git` → `https://github.com/owner/repo`
      - URL already in canonical form     → returned unchanged
    """
    ssh = re.match(r"^git@([^:]+):(.+?)(?:\.git)?$", url)
    if ssh is not None:
        return f"https://{ssh.group(1)}/{ssh.group(2)}"
    if url.endswith(".git"):
        return url[: -len(".git")]
    return url


def detect_origin_url(repo: git.Repo) -> str | None:
    """Return the `origin` remote URL normalized to `https://...` form.

    Returns None if:
      - the repo has no `origin` remote, OR
      - the remote has no URLs configured.

    Note: this returns whatever is configured as `origin` — for cloned forks,
    that's often the upstream URL, not the fork's. Callers that need "this
    user's fork" must use `--repo-url` explicitly.
    """
    try:
        urls = list(repo.remote("origin").urls)
    except ValueError:
        return None
    if not urls:
        return None
    return normalize_git_url(urls[0])


def commit_messages(
    repo: git.Repo,
    base_ref: str = "origin/main",
    head_ref: str = "HEAD",
) -> dict[str, str]:
    """Return `{sha: first-line-of-message}` for commits between base..head.

    Raises:
        git.GitCommandError: if the ref range can't be resolved (e.g., no
            origin/main locally). Callers typically catch and degrade gracefully.
    """
    result: dict[str, str] = {}
    for commit in repo.iter_commits(f"{base_ref}..{head_ref}"):
        subject = commit.message.split("\n", 1)[0] if isinstance(commit.message, str) else ""
        result[commit.hexsha] = subject
    return result
