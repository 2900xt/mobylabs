# MobyLabs TUI

Chat-first terminal UI scaffold for a future human-in-the-loop research agent.

The current version has the first durable state layer: a local `.moby/state.sqlite`
workspace with profiles, research programs, notes, decisions, and graph summary
commands. It still has no LangGraph backend, arXiv scanning, LLM calls, or
notebook runner.

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

Optional workspace:

```bash
moby --workspace ~/research/moby-demo
```

Inside the TUI:

- Type into the input box and press Enter.
- Use slash commands: `/profile`, `/program`, `/graph`, `/notes`, `/decisions`, `/plan`, `/chat`, `/clear`, `/status`, `/help`, `/quit`.
- Scroll the transcript with Up/Down or Page Up/Page Down.
- Press `Ctrl-Q` or `Ctrl-C` to quit.

## Stage 1 Commands

```text
/profile Ada Lovelace
/program new Sparse priors for trajectory inference
/notes Check public datasets before inventing synthetic benchmarks.
/decisions scope | proceed | This is a bounded first experiment.
/graph
```

State can be exported or imported as JSON for debugging:

```bash
moby --workspace ~/research/moby-demo --export-json state.json
moby --workspace ~/research/moby-demo-copy --import-json state.json
```
