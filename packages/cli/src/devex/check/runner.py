"""Subprocess wrapper for running configured lint/test commands.

Commands are executed via `shell=True` because they originate from the
user's own `devex.profile.ts` (trusted source — the user controls it) and
may include shell features (pipes, redirects, env var substitutions).

Stops on the first failure (fail-fast) so a long test run isn't wasted on
a build that already failed lint.
"""

from __future__ import annotations

import shlex
import subprocess
from dataclasses import dataclass
from enum import Enum


class CheckLabel(str, Enum):
    LINT = "lint"
    TEST = "test"


@dataclass(frozen=True)
class CheckResult:
    label: CheckLabel
    command: str
    exit_code: int

    @property
    def passed(self) -> bool:
        return self.exit_code == 0


def run_check(label: CheckLabel, command: str) -> CheckResult:
    """Run one shell command; return its exit code.

    Output streams to the caller's stdout/stderr directly (no capture) so
    the user sees test/lint output in real time, just like running the
    command manually.
    """
    # Validate early — malformed shell quoting fails with a friendlier exit
    # code (2) than a shell crash deep in the subprocess.
    try:
        shlex.split(command)
    except ValueError:
        return CheckResult(label=label, command=command, exit_code=2)

    completed = subprocess.run(command, shell=True, check=False)
    return CheckResult(label=label, command=command, exit_code=completed.returncode)


def run_all(
    lint_commands: tuple[str, ...] | list[str],
    test_command: str | None,
) -> list[CheckResult]:
    """Run lint commands (in order), then the test command. Fail-fast.

    Returns the list of results up to and including the first failure, or
    all results if everything passed.
    """
    results: list[CheckResult] = []

    for cmd in lint_commands:
        result = run_check(CheckLabel.LINT, cmd)
        results.append(result)
        if not result.passed:
            return results

    if test_command:
        result = run_check(CheckLabel.TEST, test_command)
        results.append(result)

    return results
