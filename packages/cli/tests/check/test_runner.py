"""Tests for the check runner (subprocess wrapper)."""

from __future__ import annotations

from devex.check import CheckLabel, run_all, run_check


class TestRunCheck:
    def test_command_that_exits_zero_is_passed(self) -> None:
        result = run_check(CheckLabel.LINT, "true")
        assert result.passed
        assert result.exit_code == 0
        assert result.label is CheckLabel.LINT

    def test_command_that_exits_nonzero_is_failed(self) -> None:
        result = run_check(CheckLabel.TEST, "false")
        assert not result.passed
        assert result.exit_code == 1
        assert result.label is CheckLabel.TEST

    def test_command_with_shell_features(self) -> None:
        # echo prints to caller stdout (captured by pytest) and exits 0
        result = run_check(CheckLabel.LINT, "echo hello | grep hello")
        assert result.passed


class TestRunAll:
    def test_runs_lint_then_test(self) -> None:
        results = run_all(["true"], "true")
        assert len(results) == 2
        assert all(r.passed for r in results)
        # Labels in correct order
        assert results[0].label is CheckLabel.LINT
        assert results[1].label is CheckLabel.TEST

    def test_fail_fast_on_first_lint_failure(self) -> None:
        results = run_all(["true", "false", "true"], "true")
        # Third lint command and test command never run after the second lint fails
        assert len(results) == 2
        assert results[0].passed
        assert not results[1].passed

    def test_no_test_command_skips_test_phase(self) -> None:
        results = run_all(["true"], None)
        assert len(results) == 1
        assert results[0].label is CheckLabel.LINT

    def test_empty_lint_and_no_test_returns_empty(self) -> None:
        results = run_all([], None)
        assert results == []

    def test_only_test_command(self) -> None:
        results = run_all([], "true")
        assert len(results) == 1
        assert results[0].label is CheckLabel.TEST
