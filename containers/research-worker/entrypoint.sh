#!/usr/bin/env bash
set -euo pipefail

# ── Pearl Research Worker Entrypoint ──
# Based on Opera's entrypoint-interactive.sh.
# Clones target repo, runs Claude Code with the task prompt,
# commits and pushes changes, creates a PR.

REPO_DIR="/workspace/repo"
MAX_ROUNDS=3

# ── Required env vars ──
: "${TASK_PROMPT:?TASK_PROMPT is required}"
: "${REPO_URL:?REPO_URL is required}"
: "${PINNED_SHA:?PINNED_SHA is required}"
: "${BRANCH_NAME:?BRANCH_NAME is required}"
: "${GITHUB_TOKEN:?GITHUB_TOKEN is required}"
: "${ANTHROPIC_API_KEY:?ANTHROPIC_API_KEY is required}"
: "${MAX_BUDGET_USD:?MAX_BUDGET_USD is required}"
: "${MODEL:?MODEL is required}"

# ── Configure git ──
echo "[worker] Configuring git..."
git config --global user.name "${GIT_AUTHOR_NAME:-pearl-agent}"
git config --global user.email "${GIT_AUTHOR_EMAIL:-pearl-agent@noreply.github.com}"
git config --global url."https://x-access-token:${GITHUB_TOKEN}@github.com/".insteadOf "https://github.com/"
export GH_TOKEN="$GITHUB_TOKEN"

# ── Clone repository ──
echo "[worker] Cloning repo..."
if ! (
  git init "$REPO_DIR" &&
  cd "$REPO_DIR" &&
  git remote add origin "$REPO_URL" &&
  if git fetch origin "$BRANCH_NAME" 2>/dev/null; then
    echo "[worker] Checking out existing branch $BRANCH_NAME"
    git checkout -b "$BRANCH_NAME" "origin/$BRANCH_NAME"
    git fetch --depth 50 origin main 2>/dev/null || true
  else
    echo "[worker] Creating new branch from ${PINNED_SHA}"
    git fetch --depth 1 origin "$PINNED_SHA" &&
    git checkout FETCH_HEAD &&
    git checkout -b "$BRANCH_NAME"
  fi
); then
  echo "[worker] ERROR: Failed to clone/checkout repository"
  exit 1
fi

cd "$REPO_DIR"

# ── Run Claude Code ──
ROUND=0
while [ "$ROUND" -lt "$MAX_ROUNDS" ]; do
  ROUND=$((ROUND + 1))
  echo ""
  echo "[worker] ══════ Round $ROUND/$MAX_ROUNDS ══════"
  echo "[worker] Running Claude Code (model=$MODEL, budget=$MAX_BUDGET_USD)..."

  CLAUDE_OUTPUT=$(claude \
    -p "$TASK_PROMPT" \
    --output-format text \
    --dangerously-skip-permissions \
    --max-budget-usd "$MAX_BUDGET_USD" \
    --max-turns 100 \
    --model "$MODEL" 2>&1) || true

  echo "$CLAUDE_OUTPUT"

  # Check if Claude made changes
  CHANGES=$(git status --porcelain)
  if [ -n "$CHANGES" ]; then
    echo ""
    echo "[worker] Changes detected! Moving to commit/push."
    break
  fi

  if [ "$ROUND" -ge "$MAX_ROUNDS" ]; then
    echo "[worker] Max rounds reached without changes."
    break
  fi

  echo "[worker] No changes yet. Retrying with more explicit instructions..."
  TASK_PROMPT="$TASK_PROMPT

IMPORTANT: You MUST write actual code files. Do not just explain what to do.
Create the files, write the implementation, and make sure tests pass.
Start by creating the file structure, then implement each component."
done

# ── Commit and push ──
CHANGES=$(git status --porcelain)
if [ -z "$CHANGES" ]; then
  echo "[worker] No changes produced after $ROUND rounds."
  echo '{"status":"failed","files_changed":0,"lines_added":0,"lines_removed":0,"cost_usd":0,"diff":""}'
  exit 0
fi

echo "[worker] Committing changes..."
git add -A
git commit -m "pearl: ${TASK_PROMPT:0:60}" || { echo "[worker] git commit failed"; exit 1; }

# Count changes
FILES_CHANGED=$(git diff HEAD~1 --stat | tail -1 | grep -oP '\d+ file' | grep -oP '\d+' || echo "0")
LINES_ADDED=$(git diff HEAD~1 --numstat | awk '{s+=$1} END {print s+0}')
LINES_REMOVED=$(git diff HEAD~1 --numstat | awk '{s+=$2} END {print s+0}')
DIFF=$(git diff HEAD~1 --stat)

echo "[worker] Pushing branch $BRANCH_NAME..."
git push origin "$BRANCH_NAME" || { echo "[worker] git push failed"; exit 1; }

echo "[worker] Creating PR..."
PR_URL=$(gh pr create \
  --title "Pearl Research: ${TASK_PROMPT:0:60}" \
  --body "Automated research implementation step from Pearl AI" \
  --base main \
  --head "$BRANCH_NAME" \
  --repo "$(echo "$REPO_URL" | sed 's|https://github.com/||;s|\.git$||')" \
  2>&1) || echo "[worker] PR creation failed: $PR_URL"

echo "[worker] Done. PR: ${PR_URL:-none}"

# Emit structured output for the orchestrator to parse
echo "{\"status\":\"completed\",\"files_changed\":$FILES_CHANGED,\"lines_added\":$LINES_ADDED,\"lines_removed\":$LINES_REMOVED,\"cost_usd\":0,\"diff\":\"$DIFF\"}"
