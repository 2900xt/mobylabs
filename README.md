# MobyLabs TUI

Chat-first terminal UI scaffold for a future human-in-the-loop research agent.

The current version intentionally has no LangGraph backend, arXiv scanning, LLM calls, notebooks, or research workflow logic. It is just the terminal interface scaffold: a single chat surface plus slash commands.

## Install

```bash
python -m venv .venv
source .venv/bin/activate
pip install -e .
```

## Run

```bash
moby
```

Optional title:

```bash
moby --title "Moby Research"
```

Inside the TUI:

- Type into the input box and press Enter.
- Use slash commands: `/plan`, `/chat`, `/clear`, `/status`, `/help`, `/quit`.
- Scroll the transcript with Up/Down or Page Up/Page Down.
- Press `Ctrl-Q` or `Ctrl-C` to quit.
