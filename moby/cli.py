"""Entrypoint for the Moby terminal UI."""

from __future__ import annotations

import argparse

from .tui import run_tui


def main() -> None:
    parser = argparse.ArgumentParser(
        prog="moby",
        description="Empty TUI shell for a future research agent.",
    )
    parser.add_argument(
        "--title",
        default="Moby",
        help="Title shown in the TUI header.",
    )
    args = parser.parse_args()
    run_tui(title=args.title)


if __name__ == "__main__":
    main()

