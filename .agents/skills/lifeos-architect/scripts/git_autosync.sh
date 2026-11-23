#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="/storage/emulated/10/Documents/Antigravity/LifeOS"
LOG_FILE="/tmp/lifeos_git_autosync.log"
LOCK_FILE="/tmp/lifeos_git_autosync.lock"
BRANCH="main"

export PATH="/usr/local/bin:/usr/bin:/bin"
export GIT_TERMINAL_PROMPT=0

log() {
  printf '[%s] %s\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" "$*" >> "$LOG_FILE"
}

exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  log "SKIP: another autosync process is already running."
  exit 0
fi

if [ ! -d "$REPO_DIR/.git" ]; then
  log "ERROR: Git repository not found at $REPO_DIR"
  exit 1
fi

cd "$REPO_DIR"
log "START: LifeOS-v3 autosync check"

# Commit any uncommitted local changes before rebasing so local work is preserved.
if [ -n "$(git status --porcelain)" ]; then
  git add -A >> "$LOG_FILE" 2>&1
  if ! git diff --cached --quiet; then
    COMMIT_TS="$(date -u '+%Y-%m-%d %H:%M UTC')"
    if git commit -m "chore(autosync): periodic LifeOS-v3 workspace sync (${COMMIT_TS})" >> "$LOG_FILE" 2>&1; then
      log "COMMIT: auto-committed local workspace changes"
    else
      log "ERROR: git commit failed"
      exit 1
    fi
  fi
fi

# Pull remote changes (e.g. Colab notebook updates) cleanly via rebase.
if ! git pull --rebase origin "$BRANCH" >> "$LOG_FILE" 2>&1; then
  log "ERROR: git pull --rebase origin $BRANCH failed; aborting rebase if in progress"
  git rebase --abort >> "$LOG_FILE" 2>&1 || true
  exit 1
fi

# Push if local branch is ahead of origin/main.
AHEAD_COUNT="$(git rev-list --count "origin/${BRANCH}..HEAD" 2>/dev/null || echo 0)"
if [ "$AHEAD_COUNT" -gt 0 ]; then
  if git push origin "$BRANCH" >> "$LOG_FILE" 2>&1; then
    log "PUSH: pushed $AHEAD_COUNT commit(s) to origin/$BRANCH"
  else
    log "ERROR: git push origin $BRANCH failed (check gh auth / credentials)"
    exit 1
  fi
else
  log "CLEAN: already in sync with origin/$BRANCH"
fi

log "DONE: LifeOS-v3 autosync complete"
