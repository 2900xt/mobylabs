#!/usr/bin/env python3
"""CLI entrypoint for the Pearl research agent.

Usage:
    python main.py "Your research idea here"
    python main.py                              # interactive prompt
    python main.py --angle-index 1              # pick 2nd angle instead of top
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import datetime

from state import PearlState
from graph import pearl_graph


# ---------------------------------------------------------------------------
# Pretty-print helpers
# ---------------------------------------------------------------------------


def _hr(char: str = "=", width: int = 72) -> str:
    return char * width


def print_results(state: PearlState) -> None:
    """Render the final pipeline output to the terminal."""

    print(f"\n{_hr()}")
    print("  PEARL RESEARCH AGENT — RESULTS")
    print(_hr())

    # Papers found
    print(f"\n{'Papers Found':>20}: {len(state.papers)}")
    print(f"{'Papers Analysed':>20}: {len(state.paper_analyses)}")

    # Angles
    print(f"\n{_hr('-')}")
    print("  TOP RESEARCH ANGLES")
    print(_hr("-"))
    for i, angle in enumerate(state.angles):
        print(f"\n  [{i + 1}] {angle.title}")
        print(f"      {angle.description}")
        print(
            f"      Novelty: {angle.novelty}/10  |  "
            f"Practicality: {angle.practicality}/10  |  "
            f"Impact: {angle.impact}/10  |  "
            f"Overall: {angle.overall_score:.1f}"
        )

    # Abstract
    if state.generated_abstract:
        print(f"\n{_hr('-')}")
        print("  GENERATED ABSTRACT")
        print(_hr("-"))
        print(f"\n  Title: {state.generated_abstract.title}\n")
        # Wrap abstract text
        for line in state.generated_abstract.abstract.split("\n"):
            print(f"  {line}")
        print(f"\n  Keywords: {', '.join(state.generated_abstract.keywords)}")
        print(f"  Contributions:")
        for c in state.generated_abstract.contributions:
            print(f"    - {c}")

    # Research plan
    if state.research_plan:
        plan = state.research_plan
        print(f"\n{_hr('-')}")
        print("  RESEARCH PLAN")
        print(_hr("-"))
        print(f"\n  Title: {plan.title}\n")
        print(f"  Abstract: {plan.abstract}\n")

        print("  Introduction:")
        print(f"    Problem: {plan.introduction.problem_statement}")
        print(f"    Research Questions:")
        for q in plan.introduction.research_questions:
            print(f"      - {q}")

        print(f"\n  Methodology ({len(plan.methodology.phases)} phases):")
        for j, phase in enumerate(plan.methodology.phases):
            print(f"    Phase {j + 1}: {phase.name}")
            for s in phase.steps:
                print(f"      {s}")

        print(f"\n  Timeline:")
        for t in plan.timeline:
            print(f"    {t.phase} ({t.duration})")
            for m in t.milestones:
                print(f"      - {m}")

        print(f"\n  Potential Challenges:")
        for ch in plan.potential_challenges:
            print(f"    - {ch.challenge}")
            print(f"      Mitigation: {ch.mitigation}")

    # Critique
    if state.critique:
        crit = state.critique
        print(f"\n{_hr('-')}")
        print("  PLAN CRITIQUE")
        print(_hr("-"))
        print(f"\n  Overall Score: {crit.overall_assessment.score}/10")
        print(f"  Readiness: {crit.overall_assessment.readiness_level}")
        print(f"  Summary: {crit.overall_assessment.summary}")

        if crit.missing_elements:
            print(f"\n  Missing Elements:")
            for el in crit.missing_elements:
                print(f"    - {el}")

        if crit.questions_to_consider:
            print(f"\n  Questions to Consider:")
            for q in crit.questions_to_consider:
                print(f"    - {q}")

    # Execution results
    if state.execution_plan and state.execution_results:
        print(f"\n{_hr('-')}")
        print("  EXECUTION RESULTS")
        print(_hr("-"))
        print(f"\n  Status: {state.execution_status}")
        print(f"  Total Cost: ${state.execution_plan.total_cost_usd:.2f}")
        print(f"  Plan Revisions: {state.execution_plan.plan_revisions}")
        print(f"\n  Steps:")
        for r in state.execution_results:
            review = f" [{r.review_classification}]" if r.review_classification else ""
            print(f"    Step {r.step_number}: {r.status} — {r.files_changed} files changed, ${r.cost_usd:.3f}{review}")
            if r.review_summary:
                print(f"      Review: {r.review_summary}")

    print(f"\n{_hr()}")


def export_json(state: PearlState, path: str) -> None:
    """Export full results as JSON."""
    output = {
        "research_idea": state.research_idea,
        "papers_found": len(state.papers),
        "papers_analysed": len(state.paper_analyses),
        "angles": [a.model_dump() for a in state.angles],
        "generated_abstract": state.generated_abstract.model_dump() if state.generated_abstract else None,
        "research_plan": state.research_plan.model_dump() if state.research_plan else None,
        "methodology_inspirations": [m.model_dump() for m in state.methodology_inspirations],
        "critique": state.critique.model_dump() if state.critique else None,
        "execution_plan": state.execution_plan.model_dump() if state.execution_plan else None,
        "execution_results": [r.model_dump() for r in state.execution_results],
        "execution_status": state.execution_status,
    }
    with open(path, "w") as f:
        json.dump(output, f, indent=2)
    print(f"\nResults exported to {path}")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def main() -> None:
    parser = argparse.ArgumentParser(description="Pearl Research Agent — powered by LangGraph")
    parser.add_argument("idea", nargs="?", help="Research idea / interest (interactive prompt if omitted)")
    parser.add_argument("--angle-index", type=int, default=0, help="Which angle to develop (0 = top, default)")
    parser.add_argument("--export", type=str, default=None, help="Export results to JSON file")
    parser.add_argument("--output-dir", type=str, default=None, help="Directory for per-step output files (default: output/<timestamp>)")
    parser.add_argument("--execute", action="store_true", help="Execute the research plan via worker containers after critique")
    parser.add_argument("--target-repo", type=str, default="", help="GitHub repo (owner/name) for execution output")
    parser.add_argument("--budget", type=float, default=20.0, help="Execution budget in USD (default: $20)")
    args = parser.parse_args()

    idea = args.idea
    if not idea:
        idea = input("Enter your research idea:\n> ").strip()
    if not idea:
        print("No research idea provided. Exiting.")
        sys.exit(1)

    # Set up output directory for per-step JSON files
    output_dir = args.output_dir or os.path.join(
        os.path.dirname(os.path.abspath(__file__)),
        "output",
        datetime.now().strftime("%Y%m%d_%H%M%S"),
    )
    os.makedirs(output_dir, exist_ok=True)
    print(f"Step outputs will be saved to: {output_dir}\n")

    # Validate execution flags
    if args.execute and not args.target_repo:
        print("Error: --execute requires --target-repo (e.g., --target-repo user/repo)")
        sys.exit(1)

    initial_state = PearlState(
        research_idea=idea,
        selected_angle_index=args.angle_index,
        output_dir=output_dir,
        target_repo=args.target_repo if args.execute else "",
        execution_budget_usd=args.budget,
    )

    print(f"\nRunning Pearl research pipeline for:\n  \"{idea}\"\n")

    result = pearl_graph.invoke(initial_state)
    # LangGraph may return a dict instead of the dataclass
    if isinstance(result, dict):
        final_state = PearlState(**result)
    else:
        final_state = result
    print_results(final_state)

    if args.export:
        export_json(final_state, args.export)


if __name__ == "__main__":
    main()
