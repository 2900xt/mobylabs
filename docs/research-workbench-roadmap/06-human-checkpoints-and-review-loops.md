# Stage 6: Human Checkpoints and Review Loops

## Goal

Ask for human judgment at the moments where judgment matters, while letting
routine work proceed without constant approval.

## Checkpoint Types

### Direction Selection

Used when the agent has multiple promising research directions.

Question:

```text
Which direction should I pursue first?
```

### Novelty Concern

Used when the scanner finds adjacent or contradictory prior work.

Question:

```text
This looks close to paper X. Should I investigate novelty further or pivot?
```

### Proof Blocker

Used when a proof attempt is blocked at a lemma or invariant.

Question:

```text
The proof appears blocked at this lemma. Should I try a stronger invariant?
```

### Experiment Design

Used before spending meaningful compute or when benchmark design is ambiguous.

Question:

```text
Should I prioritize more baselines, more datasets, or faster iteration?
```

### Result Interpretation

Used when a result is noisy, surprising, negative, or contradicts prior work.

Question:

```text
The result is noisy and contradicts paper X. Should I rerun, inspect the setup,
or write this as a negative result?
```

### Writeup Approval

Used before turning conclusions into a report or manuscript section.

Question:

```text
Are these conclusions appropriately cautious?
```

## Checkpoint Policy

The app should checkpoint when:

- The agent changes research direction.
- The agent makes a novelty-sensitive claim.
- The agent would spend significant compute.
- The agent needs domain taste.
- Evidence contradicts active assumptions.
- A result may be publishable.
- A result invalidates a hypothesis.

The app should not checkpoint for:

- Routine summarization.
- Low-risk metadata cleanup.
- Local formatting.
- Short searches.
- Re-running a failed command after an obvious fix.

## Implementation Tasks

- Add `Checkpoint` entity.
- Add checkpoint policy engine.
- Add TUI checkpoint prompt.
- Add decision persistence.
- Add resume behavior after a decision.
- Add task-blocking semantics for waiting checkpoints.
- Add review queue.
- Add ability to comment on tasks and artifacts.

## Complexity

Complexity: M.

Risk level: Medium. The challenge is product judgment: too many checkpoints make
the tool annoying, while too few make it untrustworthy.

## Acceptance Criteria

- Long-running tasks can pause for human input.
- Decisions are stored with rationale and linked entities.
- The agent resumes from a checkpoint without losing context.
- The user can review past decisions.
- The TUI clearly distinguishes suggestions, decisions, and conclusions.
