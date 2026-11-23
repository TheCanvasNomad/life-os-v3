#!/usr/bin/env python3
"""
LifeOS v3.0 — BIO_CORE Historical Fitbit & Google Health ETL Pipeline
=====================================================================
Backfills historical wearable biometrics into `🩺 BIO_CORE` -> `RAW_DATA_Biometrics`
(Spreadsheet ID: 1EecdB1CnjvaR6C7zx9mTVMx7M-vSIMOUgd3lMlEPmEA).

Supports two ingestion modes:
  1. `--mode takeout`: Parses unzipped Google Takeout Fitbit JSON/CSV archives
     (sleep-*.json, steps-*.json, resting_heart_rate-*.json,
      Daily Heart Rate Variability Summary*.csv, calories-*.json,
      weight-*.json, exercise-*.json).
  2. `--mode api`: Fetches daily time-series via Fitbit Web API OAuth2
     (using FITBIT_ACCESS_TOKEN env var).
     Migration Notice: Google is migrating legacy Fitbit Web API apps to the
     Google Health API v4 (https://developers.google.com/health/migration and
     https://developers.google.com/health/migration/parity-tool). Never
     dual-link a legacy Fitbit Web API token alongside an active Google Health
     API token for the same user; revoke legacy Fitbit tokens on cutover.

Usage:
  python3 fitbit_historical_etl.py --mode takeout --takeout-dir ~/Downloads/Takeout/Fitbit --dry-run
  python3 fitbit_historical_etl.py --mode takeout --takeout-dir ~/Downloads/Takeout/Fitbit
  FITBIT_ACCESS_TOKEN=... python3 fitbit_historical_etl.py --mode api --start 2026-01-01 --end 2026-11-23
"""

import argparse
import csv
import datetime as dt
import glob
import json
import os
import subprocess
import sys
import tempfile
import urllib.error
import urllib.request
from collections import defaultdict
from pathlib import Path
from typing import Dict, List, Optional

BIO_CORE_SPREADSHEET_ID = os.environ.get(
    "LIFEOS_BIO_CORE_ID",
    "1EecdB1CnjvaR6C7zx9mTVMx7M-vSIMOUgd3lMlEPmEA",
)
RAW_TAB = "RAW_DATA_Biometrics"
COLUMNS = [
    "Timestamp",
    "Date",
    "Source",
    "Sleep_Hours",
    "Sleep_Score",
    "Deep_REM_Mins",
    "Steps",
    "Resting_HR",
    "HRV_ms",
    "Active_Calories",
    "Weight_lbs",
    "Workout_Mins",
]


def _empty_day() -> Dict[str, Optional[float]]:
    return {
        "Sleep_Hours": None,
        "Sleep_Score": None,
        "Deep_REM_Mins": None,
        "Steps": None,
        "Resting_HR": None,
        "HRV_ms": None,
        "Active_Calories": None,
        "Weight_lbs": None,
        "Workout_Mins": None,
    }


def _normalize_date(raw: str) -> Optional[str]:
    if not raw:
        return None
    raw = raw.strip()
    for fmt in ("%Y-%m-%d", "%m/%d/%y", "%m/%d/%Y", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%d %H:%M:%S"):
        try:
            return dt.datetime.strptime(raw[:19], fmt).strftime("%Y-%m-%d")
        except ValueError:
            continue
    # ISO prefix fallback
    if len(raw) >= 10 and raw[4] == "-" and raw[7] == "-":
        return raw[:10]
    return None


def parse_takeout_dir(takeout_dir: str) -> Dict[str, Dict[str, Optional[float]]]:
    """Parses unzipped Google Takeout Fitbit JSON and CSV files into daily buckets."""
    root = Path(takeout_dir).expanduser().resolve()
    if not root.exists():
        raise FileNotFoundError(f"Takeout directory not found: {root}")

    daily: Dict[str, Dict[str, Optional[float]]] = defaultdict(_empty_day)
    step_sums: Dict[str, float] = defaultdict(float)
    cal_sums: Dict[str, float] = defaultdict(float)
    workout_sums: Dict[str, float] = defaultdict(float)

    # 1. Sleep JSON (sleep-*.json)
    for path in root.rglob("sleep-*.json"):
        try:
            records = json.loads(path.read_text(encoding="utf-8"))
        except Exception:
            continue
        for rec in records if isinstance(records, list) else []:
            d = _normalize_date(str(rec.get("dateOfSleep", "")))
            if not d:
                continue
            mins_asleep = rec.get("minutesAsleep")
            if isinstance(mins_asleep, (int, float)) and mins_asleep > 0:
                prev = daily[d]["Sleep_Hours"] or 0.0
                daily[d]["Sleep_Hours"] = round(prev + (mins_asleep / 60.0), 2)
            levels = rec.get("levels", {}).get("summary", {})
            deep = levels.get("deep", {}).get("minutes", 0) or 0
            rem = levels.get("rem", {}).get("minutes", 0) or 0
            if (deep + rem) > 0:
                prev_dr = daily[d]["Deep_REM_Mins"] or 0
                daily[d]["Deep_REM_Mins"] = int(prev_dr + deep + rem)

    # 2. Sleep Score CSV (sleep_score.csv)
    for path in root.rglob("*sleep_score*.csv"):
        with path.open(encoding="utf-8", errors="ignore") as f:
            for row in csv.DictReader(f):
                d = _normalize_date(row.get("timestamp", "") or row.get("date", ""))
                score = row.get("overall_score") or row.get("score")
                if d and score:
                    try:
                        daily[d]["Sleep_Score"] = round(float(score), 1)
                    except ValueError:
                        pass

    # 3. Steps JSON (steps-*.json)
    for path in root.rglob("steps-*.json"):
        try:
            records = json.loads(path.read_text(encoding="utf-8"))
        except Exception:
            continue
        for rec in records if isinstance(records, list) else []:
            d = _normalize_date(str(rec.get("dateTime", "")))
            val = rec.get("value")
            if d and val is not None:
                try:
                    step_sums[d] += float(val)
                except ValueError:
                    pass
    for d, total in step_sums.items():
        if total > 0:
            daily[d]["Steps"] = int(round(total))

    # 4. Resting Heart Rate JSON (resting_heart_rate-*.json)
    for path in root.rglob("resting_heart_rate-*.json"):
        try:
            records = json.loads(path.read_text(encoding="utf-8"))
        except Exception:
            continue
        for rec in records if isinstance(records, list) else []:
            d = _normalize_date(str(rec.get("dateTime", "")))
            val = rec.get("value", {})
            rhr = val.get("value") if isinstance(val, dict) else val
            if d and isinstance(rhr, (int, float)) and rhr > 0:
                daily[d]["Resting_HR"] = round(float(rhr), 1)

    # 5. Daily HRV Summary CSV (Daily Heart Rate Variability Summary*.csv)
    for path in root.rglob("*Heart Rate Variability Summary*.csv"):
        with path.open(encoding="utf-8", errors="ignore") as f:
            for row in csv.DictReader(f):
                d = _normalize_date(row.get("timestamp", "") or row.get("date", ""))
                rmssd = row.get("rmssd") or row.get("daily_rmssd")
                if d and rmssd:
                    try:
                        val = float(rmssd)
                        if val > 0:
                            daily[d]["HRV_ms"] = round(val, 1)
                    except ValueError:
                        pass

    # 6. Calories JSON (calories-*.json -> store daily total or active burn)
    for path in root.rglob("calories-*.json"):
        try:
            records = json.loads(path.read_text(encoding="utf-8"))
        except Exception:
            continue
        for rec in records if isinstance(records, list) else []:
            d = _normalize_date(str(rec.get("dateTime", "")))
            val = rec.get("value")
            if d and val is not None:
                try:
                    cal_sums[d] += float(val)
                except ValueError:
                    pass
    for d, total in cal_sums.items():
        if total > 0:
            daily[d]["Active_Calories"] = int(round(total))

    # 7. Weight JSON (weight-*.json)
    for path in root.rglob("weight-*.json"):
        try:
            records = json.loads(path.read_text(encoding="utf-8"))
        except Exception:
            continue
        for rec in records if isinstance(records, list) else []:
            d = _normalize_date(str(rec.get("date", "")))
            w = rec.get("weight")
            if d and isinstance(w, (int, float)) and w > 0:
                daily[d]["Weight_lbs"] = round(float(w), 1)

    # 8. Exercise / Workouts JSON (exercise-*.json)
    for path in root.rglob("exercise-*.json"):
        try:
            records = json.loads(path.read_text(encoding="utf-8"))
        except Exception:
            continue
        for rec in records if isinstance(records, list) else []:
            d = _normalize_date(str(rec.get("startTime", "")))
            dur_ms = rec.get("activeDuration") or rec.get("duration") or 0
            if d and isinstance(dur_ms, (int, float)) and dur_ms > 0:
                workout_sums[d] += dur_ms / 60000.0
    for d, mins in workout_sums.items():
        if mins > 0:
            daily[d]["Workout_Mins"] = int(round(mins))

    return dict(sorted(daily.items()))


def _fitbit_get(url: str, token: str) -> dict:
    req = urllib.request.Request(
        url,
        headers={"Authorization": f"Bearer {token}", "Accept": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=20) as resp:
        return json.loads(resp.read().decode("utf-8"))


def fetch_fitbit_api_range(start_date: str, end_date: str, token: str) -> Dict[str, Dict[str, Optional[float]]]:
    """
    Fetches historical daily Fitbit metrics via Fitbit Web API OAuth2.
    Anti-dual-linking guard: aborts if GOOGLE_HEALTH_ACCESS_TOKEN is also set,
    per https://developers.google.com/health/migration.
    """
    if os.environ.get("GOOGLE_HEALTH_ACCESS_TOKEN"):
        raise RuntimeError(
            "Anti-dual-linking guard triggered: both FITBIT_ACCESS_TOKEN and "
            "GOOGLE_HEALTH_ACCESS_TOKEN are set. Revoke legacy Fitbit tokens on "
            "cutover to Google Health API v4 (https://developers.google.com/health/migration)."
        )

    daily: Dict[str, Dict[str, Optional[float]]] = defaultdict(_empty_day)
    base = "https://api.fitbit.com"

    # Steps
    steps_resp = _fitbit_get(f"{base}/1/user/-/activities/steps/date/{start_date}/{end_date}.json", token)
    for item in steps_resp.get("activities-steps", []):
        val = int(float(item.get("value", 0)))
        if val > 0:
            daily[item["dateTime"]]["Steps"] = val

    # Resting HR
    hr_resp = _fitbit_get(f"{base}/1/user/-/activities/heart/date/{start_date}/{end_date}.json", token)
    for item in hr_resp.get("activities-heart", []):
        rhr = item.get("value", {}).get("restingHeartRate")
        if rhr:
            daily[item["dateTime"]]["Resting_HR"] = round(float(rhr), 1)

    # Activity Calories
    cal_resp = _fitbit_get(f"{base}/1/user/-/activities/activityCalories/date/{start_date}/{end_date}.json", token)
    for item in cal_resp.get("activities-activityCalories", []):
        val = int(float(item.get("value", 0)))
        if val > 0:
            daily[item["dateTime"]]["Active_Calories"] = val

    # Sleep (v1.2 range)
    sleep_resp = _fitbit_get(f"{base}/1.2/user/-/sleep/date/{start_date}/{end_date}.json", token)
    for rec in sleep_resp.get("sleep", []):
        d = rec.get("dateOfSleep")
        if not d:
            continue
        mins = rec.get("minutesAsleep", 0) or 0
        if mins > 0:
            daily[d]["Sleep_Hours"] = round((daily[d]["Sleep_Hours"] or 0.0) + mins / 60.0, 2)
        lvl = rec.get("levels", {}).get("summary", {})
        dr = (lvl.get("deep", {}).get("minutes", 0) or 0) + (lvl.get("rem", {}).get("minutes", 0) or 0)
        if dr > 0:
            daily[d]["Deep_REM_Mins"] = int((daily[d]["Deep_REM_Mins"] or 0) + dr)

    # HRV (range endpoint supports up to 30d chunks)
    s_dt = dt.date.fromisoformat(start_date)
    e_dt = dt.date.fromisoformat(end_date)
    cur = s_dt
    while cur <= e_dt:
        chunk_end = min(e_dt, cur + dt.timedelta(days=29))
        try:
            hrv_resp = _fitbit_get(f"{base}/1/user/-/hrv/date/{cur.isoformat()}/{chunk_end.isoformat()}.json", token)
            for rec in hrv_resp.get("hrv", []):
                rmssd = rec.get("value", {}).get("dailyRmssd")
                if rmssd:
                    daily[rec["dateTime"]]["HRV_ms"] = round(float(rmssd), 1)
        except urllib.error.HTTPError:
            pass
        cur = chunk_end + dt.timedelta(days=1)

    return dict(sorted(daily.items()))


def load_existing_keys(spreadsheet_id: str) -> set:
    """Reads existing (Date, Source) keys from RAW_DATA_Biometrics for idempotent dedupe."""
    out = subprocess.check_output(
        ["gsheets", "readonly", "read", spreadsheet_id, f"{RAW_TAB}!B2:C", "--json"],
        text=True,
    )
    rows = json.loads(out) or []
    return {(str(r[0]).strip(), str(r[1]).strip()) for r in rows if len(r) >= 2 and r[0]}


def append_rows_via_gsheets(spreadsheet_id: str, rows: List[list]) -> None:
    """Appends deduplicated rows to RAW_DATA_Biometrics using gsheets mutate batch."""
    if not rows:
        print("No new rows to append.")
        return
    ops = [{"op": "append", "range": f"{RAW_TAB}!A:L", "data": rows}]
    with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False) as tf:
        json.dump(ops, tf)
        path = tf.name
    try:
        subprocess.check_call(["gsheets", "mutate", "batch", spreadsheet_id, "-f", path])
    finally:
        os.unlink(path)


def format_rows(daily: Dict[str, Dict[str, Optional[float]]], source_tag: str, existing: set) -> List[list]:
    now_iso = dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
    rows = []
    for date_str, metrics in sorted(daily.items()):
        if (date_str, source_tag) in existing:
            continue
        # Law 3: leave unlogged metrics as "" (never false 0!)
        vals = [metrics[col] if metrics[col] is not None else "" for col in COLUMNS[3:]]
        if not any(v != "" for v in vals):
            continue
        rows.append([now_iso, date_str, source_tag] + vals)
    return rows


def main() -> int:
    parser = argparse.ArgumentParser(description="Backfill historical Fitbit biometrics into LifeOS BIO_CORE.")
    parser.add_argument("--mode", choices=["takeout", "api"], required=True, help="Ingestion source mode")
    parser.add_argument("--takeout-dir", help="Path to unzipped Google Takeout Fitbit directory")
    parser.add_argument("--start", help="Start date YYYY-MM-DD (api mode)")
    parser.add_argument("--end", help="End date YYYY-MM-DD (api mode)")
    parser.add_argument("--spreadsheet-id", default=BIO_CORE_SPREADSHEET_ID, help="Target BIO_CORE spreadsheet ID")
    parser.add_argument("--source-tag", default="Fitbit_Legacy", help="Source column value (default: Fitbit_Legacy)")
    parser.add_argument("--dry-run", action="store_true", help="Parse and print preview without writing to Sheets")
    args = parser.parse_args()

    if args.mode == "takeout":
        if not args.takeout_dir:
            parser.error("--takeout-dir is required for --mode takeout")
        daily = parse_takeout_dir(args.takeout_dir)
    else:
        token = os.environ.get("FITBIT_ACCESS_TOKEN", "").strip()
        if not token:
            parser.error("FITBIT_ACCESS_TOKEN environment variable is required for --mode api")
        if not args.start or not args.end:
            parser.error("--start and --end (YYYY-MM-DD) are required for --mode api")
        daily = fetch_fitbit_api_range(args.start, args.end, token)

    existing = set() if args.dry_run else load_existing_keys(args.spreadsheet_id)
    rows = format_rows(daily, args.source_tag, existing)
    print(f"Parsed {len(daily)} unique day(s); {len(rows)} new row(s) ready for {RAW_TAB}.")
    if args.dry_run:
        for r in rows[:10]:
            print("  PREVIEW:", r)
        return 0

    append_rows_via_gsheets(args.spreadsheet_id, rows)
    print(f"Successfully appended {len(rows)} row(s) to {args.spreadsheet_id} -> {RAW_TAB}.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
