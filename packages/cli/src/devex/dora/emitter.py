"""DORA event emission — pure functions (no I/O) plus thin transport layer.

The pure side builds and validates a `DoraEvent` from primitive inputs. The
transport side either serializes to JSON (stdout fallback) or POSTs to a
collector endpoint.
"""

from __future__ import annotations

import json
import urllib.error
import urllib.request
from datetime import datetime, timezone

from devex.contracts import DoraEvent, Stage, Status


class CollectorError(Exception):
    """Raised when posting to the DORA collector endpoint fails."""


def build_event(
    *,
    work_id: str,
    team: str,
    repo: str,
    stage: Stage,
    status: Status,
    actor: str,
    git_sha: str,
    framework_version: str,
    duration_ms: int | None = None,
    reason: str | None = None,
    timestamp: datetime | None = None,
) -> DoraEvent:
    """Construct a validated `DoraEvent`. Raises `ValidationError` on bad input."""
    return DoraEvent(
        work_id=work_id,
        team=team,
        repo=repo,
        stage=stage,
        status=status,
        actor=actor,
        timestamp=timestamp or datetime.now(timezone.utc),
        duration_ms=duration_ms,
        git_sha=git_sha,
        framework_version=framework_version,
        reason=reason,
    )


def emit_to_stdout(event: DoraEvent) -> str:
    """Serialize to JSON and return the payload (caller prints it)."""
    return event.model_dump_json()


def emit_to_collector(event: DoraEvent, url: str, timeout_seconds: float = 10.0) -> None:
    """POST the event to a DORA collector endpoint.

    Raises:
        CollectorError: when the request fails (network, non-2xx response).
    """
    payload = event.model_dump_json().encode("utf-8")
    req = urllib.request.Request(
        url,
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout_seconds) as resp:
            if resp.status >= 300:
                raise CollectorError(
                    f"Collector returned HTTP {resp.status}: {resp.read().decode()[:200]}"
                )
    except urllib.error.URLError as exc:
        raise CollectorError(f"Failed to POST to {url}: {exc}") from exc
    except json.JSONDecodeError as exc:
        raise CollectorError(f"Collector response not parseable: {exc}") from exc
