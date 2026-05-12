# Stage 8: Evaluation, Security, and Production Hardening

## Goal

Make the research workbench trustworthy enough for real projects. This requires
evaluation harnesses, sandboxing, audit logs, source provenance, and careful
claims management.

## Evaluation Areas

### Paper Understanding

Measure whether paper summaries, extracted claims, datasets, methods, and
limitations match source documents.

### Hypothesis Quality

Score hypotheses on specificity, testability, source support, feasibility, and
novelty uncertainty.

### Experiment Reliability

Track whether generated experiments run, whether metrics are captured correctly,
and whether results are reproducible.

### Human Checkpoint Quality

Measure whether checkpoints happen at meaningful times and avoid excessive
interruptions.

### Report Accuracy

Verify that claims in generated reports cite supporting evidence and avoid
overstating novelty or results.

## Security Requirements

- Run generated code in an isolated workspace.
- Add command allowlists or risk scoring.
- Require approval for network access, credential access, or destructive file
  operations.
- Store secrets outside research artifacts.
- Keep audit logs for tool calls and file writes.
- Never include private notes or unpublished data in external search requests
  without explicit approval.

## Production Requirements

- Structured logs.
- Crash recovery.
- Task retries.
- Artifact checksums.
- Database migrations.
- Backup and export.
- Configurable model providers.
- Offline mode for local artifacts.
- Data deletion controls.

## Claims Policy

Generated outputs should use calibrated language:

- "The scanned sources suggest..."
- "I found no direct match in the indexed sources..."
- "This result supports..."
- "This result does not establish..."
- "A targeted novelty search is still needed..."

The system should flag unsupported wording:

- "No one has done..."
- "This proves..."
- "The best method..."
- "Definitively novel..."

## Implementation Tasks

- Add eval datasets for paper summaries and hypothesis generation.
- Add regression tests for structured outputs.
- Add sandboxed command runner.
- Add audit log table.
- Add artifact hashing.
- Add claims linter for reports.
- Add source coverage reports.
- Add destructive-action approvals.
- Add backup/export commands.

## Complexity

Complexity: XL.

Risk level: High. This stage separates a compelling demo from a tool that can be
trusted with real research work.

## Acceptance Criteria

- Every tool call is auditable.
- Generated code runs in an isolated workspace or requires explicit trust.
- Reports identify unsupported claims.
- Results link back to commands, configs, and artifacts.
- The app can export or back up a complete research program.
