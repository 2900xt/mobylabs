"""Domain models for durable research state."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Any
from uuid import uuid4


def new_id(prefix: str) -> str:
    return f"{prefix}_{uuid4().hex}"


def utc_now() -> str:
    return datetime.now(UTC).isoformat(timespec="microseconds")


@dataclass(frozen=True)
class UserProfile:
    id: str = field(default_factory=lambda: new_id("profile"))
    display_name: str = ""
    fields: list[str] = field(default_factory=list)
    expertise: list[str] = field(default_factory=list)
    current_interests: list[str] = field(default_factory=list)
    preferred_methods: list[str] = field(default_factory=list)
    constraints: list[str] = field(default_factory=list)
    risk_tolerance: str = "medium"
    checkpoint_preferences: dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class ResearchProgram:
    id: str = field(default_factory=lambda: new_id("program"))
    title: str = ""
    description: str = ""
    status: str = "active"
    created_at: str = field(default_factory=utc_now)
    updated_at: str = field(default_factory=utc_now)
    profile_id: str | None = None
    workspace_path: str = ""


@dataclass(frozen=True)
class Paper:
    id: str = field(default_factory=lambda: new_id("paper"))
    title: str = ""
    authors: list[str] = field(default_factory=list)
    source: str = ""
    url: str | None = None
    doi: str | None = None
    arxiv_id: str | None = None
    published_at: str | None = None
    abstract: str = ""
    summary: str = ""
    embedding_id: str | None = None
    ingested_at: str = field(default_factory=utc_now)


@dataclass(frozen=True)
class Claim:
    id: str = field(default_factory=lambda: new_id("claim"))
    program_id: str = ""
    text: str = ""
    claim_type: str = "observation"
    confidence: float | None = None
    source_kind: str = "human"
    source_id: str | None = None
    created_at: str = field(default_factory=utc_now)


@dataclass(frozen=True)
class OpenQuestion:
    id: str = field(default_factory=lambda: new_id("question"))
    program_id: str = ""
    text: str = ""
    importance: str = "medium"
    status: str = "open"
    related_claim_ids: list[str] = field(default_factory=list)


@dataclass(frozen=True)
class Hypothesis:
    id: str = field(default_factory=lambda: new_id("hypothesis"))
    program_id: str = ""
    title: str = ""
    statement: str = ""
    why_promising: str = ""
    evidence_ids: list[str] = field(default_factory=list)
    risk_summary: str = ""
    feasibility_score: float | None = None
    novelty_score: float | None = None
    status: str = "proposed"


@dataclass(frozen=True)
class Experiment:
    id: str = field(default_factory=lambda: new_id("experiment"))
    program_id: str = ""
    hypothesis_id: str | None = None
    title: str = ""
    plan: str = ""
    datasets: list[str] = field(default_factory=list)
    baselines: list[str] = field(default_factory=list)
    metrics: list[str] = field(default_factory=list)
    status: str = "planned"
    workspace_ref: str | None = None


@dataclass(frozen=True)
class Result:
    id: str = field(default_factory=lambda: new_id("result"))
    experiment_id: str = ""
    summary: str = ""
    metrics_json: dict[str, Any] = field(default_factory=dict)
    artifact_paths: list[str] = field(default_factory=list)
    interpretation: str = ""
    limitations: str = ""
    created_at: str = field(default_factory=utc_now)


@dataclass(frozen=True)
class HumanDecision:
    id: str = field(default_factory=lambda: new_id("decision"))
    program_id: str = ""
    checkpoint_id: str = ""
    decision: str = ""
    rationale: str = ""
    created_at: str = field(default_factory=utc_now)


@dataclass(frozen=True)
class ResearchNote:
    id: str = field(default_factory=lambda: new_id("note"))
    program_id: str = ""
    author: str = "human"
    note_type: str = "note"
    content: str = ""
    linked_entity_ids: list[str] = field(default_factory=list)
    created_at: str = field(default_factory=utc_now)


@dataclass(frozen=True)
class DraftSection:
    id: str = field(default_factory=lambda: new_id("draft"))
    program_id: str = ""
    section_type: str = "memo"
    title: str = ""
    content: str = ""
    citation_ids: list[str] = field(default_factory=list)
    status: str = "draft"
    updated_at: str = field(default_factory=utc_now)
