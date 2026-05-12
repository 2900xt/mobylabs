from __future__ import annotations

import tempfile
import unittest

from moby.storage import WorkspaceStore
from moby.tui import TuiState, _handle_command, _load_initial_state


class TuiCommandTests(unittest.TestCase):
    def test_profile_program_notes_decisions_and_graph_commands(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            state = TuiState(title="Test", store=WorkspaceStore(tmp))
            _load_initial_state(state)

            self.assertTrue(_handle_command(state, "/profile Ada"))
            self.assertTrue(_handle_command(state, "/program new Sparse priors"))
            self.assertIsNotNone(state.active_program_id)
            self.assertTrue(_handle_command(state, "/notes First durable note"))
            self.assertTrue(_handle_command(state, "/decisions checkpoint-1 | proceed | enough signal"))
            self.assertTrue(_handle_command(state, "/graph"))

            transcript = "\n".join(message.content for message in state.messages)
            self.assertIn("Created profile Ada", transcript)
            self.assertIn("Created and opened program Sparse priors", transcript)
            self.assertIn("Saved note", transcript)
            self.assertIn("Saved decision", transcript)
            self.assertIn("notes: 1", transcript)
            self.assertIn("decisions: 1", transcript)

    def test_open_program_restores_existing_state(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            state = TuiState(title="Test", store=WorkspaceStore(tmp))
            _load_initial_state(state)
            _handle_command(state, "/program new First")
            _handle_command(state, "/program new Second")
            second_program_id = state.active_program_id

            fresh_state = TuiState(title="Test", store=WorkspaceStore(tmp))
            _load_initial_state(fresh_state)

            self.assertEqual(fresh_state.active_program_id, second_program_id)
            self.assertTrue(_handle_command(fresh_state, f"/program open {second_program_id}"))
            self.assertEqual(fresh_state.status, "Program opened")


if __name__ == "__main__":
    unittest.main()
