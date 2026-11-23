#!/usr/bin/env python3
"""
LifeOS v3.0 — Google Health API v4 OAuth2 & 90-Day Historical Backfill
======================================================================
Official Google Health API v4 client (https://health.googleapis.com/v4) that:
  1. Reads OAuth 2.0 client credentials from `.secrets/google_health_credentials.json`
     (git-ignored) and persists tokens to `.secrets/google_health_token.json`.
  2. Verifies account linking via `GET /v4/users/me/identity` (handling HTTP 400
     `FAILED_PRECONDITION / ACCOUNT_NOT_LINKED` cleanly).
  3. Backfills 90 days of reconciled biometrics (`steps`, `sleep`,
     `daily-resting-heart-rate`, `daily-heart-rate-variability`, `total-calories`,
     `weight`, `exercise`) obeying per-data-type query range limits (14d chunks
     for `total-calories`, 90d chunks for daily/session types).
  4. Deduplicates by `(Date, Source)` and appends cleanly into
     `🩺 BIO_CORE` (`1EecdB1CnjvaR6C7zx9mTVMx7M-vSIMOUgd3lMlEPmEA`) -> `RAW_DATA_Biometrics`.

Canonical Documentation:
  - Setup & OAuth: https://developers.google.com/health/setup
  - Scopes:        https://developers.google.com/health/scopes
  - Endpoints:     https://developers.google.com/health/endpoints
  - Aggregation:   https://developers.google.com/health/aggregate-data
  - Data Types:    https://developers.google.com/health/data-types

Usage:
  # Step 1: Print OAuth2 authorization URL (or run local callback flow)
  python3 src/utilities/biometric_core/google_health_v4_backfill.py --auth-url

  # Step 2: Exchange authorization code (or full redirect URL) & run 90-day backfill
  python3 src/utilities/biometric_core/google_health_v4_backfill.py \
    --auth-code "<CODE_OR_REDIRECT_URL>" --days 90

  # Subsequent runs (uses cached refresh_token automatically)
  python3 src/utilities/biometric_core/google_health_v4_backfill.py --days 90
"""

import argparse
import datetime as dt
import json
import os
import subprocess
import sys
import tempfile
import urllib.error
import urllib.parse
import urllib.request
from collections import defaultdict
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

WORKSPACE_ROOT = Path(__file__).resolve().parents[3]
DEFAULT_CREDS_PATH = WORKSPACE_ROOT / ".secrets" / "google_health_credentials.json"
DEFAULT_TOKEN_PATH = WORKSPACE_ROOT / ".secrets" / "google_health_token.json"

BIO_CORE_SPREADSHEET_ID = os.environ.get(
    "LIFEOS_BIO_CORE_ID",
    "1EecdB1CnjvaR6C7zx9mTVMx7M-vSIMOUgd3lMlEPmEA",
)
RAW_TAB = "RAW_DATA_Biometrics"
HEALTH_BASE = "https://health.googleapis.com/v4"
OAUTH_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
OAUTH_TOKEN_URL = "https://oauth2.googleapis.com/token"

# Official Google Health API v4 readonly scopes (https://developers.google.com/health/scopes)
SCOPES = [
    "https://www.googleapis.com/auth/googlehealth.activity_and_fitness.readonly",
    "https://www.googleapis.com/auth/googlehealth.health_metrics_and_measurements.readonly",
    "https://www.googleapis.com/auth/googlehealth.sleep.readonly",
    "https://www.googleapis.com/auth/googlehealth.profile.readonly",
]

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
    return {col: None for col in COLUMNS[3:]}


def load_client_config(creds_path: Path) -> Dict[str, Any]:
    if not creds_path.exists():
        raise FileNotFoundError(
            f"Credentials file not found at {creds_path}. "
            "Move your downloaded client_secret_*.json to .secrets/google_health_credentials.json."
        )
    raw = json.loads(creds_path.read_text(encoding="utf-8"))
    cfg = raw.get("web") or raw.get("installed") or raw
    if "client_id" not in cfg or "client_secret" not in cfg:
        raise ValueError(f"Invalid OAuth client JSON in {creds_path}: missing client_id/client_secret")
    redirects = cfg.get("redirect_uris") or ["https://www.google.com"]
    return {
        "client_id": cfg["client_id"],
        "client_secret": cfg["client_secret"],
        "redirect_uri": redirects[0],
        "auth_uri": cfg.get("auth_uri", OAUTH_AUTH_URL),
        "token_uri": cfg.get("token_uri", OAUTH_TOKEN_URL),
    }


def build_authorization_url(cfg: Dict[str, Any]) -> str:
    params = {
        "client_id": cfg["client_id"],
        "redirect_uri": cfg["redirect_uri"],
        "response_type": "code",
        "scope": " ".join(SCOPES),
        "access_type": "offline",
        "prompt": "consent",
        "include_granted_scopes": "true",
    }
    return f"{cfg['auth_uri']}?{urllib.parse.urlencode(params)}"


def extract_code(code_or_url: str) -> str:
    s = code_or_url.strip()
    if s.startswith("http://") or s.startswith("https://"):
        parsed = urllib.parse.urlparse(s)
        qs = urllib.parse.parse_qs(parsed.query)
        if "code" in qs and qs["code"]:
            return qs["code"][0]
        raise ValueError("Redirect URL does not contain a `?code=...` parameter.")
    return s


def _post_form(url: str, data: Dict[str, str]) -> Dict[str, Any]:
    body = urllib.parse.urlencode(data).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=body,
        headers={"Content-Type": "application/x-www-form-urlencoded", "Accept": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        err_body = e.read().decode("utf-8", errors="ignore")
        raise RuntimeError(f"OAuth token exchange failed ({e.code}): {err_body}") from e


def exchange_auth_code(cfg: Dict[str, Any], code_or_url: str, token_path: Path) -> Dict[str, Any]:
    code = extract_code(code_or_url)
    tok = _post_form(
        cfg["token_uri"],
        {
            "code": code,
            "client_id": cfg["client_id"],
            "client_secret": cfg["client_secret"],
            "redirect_uri": cfg["redirect_uri"],
            "grant_type": "authorization_code",
        },
    )
    tok["obtained_at_utc"] = dt.datetime.now(dt.timezone.utc).isoformat()
    token_path.parent.mkdir(parents=True, exist_ok=True)
    token_path.write_text(json.dumps(tok, indent=2), encoding="utf-8")
    os.chmod(token_path, 0o600)
    return tok


def refresh_access_token(cfg: Dict[str, Any], token_path: Path) -> Dict[str, Any]:
    if not token_path.exists():
        raise FileNotFoundError(
            f"No cached token at {token_path}. Run with --auth-url then --auth-code first."
        )
    tok = json.loads(token_path.read_text(encoding="utf-8"))
    refresh_tok = tok.get("refresh_token")
    if not refresh_tok:
        return tok
    refreshed = _post_form(
        cfg["token_uri"],
        {
            "client_id": cfg["client_id"],
            "client_secret": cfg["client_secret"],
            "refresh_token": refresh_tok,
            "grant_type": "refresh_token",
        },
    )
    tok["access_token"] = refreshed["access_token"]
    if refreshed.get("scope"):
        tok["scope"] = refreshed["scope"]
    tok["obtained_at_utc"] = dt.datetime.now(dt.timezone.utc).isoformat()
    token_path.write_text(json.dumps(tok, indent=2), encoding="utf-8")
    os.chmod(token_path, 0o600)
    return tok


def health_request(
    method: str,
    path: str,
    access_token: str,
    params: Optional[Dict[str, str]] = None,
    body: Optional[Dict[str, Any]] = None,
) -> Tuple[int, Dict[str, Any]]:
    url = f"{HEALTH_BASE}{path}"
    if params:
        url = f"{url}?{urllib.parse.urlencode(params)}"
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Accept": "application/json",
    }
    data_bytes = None
    if body is not None:
        headers["Content-Type"] = "application/json"
        data_bytes = json.dumps(body).encode("utf-8")
    req = urllib.request.Request(url, data=data_bytes, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return resp.status, json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        raw = e.read().decode("utf-8", errors="ignore")
        try:
            parsed = json.loads(raw)
        except Exception:
            parsed = {"raw_error": raw}
        return e.code, parsed


def verify_identity(access_token: str) -> Dict[str, Any]:
    """Calls GET /v4/users/me/identity and handles ACCOUNT_NOT_LINKED gracefully."""
    status, data = health_request("GET", "/users/me/identity", access_token)
    if status == 400:
        err = data.get("error", {})
        for detail in err.get("details", []):
            if detail.get("reason") == "ACCOUNT_NOT_LINKED":
                redir = detail.get("metadata", {}).get("redirect_uri", "https://fitbit.google.com/auth/signup")
                raise RuntimeError(
                    "Google Account is not linked to Google Health yet (ACCOUNT_NOT_LINKED). "
                    f"Sign in to the Google Health mobile app or visit {redir}, then re-run."
                )
    if status >= 400:
        raise RuntimeError(f"users.getIdentity failed ({status}): {json.dumps(data)}")
    return data


def _civil_dt(d: dt.date) -> Dict[str, Any]:
    return {
        "date": {"year": d.year, "month": d.month, "day": d.day},
        "time": {"hours": 0, "minutes": 0, "seconds": 0, "nanos": 0},
    }


def _civil_date_str(obj: Optional[Dict[str, Any]]) -> Optional[str]:
    if not isinstance(obj, dict):
        return None
    d = obj.get("date") or obj
    y, m, day = d.get("year"), d.get("month"), d.get("day")
    if y and m and day:
        return f"{int(y):04d}-{int(m):02d}-{int(day):02d}"
    return None


def _iso_date_prefix(val: Optional[str]) -> Optional[str]:
    if not val or len(val) < 10:
        return None
    return val[:10]


def fetch_daily_rollup(
    access_token: str,
    data_type: str,
    start_date: dt.date,
    end_date_inclusive: dt.date,
    max_chunk_days: int = 90,
) -> List[Dict[str, Any]]:
    """Queries POST /v4/users/me/dataTypes/{data_type}/dataPoints:dailyRollUp in compliant chunks."""
    results: List[Dict[str, Any]] = []
    cur = start_date
    while cur <= end_date_inclusive:
        chunk_end_incl = min(end_date_inclusive, cur + dt.timedelta(days=max_chunk_days - 1))
        # CivilTimeInterval is closed-open [start, end), so end = next calendar day at 00:00:00
        end_excl = chunk_end_incl + dt.timedelta(days=1)
        payload = {
            "range": {"start": _civil_dt(cur), "end": _civil_dt(end_excl)},
            "windowSizeDays": 1,
        }
        status, data = health_request(
            "POST", f"/users/me/dataTypes/{data_type}/dataPoints:dailyRollUp", access_token, body=payload
        )
        if status == 403:
            print(f"  [SKIP] Scope not granted for {data_type} (HTTP 403); degrading gracefully.")
            return []
        if status >= 400:
            print(f"  [WARN] dailyRollUp {data_type} ({cur}..{chunk_end_incl}) returned {status}: {data}")
        else:
            results.extend(data.get("rollupDataPoints", []))
        cur = end_excl
    return results


def fetch_list_or_reconcile(
    access_token: str,
    data_type: str,
    filter_expr: str,
    use_reconcile: bool = True,
) -> List[Dict[str, Any]]:
    suffix = ":reconcile" if use_reconcile else ""
    path = f"/users/me/dataTypes/{data_type}/dataPoints{suffix}"
    params = {"filter": filter_expr, "pageSize": "1000"}
    items: List[Dict[str, Any]] = []
    while True:
        status, data = health_request("GET", path, access_token, params=params)
        if status == 403:
            print(f"  [SKIP] Scope not granted for {data_type} (HTTP 403); degrading gracefully.")
            return []
        if status >= 400:
            print(f"  [WARN] {data_type}{suffix} returned {status}: {data}")
            break
        items.extend(data.get("dataPoints", []))
        nxt = data.get("nextPageToken")
        if not nxt:
            break
        params["pageToken"] = nxt
    return items


def _parse_duration_seconds(dur: Any) -> float:
    if isinstance(dur, (int, float)):
        return float(dur)
    if isinstance(dur, str) and dur.endswith("s"):
        try:
            return float(dur[:-1])
        except ValueError:
            return 0.0
    return 0.0


def backfill_google_health(access_token: str, days: int) -> Dict[str, Dict[str, Optional[float]]]:
    end_date = dt.date.today()
    start_date = end_date - dt.timedelta(days=days - 1)
    start_iso = f"{start_date.isoformat()}T00:00:00Z"
    daily: Dict[str, Dict[str, Optional[float]]] = defaultdict(_empty_day)

    print(f"Querying Google Health API v4 ({start_date} -> {end_date})...")

    # 1. Steps (dailyRollUp, 90d max)
    for pt in fetch_daily_rollup(access_token, "steps", start_date, end_date, max_chunk_days=90):
        d = _civil_date_str(pt.get("civilStartTime"))
        val = (pt.get("steps") or {}).get("countSum")
        if d and val is not None:
            daily[d]["Steps"] = int(round(float(val)))

    # 2. Total / Active Calories (dailyRollUp, 14d max per official spec!)
    for pt in fetch_daily_rollup(access_token, "total-calories", start_date, end_date, max_chunk_days=14):
        d = _civil_date_str(pt.get("civilStartTime"))
        tc = pt.get("totalCalories") or pt.get("total_calories") or {}
        val = tc.get("kcalSum") or tc.get("kilocaloriesSum") or tc.get("sum")
        if d and val is not None:
            daily[d]["Active_Calories"] = int(round(float(val)))

    # 3. Daily Resting Heart Rate
    rhr_filter = f'daily_resting_heart_rate.date >= "{start_date.isoformat()}"'
    for dp in fetch_list_or_reconcile(access_token, "daily-resting-heart-rate", rhr_filter, use_reconcile=False):
        rhr = dp.get("dailyRestingHeartRate") or {}
        d = _civil_date_str(rhr.get("date"))
        bpm = rhr.get("beatsPerMinute")
        if d and bpm is not None and float(bpm) > 0:
            daily[d]["Resting_HR"] = round(float(bpm), 1)

    # 4. Daily Heart Rate Variability (RMSSD ms)
    hrv_filter = f'daily_heart_rate_variability.date >= "{start_date.isoformat()}"'
    for dp in fetch_list_or_reconcile(access_token, "daily-heart-rate-variability", hrv_filter, use_reconcile=False):
        hrv = dp.get("dailyHeartRateVariability") or {}
        d = _civil_date_str(hrv.get("date"))
        rmssd = hrv.get("averageHeartRateVariabilityMilliseconds") or hrv.get("rmssdMilliseconds")
        if d and rmssd is not None and float(rmssd) > 0:
            daily[d]["HRV_ms"] = round(float(rmssd), 1)

    # 5. Sleep (reconcile)
    sleep_filter = f'sleep.interval.start_time >= "{start_iso}"'
    for dp in fetch_list_or_reconcile(access_token, "sleep", sleep_filter, use_reconcile=True):
        slp = dp.get("sleep") or {}
        interval = slp.get("interval") or {}
        d = _iso_date_prefix(interval.get("endTime") or interval.get("startTime"))
        if not d:
            continue
        summary = slp.get("summary") or {}
        asleep_mins = summary.get("minutesAsleep")
        if asleep_mins is None:
            dur_s = _parse_duration_seconds(summary.get("asleepDuration"))
            asleep_mins = dur_s / 60.0 if dur_s > 0 else None
        if asleep_mins and float(asleep_mins) > 0:
            daily[d]["Sleep_Hours"] = round((daily[d]["Sleep_Hours"] or 0.0) + float(asleep_mins) / 60.0, 2)
        stages = summary.get("stagesSummary") or []
        deep_rem = 0.0
        for st in stages:
            stype = str(st.get("type", "")).upper()
            if "DEEP" in stype or "REM" in stype:
                deep_rem += float(st.get("minutes") or (_parse_duration_seconds(st.get("duration")) / 60.0))
        if deep_rem > 0:
            daily[d]["Deep_REM_Mins"] = int(round((daily[d]["Deep_REM_Mins"] or 0) + deep_rem))

    # 6. Weight (reconcile, grams -> lbs)
    wt_filter = f'weight.sample_time.physical_time >= "{start_iso}"'
    for dp in fetch_list_or_reconcile(access_token, "weight", wt_filter, use_reconcile=True):
        wt = dp.get("weight") or {}
        st = wt.get("sampleTime") or {}
        d = _iso_date_prefix(st.get("physicalTime"))
        grams = wt.get("weightGrams")
        if d and grams is not None and float(grams) > 0:
            daily[d]["Weight_lbs"] = round(float(grams) / 453.59237, 1)

    # 7. Exercise / Workouts (reconcile)
    ex_filter = f'exercise.interval.start_time >= "{start_iso}"'
    for dp in fetch_list_or_reconcile(access_token, "exercise", ex_filter, use_reconcile=True):
        ex = dp.get("exercise") or {}
        interval = ex.get("interval") or {}
        d = _iso_date_prefix(interval.get("startTime"))
        dur_s = _parse_duration_seconds(ex.get("activeDuration") or ex.get("duration"))
        if d and dur_s > 0:
            daily[d]["Workout_Mins"] = int(round((daily[d]["Workout_Mins"] or 0) + dur_s / 60.0))

    return dict(sorted(daily.items()))


def load_existing_keys(spreadsheet_id: str) -> set:
    out = subprocess.check_output(
        ["gsheets", "readonly", "read", spreadsheet_id, f"{RAW_TAB}!B2:C", "--json"],
        text=True,
    )
    rows = json.loads(out) or []
    return {(str(r[0]).strip(), str(r[1]).strip()) for r in rows if len(r) >= 2 and r[0]}


def append_rows_via_gsheets(spreadsheet_id: str, rows: List[list]) -> None:
    if not rows:
        print("No new rows to append to RAW_DATA_Biometrics.")
        return
    ops = [{"op": "append", "range": f"{RAW_TAB}!A:L", "data": rows}]
    with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False) as tf:
        json.dump(ops, tf)
        path = tf.name
    try:
        subprocess.check_call(["gsheets", "mutate", "batch", spreadsheet_id, "-f", path])
    finally:
        os.unlink(path)


def main() -> int:
    parser = argparse.ArgumentParser(description="Google Health API v4 OAuth2 & 90-day backfill into LifeOS BIO_CORE.")
    parser.add_argument("--creds", type=Path, default=DEFAULT_CREDS_PATH, help="OAuth2 client JSON path")
    parser.add_argument("--token", type=Path, default=DEFAULT_TOKEN_PATH, help="Cached OAuth2 token JSON path")
    parser.add_argument("--auth-url", action="store_true", help="Print the Google OAuth2 consent URL and exit")
    parser.add_argument("--auth-code", help="Exchange an authorization code (or full redirect URL) for tokens")
    parser.add_argument("--days", type=int, default=90, help="Number of historical days to backfill (default: 90)")
    parser.add_argument("--source-tag", default="Health_Connect", help="Source column tag (default: Health_Connect)")
    parser.add_argument("--spreadsheet-id", default=BIO_CORE_SPREADSHEET_ID, help="Target BIO_CORE spreadsheet ID")
    parser.add_argument("--dry-run", action="store_true", help="Fetch & preview rows without writing to Google Sheets")
    args = parser.parse_args()

    cfg = load_client_config(args.creds)

    if args.auth_url:
        print("\nOpen this URL in your browser to authorize Google Health API v4:\n")
        print(build_authorization_url(cfg))
        print(
            "\nAfter approving, copy the full redirected URL (or the `code=...` parameter) and run:\n"
            f'  python3 {sys.argv[0]} --auth-code "<PASTE_CODE_OR_URL>" --days {args.days}\n'
        )
        return 0

    if args.auth_code:
        tok = exchange_auth_code(cfg, args.auth_code, args.token)
        print(f"Saved OAuth2 tokens securely to {args.token}")
    else:
        tok = refresh_access_token(cfg, args.token)

    access_token = tok["access_token"]
    identity = verify_identity(access_token)
    print(f"Verified Google Health Identity: healthUserId={identity.get('healthUserId')}")

    daily = backfill_google_health(access_token, args.days)
    existing = set() if args.dry_run else load_existing_keys(args.spreadsheet_id)
    now_iso = dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
    rows = []
    for d_str, metrics in sorted(daily.items()):
        if (d_str, args.source_tag) in existing:
            continue
        vals = [metrics[c] if metrics[c] is not None else "" for c in COLUMNS[3:]]
        if not any(v != "" for v in vals):
            continue
        rows.append([now_iso, d_str, args.source_tag] + vals)

    print(f"Retrieved {len(daily)} day(s) from Google Health API v4; {len(rows)} new row(s) ready.")
    if args.dry_run:
        for r in rows[:10]:
            print("  PREVIEW:", r)
        return 0

    append_rows_via_gsheets(args.spreadsheet_id, rows)
    print(f"Appended {len(rows)} row(s) into {args.spreadsheet_id} -> {RAW_TAB}.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
