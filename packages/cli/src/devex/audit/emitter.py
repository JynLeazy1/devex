"""SOC 2 audit event emission — mirrors the shape of `devex.dora.emitter`.

Same split as DORA: pure builder + thin transport layer. The schema is shared
via `BaseEvent` so DORA and audit can land in the same event stream and be
discriminated by consumers on `schema_version` and presence of `action`.
"""

from __future__ import annotations

import json
import urllib.error
import urllib.request
from datetime import UTC, datetime

from devex.contracts import AuditAction, AuditEvent


class CollectorError(Exception):
    """Raised when posting to the audit collector endpoint fails."""


def build_event(
    *,
    work_id: str,
    team: str,
    repo: str,
    action: AuditAction,
    target: str,
    reason: str,
    actor: str,
    git_sha: str,
    framework_version: str,
    timestamp: datetime | None = None,
) -> AuditEvent:
    """Construct a validated `AuditEvent`. Raises `ValidationError` on bad input."""
    return AuditEvent(
        work_id=work_id,
        team=team,
        repo=repo,
        action=action,
        target=target,
        reason=reason,
        actor=actor,
        timestamp=timestamp or datetime.now(UTC),
        git_sha=git_sha,
        framework_version=framework_version,
    )


def emit_to_stdout(event: AuditEvent) -> str:
    """Serialize to JSON and return the payload (caller prints it)."""
    return event.model_dump_json()


def emit_to_collector(event: AuditEvent, url: str, timeout_seconds: float = 10.0) -> None:
    """POST the event to an audit collector endpoint.

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
