"""Shared base for all framework event schemas (Python mirror).

This file defines the fields that every event (DORA, audit, future) must carry.
The TypeScript framework's equivalent lives at
`packages/framework/src/contracts/_base.ts` and MUST keep the same field names
and types in lockstep with this file.

See `packages/framework/src/contracts/README.md` for the lockstep rules.
"""

from __future__ import annotations

import re
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

#: Schema version of all framework events. Bump this when introducing a
#: breaking change to the event shape — consumers (DORA dashboards, audit log
#: stores) discriminate on this field for migration.
SCHEMA_VERSION: Literal["1.0"] = "1.0"

# Regex constants — mirror those in `_base.ts`.
_WORK_ID_RE = re.compile(r"^[A-Z][A-Z0-9]*-\d+$")
_GIT_SHA_RE = re.compile(r"^[0-9a-f]{7,40}$")
_SEMVER_RE = re.compile(r"^\d+\.\d+\.\d+(-[0-9A-Za-z\-.]+)?(\+[0-9A-Za-z\-.]+)?$")


class BaseEvent(BaseModel):
    """Fields present on every framework event.

    Mirrored from `BaseEventSchema` in TypeScript. `extra='forbid'` rejects
    unknown fields — schema drift between TS and Python is a bug, not a
    feature.
    """

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=False)

    schema_version: Literal["1.0"] = SCHEMA_VERSION
    work_id: str = Field(..., description="Cross-cutting traceability ID, e.g. 'FIN-123'.")
    team: str = Field(..., min_length=1, description="Owning team slug.")
    repo: str = Field(..., description="Repository URL of the service.")
    actor: str = Field(..., min_length=1, description="Who triggered the event.")
    timestamp: datetime = Field(..., description="When the event occurred (UTC ISO-8601).")
    git_sha: str = Field(..., description="Commit SHA being acted upon.")
    framework_version: str = Field(..., description="Version of @devex/framework.")

    @field_validator("work_id")
    @classmethod
    def _validate_work_id(cls, v: str) -> str:
        if not _WORK_ID_RE.match(v):
            raise ValueError("work_id must look like 'PREFIX-123'")
        return v

    @field_validator("git_sha")
    @classmethod
    def _validate_git_sha(cls, v: str) -> str:
        if not _GIT_SHA_RE.match(v):
            raise ValueError("git_sha must be a 7-40 char hex git SHA")
        return v

    @field_validator("framework_version")
    @classmethod
    def _validate_semver(cls, v: str) -> str:
        if not _SEMVER_RE.match(v):
            raise ValueError("framework_version must be valid semver")
        return v

    @field_validator("repo")
    @classmethod
    def _validate_repo_url(cls, v: str) -> str:
        if not (v.startswith("http://") or v.startswith("https://")):
            raise ValueError("repo must be a valid URL")
        return v
