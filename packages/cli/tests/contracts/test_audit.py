"""Tests for the AuditEvent schema (Python mirror)."""

from __future__ import annotations

from datetime import datetime, timezone

import pytest
from pydantic import ValidationError

from devex.contracts import SCHEMA_VERSION, AuditAction, AuditEvent


def _valid_payload() -> dict:
    return {
        "schema_version": SCHEMA_VERSION,
        "work_id": "FIN-456",
        "team": "transactionify",
        "repo": "https://github.com/org/transactionify",
        "action": "pr-merged",
        "target": "PR #123",
        "actor": "two-reviewer-bot",
        "timestamp": datetime(2026, 5, 23, 15, 0, 0, tzinfo=timezone.utc),
        "reason": "Merged after approvals by alice and bob (two-reviewer rule)",
        "git_sha": "deadbeef",
        "framework_version": "0.1.0",
    }


class TestAuditEvent:
    def test_accepts_well_formed_event(self) -> None:
        event = AuditEvent.model_validate(_valid_payload())
        assert event.action == AuditAction.PR_MERGED
        assert "two-reviewer" in event.reason

    def test_rejects_empty_reason(self) -> None:
        payload = _valid_payload() | {"reason": ""}
        with pytest.raises(ValidationError):
            AuditEvent.model_validate(payload)

    def test_rejects_unknown_action(self) -> None:
        payload = _valid_payload() | {"action": "secret-shenanigans"}
        with pytest.raises(ValidationError):
            AuditEvent.model_validate(payload)

    def test_rejects_empty_target(self) -> None:
        payload = _valid_payload() | {"target": ""}
        with pytest.raises(ValidationError):
            AuditEvent.model_validate(payload)
