"""A compact curses chat TUI.

The app intentionally stops at the terminal surface: no agent, graph, paper
search, or model client is wired in yet. The UI is built as a single chat
framebuffer with slash commands controlling mode and session state.
"""

from __future__ import annotations

import curses
import textwrap
from dataclasses import dataclass, field
from pathlib import Path

from .storage import WorkspaceStore


@dataclass(frozen=True)
class ChatMessage:
    role: str
    content: str


@dataclass(frozen=True)
class RenderLine:
    role: str
    kind: str
    text: str


@dataclass
class TuiState:
    title: str
    store: WorkspaceStore
    input_text: str = ""
    cursor: int = 0
    messages: list[ChatMessage] = field(default_factory=list)
    status: str = "Ready"
    mode: str = "Chat"
    scroll_from_bottom: int = 0
    active_program_id: str | None = None


def run_tui(title: str = "MobyLabs", workspace_path: str | Path = ".") -> None:
    store = WorkspaceStore(workspace_path)
    state = TuiState(title=title, store=store)
    _load_initial_state(state)
    curses.wrapper(lambda stdscr: _main(stdscr, state))


def _main(stdscr: curses.window, state: TuiState) -> None:
    curses.curs_set(1)
    curses.noecho()
    curses.raw()
    _init_colors()
    stdscr.keypad(True)

    try:
        while True:
            _draw(stdscr, state)
            try:
                key = stdscr.get_wch()
            except KeyboardInterrupt:
                break

            if _is_quit_key(key):
                break
            if key == curses.KEY_RESIZE:
                state.status = "Resized"
                continue
            if key in (curses.KEY_PPAGE,):
                state.scroll_from_bottom += 8
                continue
            if key in (curses.KEY_NPAGE,):
                state.scroll_from_bottom = max(0, state.scroll_from_bottom - 8)
                continue
            if key == curses.KEY_UP:
                state.scroll_from_bottom += 1
                continue
            if key == curses.KEY_DOWN:
                state.scroll_from_bottom = max(0, state.scroll_from_bottom - 1)
                continue
            if key in (curses.KEY_LEFT, "\x02"):
                state.cursor = max(0, state.cursor - 1)
                continue
            if key in (curses.KEY_RIGHT, "\x06"):
                state.cursor = min(len(state.input_text), state.cursor + 1)
                continue
            if key in (curses.KEY_HOME, "\x01"):
                state.cursor = 0
                continue
            if key in (curses.KEY_END, "\x05"):
                state.cursor = len(state.input_text)
                continue
            if key in (curses.KEY_BACKSPACE, "\b", "\x7f"):
                if state.cursor > 0:
                    state.input_text = state.input_text[: state.cursor - 1] + state.input_text[state.cursor :]
                    state.cursor -= 1
                continue
            if key == curses.KEY_DC:
                state.input_text = state.input_text[: state.cursor] + state.input_text[state.cursor + 1 :]
                continue
            if key == "\x15":  # Ctrl-U
                state.input_text = state.input_text[state.cursor :]
                state.cursor = 0
                continue
            if key == "\x0b":  # Ctrl-K
                state.input_text = state.input_text[: state.cursor]
                continue
            if key in (curses.KEY_ENTER, "\n", "\r"):
                should_continue = _submit(state)
                if not should_continue:
                    break
                continue
            if isinstance(key, str) and key.isprintable():
                state.input_text = state.input_text[: state.cursor] + key + state.input_text[state.cursor :]
                state.cursor += len(key)
    finally:
        curses.noraw()


def _submit(state: TuiState) -> bool:
    submitted = state.input_text.strip()
    state.input_text = ""
    state.cursor = 0
    if not submitted:
        return True

    state.scroll_from_bottom = 0
    if submitted.startswith("/"):
        return _handle_command(state, submitted)

    state.messages.append(ChatMessage("user", submitted))
    if state.mode == "Plan":
        state.messages.append(
            ChatMessage(
                "assistant",
                "Plan mode is active, but no AI backend is connected yet. Your request was captured.",
            )
        )
    else:
        state.messages.append(ChatMessage("assistant", "No AI backend is connected yet. Your message was captured."))
    state.status = "Input captured"
    return True


def _handle_command(state: TuiState, submitted: str) -> bool:
    command, _, arg = submitted.partition(" ")
    command = command.lower()

    if command in ("/q", "/quit", "/exit"):
        return False
    if command == "/clear":
        state.messages.clear()
        state.status = "Session cleared"
        return True
    if command == "/plan":
        state.mode = "Plan"
        state.status = "Plan mode"
        state.messages.append(ChatMessage("system", "Plan mode active. Use /chat to return to regular chat."))
        return True
    if command == "/chat":
        state.mode = "Chat"
        state.status = "Chat mode"
        state.messages.append(ChatMessage("system", "Chat mode active."))
        return True
    if command == "/status":
        program = _program_label(state)
        state.messages.append(ChatMessage("system", f"Mode: {state.mode}. Program: {program}. Status: {state.status}."))
        state.status = "Status shown"
        return True
    if command == "/help":
        state.messages.append(
            ChatMessage(
                "system",
                "Commands: /profile, /program new, /program open, /graph, /notes, /decisions, /plan, /chat, /clear, /status, /help, /quit.",
            )
        )
        state.status = "Help shown"
        return True
    if command == "/profile":
        _handle_profile_command(state, arg.strip())
        return True
    if command == "/program":
        _handle_program_command(state, arg.strip())
        return True
    if command == "/graph":
        _handle_graph_command(state)
        return True
    if command == "/notes":
        _handle_notes_command(state, arg.strip())
        return True
    if command == "/decisions":
        _handle_decisions_command(state, arg.strip())
        return True

    detail = f"Unknown command: {command}"
    if arg:
        detail += f" {arg}"
    state.messages.append(ChatMessage("system", f"{detail}. Try /help."))
    state.status = "Unknown command"
    return True


def _load_initial_state(state: TuiState) -> None:
    state.store.initialize()
    with state.store.uow() as uow:
        programs = uow.programs.list()
    if programs:
        state.active_program_id = programs[-1].id


def _handle_profile_command(state: TuiState, arg: str) -> None:
    with state.store.uow() as uow:
        if arg:
            profile = uow.profiles.create(arg)
            state.messages.append(ChatMessage("system", f"Created profile {profile.display_name} ({profile.id})."))
            state.status = "Profile created"
            return

        profiles = uow.profiles.list()
    if not profiles:
        state.messages.append(ChatMessage("system", "No profiles yet. Use /profile Your Name."))
    else:
        body = "\n".join(f"{profile.id}: {profile.display_name}" for profile in profiles)
        state.messages.append(ChatMessage("system", body))
    state.status = "Profiles shown"


def _handle_program_command(state: TuiState, arg: str) -> None:
    action, _, detail = arg.partition(" ")
    action = action.lower()
    if action == "new" and detail.strip():
        _create_program(state, detail.strip())
        return
    if action == "open" and detail.strip():
        _open_program(state, detail.strip())
        return
    if action in ("", "list"):
        _list_programs(state)
        return

    state.messages.append(ChatMessage("system", "Usage: /program new Title, /program open program_id, or /program list."))
    state.status = "Program help"


def _create_program(state: TuiState, title: str) -> None:
    with state.store.uow() as uow:
        profiles = uow.profiles.list(limit=1)
        profile_id = profiles[0].id if profiles else None
        program = uow.programs.create(
            title,
            profile_id=profile_id,
            workspace_path=str(state.store.workspace_path),
        )
    state.active_program_id = program.id
    state.messages.append(ChatMessage("system", f"Created and opened program {program.title} ({program.id})."))
    state.status = "Program created"


def _open_program(state: TuiState, program_id: str) -> None:
    with state.store.uow() as uow:
        program = uow.programs.get(program_id)
    if program is None:
        state.messages.append(ChatMessage("system", f"No program found for {program_id}."))
        state.status = "Program not found"
        return
    state.active_program_id = program.id
    state.messages.append(ChatMessage("system", f"Opened program {program.title} ({program.id})."))
    state.status = "Program opened"


def _list_programs(state: TuiState) -> None:
    with state.store.uow() as uow:
        programs = uow.programs.list()
    if not programs:
        state.messages.append(ChatMessage("system", "No programs yet. Use /program new Title."))
    else:
        lines = []
        for program in programs:
            marker = "*" if program.id == state.active_program_id else " "
            lines.append(f"{marker} {program.id}: {program.title} [{program.status}]")
        state.messages.append(ChatMessage("system", "\n".join(lines)))
    state.status = "Programs shown"


def _handle_graph_command(state: TuiState) -> None:
    with state.store.uow() as uow:
        summary = uow.graph.summary(state.active_program_id)
    count_lines = [
        f"{key}: {value}"
        for key, value in summary.items()
        if key != "recent_notes"
    ]
    notes = summary["recent_notes"]
    if notes:
        count_lines.append("recent notes:")
        count_lines.extend(f"- {note['content']}" for note in notes)
    state.messages.append(ChatMessage("system", "\n".join(count_lines)))
    state.status = "Graph shown"


def _handle_notes_command(state: TuiState, arg: str) -> None:
    if not state.active_program_id:
        state.messages.append(ChatMessage("system", "Open a program first with /program new Title or /program open program_id."))
        state.status = "No program"
        return
    with state.store.uow() as uow:
        if arg:
            note = uow.notes.create(state.active_program_id, arg)
            uow.programs.touch(state.active_program_id)
            state.messages.append(ChatMessage("system", f"Saved note {note.id}."))
            state.status = "Note saved"
            return
        notes = uow.notes.list(program_id=state.active_program_id, limit=10)
    if not notes:
        state.messages.append(ChatMessage("system", "No notes yet. Use /notes Your note text."))
    else:
        state.messages.append(ChatMessage("system", "\n".join(f"{note.created_at}: {note.content}" for note in notes)))
    state.status = "Notes shown"


def _handle_decisions_command(state: TuiState, arg: str) -> None:
    if not state.active_program_id:
        state.messages.append(ChatMessage("system", "Open a program first with /program new Title or /program open program_id."))
        state.status = "No program"
        return
    with state.store.uow() as uow:
        if arg:
            checkpoint, decision, rationale = _parse_decision_arg(arg)
            record = uow.decisions.create(state.active_program_id, checkpoint, decision, rationale)
            uow.programs.touch(state.active_program_id)
            state.messages.append(ChatMessage("system", f"Saved decision {record.id}."))
            state.status = "Decision saved"
            return
        decisions = uow.decisions.list(program_id=state.active_program_id, limit=10)
    if not decisions:
        state.messages.append(ChatMessage("system", "No decisions yet. Use /decisions checkpoint | decision | rationale."))
    else:
        lines = [f"{item.created_at}: {item.checkpoint_id} -> {item.decision}" for item in decisions]
        state.messages.append(ChatMessage("system", "\n".join(lines)))
    state.status = "Decisions shown"


def _parse_decision_arg(arg: str) -> tuple[str, str, str]:
    parts = [part.strip() for part in arg.split("|", 2)]
    while len(parts) < 3:
        parts.append("")
    checkpoint, decision, rationale = parts
    return checkpoint or "manual", decision or arg, rationale


def _program_label(state: TuiState) -> str:
    if not state.active_program_id:
        return "none"
    with state.store.uow() as uow:
        program = uow.programs.get(state.active_program_id)
    if program is None:
        return "missing"
    return f"{program.title} ({program.id})"


def _draw(stdscr: curses.window, state: TuiState) -> None:
    stdscr.erase()
    height, width = stdscr.getmaxyx()
    if height < 10 or width < 36:
        _addstr(stdscr, 0, 0, "Terminal too small", _attr("warn"))
        stdscr.refresh()
        return

    input_width = max(1, width - 6)
    input_lines = _wrap_input(state.input_text or " ", input_width)
    composer_height = min(7, max(3, len(input_lines) + 2))
    header_height = 3
    composer_y = height - composer_height
    chat_y = header_height
    chat_height = max(1, composer_y - chat_y)

    _draw_header(stdscr, state, width)
    _draw_chat(stdscr, state, chat_y, chat_height, width)
    _draw_composer(stdscr, state, composer_y, composer_height, width, input_lines, input_width)
    stdscr.refresh()


def _draw_header(stdscr: curses.window, state: TuiState, width: int) -> None:
    title = f" {state.title} "
    _addstr(stdscr, 0, 1, title, _attr("title"))

    program = state.active_program_id[:16] if state.active_program_id else "no program"
    right = f"{state.mode} | {program} | {state.status} | Ctrl-C/Q"
    _addstr(stdscr, 0, max(1, width - len(right) - 1), right[: max(0, width - 2)], _attr("muted"))

    hint = "Type a message. Commands: /profile /program /graph /notes /decisions /help"
    _addstr(stdscr, 1, 2, hint[: max(0, width - 4)], _attr("muted"))
    _hline(stdscr, 2, 0, width, curses.ACS_HLINE, _attr("border"))


def _draw_chat(stdscr: curses.window, state: TuiState, y: int, height: int, width: int) -> None:
    content_width = max(1, width - 6)
    if not state.messages:
        _draw_empty_state(stdscr, y, height, width)
        return

    lines = _render_messages(state.messages, content_width)
    max_scroll = max(0, len(lines) - height)
    state.scroll_from_bottom = min(state.scroll_from_bottom, max_scroll)
    end = len(lines) - state.scroll_from_bottom
    start = max(0, end - height)
    visible = lines[start:end]

    draw_y = y
    for line in visible:
        if draw_y >= y + height:
            break
        attr = _line_attr(line)
        x = 2 if line.kind == "label" else 4
        _addstr(stdscr, draw_y, x, line.text[: max(0, width - x - 2)], attr)
        draw_y += 1

    if start > 0:
        _addstr(stdscr, y, max(1, width - 14), "more above", _attr("muted"))
    if state.scroll_from_bottom > 0:
        _addstr(stdscr, y + height - 1, max(1, width - 14), "more below", _attr("muted"))


def _draw_empty_state(stdscr: curses.window, y: int, height: int, width: int) -> None:
    lines = [
        "MobyLabs is ready.",
        "Create a profile with /profile, then a program with /program new.",
    ]
    start_y = y + max(0, height // 2 - 1)
    for offset, line in enumerate(lines):
        x = max(1, (width - len(line)) // 2)
        _addstr(stdscr, start_y + offset, x, line, _attr("muted"))


def _draw_composer(
    stdscr: curses.window,
    state: TuiState,
    y: int,
    height: int,
    width: int,
    input_lines: list[str],
    input_width: int,
) -> None:
    _draw_panel(stdscr, y, 0, height, width, f" {state.mode.lower()} ")

    prompt = "> "
    if state.input_text:
        visible_lines = input_lines[-max(1, height - 2) :]
        for offset, line in enumerate(visible_lines):
            prefix = prompt if offset == 0 else "  "
            _addstr(stdscr, y + 1 + offset, 2, prefix + line[:input_width], _attr("input"))
    else:
        _addstr(stdscr, y + 1, 2, prompt, _attr("input"))
        _addstr(stdscr, y + 1, 4, "Ask MobyLabs or type /help", _attr("muted"))

    cursor_line, cursor_col = _cursor_position(state.input_text, state.cursor, input_width)
    cursor_line = min(cursor_line, height - 3)
    stdscr.move(y + 1 + cursor_line, min(width - 2, 4 + cursor_col))


def _render_messages(messages: list[ChatMessage], width: int) -> list[RenderLine]:
    lines: list[RenderLine] = []
    for index, message in enumerate(messages):
        if index:
            lines.append(RenderLine(message.role, "spacer", ""))

        label = _role_label(message.role)
        lines.append(RenderLine(message.role, "label", label))
        for paragraph in message.content.splitlines() or [""]:
            wrapped = _wrap_text(paragraph, width)
            for line in wrapped:
                lines.append(RenderLine(message.role, "body", line))
    return lines


def _role_label(role: str) -> str:
    if role == "user":
        return "you"
    if role == "assistant":
        return "moby"
    return "system"


def _line_attr(line: RenderLine) -> int:
    if line.kind == "spacer":
        return _attr("normal")
    if line.role == "user" and line.kind == "label":
        return _attr("user")
    if line.role == "assistant" and line.kind == "label":
        return _attr("assistant")
    if line.role == "system":
        return _attr("muted")
    return _attr("normal")


def _cursor_position(text: str, cursor: int, width: int) -> tuple[int, int]:
    if not text:
        return 0, 0

    width = max(1, width)
    return cursor // width, cursor % width


def _wrap_text(text: str, width: int) -> list[str]:
    width = max(1, width)
    if not text:
        return [""]
    return textwrap.wrap(
        text,
        width=width,
        break_long_words=True,
        break_on_hyphens=False,
        replace_whitespace=False,
        drop_whitespace=False,
    ) or [""]


def _wrap_input(text: str, width: int) -> list[str]:
    width = max(1, width)
    if not text:
        return [""]
    return [text[index : index + width] for index in range(0, len(text), width)]


def _draw_panel(stdscr: curses.window, y: int, x: int, height: int, width: int, title: str = "") -> None:
    if height <= 1 or width <= 1:
        return

    attr = _attr("border")
    right = x + width - 1
    bottom = y + height - 1

    _hline(stdscr, y, x + 1, width - 2, curses.ACS_HLINE, attr)
    _hline(stdscr, bottom, x + 1, width - 2, curses.ACS_HLINE, attr)
    _vline(stdscr, y + 1, x, height - 2, curses.ACS_VLINE, attr)
    _vline(stdscr, y + 1, right, height - 2, curses.ACS_VLINE, attr)
    _addch(stdscr, y, x, curses.ACS_ULCORNER, attr)
    _addch(stdscr, y, right, curses.ACS_URCORNER, attr)
    _addch(stdscr, bottom, x, curses.ACS_LLCORNER, attr)
    _addch(stdscr, bottom, right, curses.ACS_LRCORNER, attr)
    if title:
        _addstr(stdscr, y, x + 2, title[: max(0, width - 4)], _attr("muted"))


def _hline(stdscr: curses.window, y: int, x: int, count: int, char: int, attr: int) -> None:
    height, width = stdscr.getmaxyx()
    if y < 0 or y >= height or x >= width or count <= 0:
        return
    try:
        stdscr.hline(y, max(0, x), char, min(count, width - max(0, x)), attr)
    except curses.error:
        pass


def _vline(stdscr: curses.window, y: int, x: int, count: int, char: int, attr: int) -> None:
    height, width = stdscr.getmaxyx()
    if x < 0 or x >= width or y >= height or count <= 0:
        return
    try:
        stdscr.vline(max(0, y), x, char, min(count, height - max(0, y)), attr)
    except curses.error:
        pass


def _addstr(stdscr: curses.window, y: int, x: int, text: str, attr: int = 0) -> None:
    height, width = stdscr.getmaxyx()
    if y < 0 or y >= height or x < 0 or x >= width:
        return
    try:
        stdscr.addstr(y, x, text[: max(0, width - x - 1)], attr)
    except curses.error:
        pass


def _addch(stdscr: curses.window, y: int, x: int, char: int, attr: int = 0) -> None:
    height, width = stdscr.getmaxyx()
    if y < 0 or y >= height or x < 0 or x >= width:
        return
    try:
        stdscr.addch(y, x, char, attr)
    except curses.error:
        pass


def _is_quit_key(key: object) -> bool:
    return key in (3, 17, "\x03", "\x11")


def _init_colors() -> None:
    if not curses.has_colors():
        return
    curses.start_color()
    try:
        curses.use_default_colors()
    except curses.error:
        pass
    _safe_init_pair(1, curses.COLOR_CYAN)
    _safe_init_pair(2, curses.COLOR_BLUE)
    _safe_init_pair(3, curses.COLOR_GREEN)
    _safe_init_pair(4, curses.COLOR_YELLOW)
    _safe_init_pair(5, curses.COLOR_WHITE)


def _safe_init_pair(pair: int, foreground: int) -> None:
    if pair >= curses.COLOR_PAIRS or foreground >= curses.COLORS:
        return
    try:
        curses.init_pair(pair, foreground, -1)
    except curses.error:
        pass


def _attr(name: str) -> int:
    if not curses.has_colors():
        return curses.A_NORMAL
    attrs = {
        "title": _pair(1) | curses.A_BOLD,
        "border": _pair(2),
        "user": _pair(3) | curses.A_BOLD,
        "assistant": _pair(1) | curses.A_BOLD,
        "warn": _pair(4) | curses.A_BOLD,
        "input": _pair(5),
        "muted": _pair(5) | curses.A_DIM,
        "normal": curses.A_NORMAL,
    }
    return attrs.get(name, curses.A_NORMAL)


def _pair(pair: int) -> int:
    if pair >= curses.COLOR_PAIRS:
        return curses.A_NORMAL
    return curses.color_pair(pair)
