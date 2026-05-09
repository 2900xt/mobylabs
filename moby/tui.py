"""A minimal curses TUI shell.

This intentionally contains no agent, graph, paper search, or model logic yet.
It is only the terminal surface that future research workflows can plug into.
"""

from __future__ import annotations

import curses
from dataclasses import dataclass, field


@dataclass
class TuiState:
    title: str
    input_text: str = ""
    messages: list[str] = field(default_factory=list)
    status: str = "Idle"


def run_tui(title: str = "Moby") -> None:
    curses.wrapper(lambda stdscr: _main(stdscr, TuiState(title=title)))


def _main(stdscr: curses.window, state: TuiState) -> None:
    curses.curs_set(1)
    curses.use_default_colors()
    stdscr.keypad(True)

    while True:
        _draw(stdscr, state)
        key = stdscr.getch()

        if key in (3, 17):  # Ctrl-C, Ctrl-Q
            break
        if key == curses.KEY_RESIZE:
            continue
        if key in (curses.KEY_BACKSPACE, 127, 8):
            state.input_text = state.input_text[:-1]
            continue
        if key in (10, 13):
            submitted = state.input_text.strip()
            if submitted:
                state.messages.append(f"> {submitted}")
                state.messages.append("  No agent is wired up yet.")
                state.status = "Input captured"
            state.input_text = ""
            continue
        if 32 <= key <= 126:
            state.input_text += chr(key)


def _draw(stdscr: curses.window, state: TuiState) -> None:
    stdscr.erase()
    height, width = stdscr.getmaxyx()
    if height < 8 or width < 40:
        _addstr(stdscr, 0, 0, "Terminal too small")
        stdscr.refresh()
        return

    sidebar_width = min(24, max(18, width // 5))
    input_y = height - 3

    _draw_box(stdscr, 0, 0, 3, width, f" {state.title} ")
    _addstr(stdscr, 1, 2, "Research TUI shell")
    _addstr(stdscr, 1, width - 22, "Ctrl-Q to quit")

    _draw_box(stdscr, 3, 0, height - 6, sidebar_width, " Workspace ")
    _addstr(stdscr, 5, 2, "Profile")
    _addstr(stdscr, 6, 2, "Papers")
    _addstr(stdscr, 7, 2, "Hypotheses")
    _addstr(stdscr, 8, 2, "Experiments")
    _addstr(stdscr, 10, 2, f"Status: {state.status}"[: sidebar_width - 4])

    main_x = sidebar_width
    main_width = width - sidebar_width
    _draw_box(stdscr, 3, main_x, height - 6, main_width, " Session ")
    visible_messages = state.messages[-max(1, height - 10) :]
    for offset, message in enumerate(visible_messages):
        _addstr(stdscr, 5 + offset, main_x + 2, message[: main_width - 4])

    _draw_box(stdscr, input_y, 0, 3, width, " Input ")
    prompt = "> "
    available = max(1, width - len(prompt) - 4)
    text = state.input_text[-available:]
    _addstr(stdscr, input_y + 1, 2, prompt + text)
    stdscr.move(input_y + 1, min(width - 2, 2 + len(prompt) + len(text)))
    stdscr.refresh()


def _draw_box(stdscr: curses.window, y: int, x: int, height: int, width: int, title: str = "") -> None:
    right = x + width - 1
    bottom = y + height - 1
    for col in range(x + 1, right):
        _addstr(stdscr, y, col, "-")
        _addstr(stdscr, bottom, col, "-")
    for row in range(y + 1, bottom):
        _addstr(stdscr, row, x, "|")
        _addstr(stdscr, row, right, "|")
    _addstr(stdscr, y, x, "+")
    _addstr(stdscr, y, right, "+")
    _addstr(stdscr, bottom, x, "+")
    _addstr(stdscr, bottom, right, "+")
    if title:
        _addstr(stdscr, y, x + 2, title[: max(0, width - 4)])


def _addstr(stdscr: curses.window, y: int, x: int, text: str) -> None:
    height, width = stdscr.getmaxyx()
    if y < 0 or y >= height or x < 0 or x >= width:
        return
    try:
        stdscr.addstr(y, x, text[: max(0, width - x - 1)])
    except curses.error:
        pass
