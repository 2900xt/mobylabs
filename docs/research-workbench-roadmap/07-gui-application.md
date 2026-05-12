# Stage 7: GUI Application

## Goal

Build a GUI on top of the same research state and agent runtime. The GUI should
support longer-lived research programs better than the TUI: browsing papers,
comparing hypotheses, reviewing experiment results, editing reports, and
inspecting provenance.

## Recommended Architecture

Keep the Python backend as the source of truth:

```text
Python backend
  storage
  task executor
  model clients
  tool registry
  artifact manager
  API server

Web frontend
  research program dashboard
  task graph
  chat/review panel
  paper map
  hypothesis board
  experiment dashboard
  report editor
```

Suggested frontend stack:

- React or Next.js.
- TypeScript.
- TanStack Query for server state.
- Zustand or similar for small local UI state.
- WebSockets or Server-Sent Events for agent progress.

Suggested backend API:

- FastAPI.
- REST for CRUD.
- SSE or WebSocket for task events.
- File serving for artifacts.

## Primary Screens

### Program Dashboard

Shows active goal, recent progress, open checkpoints, current hypotheses, and
recent artifacts.

### Research Map

Shows papers grouped by direction, open questions, claims, contradictions, and
gaps.

### Hypothesis Board

Compares generated hypotheses by promise, feasibility, novelty uncertainty,
risk, and evidence.

### Experiment Dashboard

Shows experiment status, configs, metrics, plots, logs, and result summaries.

### Chat and Checkpoint Panel

Supports natural-language interaction, slash commands, approvals, edits, and
comments.

### Report Editor

Lets the user review generated memos, related work, methods, results, and
conclusions with citation links.

## Implementation Tasks

- Expose backend API over FastAPI.
- Add authenticated local session support.
- Add event stream for task updates.
- Build program dashboard.
- Build research map view.
- Build hypothesis comparison view.
- Build experiment result view.
- Build checkpoint review flow.
- Build report editor.
- Add export to Markdown, LaTeX, and PDF.

## Complexity

Complexity: XL.

Risk level: Medium. The GUI is large but straightforward if the backend state is
clean. If the state model is weak, the GUI will become an expensive transcript
viewer.

## Acceptance Criteria

- The GUI can open the same programs as the TUI.
- Task progress updates live.
- Papers, hypotheses, experiments, results, decisions, and drafts have dedicated
  views.
- The user can approve checkpoints from the GUI.
- Reports can be exported with citations and artifact references.
