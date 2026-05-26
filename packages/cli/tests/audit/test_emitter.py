"""Pure tests for the audit emitter helpers."""

from __future__ import annotations

import json
from datetime import UTC, datetime

import pytest
from pydantic import ValidationError

from devex.audit import build_event, emit_to_stdout
from devex.contracts import AuditAction


def _kwargs(**overrides) -> dict:
    base = dict(
        work_id="FIN-123",
        team="platform",
        repo="https://github.com/org/svc",
        action=AuditAction.PR_MERGED,
        target="PR #42",
        reason="Merged by two approvers via Golden Path two-reviewer rule",
        actor="jorge",
        git_sha="abc1234",
        framework_version="0.1.0",
        timestamp=datetime(2026, 5, 24, 12, 0, 0, tzinfo=UTC),
    )
    base.update(overrides)
    return base


class TestBuildEvent:
    def test_builds_valid_event_from_minimal_inputs(self) -> None:
        ev = build_event(**_kwargs())
        assert ev.work_id == "FIN-123"
        assert ev.action == AuditAction.PR_MERGED
        assert ev.target == "PR #42"
        assert ev.reason.startswith("Merged")

    def test_rejects_empty_target(self) -> None:
        with pytest.raises(ValidationError):
            build_event(**_kwargs(target=""))

    def test_rejects_empty_reason(self) -> None:
        with pytest.raises(ValidationError):
            build_event(**_kwargs(reason=""))

    def test_rejects_invalid_work_id(self) -> None:
        with pytest.raises(ValidationError):
            build_event(**_kwargs(work_id="not-an-id"))

    def test_timestamp_defaults_to_now_when_omitted(self) -> None:
        kwargs = _kwargs()
        del kwargs["timestamp"]
        ev = build_event(**kwargs)
        assert ev.timestamp is not None
        assert ev.timestamp.tzinfo is not None


class TestEmitToStdout:
    def test_serializes_to_valid_json(self) -> None:
        ev = build_event(**_kwargs())
        parsed = json.loads(emit_to_stdout(ev))
        assert parsed["work_id"] == "FIN-123"
        assert parsed["action"] == "pr-merged"
        assert parsed["schema_version"] == "1.0"

    def test_json_has_all_audit_keys(self) -> None:
        ev = build_event(**_kwargs())
        parsed = json.loads(emit_to_stdout(ev))
        required = {
            "schema_version",
            "work_id",
            "team",
            "repo",
            "action",
            "target",
            "reason",
            "actor",
            "timestamp",
            "git_sha",
            "framework_version",
        }
        assert required.issubset(parsed.keys())
