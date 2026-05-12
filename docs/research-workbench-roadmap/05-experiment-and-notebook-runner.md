# Stage 5: Experiment and Notebook Runner

## Goal

Let the agent write reproducible experiment code, notebooks, configs, plots, and
result summaries inside a controlled project workspace.

## Workspace Layout

Recommended generated structure:

```text
experiments/
  <experiment-id>/
    README.md
    config.yaml
    notebook.ipynb
    src/
    scripts/
    results/
    figures/
    logs/
```

## Execution Model

The runner should support:

- Dry-run planning.
- Dependency detection.
- Environment setup.
- Command execution.
- Test execution.
- Notebook execution.
- Plot generation.
- Result capture.
- Failure analysis.

For the MVP, local execution is acceptable if the project is trusted. For a
serious product, default to containers or isolated sandboxes.

## Notebook Requirements

Generated notebooks should include:

- Research question.
- Data loading.
- Baselines.
- Method implementation.
- Metrics.
- Ablations.
- Figures.
- Interpretation.
- Reproducibility notes.

Notebook content should be derived from structured experiment state. The
notebook should not be the only source of truth.

## Result Capture

Store results as structured records:

- Metric name.
- Metric value.
- Confidence interval or variance when available.
- Dataset split.
- Baseline or method name.
- Config hash.
- Command used.
- Artifact paths.

## Failure Handling

Failures should become useful research memory:

- Environment failure.
- Dataset failure.
- Implementation bug.
- Baseline mismatch.
- No improvement.
- Noisy result.
- Contradiction with prior paper.
- Insufficient compute.

## Implementation Tasks

- Add artifact manager.
- Add safe file writer with diff previews.
- Add command runner with timeouts.
- Add notebook generator.
- Add notebook executor.
- Add result parser.
- Add experiment status dashboard in TUI.
- Add automatic failure notes.
- Add report generation from result records.

## Complexity

Complexity: XL.

Risk level: High. Reproducible experiments require careful environment control,
artifact tracking, and failure capture. Start with Python projects and trusted
local repos before supporting arbitrary languages.

## Acceptance Criteria

- The agent can create an experiment folder from a selected hypothesis.
- The agent can write a starter notebook and supporting script.
- The runner can execute the experiment and capture logs.
- Results are stored in structured state and linked to the hypothesis.
- Failures are summarized and persisted as research notes.
