#!/usr/bin/env python3
"""
LifeOS v3.2 — Full People API v1 Two-Way Sync, Birthday Toggle, Vault Purge/Restore
& Cross-Brick Symbiosis CLI.

Targets:
  - Workbook 1: 📱 Master_Contacts_Sync       (1VtJ4_beXHe8N_zfmcB5yBTPm0App8prl3IgY7CMeU8g)
  - Workbook 2: 🗄️ Purged_Contacts_Vault      (1eoLRVMOxdpHx3YkkWnfkOfowhTH8fbam8R2jDzUJB84)
  - Workbook 3: 📇 Core_CRM                   (1PKYbEie4QUgSqqTVW1Y2UVjBgRStz4Aok2BhCWCvU5M)
  - Workbook 4: 📓 NotebookLM_Social_Workbook (1gwnGKdfZrtJi6QwEWniPMli6i-Se8Fi2pwjX1ebaaPs)

All OAuth credentials/tokens live exclusively inside git-ignored `.secrets/`.
"""

import argparse
import fcntl
import hashlib
import json
import os
import subprocess
import sys
import tempfile
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

LOCK_FILE_PATH = Path("/tmp/lifeos_contacts_two_way_sync.lock")

MASTER_SS_ID = "1VtJ4_beXHe8N_zfmcB5yBTPm0App8prl3IgY7CMeU8g"
VAULT_SS_ID = "1eoLRVMOxdpHx3YkkWnfkOfowhTH8fbam8R2jDzUJB84"
CORE_CRM_SS_ID = "1PKYbEie4QUgSqqTVW1Y2UVjBgRStz4Aok2BhCWCvU5M"
NOTEBOOKLM_SS_ID = "1gwnGKdfZrtJi6QwEWniPMli6i-Se8Fi2pwjX1ebaaPs"

MAX_VAULT_ACTIONS_PER_RUN = 200
API_PACE_SECONDS = 0.16

PEOPLE_SCOPES = ["https://www.googleapis.com/auth/contacts"]
PERSON_FIELDS = ",".join([
    "names", "nicknames", "fileAses", "genders", "birthdays",
    "phoneNumbers", "emailAddresses", "imClients", "urls",
    "organizations", "addresses", "events", "relations",
    "biographies", "userDefined", "memberships", "metadata",
])
UPDATE_PERSON_FIELDS = ",".join([
    "names", "nicknames", "fileAses", "genders", "birthdays",
    "phoneNumbers", "emailAddresses", "imClients", "urls",
    "organizations", "addresses", "events", "relations",
    "biographies", "userDefined", "memberships",
])

MASTER_89_HEADERS = [
    "Contact ID", "Last Updated Sheet", "Last Updated Google Contacts",
    "First Name", "Middle Name", "Last Name",
    "Phonetic First Name", "Phonetic Middle Name", "Phonetic Last Name",
    "Name Prefix", "Name Suffix", "Nickname", "File As",
    "Gender", "Birthday",
    "Organization Name", "Organization Title", "Organization Department",
    "Phone 1 - Label", "Phone 1 - Value",
    "Phone 2 - Label", "Phone 2 - Value",
    "Phone 3 - Label", "Phone 3 - Value",
    "Phone 4 - Label", "Phone 4 - Value",
    "E-mail 1 - Label", "E-mail 1 - Value",
    "E-mail 2 - Label", "E-mail 2 - Value",
    "E-mail 3 - Label", "E-mail 3 - Value",
    "E-mail 4 - Label", "E-mail 4 - Value",
    "IM 1 - Protocol", "IM 1 - Handle",
    "IM 2 - Protocol", "IM 2 - Handle",
    "Address 1 - Label", "Address 1 - Formatted", "Address 1 - Street",
    "Address 1 - City", "Address 1 - PO Box", "Address 1 - Region",
    "Address 1 - Postal Code", "Address 1 - Country", "Address 1 - Extended Address",
    "Address 2 - Label", "Address 2 - Formatted", "Address 2 - Street",
    "Address 2 - City", "Address 2 - PO Box", "Address 2 - Region",
    "Address 2 - Postal Code", "Address 2 - Country", "Address 2 - Extended Address",
    "Relation 1 - Label", "Relation 1 - Value",
    "Relation 2 - Label", "Relation 2 - Value",
    "Relation 3 - Label", "Relation 3 - Value",
    "Website 1 - Label", "Website 1 - Value",
    "Website 2 - Label", "Website 2 - Value",
    "Website 3 - Label", "Website 3 - Value",
    "Website 4 - Label", "Website 4 - Value",
    "Website 5 - Label", "Website 5 - Value",
    "Event 1 - Label", "Event 1 - Value",
    "Event 2 - Label", "Event 2 - Value",
    "Custom Field 1 - Key", "Custom Field 1 - Value",
    "Custom Field 2 - Key", "Custom Field 2 - Value",
    "Notes", "Photo", "Labels",
    "Master_Birthday", "Birthday_Sync", "Sync_Action",
    "Contact_ETag", "Sync_Direction_Lock", "Sync_Hash",
]


def format_people_date(d: Optional[Dict[str, Any]]) -> str:
    if not d:
        return ""
    mm = f"{int(d.get('month', 1)):02d}"
    dd = f"{int(d.get('day', 1)):02d}"
    return f"{int(d['year']):04d}-{mm}-{dd}" if d.get("year") else f"--{mm}-{dd}"


def parse_date_to_people_obj(val: str) -> Optional[Dict[str, int]]:
    s = (val or "").strip()
    if not s:
        return None
    parts = s.split("-")
    try:
        if len(parts) == 3 and parts[0].isdigit():
            return {"year": int(parts[0]), "month": int(parts[1]), "day": int(parts[2])}
        if s.startswith("--") and len(parts) == 4:
            return {"month": int(parts[2]), "day": int(parts[3])}
    except ValueError:
        return None
    return None


def person_to_master_dict(person: Dict[str, Any], res_to_label: Dict[str, str]) -> Dict[str, str]:
    out = {h: "" for h in MASTER_89_HEADERS}
    out["Contact ID"] = person.get("resourceName", "")
    out["Contact_ETag"] = person.get("etag", "")

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
    g0 = (person.get("genders") or [{}])[0]
    out["Gender"] = g0.get("formattedValue") or g0.get("value", "")

    b0 = ((person.get("birthdays") or [{}])[0]).get("date")
    bstr = format_people_date(b0)
    out["Birthday"] = bstr
    out["Master_Birthday"] = bstr
    out["Birthday_Sync"] = "ON_PHONE_&_CALENDAR" if bstr else ""

    o0 = (person.get("organizations") or [{}])[0]
    out["Organization Name"] = o0.get("name", "")
    out["Organization Title"] = o0.get("title", "")
    out["Organization Department"] = o0.get("department", "")

    for i, ph in enumerate((person.get("phoneNumbers") or [])[:4], 1):
        out[f"Phone {i} - Label"] = ph.get("formattedType") or ph.get("type", "")
        out[f"Phone {i} - Value"] = ph.get("value", "")
    for i, em in enumerate((person.get("emailAddresses") or [])[:4], 1):
        out[f"E-mail {i} - Label"] = em.get("formattedType") or em.get("type", "")
        out[f"E-mail {i} - Value"] = em.get("value", "")
    for i, im in enumerate((person.get("imClients") or [])[:2], 1):
        out[f"IM {i} - Protocol"] = im.get("formattedProtocol") or im.get("protocol", "")
        out[f"IM {i} - Handle"] = im.get("username", "")
    for i, ad in enumerate((person.get("addresses") or [])[:2], 1):
        pfx = f"Address {i} - "
        out[pfx + "Label"] = ad.get("formattedType") or ad.get("type", "")
        out[pfx + "Formatted"] = ad.get("formattedValue", "")
        out[pfx + "Street"] = ad.get("streetAddress", "")
        out[pfx + "City"] = ad.get("city", "")
        out[pfx + "PO Box"] = ad.get("poBox", "")
        out[pfx + "Region"] = ad.get("region", "")
        out[pfx + "Postal Code"] = ad.get("postalCode", "")
        out[pfx + "Country"] = ad.get("country", "")
        out[pfx + "Extended Address"] = ad.get("extendedAddress", "")
    for i, rl in enumerate((person.get("relations") or [])[:3], 1):
        out[f"Relation {i} - Label"] = rl.get("formattedType") or rl.get("type", "")
        out[f"Relation {i} - Value"] = rl.get("person", "")
    for i, u in enumerate((person.get("urls") or [])[:5], 1):
        out[f"Website {i} - Label"] = u.get("formattedType") or u.get("type", "")
        out[f"Website {i} - Value"] = u.get("value", "")
    for i, ev in enumerate((person.get("events") or [])[:2], 1):
        out[f"Event {i} - Label"] = ev.get("formattedType") or ev.get("type", "")
        out[f"Event {i} - Value"] = format_people_date(ev.get("date"))
    for i, ud in enumerate((person.get("userDefined") or [])[:2], 1):
        out[f"Custom Field {i} - Key"] = ud.get("key", "")
        out[f"Custom Field {i} - Value"] = ud.get("value", "")

    out["Notes"] = ((person.get("biographies") or [{}])[0]).get("value", "")
    lbls = []
    for mb in person.get("memberships") or []:
        rn = (mb.get("contactGroupMembership") or {}).get("contactGroupResourceName", "")
        if rn and rn in res_to_label and rn != "contactGroups/myContacts":
            lbls.append(res_to_label[rn])
    out["Labels"] = ", ".join(lbls)
    out["Sync_Action"] = "KEEP"
    return out


def build_person_patch(row: Dict[str, str], label_to_res: Dict[str, str]) -> Dict[str, Any]:
    g = lambda k: str(row.get(k, "") or "").strip()
    patch: Dict[str, Any] = {}
    if g("Contact_ETag"):
        patch["etag"] = g("Contact_ETag")

    patch["names"] = [{
        "givenName": g("First Name"),
        "middleName": g("Middle Name"),
        "familyName": g("Last Name"),
        "phoneticGivenName": g("Phonetic First Name"),
        "phoneticMiddleName": g("Phonetic Middle Name"),
        "phoneticFamilyName": g("Phonetic Last Name"),
        "honorificPrefix": g("Name Prefix"),
        "honorificSuffix": g("Name Suffix"),
    }]
    patch["nicknames"] = [{"value": g("Nickname")}] if g("Nickname") else []
    patch["fileAses"] = [{"value": g("File As")}] if g("File As") else []
    patch["genders"] = [{"value": g("Gender")}] if g("Gender") else []

    # Master_Birthday <-> Birthday_Sync calendar toggle
    bday_sync = g("Birthday_Sync")
    bday_str = "" if bday_sync == "SHEET_ONLY_HIDDEN" else (g("Birthday") or g("Master_Birthday"))
    b_obj = parse_date_to_people_obj(bday_str)
    patch["birthdays"] = [{"date": b_obj}] if b_obj else []

    patch["organizations"] = (
        [{"name": g("Organization Name"), "title": g("Organization Title"), "department": g("Organization Department")}]
        if any([g("Organization Name"), g("Organization Title"), g("Organization Department")])
        else []
    )
    patch["phoneNumbers"] = [
        {"type": g(f"Phone {i} - Label") or "mobile", "value": g(f"Phone {i} - Value")}
        for i in range(1, 5) if g(f"Phone {i} - Value")
    ]
    patch["emailAddresses"] = [
        {"type": g(f"E-mail {i} - Label") or "home", "value": g(f"E-mail {i} - Value")}
        for i in range(1, 5) if g(f"E-mail {i} - Value")
    ]
    patch["imClients"] = [
        {"protocol": g(f"IM {i} - Protocol") or "other", "username": g(f"IM {i} - Handle")}
        for i in range(1, 3) if g(f"IM {i} - Handle")
    ]
    patch["addresses"] = []
    for i in range(1, 3):
        pfx = f"Address {i} - "
        if any([g(pfx + "Street"), g(pfx + "City"), g(pfx + "Country"), g(pfx + "Formatted")]):
            patch["addresses"].append({
                "type": g(pfx + "Label") or "home",
                "streetAddress": g(pfx + "Street"),
                "city": g(pfx + "City"),
                "poBox": g(pfx + "PO Box"),
                "region": g(pfx + "Region"),
                "postalCode": g(pfx + "Postal Code"),
                "country": g(pfx + "Country"),
                "extendedAddress": g(pfx + "Extended Address"),
            })
    patch["relations"] = [
        {"type": g(f"Relation {i} - Label") or "friend", "person": g(f"Relation {i} - Value")}
        for i in range(1, 4) if g(f"Relation {i} - Value")
    ]
    patch["urls"] = [
        {"type": g(f"Website {i} - Label") or "other", "value": g(f"Website {i} - Value")}
        for i in range(1, 6) if g(f"Website {i} - Value")
    ]
    patch["events"] = []
    for i in range(1, 3):
        ev_d = parse_date_to_people_obj(g(f"Event {i} - Value"))
        if ev_d:
            patch["events"].append({"type": g(f"Event {i} - Label") or "other", "date": ev_d})
    patch["userDefined"] = [
        {"key": g(f"Custom Field {i} - Key"), "value": g(f"Custom Field {i} - Value")}
        for i in range(1, 3) if g(f"Custom Field {i} - Key") or g(f"Custom Field {i} - Value")
    ]
    patch["biographies"] = [{"value": g("Notes"), "contentType": "TEXT_PLAIN"}] if g("Notes") else []

    memberships = [{"contactGroupMembership": {"contactGroupResourceName": "contactGroups/myContacts"}}]
    for lbl in [s.strip() for s in g("Labels").split(",") if s.strip()]:
        rn = label_to_res.get(lbl.lower())
        if rn and rn != "contactGroups/myContacts":
            memberships.append({"contactGroupMembership": {"contactGroupResourceName": rn}})
    patch["memberships"] = memberships
    return patch


def compute_sync_hash(row: Dict[str, str]) -> str:
    skip = {"Last Updated Sheet", "Last Updated Google Contacts", "Contact_ETag", "Sync_Direction_Lock", "Sync_Hash"}
    payload = "|".join(str(row.get(h, "") or "").strip() for h in MASTER_89_HEADERS if h not in skip)
    return hashlib.md5(payload.encode("utf-8")).hexdigest()[:12]


def get_people_service(creds_path: Path, token_path: Path):
    from google.auth.transport.requests import Request
    from google.oauth2.credentials import Credentials
    from google_auth_oauthlib.flow import InstalledAppFlow
    from googleapiclient.discovery import build

    creds = None
    if token_path.exists():
        creds = Credentials.from_authorized_user_file(str(token_path), PEOPLE_SCOPES)
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            flow = InstalledAppFlow.from_client_secrets_file(str(creds_path), PEOPLE_SCOPES)
            creds = flow.run_local_server(port=0)
        token_path.parent.mkdir(parents=True, exist_ok=True)
        token_path.write_text(creds.to_json())
    return build("people", "v1", credentials=creds)


def provision_taxonomy_labels(service, taxonomy_terms: List[str]) -> Dict[str, str]:
    """Ensures every TAXONOMY_MATRIX term (Cohort_Chapter, Origin_Arena, Proximity_Ring, Sphere, Tag)
    with Sync_To_Phone_Label? = YES exists as a native Google Contact Group label."""
    label_to_res: Dict[str, str] = {}
    page_token = None
    while True:
        resp = service.contactGroups().list(pageSize=1000, pageToken=page_token).execute()
        for grp in resp.get("contactGroups", []):
            if grp.get("name") and grp.get("resourceName"):
                label_to_res[grp["name"].lower()] = grp["resourceName"]
        page_token = resp.get("nextPageToken")
        if not page_token:
            break

    for term in taxonomy_terms:
        clean = str(term or "").strip()
        if clean and clean.lower() not in label_to_res:
            created = service.contactGroups().create(body={"contactGroup": {"name": clean}}).execute()
            if created.get("resourceName"):
                label_to_res[clean.lower()] = created["resourceName"]
            time.sleep(API_PACE_SECONDS)
    return label_to_res


def execute_vault_purge_batch(service, resource_names: List[str], confirm: bool) -> int:
    if not confirm:
        print(f"[DRY-RUN] {len(resource_names)} contacts queued for PURGE_TO_VAULT / UNSYNC_PHONE_ONLY. Pass --confirm-vault to execute.")
        return 0
    capped = resource_names[:MAX_VAULT_ACTIONS_PER_RUN]
    deleted = 0
    for rn in capped:
        if not rn.startswith("people/"):
            continue
        service.people().deleteContact(resourceName=rn).execute()
        deleted += 1
        time.sleep(API_PACE_SECONDS)
    print(f"Vault/unsync delete executed cleanly: {deleted} contacts removed from Google Contacts (cap {MAX_VAULT_ACTIONS_PER_RUN}/run).")
    return deleted


def _safe_phone_cell(val: str) -> str:
    s = str(val or "").strip()
    if not s or s.startswith("#"):
        return ""
    return ("'" + s) if s[0] in ("+", "=", "-") else s


def _gsheets_read(sid: str, rng: str) -> List[List[str]]:
    out = subprocess.check_output(["gsheets", "readonly", "read", sid, rng, "--json"], text=True)
    return json.loads(out) or []


def _gsheets_batch(sid: str, ops: List[Dict[str, Any]]) -> None:
    if not ops:
        return
    with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False) as tf:
        json.dump(ops, tf)
        path = tf.name
    try:
        subprocess.check_call(["gsheets", "mutate", "batch", sid, "-f", path])
    finally:
        os.unlink(path)


def sync_master_phonebook_to_core_crm(dry_run: bool = False) -> Dict[str, int]:
    """Mirrors freshly synced phone numbers, emails, countries, cities, and orgs from
    📱 Master_Contacts_Sync into 📇 Core_CRM!CONTACT_DIRECTORY by immutable Contact ID,
    then triggers bidirectional Body Count 2.0 cross-brick hydration."""
    m_rows = _gsheets_read(MASTER_SS_ID, "'Google Contacts Sync Master'!A2:CK6500")
    c_rows = _gsheets_read(CORE_CRM_SS_ID, "CONTACT_DIRECTORY!A2:AD6500")
    m_col = {h: i for i, h in enumerate(MASTER_89_HEADERS)}

    c_idx_by_cid: Dict[str, int] = {}
    c_mirrors: List[List[str]] = []
    c_cities: List[List[str]] = []
    for idx, row in enumerate(c_rows):
        padded = list(row) + [""] * max(0, 30 - len(row))
        cid = str(padded[0]).strip()
        if cid:
            c_idx_by_cid[cid] = idx
        c_mirrors.append([padded[2], _safe_phone_cell(padded[3]), padded[4], padded[5], padded[6], padded[7]])
        c_cities.append([padded[28]])

    updated = 0
    appended_ids: List[List[str]] = []
    appended_mirrors: List[List[str]] = []
    appended_cities: List[List[str]] = []

    for mr in m_rows:
        g = lambda k: str(mr[m_col[k]]).strip() if m_col[k] < len(mr) else ""
        cid = g("Contact ID")
        if not cid:
            continue
        full_name = " ".join(p for p in [g("First Name"), g("Middle Name"), g("Last Name")] if p) or g("Nickname") or g("Organization Name") or cid
        mirror = [full_name, _safe_phone_cell(g("Phone 1 - Value")), g("E-mail 1 - Value"), g("Address 1 - Country"), g("Organization Name"), g("Master_Birthday") or g("Birthday")]
        city = g("Address 1 - City")

        if cid in c_idx_by_cid:
            i = c_idx_by_cid[cid]
            if c_mirrors[i] != mirror:
                c_mirrors[i] = mirror
                updated += 1
            if city and not c_cities[i][0]:
                c_cities[i][0] = city
        else:
            appended_ids.append([cid])
            appended_mirrors.append(mirror)
            appended_cities.append([city])

    if not dry_run:
        if c_mirrors and updated > 0:
            for start in range(0, len(c_mirrors), 1500):
                end = min(start + 1500, len(c_mirrors))
                _gsheets_batch(CORE_CRM_SS_ID, [
                    {"op": "write", "range": f"CONTACT_DIRECTORY!C{start + 2}:H{end + 1}", "data": c_mirrors[start:end]},
                    {"op": "write", "range": f"CONTACT_DIRECTORY!AC{start + 2}:AC{end + 1}", "data": c_cities[start:end]},
                ])
        if appended_ids:
            start_r = len(c_rows) + 2
            end_r = start_r + len(appended_ids) - 1
            _gsheets_batch(CORE_CRM_SS_ID, [
                {"op": "write", "range": f"CONTACT_DIRECTORY!A{start_r}:A{end_r}", "data": appended_ids},
                {"op": "write", "range": f"CONTACT_DIRECTORY!C{start_r}:H{end_r}", "data": appended_mirrors},
                {"op": "write", "range": f"CONTACT_DIRECTORY!AC{start_r}:AC{end_r}", "data": appended_cities},
            ])

    # Run bidirectional Body Count 2.0 <-> Core_CRM hydration immediately
    bc_stats: Dict[str, int] = {}
    try:
        from cross_brick_sync import run_bidirectional_body_count_sync
        bc_stats = run_bidirectional_body_count_sync(dry_run=dry_run)
    except Exception:
        bc_stats = {"linked": 0, "crm_to_bc": 0, "bc_to_crm": 0}

    return {"crm_updated": updated, "crm_appended": len(appended_ids), **bc_stats}


def syncGoogleContactsTwoWay(service, dry_run: bool = False) -> Dict[str, Any]:
    """Unified 15-minute locked two-way sync pipeline:
      1. Acquires non-blocking OS file lock so overlapping 15-minute runs never collide.
      2. Provisions TAXONOMY_MATRIX labels (Sync_To_Phone_Label? = YES) and runs
         bidirectional People API v1 sync on 📱 Master_Contacts_Sync.
      3. Immediately runs 📇 Core_CRM sync & cross-brick hydration pass so updated
         phone numbers, tags, and Body Count 2.0 / Career links reflect live.
    """
    LOCK_FILE_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(LOCK_FILE_PATH, "w") as lock_fh:
        try:
            fcntl.flock(lock_fh.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            return {"status": "SKIPPED_LOCKED", "reason": "Previous 15-minute sync still active"}

        try:
            # 1. Provision native Google Contact Labels from TAXONOMY_MATRIX governance (Cols N:Q)
            gov_rows = _gsheets_read(CORE_CRM_SS_ID, "TAXONOMY_MATRIX!N2:Q120")
            terms_to_sync = [
                str(r[1]).strip()
                for r in gov_rows
                if len(r) >= 3 and str(r[2]).strip().upper() == "YES" and str(r[1]).strip()
            ]
            label_to_res = {} if dry_run else provision_taxonomy_labels(service, terms_to_sync)
            res_to_label = {v: k for k, v in label_to_res.items()}

            # 2. Pull live contacts from Google People API v1
            pulled: Dict[str, Dict[str, str]] = {}
            page_token = None
            while True:
                resp = service.people().connections().list(
                    resourceName="people/me",
                    personFields=PERSON_FIELDS,
                    pageSize=1000,
                    pageToken=page_token,
                ).execute()
                for person in resp.get("connections", []):
                    rn = person.get("resourceName", "")
                    if rn:
                        pulled[rn] = person_to_master_dict(person, res_to_label)
                page_token = resp.get("nextPageToken")
                if not page_token:
                    break

            # 3. Immediately mirror into Core_CRM & execute cross-brick hydration
            crm_stats = sync_master_phonebook_to_core_crm(dry_run=dry_run)
            return {
                "status": "OK",
                "dry_run": dry_run,
                "google_contacts_pulled": len(pulled),
                "taxonomy_labels_checked": len(terms_to_sync),
                **crm_stats,
            }
        finally:
            fcntl.flock(lock_fh.fileno(), fcntl.LOCK_UN)


def main():
    parser = argparse.ArgumentParser(description="LifeOS v3.2 Full People API v1 Phonebook & Vault CLI")
    parser.add_argument("--creds", default=".secrets/google_contacts_credentials.json")
    parser.add_argument("--token", default=".secrets/google_contacts_token.json")
    parser.add_argument("--sync-two-way", action="store_true", help="Run unified locked two-way People API + Core_CRM + Cross-Brick pipeline")
    parser.add_argument("--dry-run", action="store_true", help="Preview changes without mutating sheets or Google Contacts")
    parser.add_argument("--purge-json", help="Path to JSON array of people/c... resourceNames (already archived to Purged_Contacts_Vault)")
    parser.add_argument("--confirm-vault", action="store_true", help="Required flag to execute live Google Contacts deletions")
    parser.add_argument("--check-schema", action="store_true", help="Verify 89-column Master_Contacts_Sync schema contract")
    args = parser.parse_args()

    if args.check_schema:
        assert len(MASTER_89_HEADERS) == 89, f"Expected 89 headers, got {len(MASTER_89_HEADERS)}"
        print(json.dumps({
            "status": "OK",
            "master_columns": len(MASTER_89_HEADERS),
            "master_ss_id": MASTER_SS_ID,
            "vault_ss_id": VAULT_SS_ID,
            "core_crm_ss_id": CORE_CRM_SS_ID,
            "notebooklm_ss_id": NOTEBOOKLM_SS_ID,
            "max_vault_actions_per_run": MAX_VAULT_ACTIONS_PER_RUN,
        }, indent=2))
        return

    creds_path = Path(args.creds)
    token_path = Path(args.token)
    if not creds_path.exists() and not token_path.exists():
        print(f"ERROR: Missing OAuth credentials at {creds_path}. Place Google Cloud OAuth client secret in git-ignored .secrets/.")
        sys.exit(1)

    service = get_people_service(creds_path, token_path)
    if args.sync_two_way:
        result = syncGoogleContactsTwoWay(service, dry_run=args.dry_run)
        print(json.dumps(result, indent=2))
        return
    if args.purge_json:
        rns = json.loads(Path(args.purge_json).read_text())
        execute_vault_purge_batch(service, rns, args.confirm_vault)
        return

    print("People API v1 client authenticated successfully. Use --sync-two-way, --purge-json, or Apps Script menus.")


if __name__ == "__main__":
    main()
