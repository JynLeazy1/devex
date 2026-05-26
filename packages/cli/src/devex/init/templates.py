"""Template generation for `devex init`.

Templates are simple f-strings — no Jinja2 dependency. For complex templating
in the future, a switch to Jinja2 is a one-file change.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class ScaffoldContext:
    """Inputs the user provides (or defaults) for the scaffolding templates."""

    service_name: str
    team: str
    repo_url: str
    work_id_pattern: str = r"[A-Z][A-Z0-9]*-\d+"
    aws_region: str = "us-east-1"
    python_runtime: str = "3.12"
    source_path: str = "src/python"
    strict_tags: bool = False


def render_devex_profile_ts(ctx: ScaffoldContext) -> str:
    tag_severity_line = (
        "  tagSeverity: 'error',\n" if ctx.strict_tags else ""
    )
    return f"""\
import type {{ PythonLambdaProfile }} from '@devex/framework'

export const profile: PythonLambdaProfile = {{
  language: 'python',
  serviceName: '{ctx.service_name}',
  team: '{ctx.team}',
  repoUrl: '{ctx.repo_url}',
  workIdPattern: '{ctx.work_id_pattern}',
  awsRegion: '{ctx.aws_region}',
  runtime: '{ctx.python_runtime}',
  packageManager: 'uv',
  sourcePath: '{ctx.source_path}',
  testCommand: 'pytest --cov={ctx.source_path} --cov-report=xml --cov-fail-under=80',
  lintCommands: [
    'ruff check {ctx.source_path}',
    'ruff format --check {ctx.source_path}',
  ],
  openApiPath: null,
  minCoverage: 80,
{tag_severity_line}}}
"""


def render_pr_wac_ts(_ctx: ScaffoldContext) -> str:
    return """\
import { Workflow } from '@github-actions-workflow-ts/lib'

import {
  cdkSynthJob,
  contractValidationJob,
  doraSummaryJob,
  smallTestsJob,
  workIdValidationJob,
} from '@devex/framework'

import { profile } from '../devex.profile'

const workId = workIdValidationJob(profile)
const smallTests = smallTestsJob(profile).needs([workId])
const contracts = contractValidationJob(profile).needs([workId])
const synth = cdkSynthJob(profile).needs([smallTests, contracts])
const dora = doraSummaryJob(profile).needs([workId, smallTests, contracts, synth])

export const prPipeline = new Workflow('pr', {
  name: 'PR Pipeline (Golden Path)',
  on: { pull_request: { branches: ['main'] } },
})
  .addJob(workId)
  .addJob(smallTests)
  .addJob(contracts)
  .addJob(synth)
  .addJob(dora)
"""


def files_for_profile(profile: str, ctx: ScaffoldContext) -> dict[str, str]:
    """Return `{relative_path: file_content}` for the requested profile."""
    if profile == "python-lambda-api":
        return {
            "devex.profile.ts": render_devex_profile_ts(ctx),
            "workflows/pr.wac.ts": render_pr_wac_ts(ctx),
        }
    raise ValueError(f"Profile '{profile}' not supported in PoC scope")
