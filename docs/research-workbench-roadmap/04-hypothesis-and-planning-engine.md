# Stage 4: Hypothesis and Planning Engine

## Goal

Generate concrete, testable research hypotheses from the research map, then
turn selected hypotheses into executable research plans.

## Hypothesis Format

Each hypothesis should include:

- Statement.
- Why it may be promising.
- Evidence from papers, results, or human notes.
- What would falsify it.
- Feasibility score.
- Novelty uncertainty.
- Required datasets.
- Required baselines.
- Expected implementation effort.
- Risks and failure modes.
- Recommended next step.

Example:

```text
Hypothesis:
Sparse structured priors improve latent trajectory inference under low-trial
regimes.

Why promising:
Recent adjacent methods improve inference stability but do not directly test
this setting in the scanned sources.

Required work:
Implement baseline, add structured prior, benchmark on public datasets.

Risk:
The improvement may be interpretability-only and not predictive.
```

## Agent Roles

### Field Mapper

Turns papers and notes into a structured map.

### Hypothesis Generator

Proposes testable ideas with evidence links.

### Skeptic

Critiques novelty, feasibility, assumptions, and experimental design.

### Planner

Converts selected hypotheses into concrete task graphs.

## Planning Output

Plans should include:

- Research objective.
- Baselines.
- Datasets.
- Metrics.
- Implementation tasks.
- Experiment matrix.
- Expected artifacts.
- Compute estimate.
- Checkpoints.
- Stop conditions.

## Human Decisions

The human should choose among:

- Explore.
- Reject.
- Modify.
- Ask for deeper novelty search.
- Ask for more evidence.
- Defer.

Every decision should become a `HumanDecision` record.

## Implementation Tasks

- Add structured hypothesis schema.
- Add hypothesis generation prompt chain.
- Add skeptic prompt chain.
- Add ranking and filtering.
- Add targeted novelty search task.
- Add experiment-plan schema.
- Add task graph generation from a selected plan.
- Add TUI review screen for hypothesis comparison.

## Complexity

Complexity: L.

Risk level: High. Hypothesis generation is where hallucinated novelty and
overconfident claims are most likely. The skeptic pass and citation-backed
output are required, not optional.

## Acceptance Criteria

- `/hypothesize` produces ranked, evidence-linked hypotheses.
- Each hypothesis has an explicit novelty uncertainty label.
- The user can accept, reject, or edit a hypothesis.
- Accepted hypotheses generate experiment plans.
- Rejected hypotheses remain searchable as negative decisions.
