"""File-system scaffolding for `devex init`."""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from pathlib import Path


class WriteOutcome(Enum):
    CREATED = "created"
    SKIPPED_EXISTS = "skipped (exists)"
    OVERWRITTEN = "overwritten"
    DRY_RUN = "dry-run"


@dataclass(frozen=True)
class WriteResult:
    path: Path
    outcome: WriteOutcome


def write_files(
    root: Path,
    files: dict[str, str],
    *,
    force: bool = False,
    dry_run: bool = False,
) -> list[WriteResult]:
    """Write `files` (path → content) under `root`.

    - `force=False`: existing files are skipped (recorded as SKIPPED_EXISTS).
    - `force=True`: existing files are overwritten.
    - `dry_run=True`: nothing is written; outcomes record what WOULD happen.
    """
    results: list[WriteResult] = []
    for rel_path, content in files.items():
        target = root / rel_path
        exists = target.exists()

        if dry_run:
            results.append(WriteResult(path=target, outcome=WriteOutcome.DRY_RUN))
            continue

        if exists and not force:
            results.append(
                WriteResult(path=target, outcome=WriteOutcome.SKIPPED_EXISTS)
            )
            continue

        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(content, encoding="utf-8")
        results.append(
            WriteResult(
                path=target,
                outcome=WriteOutcome.OVERWRITTEN if exists else WriteOutcome.CREATED,
            )
        )
    return results
