# Moby Research TUI

An empty terminal UI shell for a future human-in-the-loop research agent.

The current version intentionally has no LangGraph backend, arXiv scanning, LLM calls, notebooks, or research workflow logic. It is just the terminal interface scaffold.

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

- Type into the input bar and press Enter.
- Press `Ctrl-Q` to quit.

