"""Pure tests for the DORA emitter helpers."""

from __future__ import annotations

import json
from datetime import datetime, timezone

import pytest
from pydantic import ValidationError

from devex.contracts import Stage, Status
from devex.dora import build_event, emit_to_stdout


def _kwargs(**overrides) -> dict:
    base = dict(
        work_id="FIN-123",
        team="platform",
        repo="https://github.com/org/svc",
        stage=Stage.SMALL_TESTS,
        status=Status.SUCCESS,
        actor="jorge",
        git_sha="abc1234",
        framework_version="0.1.0",
        timestamp=datetime(2026, 5, 24, 12, 0, 0, tzinfo=timezone.utc),
    )
    base.update(overrides)
    return base


class TestBuildEvent:
    def test_builds_valid_event_from_minimal_inputs(self) -> None:
        ev = build_event(**_kwargs())
        assert ev.work_id == "FIN-123"
        assert ev.stage == Stage.SMALL_TESTS
        assert ev.status == Status.SUCCESS
        assert ev.duration_ms is None
        assert ev.reason is None

    def test_rejects_invalid_work_id_format(self) -> None:
        with pytest.raises(ValidationError):
            build_event(**_kwargs(work_id="fin-123"))

    def test_rejects_invalid_git_sha(self) -> None:
        with pytest.raises(ValidationError):
            build_event(**_kwargs(git_sha="not-a-sha"))

    def test_rejects_negative_duration(self) -> None:
        with pytest.raises(ValidationError):
            build_event(**_kwargs(duration_ms=-1))

    def test_timestamp_defaults_to_now_when_omitted(self) -> None:
        kwargs = _kwargs()
        del kwargs["timestamp"]
        ev = build_event(**kwargs)
        assert ev.timestamp is not None
        # Default is current UTC; should be tz-aware
        assert ev.timestamp.tzinfo is not None


class TestEmitToStdout:
    def test_serializes_to_valid_json(self) -> None:
        ev = build_event(**_kwargs())
        payload = emit_to_stdout(ev)
        parsed = json.loads(payload)
        assert parsed["work_id"] == "FIN-123"
        assert parsed["schema_version"] == "1.0"

    def test_json_has_all_required_keys(self) -> None:
        ev = build_event(**_kwargs())
        parsed = json.loads(emit_to_stdout(ev))
        required = {
            "schema_version",
            "work_id",
            "team",
            "repo",
            "stage",
            "status",
            "actor",
            "timestamp",
            "duration_ms",
            "git_sha",
            "framework_version",
            "reason",
        }
        assert required.issubset(parsed.keys())
