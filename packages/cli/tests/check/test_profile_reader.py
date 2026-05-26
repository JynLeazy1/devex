"""Pure tests for the devex.profile.ts regex parser."""

from __future__ import annotations

from pathlib import Path

import pytest

from devex.check import ProfileCommands, parse_profile_commands, resolve_check_commands


_GENERATED_BY_DEVEX_INIT = """\
import type { PythonLambdaProfile } from '@devex/framework'

export const profile: PythonLambdaProfile = {
  language: 'python',
  serviceName: 'billing-api',
  team: 'finance',
  repoUrl: 'https://github.com/org/billing-api',
  workIdPattern: '[A-Z][A-Z0-9]*-\\d+',
  awsRegion: 'us-east-1',
  runtime: '3.12',
  packageManager: 'uv',
  sourcePath: 'src/python',
  testCommand: 'pytest --cov=src/python --cov-report=xml --cov-fail-under=80',
  lintCommands: [
    'ruff check src/python',
    'ruff format --check src/python',
  ],
  openApiPath: null,
  minCoverage: 80,
}
"""


class TestParseProfileCommands:
    def test_parses_devex_init_output(self, tmp_path: Path) -> None:
        path = tmp_path / "devex.profile.ts"
        path.write_text(_GENERATED_BY_DEVEX_INIT)

        cmds = parse_profile_commands(path)
        assert cmds.test_command == (
            "pytest --cov=src/python --cov-report=xml --cov-fail-under=80"
        )
        assert cmds.lint_commands == (
            "ruff check src/python",
            "ruff format --check src/python",
        )

    def test_returns_empty_when_file_does_not_exist(self, tmp_path: Path) -> None:
        cmds = parse_profile_commands(tmp_path / "nope.ts")
        assert cmds == ProfileCommands(test_command=None, lint_commands=())

    def test_handles_double_quoted_values(self, tmp_path: Path) -> None:
        path = tmp_path / "devex.profile.ts"
        path.write_text("""
          testCommand: "pytest",
          lintCommands: ["ruff check ."],
        """)

        cmds = parse_profile_commands(path)
        assert cmds.test_command == "pytest"
        assert cmds.lint_commands == ("ruff check .",)

    def test_handles_single_line_lintCommands(self, tmp_path: Path) -> None:
        path = tmp_path / "devex.profile.ts"
        path.write_text(
            "testCommand: 'pytest',\n"
            "lintCommands: ['ruff check .', 'mypy src'],\n"
        )

        cmds = parse_profile_commands(path)
        assert cmds.lint_commands == ("ruff check .", "mypy src")

    def test_returns_empty_lints_when_block_absent(self, tmp_path: Path) -> None:
        path = tmp_path / "devex.profile.ts"
        path.write_text("testCommand: 'pytest',\n")

        cmds = parse_profile_commands(path)
        assert cmds.test_command == "pytest"
        assert cmds.lint_commands == ()


class TestCommentStripping:
    """Regression: regex used to match keywords inside // comments."""

    def test_line_commented_testCommand_is_ignored(self, tmp_path: Path) -> None:
        path = tmp_path / "devex.profile.ts"
        path.write_text(
            "// testCommand: 'EVIL — should not run',\n"
            "lintCommands: ['ruff check .'],\n"
        )

        cmds = parse_profile_commands(path)
        assert cmds.test_command is None
        assert cmds.lint_commands == ("ruff check .",)

    def test_line_commented_lintCommands_is_ignored(self, tmp_path: Path) -> None:
        path = tmp_path / "devex.profile.ts"
        path.write_text(
            "testCommand: 'pytest',\n"
            "// lintCommands: ['EVIL'],\n"
        )

        cmds = parse_profile_commands(path)
        assert cmds.test_command == "pytest"
        assert cmds.lint_commands == ()

    def test_block_comment_around_field_is_ignored(self, tmp_path: Path) -> None:
        path = tmp_path / "devex.profile.ts"
        path.write_text(
            "/* testCommand: 'EVIL', */\n"
            "lintCommands: ['ruff check .'],\n"
        )

        cmds = parse_profile_commands(path)
        assert cmds.test_command is None
        assert cmds.lint_commands == ("ruff check .",)

    def test_multiline_block_comment(self, tmp_path: Path) -> None:
        path = tmp_path / "devex.profile.ts"
        path.write_text(
            "/*\n"
            "testCommand: 'EVIL',\n"
            "lintCommands: ['EVIL'],\n"
            "*/\n"
            "testCommand: 'pytest',\n"
        )

        cmds = parse_profile_commands(path)
        assert cmds.test_command == "pytest"

    def test_url_with_slashes_inside_string_is_preserved(self, tmp_path: Path) -> None:
        """`//` inside a string value (e.g., a URL) must not be treated as a comment."""
        path = tmp_path / "devex.profile.ts"
        path.write_text("testCommand: 'curl https://example.com/test && pytest',\n")

        cmds = parse_profile_commands(path)
        assert cmds.test_command == "curl https://example.com/test && pytest"

    def test_indented_line_comment_is_stripped(self, tmp_path: Path) -> None:
        path = tmp_path / "devex.profile.ts"
        path.write_text(
            "  // testCommand: 'EVIL',\n"
            "testCommand: 'pytest',\n"
        )

        cmds = parse_profile_commands(path)
        assert cmds.test_command == "pytest"


class TestResolveCheckCommands:
    def test_explicit_flags_win_over_profile(self, tmp_path: Path) -> None:
        path = tmp_path / "devex.profile.ts"
        path.write_text(_GENERATED_BY_DEVEX_INIT)

        result = resolve_check_commands(
            path,
            explicit_test="my-custom-test",
            explicit_lint=["my-custom-lint"],
        )
        assert result.test_command == "my-custom-test"
        assert result.lint_commands == ("my-custom-lint",)

    def test_falls_back_to_profile_when_no_flags(self, tmp_path: Path) -> None:
        path = tmp_path / "devex.profile.ts"
        path.write_text(_GENERATED_BY_DEVEX_INIT)

        result = resolve_check_commands(path, explicit_test=None, explicit_lint=[])
        assert result.test_command is not None
        assert "pytest" in result.test_command
        assert len(result.lint_commands) == 2

    def test_returns_empty_when_no_profile_and_no_flags(self, tmp_path: Path) -> None:
        result = resolve_check_commands(
            tmp_path / "missing.ts",
            explicit_test=None,
            explicit_lint=[],
        )
        assert result.test_command is None
        assert result.lint_commands == ()

    def test_explicit_only_lint_overrides(self, tmp_path: Path) -> None:
        path = tmp_path / "devex.profile.ts"
        path.write_text(_GENERATED_BY_DEVEX_INIT)

        result = resolve_check_commands(
            path, explicit_test=None, explicit_lint=["only-this-lint"]
        )
        # Lint was given explicitly → ignore profile entirely
        assert result.test_command is None
        assert result.lint_commands == ("only-this-lint",)
