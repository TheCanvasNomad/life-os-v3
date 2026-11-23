#!/usr/bin/env python3
"""LifeOS-v3 Google Sheets Discovery & Schema-Snapshot Utility.

Searches Google Drive for existing LifeOS spreadsheets, resolves and fills any
missing Spreadsheet IDs in `schemas/workbook_registry.json`, and exports tab
names and header rows for every bound workbook into `schemas/live_snapshots/`.

Authentication order (documented Google auth paths only):
1. `--service-account <path>` or `GOOGLE_APPLICATION_CREDENTIALS` env var
2. `--oauth-client <credentials.json>` (Desktop OAuth flow, caches `token.json`)
3. Google Colab interactive user auth (when running inside Colab)
4. Application Default Credentials (`google.auth.default()`)
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import gspread
from google.auth import default as google_auth_default
from google.auth.credentials import Credentials
from google.auth.transport.requests import Request
from google.oauth2 import credentials as oauth2_credentials
from google.oauth2 import service_account
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build

SCOPES = [
    "https://www.googleapis.com/auth/drive.readonly",
    "https://www.googleapis.com/auth/spreadsheets.readonly",
]

REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_REGISTRY_PATH = REPO_ROOT / "schemas" / "workbook_registry.json"
DEFAULT_SNAPSHOTS_DIR = REPO_ROOT / "schemas" / "live_snapshots"
DEFAULT_TOKEN_PATH = REPO_ROOT / "token.json"

DEFAULT_LIFEOS_KEYWORDS = [
    "lifeos",
    "life os",
    "master_bus",
    "feed_hub",
    "myers-briggs",
    "mbti",
    "saboteur",
    "human design",
    "zodiac",
    "grit",
    "raisec",
    "riasec",
    "big five",
    "big-five",
    "ocean",
    "enneagram",
    "kabbalah",
    "kaballah",
    "16pf",
    "xp hub",
    "belief",
    "stance tracker",
    "career",
    "doppelganger",
    "doppelgänger",
    "temperament",
    "maslow",
    "bio_core",
    "crm_core",
    "shadow",
    "pillar",
]


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def normalize_name(text: str) -> str:
    """Normalize spreadsheet titles for resilient alias matching."""
    return re.sub(r"[^a-z0-9]+", " ", text.lower()).strip()


def sanitize_filename(key: str) -> str:
    return re.sub(r"[^A-Za-z0-9._-]+", "_", key).strip("_")


def load_credentials(
    service_account_path: Path | None = None,
    oauth_client_path: Path | None = None,
    token_path: Path = DEFAULT_TOKEN_PATH,
) -> Credentials:
    """Authenticate using Service Account, Desktop OAuth, Colab, or ADC."""
    sa_path = service_account_path
    if sa_path is None and os.environ.get("GOOGLE_APPLICATION_CREDENTIALS"):
        sa_path = Path(os.environ["GOOGLE_APPLICATION_CREDENTIALS"])

    if sa_path is not None and sa_path.exists():
        return service_account.Credentials.from_service_account_file(
            str(sa_path), scopes=SCOPES
        )

    if oauth_client_path is not None:
        creds: Credentials | None = None
        if token_path.exists():
            creds = oauth2_credentials.Credentials.from_authorized_user_file(
                str(token_path), SCOPES
            )
        if not creds or not creds.valid:
            if creds and creds.expired and creds.refresh_token:
                creds.refresh(Request())
            else:
                if not oauth_client_path.exists():
                    raise FileNotFoundError(
                        f"OAuth client file not found: {oauth_client_path}"
                    )
                flow = InstalledAppFlow.from_client_secrets_file(
                    str(oauth_client_path), SCOPES
                )
                creds = flow.run_local_server(port=0)
            token_path.write_text(creds.to_json(), encoding="utf-8")
        return creds

    # Check if running inside Google Colab
    try:
        from google.colab import auth as colab_auth  # type: ignore[import-not-found]

        colab_auth.authenticate_user()
        creds, _ = google_auth_default(scopes=SCOPES)
        return creds
    except ImportError:
        pass

    # Fallback: Application Default Credentials (gcloud auth application-default login)
    creds, _ = google_auth_default(scopes=SCOPES)
    return creds


def list_drive_spreadsheets(drive_service: Any) -> list[dict[str, Any]]:
    """Return all non-trashed Google Spreadsheets visible in Google Drive."""
    files: list[dict[str, Any]] = []
    page_token: str | None = None
    query = (
        "mimeType='application/vnd.google-apps.spreadsheet' "
        "and trashed=false"
    )

    while True:
        response = (
            drive_service.files()
            .list(
                q=query,
                spaces="drive",
                fields=(
                    "nextPageToken, "
                    "files(id, name, webViewLink, modifiedTime, owners(emailAddress))"
                ),
                includeItemsFromAllDrives=True,
                supportsAllDrives=True,
                pageSize=200,
                pageToken=page_token,
            )
            .execute()
        )
        files.extend(response.get("files", []))
        page_token = response.get("nextPageToken")
        if not page_token:
            break

    return files


def score_match(drive_name: str, entry: dict[str, Any]) -> int:
    """Return match confidence score between a Drive file name and a registry entry."""
    norm_drive = normalize_name(drive_name)
    candidates = [entry.get("title", ""), *entry.get("search_aliases", [])]
    best = 0
    for candidate in candidates:
        norm_cand = normalize_name(candidate)
        if not norm_cand:
            continue
        if norm_drive == norm_cand:
            best = max(best, 100)
        elif norm_cand in norm_drive:
            # Prefer longer, more specific alias matches
            best = max(best, 70 + min(25, len(norm_cand)))
        elif norm_drive in norm_cand and len(norm_drive) >= 6:
            best = max(best, 60)
    return best


def is_lifeos_candidate(drive_name: str, keywords: list[str]) -> bool:
    lower_name = drive_name.lower()
    return any(kw.lower() in lower_name for kw in keywords)


def bind_missing_ids(
    registry: dict[str, Any],
    drive_files: list[dict[str, Any]],
    keywords: list[str],
    include_all_sheets: bool = False,
    force_rebind: bool = False,
) -> tuple[list[str], list[dict[str, Any]]]:
    """Bind missing Spreadsheet IDs in-place and collect unmapped LifeOS sheets."""
    workbooks: dict[str, dict[str, Any]] = registry.setdefault("workbooks", {})
    already_bound_ids = {
        wb["spreadsheet_id"]
        for wb in workbooks.values()
        if wb.get("spreadsheet_id")
    }
    newly_bound: list[str] = []

    for key, entry in workbooks.items():
        if entry.get("spreadsheet_id") and not force_rebind:
            continue

        best_file: dict[str, Any] | None = None
        best_score = 0
        for f in drive_files:
            if f["id"] in already_bound_ids and not force_rebind:
                continue
            score = score_match(f["name"], entry)
            if score > best_score:
                best_score = score
                best_file = f
            elif score == best_score and best_file is not None and score > 0:
                # Break ties by most recently modified spreadsheet
                if f.get("modifiedTime", "") > best_file.get("modifiedTime", ""):
                    best_file = f

        if best_file is not None and best_score >= 70:
            entry["spreadsheet_id"] = best_file["id"]
            entry["title"] = best_file["name"]
            entry["status"] = "bound"
            entry["drive_url"] = best_file.get("webViewLink", "")
            entry["last_bound_utc"] = utc_now_iso()
            already_bound_ids.add(best_file["id"])
            newly_bound.append(
                f"{key} -> {best_file['name']} ({best_file['id']})"
            )

    # Track any other LifeOS spreadsheets found in Drive that aren't in `workbooks`
    unmapped: list[dict[str, Any]] = []
    for f in drive_files:
        if f["id"] in already_bound_ids:
            continue
        if include_all_sheets or is_lifeos_candidate(f["name"], keywords):
            unmapped.append(
                {
                    "title": f["name"],
                    "spreadsheet_id": f["id"],
                    "drive_url": f.get("webViewLink", ""),
                    "modified_time": f.get("modifiedTime", ""),
                }
            )

    unmapped.sort(key=lambda item: item["title"].lower())
    registry["unmapped_discovered"] = unmapped
    return newly_bound, unmapped


def extract_headers_from_preview(rows: list[list[str]]) -> tuple[int | None, list[str]]:
    """Pick the first dense header row from top rows while preserving blank cells."""
    if not rows:
        return None, []

    best_idx = 0
    best_non_empty = -1
    for idx, row in enumerate(rows):
        non_empty = sum(1 for cell in row if str(cell).strip() != "")
        if non_empty > best_non_empty:
            best_non_empty = non_empty
            best_idx = idx
        # Stop immediately if row 1 already has >= 2 populated column headers
        if idx == 0 and non_empty >= 2:
            break

    if best_non_empty <= 0:
        return None, []

    # Preserve internal blank cells as "" (Law 3) while trimming trailing empties
    raw_row = [str(cell) if cell is not None else "" for cell in rows[best_idx]]
    while raw_row and raw_row[-1] == "":
        raw_row.pop()
    return best_idx + 1, raw_row


def snapshot_workbook(
    gc: gspread.Client,
    key: str,
    entry: dict[str, Any],
    preview_rows: int = 3,
    pause_seconds: float = 0.4,
) -> dict[str, Any]:
    """Read tab names and header rows for a single bound workbook via gspread."""
    spreadsheet_id = entry["spreadsheet_id"]
    spreadsheet = gc.open_by_key(spreadsheet_id)
    worksheets = spreadsheet.worksheets()

    tabs_payload: list[dict[str, Any]] = []
    for ws in worksheets:
        try:
            range_ref = f"1:{preview_rows}"
            top_rows = ws.get(range_ref)
        except gspread.exceptions.APIError as exc:
            top_rows = []
            tabs_payload.append(
                {
                    "title": ws.title,
                    "sheet_id": ws.id,
                    "index": ws.index,
                    "row_count": ws.row_count,
                    "col_count": ws.col_count,
                    "header_row_index": None,
                    "headers": [],
                    "row_1": [],
                    "error": str(exc),
                }
            )
            time.sleep(pause_seconds)
            continue

        row_1 = (
            [str(c) if c is not None else "" for c in top_rows[0]]
            if top_rows
            else []
        )
        while row_1 and row_1[-1] == "":
            row_1.pop()

        header_row_idx, headers = extract_headers_from_preview(top_rows)
        tabs_payload.append(
            {
                "title": ws.title,
                "sheet_id": ws.id,
                "index": ws.index,
                "row_count": ws.row_count,
                "col_count": ws.col_count,
                "header_row_index": header_row_idx,
                "headers": headers,
                "row_1": row_1,
            }
        )
        if pause_seconds > 0:
            time.sleep(pause_seconds)

    return {
        "registry_key": key,
        "title": spreadsheet.title,
        "spreadsheet_id": spreadsheet_id,
        "url": spreadsheet.url,
        "snapshot_utc": utc_now_iso(),
        "tab_count": len(tabs_payload),
        "tabs": tabs_payload,
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Discover LifeOS Google Spreadsheets, bind missing IDs in "
            "schemas/workbook_registry.json, and snapshot tab headers into "
            "schemas/live_snapshots/."
        )
    )
    parser.add_argument(
        "--registry",
        type=Path,
        default=DEFAULT_REGISTRY_PATH,
        help=f"Path to workbook registry JSON (default: {DEFAULT_REGISTRY_PATH})",
    )
    parser.add_argument(
        "--snapshots-dir",
        type=Path,
        default=DEFAULT_SNAPSHOTS_DIR,
        help=f"Directory for live schema snapshots (default: {DEFAULT_SNAPSHOTS_DIR})",
    )
    parser.add_argument(
        "--service-account",
        type=Path,
        default=None,
        help="Path to Google service account JSON file.",
    )
    parser.add_argument(
        "--oauth-client",
        type=Path,
        default=None,
        help="Path to Google OAuth Desktop credentials.json.",
    )
    parser.add_argument(
        "--token",
        type=Path,
        default=DEFAULT_TOKEN_PATH,
        help=f"Path to cached OAuth token.json (default: {DEFAULT_TOKEN_PATH})",
    )
    parser.add_argument(
        "--all-sheets",
        action="store_true",
        help="Record all unmapped Drive spreadsheets instead of LifeOS-keyword matches.",
    )
    parser.add_argument(
        "--only-bound",
        action="store_true",
        help="Skip Drive discovery and only snapshot currently bound workbooks.",
    )
    parser.add_argument(
        "--force-rebind",
        action="store_true",
        help="Allow re-matching already bound Spreadsheet IDs during Drive discovery.",
    )
    parser.add_argument(
        "--skip-snapshots",
        action="store_true",
        help="Only discover & update workbook_registry.json without exporting tab snapshots.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Run discovery and print planned updates without writing files.",
    )
    parser.add_argument(
        "--pause-seconds",
        type=float,
        default=0.4,
        help="Delay between worksheet reads to respect Google Sheets read quotas.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    if not args.registry.exists():
        print(f"ERROR: Registry file not found: {args.registry}", file=sys.stderr)
        return 1

    registry = json.loads(args.registry.read_text(encoding="utf-8"))
    creds = load_credentials(
        service_account_path=args.service_account,
        oauth_client_path=args.oauth_client,
        token_path=args.token,
    )

    if not args.only_bound:
        drive_service = build("drive", "v3", credentials=creds, cache_discovery=False)
        drive_files = list_drive_spreadsheets(drive_service)
        print(f"Found {len(drive_files)} Google Spreadsheets in Drive.")

        newly_bound, unmapped = bind_missing_ids(
            registry=registry,
            drive_files=drive_files,
            keywords=DEFAULT_LIFEOS_KEYWORDS,
            include_all_sheets=args.all_sheets,
            force_rebind=args.force_rebind,
        )
        if newly_bound:
            print("Newly bound Spreadsheet IDs:")
            for line in newly_bound:
                print(f"  + {line}")
        else:
            print("No new Spreadsheet IDs bound.")

        print(f"Unmapped LifeOS-candidate spreadsheets recorded: {len(unmapped)}")

    if not args.skip_snapshots:
        gc = gspread.authorize(creds)
        args.snapshots_dir.mkdir(parents=True, exist_ok=True)
        for key, entry in registry.get("workbooks", {}).items():
            sid = entry.get("spreadsheet_id")
            if not sid:
                print(f"  - SKIP {key}: awaiting Spreadsheet ID binding")
                continue

            print(f"Snapshotting {key} ({entry.get('title', '')}) [{sid}]...")
            try:
                snap = snapshot_workbook(
                    gc=gc,
                    key=key,
                    entry=entry,
                    pause_seconds=args.pause_seconds,
                )
            except Exception as exc:  # noqa: BLE001
                print(f"  ! Failed to snapshot {key}: {exc}", file=sys.stderr)
                continue

            discovered_tabs = [tab["title"] for tab in snap["tabs"]]
            existing_live_tabs = entry.get("live_tabs", [])
            # Preserve manually curated live_tabs while recording full discovered tab list
            entry["all_tabs"] = discovered_tabs
            if not existing_live_tabs:
                entry["live_tabs"] = discovered_tabs
            entry["last_snapshot_utc"] = snap["snapshot_utc"]

            out_file = args.snapshots_dir / f"{sanitize_filename(key)}.json"
            if not args.dry_run:
                out_file.write_text(
                    json.dumps(snap, indent=2, ensure_ascii=False) + "\n",
                    encoding="utf-8",
                )
            print(
                f"  ✓ {key}: {snap['tab_count']} tab(s) -> {out_file.relative_to(REPO_ROOT)}"
            )

    registry["last_updated_utc"] = utc_now_iso()
    if args.dry_run:
        print("DRY RUN: No files were written.")
    else:
        args.registry.write_text(
            json.dumps(registry, indent=2, ensure_ascii=False) + "\n",
            encoding="utf-8",
        )
        print(f"Updated registry: {args.registry}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
