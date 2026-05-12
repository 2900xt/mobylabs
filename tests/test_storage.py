from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from moby.models import Claim
from moby.storage import WorkspaceStore


class StorageTests(unittest.TestCase):
    def test_initialize_creates_workspace_layout(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            store = WorkspaceStore(tmp)

            store.initialize()

            self.assertTrue((Path(tmp) / ".moby" / "state.sqlite").exists())
            self.assertTrue((Path(tmp) / ".moby" / "artifacts" / "papers").is_dir())
            self.assertTrue((Path(tmp) / ".moby" / "logs").is_dir())

    def test_repositories_persist_research_graph_entities(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            store = WorkspaceStore(tmp)

            with store.uow() as uow:
                profile = uow.profiles.create("Ada")
                program = uow.programs.create("Sparse priors", profile_id=profile.id, workspace_path=tmp)
                claim = uow.claims.save(
                    Claim(
                        program_id=program.id,
                        text="Structured priors can reduce sample complexity.",
                        confidence=0.7,
                    )
                )
                note = uow.notes.create(program.id, "Check public datasets first.")
                decision = uow.decisions.create(program.id, "scope", "proceed", "Good first benchmark.")

            with store.uow() as uow:
                self.assertEqual(uow.profiles.get(profile.id), profile)
                self.assertEqual(uow.programs.get(program.id), program)
                self.assertEqual(uow.claims.get(claim.id), claim)
                self.assertEqual(uow.notes.get(note.id), note)
                self.assertEqual(uow.decisions.get(decision.id), decision)
                summary = uow.graph.summary(program.id)

            self.assertEqual(summary["profiles"], 1)
            self.assertEqual(summary["programs"], 1)
            self.assertEqual(summary["claims"], 1)
            self.assertEqual(summary["notes"], 1)
            self.assertEqual(summary["decisions"], 1)
            self.assertEqual(summary["recent_notes"][0]["content"], "Check public datasets first.")

    def test_json_export_import_round_trip(self) -> None:
        with tempfile.TemporaryDirectory() as source, tempfile.TemporaryDirectory() as target:
            source_store = WorkspaceStore(source)
            with source_store.uow() as uow:
                profile = uow.profiles.create("Grace")
                program = uow.programs.create("Readable systems", profile_id=profile.id, workspace_path=source)
                uow.notes.create(program.id, "Imported state should preserve nested JSON fields.")

            payload = source_store.export_json()
            target_store = WorkspaceStore(target)
            target_store.import_json(payload)

            imported = target_store.export_json()
            self.assertEqual(imported["user_profiles"], payload["user_profiles"])
            self.assertEqual(imported["research_programs"], payload["research_programs"])
            self.assertEqual(imported["research_notes"], payload["research_notes"])


if __name__ == "__main__":
    unittest.main()
