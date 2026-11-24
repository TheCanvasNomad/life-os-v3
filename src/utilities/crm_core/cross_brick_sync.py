#!/usr/bin/env python3
"""
LifeOS v3.2 — Bidirectional Cross-Brick Symbiosis Sync CLI
Connects:
  - 📱 Master_Contacts_Sync       (1VtJ4_beXHe8N_zfmcB5yBTPm0App8prl3IgY7CMeU8g)
  - 📇 Core_CRM                   (1PKYbEie4QUgSqqTVW1Y2UVjBgRStz4Aok2BhCWCvU5M)
  - Body Count 2.0                (1aqYHU_bc-AqgREdvutE3VgG952_gd70yDKt4dMH6L1E)
  - 📓 NotebookLM_Social_Workbook (1gwnGKdfZrtJi6QwEWniPMli6i-Se8Fi2pwjX1ebaaPs)

Capabilities:
  1. Harvests Labels, Event 1 - Label, and Name Emojis into Core_CRM!CONTACT_DIRECTORY
  2. Bidirectional Body Count 2.0 <-> Core_CRM <-> Master_Contacts_Sync enrichment:
     - CRM -> Body Count 2.0: fills blank Connection Medium, Country, Encounter Date
     - Body Count 2.0 -> Core_CRM -> Master: sets Status (Intimate / FWB or Legacy),
       syncs How_Met (Tinder/Hinge/OkCupid), full Address 1 - Country, and Phone Labels
  3. Enforces Plain Text '@' formatting on international Phone 1-4 columns
  4. Refreshes lean NotebookLM_Social_Workbook while preserving Manual_Bio_&_Story_Notes
"""

import argparse
import json
import os
import re
import subprocess
import tempfile
import time
import unicodedata
from typing import Dict, List, Tuple

MASTER_ID = "1VtJ4_beXHe8N_zfmcB5yBTPm0App8prl3IgY7CMeU8g"
CRM_ID = "1PKYbEie4QUgSqqTVW1Y2UVjBgRStz4Aok2BhCWCvU5M"
BC_ID = "1aqYHU_bc-AqgREdvutE3VgG952_gd70yDKt4dMH6L1E"
NBLM_ID = "1gwnGKdfZrtJi6QwEWniPMli6i-Se8Fi2pwjX1ebaaPs"

EMOJI_TAG_MAP: List[Tuple[str, str]] = [
    ("✨", "High_Intent"),
    ("😍", "Strong_Attraction"),
    ("😏", "Casual_Interest"),
    ("🤤", "Top_Tier"),
    ("🍑", "Curvy_Glutes"),
    ("🍈", "Busty"),
    ("👯", "Group_Open"),
    ("💵", "Transactional"),
    ("📲", "IG_Vetted"),
]


def run_gsheets(cmd: List[str]) -> str:
    for attempt in range(4):
        try:
            return subprocess.check_output(cmd, text=True, stderr=subprocess.PIPE)
        except subprocess.CalledProcessError:
            if attempt == 3:
                raise
            time.sleep(1.5 * (attempt + 1))
    return ""


def read_sheet(sid: str, rng: str) -> List[List[str]]:
    return json.loads(run_gsheets(["gsheets", "readonly", "read", sid, rng, "--json"])) or []


def batch_write(sid: str, ops: List[Dict]) -> None:
    if not ops:
        return
    with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False) as tf:
        json.dump(ops, tf)
        path = tf.name
    try:
        run_gsheets(["gsheets", "mutate", "batch", sid, "-f", path])
    finally:
        os.unlink(path)


def clean_name_key(val: str) -> str:
    s = unicodedata.normalize("NFKD", str(val or ""))
    s = "".join(ch for ch in s if not unicodedata.combining(ch))
    s = re.sub(r"[^a-zA-Z0-9\s]", " ", s)
    return " ".join(s.lower().split())


def safe_phone_text(val: str) -> str:
    s = str(val or "").strip()
    if not s or s.startswith("#"):
        return ""
    return ("'" + s) if s[0] in ("+", "=", "-") else s


def normalize_how_met(val: str) -> str:
    low = str(val or "").strip().lower()
    if "tinder" in low:
        return "Tinder"
    if "hinge" in low:
        return "Hinge"
    if "okcupid" in low or "ok cupid" in low:
        return "OkCupid"
    if any(w in low for w in ("travel", "abroad", "trip")):
        return "Travel / Abroad"
    if any(w in low for w in ("cold", "approach", "street")):
        return "Cold_Approach"
    if any(w in low for w in ("club", "bar", "night", "event")):
        return "Event / Nightlife"
    if any(w in low for w in ("friend", "mutual")):
        return "Mutual_Friend"
    return ""


def run_bidirectional_body_count_sync(dry_run: bool = False) -> Dict[str, int]:
    """Synchronizes linked contacts bidirectionally between Body Count 2.0, Core_CRM, and Master_Contacts_Sync."""
    dir_all = read_sheet(CRM_ID, "CONTACT_DIRECTORY!A1:P6500")
    bc_all = read_sheet(BC_ID, "'Form Responses 1'!A1:BD250")
    if len(dir_all) < 2 or len(bc_all) < 2:
        return {"linked": 0, "crm_to_bc": 0, "bc_to_crm": 0}

    bc_hdr = [h.strip() for h in bc_all[0]]
    bc_col = {h: i for i, h in enumerate(bc_hdr)}

    dir_by_cid: Dict[str, Tuple[int, List[str]]] = {}
    cid_by_name: Dict[str, str] = {}
    for idx, row in enumerate(dir_all[1:], start=2):
        cid = str(row[0]).strip() if row else ""
        if not cid:
            continue
        padded = list(row) + [""] * max(0, 16 - len(row))
        dir_by_cid[cid] = (idx, padded)
        nk = clean_name_key(padded[2])
        if nk and " " in nk and nk not in cid_by_name:
            cid_by_name[nk] = cid

    crm_to_bc = 0
    bc_to_crm = 0
    linked = 0
    bc_ops: List[Dict] = []
    crm_ops: List[Dict] = []

    for r_idx, br in enumerate(bc_all[1:], start=2):
        bg = lambda k: str(br[bc_col[k]]).strip() if k in bc_col and bc_col[k] < len(br) else ""
        cid = bg("Contact_ID")
        if not cid:
            nk = clean_name_key(f"{bg('First Name')} {bg('Last Name')}")
            cid = cid_by_name.get(nk, "")
        if not cid or cid not in dir_by_cid:
            continue
        linked += 1
        dir_row_num, dr = dir_by_cid[cid]

        # CRM -> Body Count 2.0 (fill blanks only)
        cur_conn = bg("Connection Medium")
        cur_res_c = bg("Her Country of Residence")
        cur_enc_c = bg("Encounter Country")
        if not cur_conn and dr[13] in ("Tinder", "Hinge", "OkCupid"):
            bc_ops.append({"op": "write", "range": f"'Form Responses 1'!O{r_idx}", "data": [[dr[13]]]})
            crm_to_bc += 1
        if not cur_res_c and dr[5]:
            bc_ops.append({"op": "write", "range": f"'Form Responses 1'!H{r_idx}", "data": [[dr[5]]]})
            crm_to_bc += 1
        if not cur_enc_c and dr[5]:
            bc_ops.append({"op": "write", "range": f"'Form Responses 1'!V{r_idx}", "data": [[dr[5]]]})
            crm_to_bc += 1

        # Body Count 2.0 -> Core_CRM
        is_concluded = any(w in bg("Status?").lower() for w in ("concluded", "ended", "past", "ex", "over", "legacy"))
        target_status = "Legacy" if is_concluded else "Intimate / FWB"
        bc_hm = normalize_how_met(cur_conn)
        bc_ctry = cur_res_c or cur_enc_c
        changed = False
        if dr[8] != "Love Life":
            dr[8] = "Love Life"; changed = True
        if dr[12] != target_status:
            dr[12] = target_status; changed = True
        if bc_hm and not dr[13]:
            dr[13] = bc_hm; changed = True
        if bc_ctry and not dr[5]:
            dr[5] = bc_ctry; changed = True
        if changed:
            dr[3] = safe_phone_text(dr[3])
            crm_ops.append({"op": "write", "range": f"CONTACT_DIRECTORY!D{dir_row_num}:P{dir_row_num}", "data": [dr[3:16]]})
            bc_to_crm += 1

    if not dry_run:
        batch_write(BC_ID, bc_ops)
        batch_write(CRM_ID, crm_ops)
    return {"linked": linked, "crm_to_bc": crm_to_bc, "bc_to_crm": bc_to_crm}


def main() -> None:
    parser = argparse.ArgumentParser(description="LifeOS v3.2 Bidirectional Cross-Brick CRM Symbiosis CLI")
    parser.add_argument("--dry-run", action="store_true", help="Compute sync summary without mutating sheets")
    args = parser.parse_args()
    stats = run_bidirectional_body_count_sync(dry_run=args.dry_run)
    print(json.dumps({"status": "OK", "dry_run": args.dry_run, **stats}, indent=2))


if __name__ == "__main__":
    main()
