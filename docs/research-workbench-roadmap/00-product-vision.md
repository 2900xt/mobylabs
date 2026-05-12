# Stage 0: Product Vision

## Goal

Build an agentic research workbench for scientists, engineers, and technical
researchers. The tool should continuously help a human researcher scan new work,
map a field, propose testable hypotheses, run experiments, record failures, and
write defensible conclusions.

The first product should feel closer to Codex for research than to a generic
chatbot. It should have a terminal workflow first, then a richer GUI for longer
research programs.

## Core User Flow

1. User creates a research profile.
2. User starts or opens a research program.
3. Agent scans papers, repos, datasets, and prior local work.
4. Agent builds a structured research map.
5. Agent proposes hypotheses with evidence, risks, and next experiments.
6. Human selects, rejects, edits, or asks for deeper novelty checks.
7. Agent creates an experiment plan.
8. Agent writes code, notebooks, configs, and tests.
9. Agent runs experiments in an isolated workspace.
10. Agent summarizes results and asks for judgment at meaningful checkpoints.
11. Agent writes memos, reports, figures, and paper sections.

## Primary Modes

### `research`

For field scanning, literature review, hypothesis generation, and research map
maintenance.

Example:

```text
research "Track recent work on sparse latent variable inference for neural data."
```

### `prove`

For theorem-oriented work where the agent explores proof sketches, formal proof
files, counterexamples, and supporting lemmas.

Example:

```text
prove "Try to prove this convergence lemma under weaker smoothness assumptions."
```

### `experiment`

For implementation, benchmark design, notebook generation, execution, and
result interpretation.

Example:

```text
experiment "Benchmark structured sparse priors against this baseline on public datasets."
```

## Non-Goals for the MVP

- Fully autonomous publication writing.
- Claims of definitive novelty.
- Broad multi-user lab management.
- General web crawling without source controls.
- Perfect theorem proving across arbitrary formal systems.
- Running untrusted code outside a sandbox.

## Differentiator

The product tracks research reasoning over time. It should know:

- Which papers support a claim.
- Which hypotheses are active.
- Which experiments failed and why.
- Which assumptions are unresolved.
- Which decisions came from the human.
- Which conclusions are supported by current evidence.

## MVP Scope

The first valuable version is:

```text
New paper scanner + hypothesis generator + notebook runner + research log.
```

The user provides a research profile and a project directory. The system scans
recent work, clusters it into a research map, proposes ranked hypotheses, asks
the user to select one, creates an experiment plan, writes a notebook, runs an
initial experiment, and produces a short memo.

## Complexity

Overall MVP complexity: XL.

The hard parts are not the TUI or LLM calls. The hard parts are reliable state,
source provenance, safe execution, hallucination-resistant novelty claims, and a
human review loop that does not interrupt too often.
