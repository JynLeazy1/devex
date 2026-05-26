"""Pure-function tests for Work ID validators and URL normalization."""

from __future__ import annotations

import re

import pytest

from devex.validation import (
    DEFAULT_WORK_ID_PATTERN,
    inject_work_id,
    normalize_git_url,
    validate_branch,
    validate_commits,
    validate_pr_title,
)


class TestNormalizeGitUrl:
    def test_ssh_form_becomes_https(self) -> None:
        assert (
            normalize_git_url("git@github.com:org/repo.git")
            == "https://github.com/org/repo"
        )

    def test_ssh_form_without_dot_git(self) -> None:
        assert (
            normalize_git_url("git@github.com:org/repo")
            == "https://github.com/org/repo"
        )

    def test_https_keeps_form_strips_dot_git(self) -> None:
        assert (
            normalize_git_url("https://github.com/org/repo.git")
            == "https://github.com/org/repo"
        )

    def test_clean_https_unchanged(self) -> None:
        assert (
            normalize_git_url("https://github.com/org/repo")
            == "https://github.com/org/repo"
        )

    def test_non_github_host(self) -> None:
        assert (
            normalize_git_url("git@gitlab.example.com:team/svc.git")
            == "https://gitlab.example.com/team/svc"
        )


@pytest.fixture
def default_pattern() -> re.Pattern[str]:
    return re.compile(DEFAULT_WORK_ID_PATTERN)


class TestValidateBranch:
    def test_accepts_branch_with_prefix_and_id(self, default_pattern: re.Pattern[str]) -> None:
        assert validate_branch("feat/FIN-123-add-balance", default_pattern) is None

    def test_accepts_jira_style_id(self, default_pattern: re.Pattern[str]) -> None:
        assert validate_branch("JIRA-9999", default_pattern) is None

    def test_rejects_branch_without_work_id(self, default_pattern: re.Pattern[str]) -> None:
        issue = validate_branch("feature-without-id", default_pattern)
        assert issue is not None
        assert issue.target == "branch"
        assert "feature-without-id" in issue.value

    def test_rejects_lowercase_prefix(self, default_pattern: re.Pattern[str]) -> None:
        # Pattern requires uppercase letters
        assert validate_branch("fin-123", default_pattern) is not None

    def test_custom_pattern(self) -> None:
        pattern = re.compile(r"DATA-\d{4}")
        assert validate_branch("feature/DATA-1234-x", pattern) is None
        assert validate_branch("feature/DATA-123-x", pattern) is not None  # only 3 digits


class TestValidateCommits:
    def test_empty_dict_returns_no_issues(self, default_pattern: re.Pattern[str]) -> None:
        assert validate_commits({}, default_pattern) == []

    def test_all_commits_valid(self, default_pattern: re.Pattern[str]) -> None:
        messages = {
            "abc1234": "FIN-100 Add account create",
            "def5678": "FIN-100 Wire authorizer",
        }
        assert validate_commits(messages, default_pattern) == []

    def test_one_invalid_commit_returns_one_issue(self, default_pattern: re.Pattern[str]) -> None:
        messages = {
            "abc1234": "FIN-100 Add account create",
            "def5678": "wip: trying stuff",
        }
        issues = validate_commits(messages, default_pattern)
        assert len(issues) == 1
        assert issues[0].target == "commit:def5678"

    def test_sha_is_truncated_to_7_chars(self, default_pattern: re.Pattern[str]) -> None:
        messages = {"abcdefg1234567890": "missing id"}
        issues = validate_commits(messages, default_pattern)
        assert issues[0].target == "commit:abcdefg"


class TestValidatePrTitle:
    def test_accepts_title_with_id(self, default_pattern: re.Pattern[str]) -> None:
        assert validate_pr_title("FIN-123 Add balance endpoint", default_pattern) is None

    def test_rejects_empty_title(self, default_pattern: re.Pattern[str]) -> None:
        assert validate_pr_title("", default_pattern) is not None

    def test_rejects_title_without_id(self, default_pattern: re.Pattern[str]) -> None:
        issue = validate_pr_title("Add balance endpoint", default_pattern)
        assert issue is not None
        assert issue.target == "pr-title"


class TestInjectWorkId:
    def test_injects_when_message_lacks_id_and_branch_has_one(
        self, default_pattern: re.Pattern[str]
    ) -> None:
        result = inject_work_id(
            "Add balance endpoint", "feat/FIN-123-balance", default_pattern
        )
        assert result == "FIN-123 Add balance endpoint"

    def test_no_change_when_message_already_has_id(
        self, default_pattern: re.Pattern[str]
    ) -> None:
        result = inject_work_id("FIN-456 Add stuff", "feat/FIN-123-x", default_pattern)
        assert result is None

    def test_no_change_when_branch_has_no_id(
        self, default_pattern: re.Pattern[str]
    ) -> None:
        result = inject_work_id("Add stuff", "random-branch", default_pattern)
        assert result is None

    def test_no_change_when_branch_is_none(self, default_pattern: re.Pattern[str]) -> None:
        result = inject_work_id("Add stuff", None, default_pattern)
        assert result is None

    def test_custom_pattern(self) -> None:
        pattern = re.compile(r"PAY-\d{4}")
        result = inject_work_id("fix bug", "feature/PAY-9876", pattern)
        assert result == "PAY-9876 fix bug"


class TestRender:
    def test_render_contains_target_value_and_pattern(self, default_pattern: re.Pattern[str]) -> None:
        issue = validate_branch("no-id-here", default_pattern)
        assert issue is not None
        rendered = issue.render()
        assert "branch" in rendered
        assert "no-id-here" in rendered
        assert DEFAULT_WORK_ID_PATTERN in rendered


class TestDefaultPatternPortability:
    """Regression for the bug fixed in JynLeazy1/transactionify PR #2: the
    default pattern MUST be POSIX ERE-compatible because the framework emits
    it into a bash `grep -qE` call in the generated workflow YAML."""

    def test_does_not_use_perl_extensions(self) -> None:
        # \d, \w, \s, \b are JS/Python-only. POSIX ERE treats them as literal `d`/etc.
        assert "\\d" not in DEFAULT_WORK_ID_PATTERN
        assert "\\w" not in DEFAULT_WORK_ID_PATTERN
        assert "\\s" not in DEFAULT_WORK_ID_PATTERN

    @pytest.mark.parametrize("work_id", ["FIN-123", "ABC-9", "JIRA-9999", "DATA-1"])
    def test_matches_canonical_positives(self, work_id: str) -> None:
        pattern = re.compile(f"^({DEFAULT_WORK_ID_PATTERN})$")
        assert pattern.match(work_id) is not None

    @pytest.mark.parametrize("bad", ["fin-123", "FIN", "FIN-", "123", "FIN_123", "-9"])
    def test_rejects_canonical_negatives(self, bad: str) -> None:
        pattern = re.compile(f"^({DEFAULT_WORK_ID_PATTERN})$")
        assert pattern.match(bad) is None
