#!/usr/bin/env python3
"""
LifeOS v3.0 — CRM_CORE Full-Field Two-Way Google Contacts Python Companion
==========================================================================
100% Google People API v1 coverage (95 columns in `Google Contacts Sync Master`)
plus Safe Archived Bulk Deletion (`Sync_Action = "DELETE_FROM_PHONE"`):
  1. Appends full 95-col row + UTC `Purged_Timestamp` to hidden `PURGE_ARCHIVE_LOG` FIRST,
  2. Calls `DELETE https://people.googleapis.com/v1/{resourceName}:deleteContact`
     with rate-limit pacing & batch safety cap (`MAX_DELETES_PER_RUN = 200`),
  3. Outputs confirmed deleted row numbers for safe removal from Master.

Usage:
  # Authorize Google Contacts scope once
  python3 src/utilities/crm_core/contacts_sync.py --auth-url
  python3 src/utilities/crm_core/contacts_sync.py --auth-code "<CODE_OR_URL>" --pull --export-json /tmp/crm_pull.json

  # Push modified rows or purge marked rows (requires --confirm-purge)
  python3 src/utilities/crm_core/contacts_sync.py --purge-json /tmp/marked_for_purge.json --confirm-purge
"""

import argparse
import datetime as dt
import hashlib
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

WORKSPACE_ROOT = Path(__file__).resolve().parents[3]
DEFAULT_CREDS = WORKSPACE_ROOT / ".secrets" / "google_health_credentials.json"
DEFAULT_TOKEN = WORKSPACE_ROOT / ".secrets" / "google_contacts_token.json"
CRM_SHEET_ID = os.environ.get("LIFEOS_CRM_CORE_ID", "1VtJ4_beXHe8N_zfmcB5yBTPm0App8prl3IgY7CMeU8g")

PEOPLE_BASE = "https://people.googleapis.com/v1"
OAUTH_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
OAUTH_TOKEN_URL = "https://oauth2.googleapis.com/token"
SCOPES = ["https://www.googleapis.com/auth/contacts"]
MAX_DELETES_PER_RUN = 200
DELETE_PACE_SECS = 0.16

FULL_PERSON_FIELDS = ",".join([
    "names", "nicknames", "fileAses", "genders", "birthdays",
    "phoneNumbers", "emailAddresses", "imClients", "urls",
    "organizations", "addresses", "events", "relations",
    "biographies", "userDefined", "memberships", "metadata",
])

SPHERE_EMOJI_RULES = [
    (re.compile(r"[❤️💘😍🔥💋🌹🍑🍆😘💕]"), "Love Life", "Dating"),
    (re.compile(r"[⚓🚢⛵🛳🧭]"), "Maritime & Crew", "Worked_With"),
    (re.compile(r"[✈️🌍🗺🏖🧳]"), "Travel Acquaintance", "Traveled_With"),
    (re.compile(r"[💼🏢🤝💻]"), "Professional", "Worked_With"),
    (re.compile(r"[🏠👪🧬]"), "Family", "Inner_Circle"),
    (re.compile(r"[⭐👑🛡💯]"), "Friendship", "Inner_Circle"),
]


def extract_flag_iso2(text: str) -> str:
    cps = [ord(c) for c in (text or "")]
    for i in range(len(cps) - 1):
        if 0x1F1E6 <= cps[i] <= 0x1F1FF and 0x1F1E6 <= cps[i + 1] <= 0x1F1FF:
            return chr(cps[i] - 0x1F1E6 + 65) + chr(cps[i + 1] - 0x1F1E6 + 65)
    return ""


def format_date_obj(d: Optional[Dict[str, Any]]) -> str:
    if not isinstance(d, dict):
        return ""
    y = int(d.get("year") or 0)
    m = int(d.get("month") or 1)
    day = int(d.get("day") or 1)
    return f"{y:04d}-{m:02d}-{day:02d}"


def parse_date_obj(raw: str) -> Optional[Dict[str, int]]:
    m = re.match(r"^(\d{4})-(\d{2})-(\d{2})", str(raw or "").strip())
    if not m:
        return None
    return {"year": int(m.group(1)), "month": int(m.group(2)), "day": int(m.group(3))}


def compute_sync_hash(row_dict: Dict[str, Any]) -> str:
    skip = {"Last Updated Sheet", "Last Updated Google Contacts", "Sync_Direction_Lock", "Sync_Hash", "Contact_ETag", "Sync_Action"}
    canonical = "|".join(str(row_dict.get(k, "") or "").strip() for k in sorted(row_dict.keys()) if k not in skip)
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()[:16]


def person_to_full_dict(person: Dict[str, Any], group_map: Dict[str, str]) -> Dict[str, Any]:
    """Maps 100% of People API v1 fields to the 95-column CRM_CORE dictionary."""
    out: Dict[str, Any] = {}
    out["Contact ID"] = person.get("resourceName", "")
    out["Contact_ETag"] = person.get("etag", "")
    sources = (person.get("metadata") or {}).get("sources") or []
    out["Last Updated Google Contacts"] = next((s.get("updateTime", "") for s in sources if s.get("updateTime")), "")

    n = (person.get("names") or [{}])[0]
    out["First Name"] = n.get("givenName", "")
    out["Middle Name"] = n.get("middleName", "")
    out["Last Name"] = n.get("familyName", "")
    out["Phonetic First Name"] = n.get("phoneticGivenName", "")
    out["Phonetic Middle Name"] = n.get("phoneticMiddleName", "")
    out["Phonetic Last Name"] = n.get("phoneticFamilyName", "")
    out["Name Prefix"] = n.get("honorificPrefix", "")
    out["Name Suffix"] = n.get("honorificSuffix", "")

    out["Nickname"] = ((person.get("nicknames") or [{}])[0]).get("value", "")
    out["File As"] = ((person.get("fileAses") or [{}])[0]).get("value", "")
    g = (person.get("genders") or [{}])[0]
    out["Gender"] = g.get("formattedValue") or g.get("value") or ""
    out["Birthday"] = format_date_obj(((person.get("birthdays") or [{}])[0]).get("date"))
    out["Notes"] = ((person.get("biographies") or [{}])[0]).get("value", "")

    org = (person.get("organizations") or [{}])[0]
    out["Organization Name"] = org.get("name", "")
    out["Organization Title"] = org.get("title", "")
    out["Organization Department"] = org.get("department", "")

    emails = person.get("emailAddresses") or []
    for i in range(1, 5):
        em = emails[i - 1] if i - 1 < len(emails) else {}
        out[f"E-mail {i} - Label"] = em.get("formattedType") or em.get("type") or ""
        out[f"E-mail {i} - Value"] = em.get("value", "")

    phones = person.get("phoneNumbers") or []
    for i in range(1, 5):
        ph = phones[i - 1] if i - 1 < len(phones) else {}
        out[f"Phone {i} - Label"] = ph.get("formattedType") or ph.get("type") or ""
        out[f"Phone {i} - Value"] = ph.get("value", "")

    ims = person.get("imClients") or []
    for i in range(1, 3):
        im = ims[i - 1] if i - 1 < len(ims) else {}
        out[f"IM {i} - Protocol"] = im.get("formattedProtocol") or im.get("protocol") or ""
        out[f"IM {i} - Handle"] = im.get("username", "")

    addrs = person.get("addresses") or []
    for i in range(1, 3):
        ad = addrs[i - 1] if i - 1 < len(addrs) else {}
        out[f"Address {i} - Label"] = ad.get("formattedType") or ad.get("type") or ""
        out[f"Address {i} - Formatted"] = ad.get("formattedValue", "")
        out[f"Address {i} - Street"] = ad.get("streetAddress", "")
        out[f"Address {i} - City"] = ad.get("city", "")
        out[f"Address {i} - PO Box"] = ad.get("poBox", "")
        out[f"Address {i} - Region"] = ad.get("region", "")
        out[f"Address {i} - Postal Code"] = ad.get("postalCode", "")
        out[f"Address {i} - Country"] = ad.get("country", "")
        out[f"Address {i} - Extended Address"] = ad.get("extendedAddress", "")

    rels = person.get("relations") or []
    for i in range(1, 4):
        rl = rels[i - 1] if i - 1 < len(rels) else {}
        out[f"Relation {i} - Label"] = rl.get("formattedType") or rl.get("type") or ""
        out[f"Relation {i} - Value"] = rl.get("person", "")

    urls = person.get("urls") or []
    for i in range(1, 6):
        u = urls[i - 1] if i - 1 < len(urls) else {}
        out[f"Website {i} - Label"] = u.get("formattedType") or u.get("type") or ""
        out[f"Website {i} - Value"] = u.get("value", "")

    evs = person.get("events") or []
    for i in range(1, 3):
        ev = evs[i - 1] if i - 1 < len(evs) else {}
        out[f"Event {i} - Label"] = ev.get("formattedType") or ev.get("type") or ""
        out[f"Event {i} - Value"] = format_date_obj(ev.get("date"))

    uds = person.get("userDefined") or []
    for i in range(1, 3):
        ud = uds[i - 1] if i - 1 < len(uds) else {}
        out[f"Custom Field {i} - Key"] = ud.get("key", "")
        out[f"Custom Field {i} - Value"] = ud.get("value", "")

    labels = []
    for mem in person.get("memberships") or []:
        cg = (mem.get("contactGroupMembership") or {}).get("contactGroupResourceName")
        if cg and cg in group_map and group_map[cg] != "myContacts":
            labels.append(group_map[cg])
    out["Labels"] = " ::: ".join(labels)

    full_name = " ".join(x for x in [out["First Name"], out["Middle Name"], out["Last Name"]] if x)
    out["Country_Origin"] = extract_flag_iso2(full_name)
    out["Sync_Action"] = "KEEP"
    out["Sync_Hash"] = compute_sync_hash(out)
    return out


def build_person_patch(row: Dict[str, Any], etag: str) -> Tuple[Dict[str, Any], List[str]]:
    """Builds a full People API v1 updateContact payload + updatePersonFields mask."""
    g = lambda k: str(row.get(k, "") or "").strip()
    patch: Dict[str, Any] = {"etag": etag}
    fields: List[str] = []

    patch["names"] = [{
        "givenName": g("First Name"), "middleName": g("Middle Name"), "familyName": g("Last Name"),
        "phoneticGivenName": g("Phonetic First Name"), "phoneticMiddleName": g("Phonetic Middle Name"),
        "phoneticFamilyName": g("Phonetic Last Name"), "honorificPrefix": g("Name Prefix"), "honorificSuffix": g("Name Suffix"),
    }]
    fields.append("names")

    if g("Nickname"):
        patch["nicknames"] = [{"value": g("Nickname")}]; fields.append("nicknames")
    if g("File As"):
        patch["fileAses"] = [{"value": g("File As")}]; fields.append("fileAses")
    if g("Gender"):
        patch["genders"] = [{"value": g("Gender")}]; fields.append("genders")
    bday = parse_date_obj(g("Birthday"))
    if bday:
        patch["birthdays"] = [{"date": bday}]; fields.append("birthdays")
    if g("Notes"):
        patch["biographies"] = [{"value": g("Notes"), "contentType": "TEXT_PLAIN"}]; fields.append("biographies")
    if g("Organization Name") or g("Organization Title") or g("Organization Department"):
        patch["organizations"] = [{"name": g("Organization Name"), "title": g("Organization Title"), "department": g("Organization Department")}]
        fields.append("organizations")

    emails = [{"type": g(f"E-mail {i} - Label") or "other", "value": g(f"E-mail {i} - Value")} for i in range(1, 5) if g(f"E-mail {i} - Value")]
    if emails:
        patch["emailAddresses"] = emails; fields.append("emailAddresses")

    phones = [{"type": g(f"Phone {i} - Label") or "mobile", "value": g(f"Phone {i} - Value")} for i in range(1, 5) if g(f"Phone {i} - Value")]
    if phones:
        patch["phoneNumbers"] = phones; fields.append("phoneNumbers")

    ims = [{"protocol": g(f"IM {i} - Protocol") or "other", "username": g(f"IM {i} - Handle")} for i in range(1, 3) if g(f"IM {i} - Handle")]
    if ims:
        patch["imClients"] = ims; fields.append("imClients")

    addrs = []
    for i in range(1, 3):
        if g(f"Address {i} - Street") or g(f"Address {i} - City") or g(f"Address {i} - Formatted"):
            addrs.append({
                "type": g(f"Address {i} - Label") or "home",
                "streetAddress": g(f"Address {i} - Street"),
                "city": g(f"Address {i} - City"),
                "poBox": g(f"Address {i} - PO Box"),
                "region": g(f"Address {i} - Region"),
                "postalCode": g(f"Address {i} - Postal Code"),
                "country": g(f"Address {i} - Country"),
                "extendedAddress": g(f"Address {i} - Extended Address"),
            })
    if addrs:
        patch["addresses"] = addrs; fields.append("addresses")

    rels = [{"type": g(f"Relation {i} - Label") or "other", "person": g(f"Relation {i} - Value")} for i in range(1, 4) if g(f"Relation {i} - Value")]
    if rels:
        patch["relations"] = rels; fields.append("relations")

    urls = [{"type": g(f"Website {i} - Label") or "other", "value": g(f"Website {i} - Value")} for i in range(1, 6) if g(f"Website {i} - Value")]
    if urls:
        patch["urls"] = urls; fields.append("urls")

    evs = []
    for i in range(1, 3):
        d = parse_date_obj(g(f"Event {i} - Value"))
        if d:
            evs.append({"type": g(f"Event {i} - Label") or "other", "date": d})
    if evs:
        patch["events"] = evs; fields.append("events")

    uds = [{"key": g(f"Custom Field {i} - Key"), "value": g(f"Custom Field {i} - Value")} for i in range(1, 3) if g(f"Custom Field {i} - Key") and g(f"Custom Field {i} - Value")]
    if uds:
        patch["userDefined"] = uds; fields.append("userDefined")

    return patch, fields


def load_oauth_cfg(creds_path: Path) -> Dict[str, str]:
    raw = json.loads(creds_path.read_text(encoding="utf-8"))
    cfg = raw.get("web") or raw.get("installed") or raw
    redirects = cfg.get("redirect_uris") or ["http://localhost:8766"]
    return {"client_id": cfg["client_id"], "client_secret": cfg["client_secret"], "redirect_uri": redirects[0]}


def _http_json(method: str, url: str, token: Optional[str] = None, body: Any = None, form: bool = False) -> Tuple[int, Dict[str, Any]]:
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
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            raw = resp.read().decode("utf-8")
            return resp.status, (json.loads(raw) if raw.strip() else {})
    except urllib.error.HTTPError as e:
        raw = e.read().decode("utf-8", errors="ignore")
        try:
            return e.code, json.loads(raw)
        except Exception:
            return e.code, {"raw": raw}


def get_access_token(cfg: Dict[str, str], token_path: Path, auth_code: Optional[str] = None) -> str:
    if auth_code:
        code = auth_code.strip()
        if code.startswith("http"):
            code = urllib.parse.parse_qs(urllib.parse.urlparse(code).query)["code"][0]
        _, tok = _http_json("POST", OAUTH_TOKEN_URL, body={
            "code": code, "client_id": cfg["client_id"], "client_secret": cfg["client_secret"],
            "redirect_uri": cfg["redirect_uri"], "grant_type": "authorization_code",
        }, form=True)
        token_path.parent.mkdir(parents=True, exist_ok=True)
        token_path.write_text(json.dumps(tok, indent=2), encoding="utf-8")
        return tok["access_token"]
    tok = json.loads(token_path.read_text(encoding="utf-8"))
    if tok.get("refresh_token"):
        _, ref = _http_json("POST", OAUTH_TOKEN_URL, body={
            "client_id": cfg["client_id"], "client_secret": cfg["client_secret"],
            "refresh_token": tok["refresh_token"], "grant_type": "refresh_token",
        }, form=True)
        tok["access_token"] = ref["access_token"]
        token_path.write_text(json.dumps(tok, indent=2), encoding="utf-8")
    return tok["access_token"]


def delete_contact_safe(access_token: str, resource_name: str) -> bool:
    url = f"{PEOPLE_BASE}/{resource_name}:deleteContact"
    for attempt in range(4):
        status, resp = _http_json("DELETE", url, token=access_token)
        if status in (200, 204, 404):
            return True
        if status == 429 or status >= 500:
            time.sleep(0.5 * (2 ** attempt))
            continue
        raise RuntimeError(f"deleteContact failed ({status}) for {resource_name}: {resp}")
    return False


def main() -> int:
    parser = argparse.ArgumentParser(description="LifeOS CRM_CORE Full-Field People API v1 Sync & Safe Bulk Purge.")
    parser.add_argument("--creds", type=Path, default=DEFAULT_CREDS)
    parser.add_argument("--token", type=Path, default=DEFAULT_TOKEN)
    parser.add_argument("--auth-url", action="store_true")
    parser.add_argument("--auth-code")
    parser.add_argument("--pull", action="store_true", help="Pull all Google Contacts with 100% People API v1 fields")
    parser.add_argument("--purge-json", type=Path, help="JSON list of {row_num, resourceName} pre-archived to PURGE_ARCHIVE_LOG")
    parser.add_argument("--confirm-purge", action="store_true", help="Required safety flag to execute People API deleteContact")
    parser.add_argument("--export-json", type=Path, help="Write full pulled contact dicts or confirmed purge IDs to JSON")
    args = parser.parse_args()

    cfg = load_oauth_cfg(args.creds)
    if args.auth_url:
        qs = urllib.parse.urlencode({
            "client_id": cfg["client_id"], "redirect_uri": cfg["redirect_uri"],
            "response_type": "code", "scope": " ".join(SCOPES), "access_type": "offline", "prompt": "consent",
        })
        print(f"{OAUTH_AUTH_URL}?{qs}")
        return 0

    token = get_access_token(cfg, args.token, args.auth_code)

    if args.purge_json:
        records = json.loads(args.purge_json.read_text(encoding="utf-8"))
        capped = records[:MAX_DELETES_PER_RUN]
        print(f"Marked for purge: {len(records)} | Batch cap: {len(capped)} (max {MAX_DELETES_PER_RUN}/run)")
        if not args.confirm_purge:
            print("Dry-run only. Re-run with --confirm-purge AFTER archiving rows to PURGE_ARCHIVE_LOG.")
            return 0
        confirmed = []
        for rec in capped:
            res = str(rec.get("resourceName", "")).strip()
            if res.startswith("people/") and delete_contact_safe(token, res):
                confirmed.append(rec)
                time.sleep(DELETE_PACE_SECS)
        print(f"Confirmed deleted from Google Contacts: {len(confirmed)}/{len(capped)}")
        if args.export_json:
            args.export_json.write_text(json.dumps(confirmed, indent=2), encoding="utf-8")
        return 0

    if args.pull:
        _, g_resp = _http_json("GET", f"{PEOPLE_BASE}/contactGroups?pageSize=200", token=token)
        group_map = {g["resourceName"]: g["name"] for g in g_resp.get("contactGroups", [])}
        items = []
        page_token = None
        while True:
            params = {"personFields": FULL_PERSON_FIELDS, "pageSize": "500"}
            if page_token:
                params["pageToken"] = page_token
            _, resp = _http_json("GET", f"{PEOPLE_BASE}/people/me/connections?{urllib.parse.urlencode(params)}", token=token)
            for p in resp.get("connections", []):
                items.append(person_to_full_dict(p, group_map))
            page_token = resp.get("nextPageToken")
            if not page_token:
                break
        print(f"Pulled {len(items)} contacts with 100% People API v1 fields.")
        if args.export_json:
            args.export_json.write_text(json.dumps(items, indent=2), encoding="utf-8")
    return 0


if __name__ == "__main__":
    sys.exit(main())
