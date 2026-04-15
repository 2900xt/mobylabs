"""Execution orchestrator — Python port of Opera's managerOrchestrate().

Runs ExecutionSteps sequentially via Docker worker containers,
reviews results, and adaptively revises the remaining plan.
"""

from __future__ import annotations

import json
import os
import subprocess
import time
import uuid

from openai import OpenAI

from state import (
    ExecutionPlan,
    ExecutionStep,
    ExecutionStepResult,
)
from config import get_openai_client


# ── Guardrails (ported from Opera manager.ts) ──────────────

MIN_STEP_BUDGET = 2.00
MAX_REVISIONS = 3
MAX_CONSECUTIVE_NO_CHANGE = 2
WORKER_IMAGE = "pearl-research-worker:latest"


# ── Reviewer (ported from Opera reviewer.ts) ───────────────

def review_step_output(
    openai: OpenAI,
    step: ExecutionStep,
    diff: str,
    files_changed: int,
    tests_passed: bool | None,
) -> dict:
    """Classify a worker's output. Returns {classification, confidence, summary}."""
    resp = openai.chat.completions.create(
        model="gpt-4o",
        messages=[
            {
                "role": "system",
                "content": (
                    "You are a code review classifier for an automated research coding system.\n"
                    "Classify the worker output using this JSON format:\n"
                    "{\n"
                    '  "classification": "merge_ready|promising|needs_human_input|failed",\n'
                    '  "confidence": 0.0-1.0,\n'
                    '  "summary": "Brief explanation"\n'
                    "}\n\n"
                    "merge_ready: acceptance criteria met, code looks clean.\n"
                    "promising: mostly correct but has minor issues.\n"
                    "needs_human_input: significant issues requiring human judgment.\n"
                    "failed: worker failed to produce a usable result."
                ),
            },
            {
                "role": "user",
                "content": (
                    f"Task: {step.description}\n\n"
                    f"Acceptance Criteria:\n{step.acceptance_criteria}\n\n"
                    f"Files changed: {files_changed}\n"
                    f"Tests passed: {tests_passed}\n\n"
                    f"Diff:\n{diff[:8000] if diff else '(no diff available)'}\n\n"
                    "Classify this output."
                ),
            },
        ],
        max_tokens=500,
        temperature=0.3,
        response_format={"type": "json_object"},
    )
    return json.loads(resp.choices[0].message.content or '{"classification":"failed","confidence":0,"summary":"No response"}')


# ── Plan Revision (ported from Opera reviseRemainingPlan) ──

def revise_remaining_plan(
    openai: OpenAI,
    goal: str,
    completed_results: list[ExecutionStepResult],
    remaining_steps: list[ExecutionStep],
) -> dict:
    """Ask LLM whether the remaining plan should be revised.

    Returns {revised: bool, steps: list[dict], reasoning: str}.
    """
    completed_summary = "\n".join(
        f"Step {r.step_number}: {r.status} — {r.files_changed} files changed"
        + (f" — review: {r.review_classification} ({r.review_summary})" if r.review_classification else "")
        for r in completed_results
    )

    remaining_summary = "\n".join(
        f"Step {s.step_number}: {s.description}" for s in remaining_steps
    )

    resp = openai.chat.completions.create(
        model="gpt-4o",
        messages=[
            {
                "role": "system",
                "content": (
                    "You manage a serial research implementation plan. After each step, "
                    "decide if the remaining plan needs adjustment.\n\n"
                    "Rules:\n"
                    "- Do NOT add assessment/verification/diagnostic steps\n"
                    "- Every step must produce code changes\n"
                    "- If a step produced 0 changes, make the next step's prompt more specific\n"
                    "- Keep total remaining steps the same or fewer\n"
                    "- If things are going well, set revised=false\n\n"
                    "Return JSON:\n"
                    '{"revised": false, "reasoning": "why"}\n'
                    "or\n"
                    '{"revised": true, "reasoning": "why", "steps": [revised step objects]}'
                ),
            },
            {
                "role": "user",
                "content": (
                    f"Goal: {goal}\n\n"
                    f"Completed:\n{completed_summary}\n\n"
                    f"Remaining:\n{remaining_summary}\n\n"
                    "Should the remaining plan be revised?"
                ),
            },
        ],
        max_tokens=4000,
        temperature=0.4,
        response_format={"type": "json_object"},
    )
    return json.loads(resp.choices[0].message.content or '{"revised": false, "reasoning": "No response"}')


# ── Enriched Prompt Builder (ported from Opera buildEnrichedPrompt) ──

def build_enriched_prompt(
    step: ExecutionStep,
    research_plan_title: str,
    overall_goal: str,
    previous_results: list[ExecutionStepResult],
) -> str:
    """Build a context-rich prompt for the worker, including previous step results."""
    prompt = f"""# Pearl Research Executor — Step {step.step_number}

## Overall Research Goal
{overall_goal}

## Research Plan: {research_plan_title}

"""

    if previous_results:
        prompt += "## Previous Steps\n"
        for r in previous_results:
            prompt += f"- Step {r.step_number}: {r.status}"
            if r.files_changed > 0:
                prompt += f" ({r.files_changed} files changed)"
            if r.review_classification:
                prompt += f" — {r.review_classification}: {r.review_summary}"
            prompt += "\n"
        prompt += "\nYou are building on top of the code from previous steps. The branch already contains their work.\n\n"

    prompt += f"""## Your Task (Step {step.step_number}: {step.phase_name})

{step.description}

## Detailed Instructions

{step.prompt}

## Acceptance Criteria

{step.acceptance_criteria}

## Workflow Guidance

- Write clean, reproducible Python with type hints and docstrings
- Use TDD: write tests first, then implement
- Save data to `data/`, models to `models/`, results to `results/`
- Update `requirements.txt` if you add new dependencies
- Run pytest after implementation to verify
"""

    # Research-specific hints
    desc_lower = (step.description + " " + step.prompt).lower()
    if any(k in desc_lower for k in ["train", "model", "neural", "deep learning"]):
        prompt += "- This is a model training task — include training scripts with configurable hyperparameters and logging.\n"
    if any(k in desc_lower for k in ["data", "dataset", "collect", "download", "preprocess"]):
        prompt += "- This is a data task — ensure reproducible data pipelines with clear documentation.\n"
    if any(k in desc_lower for k in ["evaluate", "metric", "benchmark", "compare"]):
        prompt += "- This is an evaluation task — generate results tables/figures saved to `results/`.\n"

    return prompt


# ── Worker Spawning ────────────────────────────────────────

def spawn_worker(
    step: ExecutionStep,
    enriched_prompt: str,
    target_repo: str,
    branch_name: str,
    pinned_sha: str,
    max_budget_usd: float,
) -> dict:
    """Spawn a Docker worker container to execute a step.

    Returns a dict with status, files_changed, diff, cost_usd, etc.
    """
    repo_url = f"https://github.com/{target_repo}.git"
    github_token = os.environ.get("GITHUB_TOKEN", "")
    anthropic_key = os.environ.get("ANTHROPIC_API_KEY", "")
    model = "claude-sonnet-4-20250514" if step.model == "sonnet" else "claude-opus-4-20250514"

    if not github_token:
        raise RuntimeError("GITHUB_TOKEN is required for worker execution")
    if not anthropic_key:
        raise RuntimeError("ANTHROPIC_API_KEY is required for worker execution")

    run_id = uuid.uuid4().hex[:12]

    cmd = [
        "docker", "run", "--rm",
        "-e", f"TASK_PROMPT={enriched_prompt}",
        "-e", f"REPO_URL={repo_url}",
        "-e", f"PINNED_SHA={pinned_sha}",
        "-e", f"BRANCH_NAME={branch_name}",
        "-e", f"GITHUB_TOKEN={github_token}",
        "-e", f"ANTHROPIC_API_KEY={anthropic_key}",
        "-e", f"MAX_BUDGET_USD={max_budget_usd}",
        "-e", f"MODEL={model}",
        WORKER_IMAGE,
    ]

    start = time.time()
    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=step.max_runtime_seconds,
        )
        elapsed = int(time.time() - start)
        stdout = result.stdout
        stderr = result.stderr

        # Try to parse output JSON from the last line
        output = _parse_worker_output(stdout, run_id, branch_name, elapsed)
        output["log"] = stdout[-3000:] if stdout else ""
        return output

    except subprocess.TimeoutExpired:
        return {
            "status": "failed",
            "files_changed": 0,
            "lines_added": 0,
            "lines_removed": 0,
            "cost_usd": 0,
            "branch_name": branch_name,
            "runtime_seconds": step.max_runtime_seconds,
            "diff": "",
            "log": "Worker timed out",
        }
    except Exception as exc:
        return {
            "status": "failed",
            "files_changed": 0,
            "lines_added": 0,
            "lines_removed": 0,
            "cost_usd": 0,
            "branch_name": branch_name,
            "runtime_seconds": int(time.time() - start),
            "diff": "",
            "log": f"Worker error: {exc}",
        }


def _parse_worker_output(stdout: str, run_id: str, branch_name: str, elapsed: int) -> dict:
    """Parse structured output from worker stdout, or infer from git status lines."""
    # Try JSON output on last line
    for line in reversed(stdout.strip().split("\n")):
        line = line.strip()
        if line.startswith("{") and line.endswith("}"):
            try:
                data = json.loads(line)
                return {
                    "status": data.get("status", "completed"),
                    "files_changed": data.get("files_changed", 0),
                    "lines_added": data.get("lines_added", 0),
                    "lines_removed": data.get("lines_removed", 0),
                    "cost_usd": data.get("cost_usd", 0),
                    "branch_name": branch_name,
                    "runtime_seconds": elapsed,
                    "diff": data.get("diff", ""),
                }
            except json.JSONDecodeError:
                continue

    # Infer success from output content
    has_changes = "Changes detected" in stdout or "Committing changes" in stdout
    return {
        "status": "completed" if has_changes else "failed",
        "files_changed": 1 if has_changes else 0,
        "lines_added": 0,
        "lines_removed": 0,
        "cost_usd": 0,
        "branch_name": branch_name,
        "runtime_seconds": elapsed,
        "diff": "",
    }


# ── Main Orchestration Loop ───────────────────────────────

def execute_plan(
    plan: ExecutionPlan,
    research_plan_title: str,
    research_idea: str,
    pinned_sha: str = "main",
    log_fn=print,
) -> tuple[list[ExecutionStepResult], float, int]:
    """Execute an ExecutionPlan step-by-step, ported from Opera's managerOrchestrate().

    Returns (results, total_cost, plan_revisions).
    """
    openai = get_openai_client()
    results: list[ExecutionStepResult] = []
    remaining_steps = list(plan.steps)
    plan_revisions = 0
    total_cost = 0.0
    consecutive_no_change = 0
    max_total_steps = len(plan.steps) + MAX_REVISIONS

    execution_id = uuid.uuid4().hex[:8]

    while remaining_steps:
        step = remaining_steps.pop(0)
        remaining_budget = plan.budget_cap_usd - total_cost

        # Budget check
        if remaining_budget < MIN_STEP_BUDGET:
            log_fn(f"Budget too low (${remaining_budget:.2f} remaining, need ${MIN_STEP_BUDGET}). Stopping.")
            break

        # Step limit check
        if len(results) >= max_total_steps:
            log_fn(f"Hit max step limit ({max_total_steps}). Stopping.")
            break

        # Consecutive no-change check
        if consecutive_no_change >= MAX_CONSECUTIVE_NO_CHANGE:
            log_fn(f"{MAX_CONSECUTIVE_NO_CHANGE} consecutive steps produced no changes. Stopping.")
            break

        # Budget allocation per step
        steps_left = len(remaining_steps) + 1
        step_budget = max(
            MIN_STEP_BUDGET,
            min(remaining_budget * 0.9 / steps_left, remaining_budget - 0.10),
        )

        branch_name = f"pearl/{execution_id}/{step.step_number}"

        log_fn(f"\n── Step {step.step_number}: {step.description} ──")
        log_fn(f"   Budget: ${step_budget:.2f} | Model: {step.model} | Branch: {branch_name}")

        # Build enriched prompt with full context
        enriched_prompt = build_enriched_prompt(
            step, research_plan_title, research_idea, results,
        )

        # Determine SHA (for dependent steps, use branch from previous)
        sha = pinned_sha
        if step.depends_on_previous and results:
            prev_branch = results[-1].branch_name
            if prev_branch:
                sha = prev_branch  # Worker will fetch from this branch

        # Spawn worker
        log_fn("   Spawning worker container...")
        worker_output = spawn_worker(
            step=step,
            enriched_prompt=enriched_prompt,
            target_repo=plan.target_repo,
            branch_name=branch_name,
            pinned_sha=sha,
            max_budget_usd=step_budget,
        )

        total_cost += worker_output.get("cost_usd", 0)
        files_changed = worker_output.get("files_changed", 0)

        # Review if completed with changes
        review = None
        if worker_output["status"] == "completed" and files_changed > 0:
            log_fn("   Reviewing output...")
            review = review_step_output(
                openai,
                step,
                worker_output.get("diff", ""),
                files_changed,
                None,  # tests_passed — inferred from log
            )

        step_result = ExecutionStepResult(
            step_number=step.step_number,
            status=worker_output["status"],
            files_changed=files_changed,
            lines_added=worker_output.get("lines_added", 0),
            lines_removed=worker_output.get("lines_removed", 0),
            cost_usd=worker_output.get("cost_usd", 0),
            branch_name=branch_name,
            review_classification=review["classification"] if review else None,
            review_confidence=review.get("confidence", 0) if review else 0,
            review_summary=review.get("summary", "") if review else "",
            runtime_seconds=worker_output.get("runtime_seconds", 0),
            log=worker_output.get("log", ""),
        )
        results.append(step_result)

        log_fn(
            f"   Step {step.step_number} {step_result.status} — "
            f"{files_changed} files changed, ${step_result.cost_usd:.3f}"
            + (f" — {review['classification']}" if review else "")
        )

        # Track no-change streak
        if files_changed == 0:
            consecutive_no_change += 1
        else:
            consecutive_no_change = 0

        # Revise remaining plan if applicable
        if remaining_steps and plan_revisions < MAX_REVISIONS:
            log_fn("   Checking if plan needs revision...")
            revision = revise_remaining_plan(
                openai, research_idea, results, remaining_steps,
            )
            if revision.get("revised"):
                raw_steps = revision.get("steps", [])
                new_steps = []
                for s in raw_steps:
                    new_steps.append(ExecutionStep(
                        step_number=s.get("step_number", 0),
                        description=s.get("description", ""),
                        prompt=s.get("prompt", ""),
                        phase_name=s.get("phase_name", ""),
                        risk_level=s.get("risk_level", "medium"),
                        model=s.get("model", "sonnet"),
                        acceptance_criteria=s.get("acceptance_criteria", ""),
                        max_runtime_seconds=s.get("max_runtime_seconds", 1800),
                        depends_on_previous=s.get("depends_on_previous", True),
                        expected_outputs=s.get("expected_outputs", []),
                        tools=s.get("tools", []),
                    ))
                remaining_steps = new_steps
                plan_revisions += 1
                log_fn(f"   Plan revised ({plan_revisions}/{MAX_REVISIONS}): {revision.get('reasoning', '')[:100]}...")
            else:
                log_fn("   Plan unchanged.")

    log_fn(f"\nExecution complete: {len(results)} steps, ${total_cost:.2f} total, {plan_revisions} revisions.")
    return results, total_cost, plan_revisions
