"""DORA event schema (Python mirror).

The TypeScript equivalent lives at
`packages/framework/src/contracts/dora.ts`. Keys and types MUST stay in
lockstep.

Designed so that downstream consumers (the org's DORA dashboard) can compute
the four DORA metrics by aggregating these events. See the docstring on
``DoraEvent`` for the mapping.
"""

from __future__ import annotations

from enum import Enum

from pydantic import Field

from devex.contracts._base import BaseEvent


class Stage(str, Enum):
    """Stages emitted across the Golden Path pipelines.

    The first 5 belong to the PR Pipeline (PoC scope). The last 5 belong to the
    Integration Pipeline (designed, deferred — see ADR-001 §4).
    """

    # PR Pipeline
    WORK_ID_VALIDATION = "work-id-validation"
    SMALL_TESTS = "small-tests"
    CONTRACT_VALIDATION = "contract-validation"
    CDK_SYNTH = "cdk-synth"
    DORA_SUMMARY = "dora-summary"
    # Integration Pipeline (future)
    BUILD = "build"
    SANDBOX_DEPLOY = "sandbox-deploy"
    STAGING_DEPLOY = "staging-deploy"
    PROD_DEPLOY = "prod-deploy"
    SMOKE_TESTS = "smoke-tests"


class Status(str, Enum):
    """Terminal status of a pipeline stage.

    - ``STARTED``: stage began (paired with a later ``SUCCESS``/``FAILURE``)
    - ``SUCCESS``: stage completed without errors
    - ``FAILURE``: stage completed with an error (counts toward CFR)
    - ``SKIPPED``: stage was conditional and did not run
    - ``CANCELLED``: stage was interrupted (e.g., new commit pushed)
    """

    STARTED = "started"
    SUCCESS = "success"
    FAILURE = "failure"
    SKIPPED = "skipped"
    CANCELLED = "cancelled"


class DoraEvent(BaseEvent):
    """DORA event — one per stage transition.

    Downstream metrics:

    - **Deployment Frequency**: count of ``stage=prod-deploy, status=success``
      per period.
    - **Lead Time for Changes**: ``timestamp`` of ``prod-deploy success`` minus
      ``timestamp`` of first commit (same ``work_id``).
    - **Change Failure Rate**: ratio of ``prod-deploy failure`` to total
      ``prod-deploy``.
    - **MTTR**: time from ``prod-deploy failure`` to next ``prod-deploy
      success`` for the same ``work_id`` (or the rollback's ``work_id``).
    """

    stage: Stage
    status: Status
    duration_ms: int | None = Field(
        None,
        ge=0,
        description=(
            "Duration of the stage in milliseconds. Null for `started` events; "
            "the paired success/failure event carries the final duration."
        ),
    )
    reason: str | None = Field(
        None,
        description=(
            "Free-text reason. Required for non-success outcomes (failure, "
            "skipped, cancelled); null for started and success."
        ),
    )
