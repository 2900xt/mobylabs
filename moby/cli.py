"""Entrypoint for the MobyLabs terminal UI."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from .storage import WorkspaceStore
from .tui import run_tui


def main() -> None:
    parser = argparse.ArgumentParser(
        prog="moby",
        description="Chat-first terminal UI for MobyLabs.",
    )
    parser.add_argument(
        "--title",
        default="MobyLabs",
        help="Title shown in the TUI header.",
    )
    parser.add_argument(
        "--workspace",
        default=".",
        help="Workspace directory that contains the .moby state folder.",
    )
    parser.add_argument(
        "--export-json",
        metavar="PATH",
        help="Export durable research state to PATH. Use '-' for stdout.",
    )
    parser.add_argument(
        "--import-json",
        metavar="PATH",
        help="Import durable research state from PATH.",
    )
    args = parser.parse_args()
    workspace_path = Path(args.workspace)
    if args.import_json or args.export_json:
        store = WorkspaceStore(workspace_path)
        if args.import_json:
            with Path(args.import_json).open("r", encoding="utf-8") as file:
                store.import_json(json.load(file))
        if args.export_json:
            payload = json.dumps(store.export_json(), indent=2, sort_keys=True)
            if args.export_json == "-":
                print(payload)
            else:
                Path(args.export_json).write_text(payload + "\n", encoding="utf-8")
        return

    run_tui(title=args.title, workspace_path=workspace_path)


if __name__ == "__main__":
    main()
