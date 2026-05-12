"""SQLite persistence for Moby research state."""

from __future__ import annotations

import json
import sqlite3
from dataclasses import asdict, fields, is_dataclass
from pathlib import Path
from typing import Any, Generic, Iterable, TypeVar

from .models import (
    Claim,
    DraftSection,
    Experiment,
    HumanDecision,
    Hypothesis,
    OpenQuestion,
    Paper,
    ResearchNote,
    ResearchProgram,
    Result,
    UserProfile,
    utc_now,
)


SCHEMA_VERSION = 1
JSON_FIELDS = {
    "artifact_paths",
    "authors",
    "baselines",
    "checkpoint_preferences",
    "citation_ids",
    "constraints",
    "current_interests",
    "datasets",
    "evidence_ids",
    "expertise",
    "fields",
    "linked_entity_ids",
    "metrics",
    "metrics_json",
    "preferred_methods",
    "related_claim_ids",
}


T = TypeVar("T")


class StorageError(RuntimeError):
    """Raised when durable state cannot be read or written safely."""


class WorkspaceStore:
    """Owns the local `.moby` workspace and SQLite connection factory."""

    artifact_dirs = (
        "artifacts/papers",
        "artifacts/notebooks",
        "artifacts/experiments",
        "artifacts/figures",
        "artifacts/reports",
        "logs",
    )

    def __init__(self, workspace_path: str | Path = ".") -> None:
        self.workspace_path = Path(workspace_path).expanduser().resolve()
        self.state_dir = self.workspace_path / ".moby"
        self.db_path = self.state_dir / "state.sqlite"

    def initialize(self) -> None:
        self.state_dir.mkdir(parents=True, exist_ok=True)
        for directory in self.artifact_dirs:
            (self.state_dir / directory).mkdir(parents=True, exist_ok=True)
        with self.connect() as connection:
            _migrate(connection)

    def connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(self.db_path)
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA foreign_keys = ON")
        return connection

    def uow(self) -> UnitOfWork:
        return UnitOfWork(self)

    def export_json(self) -> dict[str, Any]:
        self.initialize()
        with self.connect() as connection:
            return {
                table: [_decode_row(dict(row)) for row in connection.execute(f"SELECT * FROM {table} ORDER BY id")]
                for table in TABLE_MODELS
            }

    def import_json(self, payload: dict[str, Any]) -> None:
        self.initialize()
        with self.uow() as uow:
            for table, model in TABLE_MODELS.items():
                repository = GenericRepository(uow.connection, table, model)
                for item in payload.get(table, []):
                    repository.save(model(**item))


class UnitOfWork:
    """Transaction boundary for updates that touch multiple repositories."""

    def __init__(self, store: WorkspaceStore) -> None:
        self.store = store
        self.connection: sqlite3.Connection | None = None
        self.profiles: ProfileRepository
        self.programs: ProgramRepository
        self.papers: GenericRepository[Paper]
        self.claims: GenericRepository[Claim]
        self.questions: GenericRepository[OpenQuestion]
        self.hypotheses: GenericRepository[Hypothesis]
        self.experiments: GenericRepository[Experiment]
        self.results: GenericRepository[Result]
        self.decisions: DecisionRepository
        self.notes: NoteRepository
        self.drafts: GenericRepository[DraftSection]
        self.graph: ResearchGraphRepository

    def __enter__(self) -> UnitOfWork:
        self.store.initialize()
        self.connection = self.store.connect()
        self.connection.execute("BEGIN")
        self.profiles = ProfileRepository(self.connection)
        self.programs = ProgramRepository(self.connection)
        self.papers = GenericRepository(self.connection, "papers", Paper)
        self.claims = GenericRepository(self.connection, "claims", Claim)
        self.questions = GenericRepository(self.connection, "open_questions", OpenQuestion)
        self.hypotheses = GenericRepository(self.connection, "hypotheses", Hypothesis)
        self.experiments = GenericRepository(self.connection, "experiments", Experiment)
        self.results = GenericRepository(self.connection, "results", Result)
        self.decisions = DecisionRepository(self.connection)
        self.notes = NoteRepository(self.connection)
        self.drafts = GenericRepository(self.connection, "draft_sections", DraftSection)
        self.graph = ResearchGraphRepository(self.connection)
        return self

    def __exit__(self, exc_type: object, exc_value: object, traceback: object) -> None:
        if self.connection is None:
            return
        try:
            if exc_type is None:
                self.connection.commit()
            else:
                self.connection.rollback()
        finally:
            self.connection.close()
            self.connection = None


class GenericRepository(Generic[T]):
    def __init__(self, connection: sqlite3.Connection, table: str, model: type[T]) -> None:
        self.connection = connection
        self.table = table
        self.model = model
        self.columns = [field.name for field in fields(model)]

    def save(self, entity: T) -> T:
        if not is_dataclass(entity):
            raise StorageError(f"{self.model.__name__} repository can only save dataclass instances")
        row = _encode_row(asdict(entity))
        columns = ", ".join(self.columns)
        placeholders = ", ".join(f":{column}" for column in self.columns)
        updates = ", ".join(f"{column}=excluded.{column}" for column in self.columns if column != "id")
        self.connection.execute(
            f"INSERT INTO {self.table} ({columns}) VALUES ({placeholders}) "
            f"ON CONFLICT(id) DO UPDATE SET {updates}",
            row,
        )
        return entity

    def get(self, entity_id: str) -> T | None:
        row = self.connection.execute(f"SELECT * FROM {self.table} WHERE id = ?", (entity_id,)).fetchone()
        if row is None:
            return None
        return self.model(**_decode_row(dict(row)))

    def list(self, *, program_id: str | None = None, limit: int | None = None) -> list[T]:
        query = f"SELECT * FROM {self.table}"
        params: list[Any] = []
        if program_id and "program_id" in self.columns:
            query += " WHERE program_id = ?"
            params.append(program_id)
        query += f" ORDER BY {self._order_by()}"
        if limit is not None:
            query += " LIMIT ?"
            params.append(limit)
        return [self.model(**_decode_row(dict(row))) for row in self.connection.execute(query, params)]

    def _order_by(self) -> str:
        if "created_at" in self.columns:
            return "created_at, id"
        if "updated_at" in self.columns:
            return "updated_at, id"
        return "id"


class ProfileRepository(GenericRepository[UserProfile]):
    def __init__(self, connection: sqlite3.Connection) -> None:
        super().__init__(connection, "user_profiles", UserProfile)

    def create(self, display_name: str) -> UserProfile:
        profile = UserProfile(display_name=display_name)
        return self.save(profile)


class ProgramRepository(GenericRepository[ResearchProgram]):
    def __init__(self, connection: sqlite3.Connection) -> None:
        super().__init__(connection, "research_programs", ResearchProgram)

    def create(
        self,
        title: str,
        *,
        description: str = "",
        profile_id: str | None = None,
        workspace_path: str = "",
    ) -> ResearchProgram:
        program = ResearchProgram(
            title=title,
            description=description,
            profile_id=profile_id,
            workspace_path=workspace_path,
        )
        return self.save(program)

    def touch(self, program_id: str) -> None:
        self.connection.execute(
            "UPDATE research_programs SET updated_at = ? WHERE id = ?",
            (utc_now(), program_id),
        )


class NoteRepository(GenericRepository[ResearchNote]):
    def __init__(self, connection: sqlite3.Connection) -> None:
        super().__init__(connection, "research_notes", ResearchNote)

    def create(self, program_id: str, content: str, *, author: str = "human", note_type: str = "note") -> ResearchNote:
        note = ResearchNote(program_id=program_id, author=author, note_type=note_type, content=content)
        return self.save(note)


class DecisionRepository(GenericRepository[HumanDecision]):
    def __init__(self, connection: sqlite3.Connection) -> None:
        super().__init__(connection, "human_decisions", HumanDecision)

    def create(self, program_id: str, checkpoint_id: str, decision: str, rationale: str = "") -> HumanDecision:
        record = HumanDecision(
            program_id=program_id,
            checkpoint_id=checkpoint_id,
            decision=decision,
            rationale=rationale,
        )
        return self.save(record)


class ResearchGraphRepository:
    def __init__(self, connection: sqlite3.Connection) -> None:
        self.connection = connection

    def summary(self, program_id: str | None = None) -> dict[str, Any]:
        return {
            "profiles": _count(self.connection, "user_profiles"),
            "programs": _count(self.connection, "research_programs"),
            "papers": _count(self.connection, "papers"),
            "claims": _count(self.connection, "claims", program_id),
            "questions": _count(self.connection, "open_questions", program_id),
            "hypotheses": _count(self.connection, "hypotheses", program_id),
            "experiments": _count(self.connection, "experiments", program_id),
            "results": _count_results(self.connection, program_id),
            "decisions": _count(self.connection, "human_decisions", program_id),
            "notes": _count(self.connection, "research_notes", program_id),
            "draft_sections": _count(self.connection, "draft_sections", program_id),
            "recent_notes": [
                dict(_decode_row(dict(row)))
                for row in self.connection.execute(
                    _program_query("research_notes", program_id, "created_at DESC", 5),
                    ([program_id] if program_id else []),
                )
            ],
        }


def _migrate(connection: sqlite3.Connection) -> None:
    current = connection.execute("PRAGMA user_version").fetchone()[0]
    if current > SCHEMA_VERSION:
        raise StorageError(f"Database schema {current} is newer than this app supports ({SCHEMA_VERSION})")
    if current == 0:
        for statement in MIGRATION_001:
            connection.execute(statement)
        connection.execute(f"PRAGMA user_version = {SCHEMA_VERSION}")


def _encode_row(row: dict[str, Any]) -> dict[str, Any]:
    return {
        key: json.dumps(value, sort_keys=True) if key in JSON_FIELDS else value
        for key, value in row.items()
    }


def _decode_row(row: dict[str, Any]) -> dict[str, Any]:
    decoded: dict[str, Any] = {}
    for key, value in row.items():
        if key in JSON_FIELDS and isinstance(value, str):
            decoded[key] = json.loads(value)
        else:
            decoded[key] = value
    return decoded


def _count(connection: sqlite3.Connection, table: str, program_id: str | None = None) -> int:
    if program_id and _has_program_id(table):
        return int(connection.execute(f"SELECT COUNT(*) FROM {table} WHERE program_id = ?", (program_id,)).fetchone()[0])
    return int(connection.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0])


def _count_results(connection: sqlite3.Connection, program_id: str | None = None) -> int:
    if not program_id:
        return _count(connection, "results")
    return int(
        connection.execute(
            """
            SELECT COUNT(*)
            FROM results
            JOIN experiments ON experiments.id = results.experiment_id
            WHERE experiments.program_id = ?
            """,
            (program_id,),
        ).fetchone()[0]
    )


def _has_program_id(table: str) -> bool:
    return table not in {"user_profiles", "research_programs", "papers", "results"}


def _program_query(table: str, program_id: str | None, order_by: str, limit: int) -> str:
    where = " WHERE program_id = ?" if program_id else ""
    return f"SELECT * FROM {table}{where} ORDER BY {order_by} LIMIT {limit}"


TABLE_MODELS = {
    "user_profiles": UserProfile,
    "research_programs": ResearchProgram,
    "papers": Paper,
    "claims": Claim,
    "open_questions": OpenQuestion,
    "hypotheses": Hypothesis,
    "experiments": Experiment,
    "results": Result,
    "human_decisions": HumanDecision,
    "research_notes": ResearchNote,
    "draft_sections": DraftSection,
}


def _table_sql(name: str, columns: Iterable[str], foreign_keys: Iterable[str] = ()) -> str:
    column_sql = ",\n        ".join(columns)
    fk_sql = "".join(f",\n        {key}" for key in foreign_keys)
    return f"""
    CREATE TABLE {name} (
        {column_sql}{fk_sql}
    )
    """


MIGRATION_001 = [
    _table_sql(
        "user_profiles",
        [
            "id TEXT PRIMARY KEY",
            "display_name TEXT NOT NULL",
            "fields TEXT NOT NULL DEFAULT '[]'",
            "expertise TEXT NOT NULL DEFAULT '[]'",
            "current_interests TEXT NOT NULL DEFAULT '[]'",
            "preferred_methods TEXT NOT NULL DEFAULT '[]'",
            "constraints TEXT NOT NULL DEFAULT '[]'",
            "risk_tolerance TEXT NOT NULL",
            "checkpoint_preferences TEXT NOT NULL DEFAULT '{}'",
        ],
    ),
    _table_sql(
        "research_programs",
        [
            "id TEXT PRIMARY KEY",
            "title TEXT NOT NULL",
            "description TEXT NOT NULL",
            "status TEXT NOT NULL",
            "created_at TEXT NOT NULL",
            "updated_at TEXT NOT NULL",
            "profile_id TEXT",
            "workspace_path TEXT NOT NULL",
        ],
        ["FOREIGN KEY(profile_id) REFERENCES user_profiles(id) ON DELETE SET NULL"],
    ),
    _table_sql(
        "papers",
        [
            "id TEXT PRIMARY KEY",
            "title TEXT NOT NULL",
            "authors TEXT NOT NULL DEFAULT '[]'",
            "source TEXT NOT NULL",
            "url TEXT",
            "doi TEXT",
            "arxiv_id TEXT",
            "published_at TEXT",
            "abstract TEXT NOT NULL",
            "summary TEXT NOT NULL",
            "embedding_id TEXT",
            "ingested_at TEXT NOT NULL",
        ],
    ),
    _table_sql(
        "claims",
        [
            "id TEXT PRIMARY KEY",
            "program_id TEXT NOT NULL",
            "text TEXT NOT NULL",
            "claim_type TEXT NOT NULL",
            "confidence REAL",
            "source_kind TEXT NOT NULL",
            "source_id TEXT",
            "created_at TEXT NOT NULL",
        ],
        ["FOREIGN KEY(program_id) REFERENCES research_programs(id) ON DELETE CASCADE"],
    ),
    _table_sql(
        "open_questions",
        [
            "id TEXT PRIMARY KEY",
            "program_id TEXT NOT NULL",
            "text TEXT NOT NULL",
            "importance TEXT NOT NULL",
            "status TEXT NOT NULL",
            "related_claim_ids TEXT NOT NULL DEFAULT '[]'",
        ],
        ["FOREIGN KEY(program_id) REFERENCES research_programs(id) ON DELETE CASCADE"],
    ),
    _table_sql(
        "hypotheses",
        [
            "id TEXT PRIMARY KEY",
            "program_id TEXT NOT NULL",
            "title TEXT NOT NULL",
            "statement TEXT NOT NULL",
            "why_promising TEXT NOT NULL",
            "evidence_ids TEXT NOT NULL DEFAULT '[]'",
            "risk_summary TEXT NOT NULL",
            "feasibility_score REAL",
            "novelty_score REAL",
            "status TEXT NOT NULL",
        ],
        ["FOREIGN KEY(program_id) REFERENCES research_programs(id) ON DELETE CASCADE"],
    ),
    _table_sql(
        "experiments",
        [
            "id TEXT PRIMARY KEY",
            "program_id TEXT NOT NULL",
            "hypothesis_id TEXT",
            "title TEXT NOT NULL",
            "plan TEXT NOT NULL",
            "datasets TEXT NOT NULL DEFAULT '[]'",
            "baselines TEXT NOT NULL DEFAULT '[]'",
            "metrics TEXT NOT NULL DEFAULT '[]'",
            "status TEXT NOT NULL",
            "workspace_ref TEXT",
        ],
        [
            "FOREIGN KEY(program_id) REFERENCES research_programs(id) ON DELETE CASCADE",
            "FOREIGN KEY(hypothesis_id) REFERENCES hypotheses(id) ON DELETE SET NULL",
        ],
    ),
    _table_sql(
        "results",
        [
            "id TEXT PRIMARY KEY",
            "experiment_id TEXT NOT NULL",
            "summary TEXT NOT NULL",
            "metrics_json TEXT NOT NULL DEFAULT '{}'",
            "artifact_paths TEXT NOT NULL DEFAULT '[]'",
            "interpretation TEXT NOT NULL",
            "limitations TEXT NOT NULL",
            "created_at TEXT NOT NULL",
        ],
        ["FOREIGN KEY(experiment_id) REFERENCES experiments(id) ON DELETE CASCADE"],
    ),
    _table_sql(
        "human_decisions",
        [
            "id TEXT PRIMARY KEY",
            "program_id TEXT NOT NULL",
            "checkpoint_id TEXT NOT NULL",
            "decision TEXT NOT NULL",
            "rationale TEXT NOT NULL",
            "created_at TEXT NOT NULL",
        ],
        ["FOREIGN KEY(program_id) REFERENCES research_programs(id) ON DELETE CASCADE"],
    ),
    _table_sql(
        "research_notes",
        [
            "id TEXT PRIMARY KEY",
            "program_id TEXT NOT NULL",
            "author TEXT NOT NULL",
            "note_type TEXT NOT NULL",
            "content TEXT NOT NULL",
            "linked_entity_ids TEXT NOT NULL DEFAULT '[]'",
            "created_at TEXT NOT NULL",
        ],
        ["FOREIGN KEY(program_id) REFERENCES research_programs(id) ON DELETE CASCADE"],
    ),
    _table_sql(
        "draft_sections",
        [
            "id TEXT PRIMARY KEY",
            "program_id TEXT NOT NULL",
            "section_type TEXT NOT NULL",
            "title TEXT NOT NULL",
            "content TEXT NOT NULL",
            "citation_ids TEXT NOT NULL DEFAULT '[]'",
            "status TEXT NOT NULL",
            "updated_at TEXT NOT NULL",
        ],
        ["FOREIGN KEY(program_id) REFERENCES research_programs(id) ON DELETE CASCADE"],
    ),
    "CREATE INDEX idx_programs_profile ON research_programs(profile_id)",
    "CREATE INDEX idx_claims_program ON claims(program_id)",
    "CREATE INDEX idx_questions_program ON open_questions(program_id)",
    "CREATE INDEX idx_hypotheses_program ON hypotheses(program_id)",
    "CREATE INDEX idx_experiments_program ON experiments(program_id)",
    "CREATE INDEX idx_decisions_program ON human_decisions(program_id)",
    "CREATE INDEX idx_notes_program ON research_notes(program_id)",
    "CREATE INDEX idx_drafts_program ON draft_sections(program_id)",
]
