"""Entrypoint for the MobyLabs terminal UI."""

from __future__ import annotations

import argparse

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
    args = parser.parse_args()
    run_tui(title=args.title)


if __name__ == "__main__":
    main()
