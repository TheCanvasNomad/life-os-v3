# Google Colab Notebooks & GitHub Auto-Sync

This directory stores browser-edited Google Colab notebooks (`.ipynb`) synced
with `https://github.com/TheCanvasNomad/life-os-v3.git` so Antigravity and
Colab stay continuously aligned under **Law 6 (Automated Git & Colab Sync)**.

---

## One-Time Colab Secrets Setup

In Google Colab, open the **Secrets** panel (key icon in the left sidebar) and
add:

| Secret Name | Required | Description |
| :--- | :---: | :--- |
| `GITHUB_PAT` | Yes | Fine-grained GitHub Personal Access Token with **Contents: Read & Write** permission on `TheCanvasNomad/life-os-v3`. |
| `GITHUB_NAME` | Optional | Git commit author name (defaults to `LifeOS Colab Sync`). |
| `GITHUB_EMAIL` | Optional | Git commit author email (defaults to `colab-sync@users.noreply.github.com`). |

Toggle **Notebook access** ON for each notebook that uses the teardown cell.

---

## Reusable Teardown Cell (Auto-Push `.ipynb` to GitHub)

Paste the following Python cell at the end of any LifeOS Colab notebook.
Before running it, press `Ctrl+S` (or **File -> Save**) in Colab so Google
Drive has the latest saved `.ipynb` state.

> **Security guarantee**: Authentication uses an ephemeral `GIT_ASKPASS` helper
> in `/tmp` that is deleted immediately in a `finally` block. Your `GITHUB_PAT`
> is never written into `.git/config`, commit history, or cell output.

```python
# === LifeOS-v3 Colab Teardown: Auto-Push Notebook to GitHub ===
import os
import shutil
import stat
import subprocess
import tempfile
from datetime import datetime, timezone
from pathlib import Path

from google.colab import drive, userdata

# --- Configure per notebook ---
NOTEBOOK_FILENAME = "your_notebook_name.ipynb"  # Exact .ipynb filename
DRIVE_NOTEBOOK_DIR = "/content/drive/MyDrive/Colab Notebooks"
REPO_URL = "https://github.com/TheCanvasNomad/life-os-v3.git"
REPO_BRANCH = "main"
TARGET_SUBDIR = "colab_notebooks"
COMMIT_MESSAGE = f"chore(colab): sync {NOTEBOOK_FILENAME}"
# ------------------------------


def sync_notebook_to_github(
    notebook_filename: str = NOTEBOOK_FILENAME,
    drive_notebook_dir: str = DRIVE_NOTEBOOK_DIR,
    repo_url: str = REPO_URL,
    branch: str = REPO_BRANCH,
    target_subdir: str = TARGET_SUBDIR,
    commit_message: str = COMMIT_MESSAGE,
) -> None:
    token = userdata.get("GITHUB_PAT")
    if not token:
        raise RuntimeError(
            "Missing Colab secret 'GITHUB_PAT'. Add it under Secrets (left sidebar)."
        )

    git_name = userdata.get("GITHUB_NAME") or "LifeOS Colab Sync"
    git_email = (
        userdata.get("GITHUB_EMAIL") or "colab-sync@users.noreply.github.com"
    )

    if not Path("/content/drive/MyDrive").exists():
        drive.mount("/content/drive", force_remount=False)

    src_nb = Path(drive_notebook_dir) / notebook_filename
    if not src_nb.exists():
        # Fallback: check local /content directory
        local_nb = Path("/content") / notebook_filename
        if local_nb.exists():
            src_nb = local_nb
        else:
            raise FileNotFoundError(
                f"Notebook not found at '{src_nb}' or '{local_nb}'. "
                "Save the notebook in Colab (Ctrl+S) and verify NOTEBOOK_FILENAME."
            )

    repo_dir = Path("/content/_lifeos_sync_repo")
    askpass_fd, askpass_path = tempfile.mkstemp(prefix="git_askpass_", suffix=".sh")

    def run_git(args, cwd=None):
        env = os.environ.copy()
        env["GIT_ASKPASS"] = askpass_path
        env["GIT_TERMINAL_PROMPT"] = "0"
        env["LIFEOS_GH_TOKEN"] = token
        proc = subprocess.run(
            ["git", *args],
            cwd=str(cwd) if cwd else None,
            env=env,
            text=True,
            capture_output=True,
        )
        if proc.returncode != 0:
            err = (proc.stderr or proc.stdout or "").replace(token, "***")
            raise RuntimeError(f"git {' '.join(args)} failed:\n{err}")
        return proc.stdout.strip()

    try:
        with os.fdopen(askpass_fd, "w") as f:
            f.write(
                "#!/bin/sh\n"
                'case "$1" in\n'
                '  *Username*) echo "x-access-token" ;;\n'
                '  *Password*) echo "$LIFEOS_GH_TOKEN" ;;\n'
                "esac\n"
            )
        os.chmod(askpass_path, stat.S_IRWXU)

        if not (repo_dir / ".git").exists():
            if repo_dir.exists():
                shutil.rmtree(repo_dir)
            run_git(["clone", "--branch", branch, repo_url, str(repo_dir)])
        else:
            run_git(["remote", "set-url", "origin", repo_url], cwd=repo_dir)
            run_git(["fetch", "origin", branch], cwd=repo_dir)
            run_git(["checkout", branch], cwd=repo_dir)
            run_git(["pull", "--rebase", "origin", branch], cwd=repo_dir)

        run_git(["config", "user.name", git_name], cwd=repo_dir)
        run_git(["config", "user.email", git_email], cwd=repo_dir)

        dest_dir = repo_dir / target_subdir
        dest_dir.mkdir(parents=True, exist_ok=True)
        dest_nb = dest_dir / notebook_filename
        shutil.copy2(src_nb, dest_nb)

        rel_path = f"{target_subdir}/{notebook_filename}"
        run_git(["add", rel_path], cwd=repo_dir)

        staged = run_git(["diff", "--cached", "--name-only"], cwd=repo_dir)
        if not staged:
            print(f"No changes detected in {rel_path}; already up to date.")
            return

        ts = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%SZ")
        run_git(["commit", "-m", f"{commit_message} ({ts})"], cwd=repo_dir)
        run_git(["pull", "--rebase", "origin", branch], cwd=repo_dir)
        run_git(["push", "origin", branch], cwd=repo_dir)
        print(f"Synced '{rel_path}' to {repo_url} ({branch}) at {ts}.")
    finally:
        if os.path.exists(askpass_path):
            os.remove(askpass_path)


sync_notebook_to_github()
```
