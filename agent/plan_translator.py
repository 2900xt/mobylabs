"""Translate a Pearl ResearchPlan into a flat list of ExecutionSteps.

Uses an LLM call to convert high-level research methodology descriptions
into concrete coding prompts that a Claude Code worker can execute.
"""

from __future__ import annotations

import json

from openai import OpenAI

from state import (
    ResearchPlan,
    ExecutionStep,
    ExecutionPlan,
)
from config import get_openai_client


def _assign_risk(phase_name: str, step_text: str) -> str:
    """Heuristic risk assignment based on phase/step content."""
    low_keywords = ["collect", "download", "setup", "install", "configure", "clean", "preprocess"]
    high_keywords = ["novel", "custom", "architect", "design", "optimize", "train", "fine-tune"]

    text = (phase_name + " " + step_text).lower()
    if any(k in text for k in high_keywords):
        return "high"
    if any(k in text for k in low_keywords):
        return "low"
    return "medium"


def translate_plan(
    research_plan: ResearchPlan,
    research_idea: str,
    target_repo: str,
    budget_cap_usd: float = 20.0,
) -> ExecutionPlan:
    """Convert a Pearl ResearchPlan into an Opera-style ExecutionPlan.

    Each MethodologyPhase becomes one or more ExecutionSteps. An LLM call
    transforms the research-language descriptions into concrete coding prompts.
    """
    openai = get_openai_client()

    # Build a summary of the plan for the LLM
    phases_summary = []
    for i, phase in enumerate(research_plan.methodology.phases):
        phases_summary.append({
            "phase_number": i + 1,
            "name": phase.name,
            "description": phase.description,
            "steps": phase.steps,
            "expected_outputs": phase.expected_outputs,
            "tools": phase.tools,
        })

    max_steps = max(3, int(budget_cap_usd / 2.0))

    resp = openai.chat.completions.create(
        model="gpt-4o",
        messages=[
            {
                "role": "system",
                "content": (
                    "You are a research engineering planner. Your job is to translate "
                    "a research methodology plan into concrete, executable coding tasks.\n\n"
                    "Each task will be executed by an AI coding agent (Claude Code) inside "
                    "a Docker container with Python 3.11, PyTorch, scikit-learn, pandas, numpy, "
                    "scipy, matplotlib, transformers, and other ML libraries pre-installed.\n\n"
                    "For each task, write a detailed `prompt` that tells the coding agent:\n"
                    "- Exactly what files to create and where (e.g., `src/data/loader.py`)\n"
                    "- What classes/functions to implement with signatures\n"
                    "- What tests to write (e.g., `tests/test_loader.py`)\n"
                    "- How to verify the step works (run pytest, check output files)\n\n"
                    "Also write `acceptance_criteria` describing how to verify success.\n\n"
                    "Rules:\n"
                    "- Group tightly-coupled sub-steps into a single task\n"
                    "- Split independently-verifiable work into separate tasks\n"
                    "- Earlier tasks should lay foundations (data loading, preprocessing)\n"
                    "- Later tasks build on them (model implementation, training, evaluation)\n"
                    "- Every task must produce code changes — no 'assessment' or 'planning' tasks\n"
                    "- Use TDD: include test files in every task\n\n"
                    "Return JSON:\n"
                    "{\n"
                    '  "reasoning": "Why you structured the tasks this way",\n'
                    '  "tasks": [\n'
                    "    {\n"
                    '      "step_number": 1,\n'
                    '      "description": "Short description",\n'
                    '      "prompt": "Detailed coding instructions...",\n'
                    '      "phase_name": "Which research phase this maps to",\n'
                    '      "acceptance_criteria": "How to verify success",\n'
                    '      "expected_outputs": ["file1.py", "file2.py"],\n'
                    '      "tools": ["pytorch", "pandas"],\n'
                    '      "risk_level": "low|medium|high",\n'
                    '      "model": "sonnet|opus",\n'
                    '      "max_runtime_seconds": 1800\n'
                    "    }\n"
                    "  ]\n"
                    "}"
                ),
            },
            {
                "role": "user",
                "content": (
                    f"Translate this research plan into executable coding tasks.\n\n"
                    f"RESEARCH IDEA:\n{research_idea}\n\n"
                    f"RESEARCH PLAN TITLE: {research_plan.title}\n\n"
                    f"ABSTRACT:\n{research_plan.abstract}\n\n"
                    f"METHODOLOGY PHASES:\n{json.dumps(phases_summary, indent=2)}\n\n"
                    f"TARGET REPOSITORY: {target_repo}\n"
                    f"BUDGET: ${budget_cap_usd:.2f} (minimum $2/task, so max {max_steps} tasks)\n\n"
                    f"Generate {min(max_steps, len(phases_summary) + 2)} or fewer coding tasks "
                    f"that implement this research plan end-to-end. Each task must produce "
                    f"real, runnable Python code."
                ),
            },
        ],
        max_tokens=6000,
        temperature=0.5,
        response_format={"type": "json_object"},
    )

    result = json.loads(resp.choices[0].message.content or "{}")

    steps: list[ExecutionStep] = []
    for task in result.get("tasks", []):
        step_num = task.get("step_number", len(steps) + 1)
        steps.append(
            ExecutionStep(
                step_number=step_num,
                description=task.get("description", ""),
                prompt=task.get("prompt", ""),
                phase_name=task.get("phase_name", ""),
                risk_level=task.get("risk_level", _assign_risk(
                    task.get("phase_name", ""), task.get("description", "")
                )),
                model=task.get("model", "sonnet"),
                acceptance_criteria=task.get("acceptance_criteria", ""),
                max_runtime_seconds=task.get("max_runtime_seconds", 1800),
                depends_on_previous=(step_num > 1),
                expected_outputs=task.get("expected_outputs", []),
                tools=task.get("tools", []),
            )
        )

    # Ensure sequential numbering
    for i, step in enumerate(steps):
        step.step_number = i + 1
        step.depends_on_previous = (i > 0)

    return ExecutionPlan(
        steps=steps,
        reasoning=result.get("reasoning", ""),
        target_repo=target_repo,
        budget_cap_usd=budget_cap_usd,
    )
