"""Tests for `devex init` template generation + filesystem scaffolding."""

from __future__ import annotations

from pathlib import Path

import pytest

from devex.init import (
    ScaffoldContext,
    WriteOutcome,
    files_for_profile,
    write_files,
)


@pytest.fixture
def ctx() -> ScaffoldContext:
    return ScaffoldContext(
        service_name="payments-api",
        team="platform",
        repo_url="https://github.com/org/payments-api",
        work_id_pattern="PAY-[0-9]+",
    )


class TestTemplates:
    def test_python_lambda_api_returns_2_files(self, ctx: ScaffoldContext) -> None:
        files = files_for_profile("python-lambda-api", ctx)
        assert set(files.keys()) == {"devex.profile.ts", "workflows/pr.wac.ts"}

    def test_unsupported_profile_raises(self, ctx: ScaffoldContext) -> None:
        with pytest.raises(ValueError, match="not supported"):
            files_for_profile("go-lambda-api", ctx)

    def test_devex_profile_substitutes_service_name(self, ctx: ScaffoldContext) -> None:
        files = files_for_profile("python-lambda-api", ctx)
        profile = files["devex.profile.ts"]
        assert "serviceName: 'payments-api'" in profile
        assert "team: 'platform'" in profile
        assert "workIdPattern: 'PAY-[0-9]+'" in profile

    def test_pr_wac_composes_all_5_factories(self, ctx: ScaffoldContext) -> None:
        files = files_for_profile("python-lambda-api", ctx)
        wac = files["workflows/pr.wac.ts"]
        for factory in (
            "workIdValidationJob",
            "smallTestsJob",
            "contractValidationJob",
            "cdkSynthJob",
            "doraSummaryJob",
        ):
            assert factory in wac
        assert "needs(" in wac

    def test_profile_omits_tag_severity_by_default(self, ctx: ScaffoldContext) -> None:
        files = files_for_profile("python-lambda-api", ctx)
        assert "tagSeverity" not in files["devex.profile.ts"]

    def test_profile_writes_strict_tags_when_requested(self) -> None:
        ctx = ScaffoldContext(
            service_name="payments-api",
            team="platform",
            repo_url="https://github.com/org/payments-api",
            strict_tags=True,
        )
        files = files_for_profile("python-lambda-api", ctx)
        assert "tagSeverity: 'error'" in files["devex.profile.ts"]


class TestWriteFiles:
    def test_creates_new_files(self, tmp_path: Path, ctx: ScaffoldContext) -> None:
        files = files_for_profile("python-lambda-api", ctx)
        results = write_files(tmp_path, files)

        assert all(r.outcome == WriteOutcome.CREATED for r in results)
        assert (tmp_path / "devex.profile.ts").exists()
        assert (tmp_path / "workflows" / "pr.wac.ts").exists()

    def test_skips_existing_without_force(self, tmp_path: Path, ctx: ScaffoldContext) -> None:
        (tmp_path / "devex.profile.ts").write_text("existing content")

        files = files_for_profile("python-lambda-api", ctx)
        results = write_files(tmp_path, files)

        # First file was skipped
        skipped = [r for r in results if r.outcome == WriteOutcome.SKIPPED_EXISTS]
        assert len(skipped) == 1
        assert skipped[0].path.name == "devex.profile.ts"
        # Pre-existing content preserved
        assert (tmp_path / "devex.profile.ts").read_text() == "existing content"

    def test_overwrites_with_force(self, tmp_path: Path, ctx: ScaffoldContext) -> None:
        (tmp_path / "devex.profile.ts").write_text("old")

        files = files_for_profile("python-lambda-api", ctx)
        results = write_files(tmp_path, files, force=True)

        overwritten = [r for r in results if r.outcome == WriteOutcome.OVERWRITTEN]
        assert any(r.path.name == "devex.profile.ts" for r in overwritten)
        assert "serviceName" in (tmp_path / "devex.profile.ts").read_text()

    def test_dry_run_writes_nothing(self, tmp_path: Path, ctx: ScaffoldContext) -> None:
        files = files_for_profile("python-lambda-api", ctx)
        results = write_files(tmp_path, files, dry_run=True)

        assert all(r.outcome == WriteOutcome.DRY_RUN for r in results)
        assert not (tmp_path / "devex.profile.ts").exists()
        assert not (tmp_path / "workflows").exists()

    def test_creates_parent_directories(self, tmp_path: Path, ctx: ScaffoldContext) -> None:
        files = files_for_profile("python-lambda-api", ctx)
        write_files(tmp_path, files)
        assert (tmp_path / "workflows" / "pr.wac.ts").exists()
