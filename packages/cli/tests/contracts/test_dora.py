"""Tests for the DoraEvent schema (Python mirror)."""

from __future__ import annotations

from datetime import datetime, timezone

import pytest
from pydantic import ValidationError

from devex.contracts import SCHEMA_VERSION, DoraEvent, Stage, Status


def _valid_payload() -> dict:
    return {
        "schema_version": SCHEMA_VERSION,
        "work_id": "FIN-123",
        "team": "transactionify",
        "repo": "https://github.com/org/transactionify",
        "stage": "small-tests",
        "status": "success",
        "actor": "jorge.flores",
        "timestamp": datetime(2026, 5, 23, 14, 32, 11, tzinfo=timezone.utc),
        "duration_ms": 47213,
        "git_sha": "abc1234",
        "framework_version": "0.1.0",
        "reason": None,
    }


class TestDoraEvent:
    def test_accepts_well_formed_event(self) -> None:
        event = DoraEvent.model_validate(_valid_payload())
        assert event.work_id == "FIN-123"
        assert event.stage == Stage.SMALL_TESTS
        assert event.status == Status.SUCCESS

    def test_rejects_invalid_work_id(self) -> None:
        payload = _valid_payload() | {"work_id": "fin-123"}
        with pytest.raises(ValidationError, match="PREFIX-123"):
            DoraEvent.model_validate(payload)

    def test_rejects_unknown_stage(self) -> None:
        payload = _valid_payload() | {"stage": "super-secret-stage"}
        with pytest.raises(ValidationError):
            DoraEvent.model_validate(payload)

    def test_rejects_non_hex_git_sha(self) -> None:
        payload = _valid_payload() | {"git_sha": "not-a-sha"}
        with pytest.raises(ValidationError, match="hex git SHA"):
            DoraEvent.model_validate(payload)

    def test_rejects_negative_duration(self) -> None:
        payload = _valid_payload() | {"duration_ms": -1}
        with pytest.raises(ValidationError):
            DoraEvent.model_validate(payload)

    def test_accepts_duration_null_for_started(self) -> None:
        payload = _valid_payload() | {"status": "started", "duration_ms": None}
        event = DoraEvent.model_validate(payload)
        assert event.duration_ms is None

    def test_rejects_missing_required_field(self) -> None:
        payload = _valid_payload()
        del payload["work_id"]
        with pytest.raises(ValidationError):
            DoraEvent.model_validate(payload)

    def test_rejects_wrong_schema_version(self) -> None:
        payload = _valid_payload() | {"schema_version": "0.9"}
        with pytest.raises(ValidationError):
            DoraEvent.model_validate(payload)

    def test_rejects_extra_fields(self) -> None:
        payload = _valid_payload() | {"surprise": "value"}
        with pytest.raises(ValidationError):
            DoraEvent.model_validate(payload)
