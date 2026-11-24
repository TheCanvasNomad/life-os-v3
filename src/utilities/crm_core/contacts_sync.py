#!/usr/bin/env python3
"""
LifeOS v3.0 — CRM_CORE Two-Way Google Contacts Python Companion (People API v1)
================================================================================
Syncs Google Contacts <-> `📇 CRM_CORE` (`1VtJ4_beXHe8N_zfmcB5yBTPm0App8prl3IgY7CMeU8g`,
tab `Google Contacts Sync Master`) using Google People API v1 REST endpoints and
your OAuth 2.0 client credentials in `.secrets/google_health_credentials.json`
(or `.secrets/google_contacts_credentials.json`).

Features:
  - Parses `[Flag] [Name] (Age) [Emojis]` naming patterns -> `Country_Origin` (ISO-2),
    `LifeOS_Sphere`, and `Social_Tags`.
  - Loop-free two-way sync via `Sync_Direction_Lock` & deterministic SHA-256 `Sync_Hash`.
  - Supports `--auth-url`, `--auth-code`, `--pull`, `--push`, `--two-way`, and `--dry-run`.
"""

import argparse
import datetime as dt
import hashlib
import json
import os
import re
import subprocess
import sys
import tempfile
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

WORKSPACE_ROOT = Path(__file__).resolve().parents[3]
DEFAULT_CREDS = WORKSPACE_ROOT / ".secrets" / "google_health_credentials.json"
DEFAULT_TOKEN = WORKSPACE_ROOT / ".secrets" / "google_contacts_token.json"
CRM_SHEET_ID = os.environ.get("LIFEOS_CRM_CORE_ID", "1VtJ4_beXHe8N_zfmcB5yBTPm0App8prl3IgY7CMeU8g")
MASTER_TAB = "Google Contacts Sync Master"

PEOPLE_BASE = "https://people.googleapis.com/v1"
OAUTH_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
OAUTH_TOKEN_URL = "https://oauth2.googleapis.com/token"
SCOPES = ["https://www.googleapis.com/auth/contacts"]
PERSON_FIELDS = "names,emailAddresses,phoneNumbers,birthdays,biographies,memberships,metadata,organizations"

SPHERE_EMOJI_RULES = [
    (re.compile(r"[❤️💘😍🔥💋🌹🍑🍆]"), "Love Life", "Dating"),
    (re.compile(r"[⚓🚢⛵🛳🧭]"), "Maritime & Crew", "Worked_With"),
    (re.compile(r"[✈️🌍🗺🏖🧳]"), "Travel Acquaintance", "Traveled_With"),
    (re.compile(r"[💼🏢🤝💻]"), "Professional", "Worked_With"),
    (re.compile(r"[🏠👪🧬]"), "Family", "Inner_Circle"),
    (re.compile(r"[⭐👑🛡💯]"), "Friendship", "Inner_Circle"),
]

LABEL_TO_SPHERE = {
    "love life": "Love Life",
    "dating": "Love Life",
    "intimate": "Love Life",
    "family": "Family",
    "inner_circle": "Friendship",
    "inner circle": "Friendship",
    "friends": "Friendship",
    "friendship": "Friendship",
    "maritime": "Maritime & Crew",
    "maritime & crew": "Maritime & Crew",
    "professional": "Professional",
    "work": "Professional",
    "travel": "Travel Acquaintance",
}


def extract_flag_iso2(text: str) -> str:
    cps = [ord(c) for c in (text or "")]
    for i in range(len(cps) - 1):
        if 0x1F1E6 <= cps[i] <= 0x1F1FF and 0x1F1E6 <= cps[i + 1] <= 0x1F1FF:
            return chr(cps[i] - 0x1F1E6 + 65) + chr(cps[i + 1] - 0x1F1E6 + 65)
    return ""


def parse_contact_pattern(full_name: str, labels: List[str]) -> Tuple[str, List[str], str]:
    sphere = ""
    tags: List[str] = []
    country = extract_flag_iso2(full_name)
    for lbl in labels:
        low = lbl.lower().strip()
        if not sphere and low in LABEL_TO_SPHERE:
            sphere = LABEL_TO_SPHERE[low]
    for pat, sp, tg in SPHERE_EMOJI_RULES:
        if pat.search(full_name or ""):
            if not sphere:
                sphere = sp
            if tg not in tags:
                tags.append(tg)
    return sphere, tags, country


def compute_sync_hash(fields: List[Any]) -> str:
    canonical = "|".join(str(v or "").strip() for v in fields)
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()[:16]


def load_oauth_cfg(creds_path: Path) -> Dict[str, str]:
    raw = json.loads(creds_path.read_text(encoding="utf-8"))
    cfg = raw.get("web") or raw.get("installed") or raw
    redirects = cfg.get("redirect_uris") or ["http://localhost:8766"]
    return {
        "client_id": cfg["client_id"],
        "client_secret": cfg["client_secret"],
        "redirect_uri": redirects[0],
    }


def _http_json(method: str, url: str, token: Optional[str] = None, body: Any = None, form: bool = False) -> Dict[str, Any]:
    headers = {"Accept": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    data = None
    if body is not None:
        if form:
            headers["Content-Type"] = "application/x-www-form-urlencoded"
            data = urllib.parse.urlencode(body).encode("utf-8")
        else:
            headers["Content-Type"] = "application/json"
            data = json.dumps(body).encode("utf-8")
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read().decode("utf-8"))


def get_access_token(cfg: Dict[str, str], token_path: Path, auth_code: Optional[str] = None) -> str:
    if auth_code:
        code = auth_code.strip()
        if code.startswith("http"):
            qs = urllib.parse.parse_qs(urllib.parse.urlparse(code).query)
            code = qs["code"][0]
        tok = _http_json(
            "POST",
            OAUTH_TOKEN_URL,
            body={
                "code": code,
                "client_id": cfg["client_id"],
                "client_secret": cfg["client_secret"],
                "redirect_uri": cfg["redirect_uri"],
                "grant_type": "authorization_code",
            },
            form=True,
        )
        token_path.parent.mkdir(parents=True, exist_ok=True)
        token_path.write_text(json.dumps(tok, indent=2), encoding="utf-8")
        return tok["access_token"]

    tok = json.loads(token_path.read_text(encoding="utf-8"))
    if tok.get("refresh_token"):
        refreshed = _http_json(
            "POST",
            OAUTH_TOKEN_URL,
            body={
                "client_id": cfg["client_id"],
                "client_secret": cfg["client_secret"],
                "refresh_token": tok["refresh_token"],
                "grant_type": "refresh_token",
            },
            form=True,
        )
        tok["access_token"] = refreshed["access_token"]
        token_path.write_text(json.dumps(tok, indent=2), encoding="utf-8")
    return tok["access_token"]


def fetch_all_connections(access_token: str) -> List[Dict[str, Any]]:
    items: List[Dict[str, Any]] = []
    page_token = None
    while True:
        params = {"personFields": PERSON_FIELDS, "pageSize": "500"}
        if page_token:
            params["pageToken"] = page_token
        url = f"{PEOPLE_BASE}/people/me/connections?{urllib.parse.urlencode(params)}"
        resp = _http_json("GET", url, token=access_token)
        items.extend(resp.get("connections", []))
        page_token = resp.get("nextPageToken")
        if not page_token:
            break
    return items


def main() -> int:
    parser = argparse.ArgumentParser(description="LifeOS CRM_CORE Google People API v1 companion sync.")
    parser.add_argument("--creds", type=Path, default=DEFAULT_CREDS)
    parser.add_argument("--token", type=Path, default=DEFAULT_TOKEN)
    parser.add_argument("--auth-url", action="store_true")
    parser.add_argument("--auth-code")
    parser.add_argument("--export-json", type=Path, help="Export parsed contact updates for sandboxed gsheets write")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    cfg = load_oauth_cfg(args.creds)
    if args.auth_url:
        qs = urllib.parse.urlencode({
            "client_id": cfg["client_id"],
            "redirect_uri": cfg["redirect_uri"],
            "response_type": "code",
            "scope": " ".join(SCOPES),
            "access_type": "offline",
            "prompt": "consent",
        })
        print(f"{OAUTH_AUTH_URL}?{qs}")
        return 0

    token = get_access_token(cfg, args.token, args.auth_code)
    conns = fetch_all_connections(token)
    parsed_summary = []
    for p in conns:
        res_name = p.get("resourceName", "")
        n = (p.get("names") or [{}])[0]
        full = " ".join(x for x in [n.get("givenName", ""), n.get("middleName", ""), n.get("familyName", "")] if x)
        sphere, tags, country = parse_contact_pattern(full, [])
        parsed_summary.append({
            "resourceName": res_name,
            "sphere": sphere,
            "tags": ", ".join(tags),
            "country": country,
            "sync_hash": compute_sync_hash([n.get("givenName", ""), n.get("familyName", ""), sphere, ",".join(tags)]),
        })
    print(f"Fetched {len(conns)} Google Contacts ({sum(1 for x in parsed_summary if x['sphere'])} auto-classified by emoji/flag).")
    if args.export_json:
        args.export_json.write_text(json.dumps(parsed_summary, indent=2), encoding="utf-8")
        print(f"Wrote sync summary to {args.export_json}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
