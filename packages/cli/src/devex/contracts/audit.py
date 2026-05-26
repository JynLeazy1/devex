"""SOC 2 audit event schema (Python mirror).

The TypeScript equivalent lives at
`packages/framework/src/contracts/audit.ts`. Keys and types MUST stay in
lockstep.

Records the "who/what/when/why" for every Golden Path lifecycle action an
auditor needs to trace.
"""

from __future__ import annotations

from enum import Enum

from pydantic import Field

from devex.contracts._base import BaseEvent


class AuditAction(str, Enum):
    """Actions worth recording for compliance review.

    - ``COMMIT_PUSHED``: a commit landed on a Golden Path repo
      (pre-push validation passed)
    - ``PR_OPENED``: PR was opened on a Golden Path branch
    - ``PR_MERGED``: PR was merged after the two-reviewer rule
    - ``PIPELINE_STARTED`` / ``PIPELINE_COMPLETED``: a workflow run boundary
    - ``DEPLOY_INITIATED`` / ``DEPLOY_COMPLETED``: a deployment to any
      environment
    - ``CONFIG_CHANGED``: the team's ``devex.profile.ts`` or workflow files
      changed
    """

    COMMIT_PUSHED = "commit-pushed"
    PR_OPENED = "pr-opened"
    PR_MERGED = "pr-merged"
    PIPELINE_STARTED = "pipeline-started"
    PIPELINE_COMPLETED = "pipeline-completed"
    DEPLOY_INITIATED = "deploy-initiated"
    DEPLOY_COMPLETED = "deploy-completed"
    CONFIG_CHANGED = "config-changed"


class AuditEvent(BaseEvent):
    """Audit event — the SOC 2 "who/what/when/why" record.

    Mapping:

    - **Who**:  ``actor`` (inherited from ``BaseEvent``)
    - **What**: ``action`` + ``target``
      (e.g. ``action='deploy-completed', target='prod'``)
    - **When**: ``timestamp`` (inherited from ``BaseEvent``)
    - **Why**:  ``reason`` (free-text justification, REQUIRED)

    ``reason`` is mandatory and non-empty — the auditor must be able to answer
    "why did this happen" for every record. For automated events, the system
    supplies a justification (e.g., 'PR #123 merged by two approvers').
    """

    action: AuditAction
    target: str = Field(
        ...,
        min_length=1,
        description=(
            "What was acted upon — environment name, resource ARN, PR number, "
            "etc. Free-form but unambiguous in context of `action`."
        ),
    )
    reason: str = Field(
        ...,
        min_length=1,
        description=(
            "Why the action happened. Required by SOC 2 — every audit record "
            "needs a traceable justification, even if automatically generated."
        ),
    )
