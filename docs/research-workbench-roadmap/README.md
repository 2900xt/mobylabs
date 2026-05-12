# Research Workbench Roadmap

This folder breaks the MobyLabs research-agent product into implementation
stages. The end goal is a human-in-the-loop research workbench that starts as a
Codex-style TUI and grows into a GUI application with persistent research state,
paper discovery, hypothesis generation, experiment execution, and report writing.

The central product principle is that the app should manage a research program,
not a stateless chat. Every useful action should leave behind structured
provenance: what was read, what was proposed, what was tested, what failed, what
the human decided, and what conclusions are currently supported.

## Stage Index

1. [Product Vision](./00-product-vision.md)
2. [State Model and Storage](./01-state-model-and-storage.md)
3. [TUI Agent Runtime](./02-tui-agent-runtime.md)
4. [Paper Scanner and Research Map](./03-paper-scanner-and-research-map.md)
5. [Hypothesis and Planning Engine](./04-hypothesis-and-planning-engine.md)
6. [Experiment and Notebook Runner](./05-experiment-and-notebook-runner.md)
7. [Human Checkpoints and Review Loops](./06-human-checkpoints-and-review-loops.md)
8. [GUI Application](./07-gui-application.md)
9. [Evaluation, Security, and Production Hardening](./08-evaluation-security-production.md)

## Suggested Build Order

Build the product in this order:

1. Define durable state and research entities before adding complex agent
   behavior.
2. Turn the current TUI scaffold into a real session client for project state.
3. Add a provider-agnostic LLM layer and deterministic tool runner.
4. Add paper ingestion and structured summaries.
5. Add hypothesis generation with skepticism and provenance.
6. Add experiment planning, generated notebooks, and reproducible runs.
7. Add human approval gates and durable decisions.
8. Add a GUI backed by the same API and state model.
9. Add evaluation, sandboxing, audit logs, and multi-user controls.

## Complexity Legend

- XS: A few hours to one day.
- S: One to three days.
- M: One to two weeks.
- L: Two to six weeks.
- XL: Multi-month effort or significant infrastructure risk.

Complexity estimates assume one strong engineer working from the current Python
TUI scaffold.
