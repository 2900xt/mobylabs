# Stage 2: TUI Agent Runtime

## Goal

Turn the current curses chat scaffold into a real research-client surface backed
by a task graph executor, persistent state, and tool calls.

## Target Experience

The TUI should feel like a research-focused Codex:

- A transcript pane for conversation and agent updates.
- A task tree pane for current plan, running work, blockers, and checkpoints.
- A context pane for active program, hypothesis, papers, and artifacts.
- A composer that supports slash commands and natural language.

## Runtime Components

### Session Controller

Owns a loaded profile, active research program, active mode, and current agent
run.

Responsibilities:

- Parse slash commands.
- Send natural-language requests to the planner.
- Render task updates.
- Persist notes and decisions.
- Resume interrupted work.

### Task Graph Executor

Runs agent work as explicit tasks rather than one long model response.

Task states:

- `pending`
- `running`
- `waiting_for_human`
- `blocked`
- `failed`
- `complete`
- `cancelled`

Task types:

- `scan_papers`
- `summarize_paper`
- `extract_claims`
- `generate_hypotheses`
- `critique_hypothesis`
- `plan_experiment`
- `write_code`
- `run_command`
- `analyze_results`
- `write_report`

### LLM Provider Interface

Keep the model layer provider-agnostic.

Interface:

```python
class ModelClient:
    def complete(self, request: ModelRequest) -> ModelResponse: ...
    def stream(self, request: ModelRequest) -> Iterator[ModelEvent]: ...
```

The app should support structured output validation for plans, hypotheses,
paper summaries, and checkpoint questions.

### Tool Registry

Expose tools through typed adapters.

Initial tools:

- Shell command runner.
- File reader/writer.
- Git status and diff reader.
- Python test runner.
- Notebook writer.
- Paper search client.
- Citation formatter.

## TUI Commands

```text
/research <goal>
/prove <goal>
/experiment <goal>
/scan
/brief
/hypothesize
/plan
/run
/review
/write
/tasks
/pause
/resume
/cancel
```

## Implementation Tasks

- Refactor UI state away from chat-only messages.
- Add an application service layer between TUI and storage.
- Add a task graph model.
- Add an event stream from executor to TUI.
- Add model-client abstraction.
- Add a fake deterministic model for tests and demos.
- Add slash command parser with command objects.
- Add background task execution with cancellation.
- Add transcript persistence.

## Complexity

Complexity: L.

Risk level: Medium. The current app is intentionally small, so the main risk is
overbuilding the runtime before the state model is proven. Keep the executor
simple: a local queue and explicit task records are enough for the MVP.

## Acceptance Criteria

- The TUI can load a research program.
- A user can start a research task and see task status update.
- The app can pause, resume, and cancel local tasks.
- Agent output is persisted as notes, tasks, and artifacts, not only transcript
  messages.
- Tests can run the runtime with fake models and fake tools.
