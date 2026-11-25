#!/usr/bin/env python3
"""Standalone Builder, Deployer & Verifier for Adult_Star_Tracker_Brick.

Strictly targets Adult_Star_Tracker_Brick (1R7hlTI8GfeO5CWPHLPP4jWoEpKDjFd96qJIWmhvu5OI).
- Zero GitHub workflows/pushes
- Zero Google Colab cells/scripts
- Zero Scene_Logs dependencies (strictly Performer-First)
- Zero live writes or IMPORTRANGE wiring to LifeOS_feed_hub, LifeOS_Master_Bus,
  or Adult Star Intelligence & Taxonomy Tracker (LifeOS)
- LifeOS-Ready Brick Contract tabs (MODULE_META, CONTEXT_IN, SIGNALS_OUT, GROWTH_LEDGER)

Usage:
  python3 build_standalone_tracker.py --dry-run
  python3 build_standalone_tracker.py --apply
  python3 build_standalone_tracker.py --verify
  python3 build_standalone_tracker.py --lookup-boobpedia "Angela White"
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import tempfile
import urllib.request
from typing import Any, Dict, List, Tuple

from tracker_helpers import (
    FORBIDDEN_SPREADSHEET_IDS,
    TARGET_SPREADSHEET_ID,
    audit_formula_blank_safety,
    audit_no_live_lifeos_wiring,
    audit_no_scene_logs_dependency,
    build_boobpedia_query_url,
    parse_boobpedia_page,
)

# Verified live sheet IDs in Adult_Star_Tracker_Brick (1R7hlTI8GfeO5CWPHLPP4jWoEpKDjFd96qJIWmhvu5OI)
SHEET_IDS: Dict[str, int] = {
    "Trait_Intelligence": 1317655136,
    "Niche_Intelligence": 1933315384,
    "Studio_Intelligence": 2088287445,
    "CALC_Performer_Power": 2041279345,
    "Performer_Intelligence": 1986988109,
    "Master_Leaderboard": 215633693,
    "Total_Rankings": 1083514762,
    "GROWTH_LEDGER": 1219993253,
    "MODULE_META": 803946795,
    "CONTEXT_IN": 1387059192,
    "SIGNALS_OUT": 1677533695,
}

# Row capacities for blank-safe auto-expanding formula bands
TRAIT_ROWS = 120
NICHE_ROWS = 50
STUDIO_ROWS = 80
PERFORMER_ROWS = 100
LEADERBOARD_ROWS = 55

# Palette (Dark-Obsidian Executive UI standard)
COLOR_OBSIDIAN = {"red": 0.059, "green": 0.090, "blue": 0.165}       # #0F172A
COLOR_SLATE = {"red": 0.118, "green": 0.161, "blue": 0.231}          # #1E293B
COLOR_ACCENT = {"red": 0.196, "green": 0.255, "blue": 0.333}         # #324155
COLOR_WHITE = {"red": 1.0, "green": 1.0, "blue": 1.0}
COLOR_SOFT_ROW = {"red": 0.961, "green": 0.973, "blue": 0.988}       # #F5F8FC
COLOR_KPI_BG = {"red": 0.937, "green": 0.957, "blue": 0.984}         # #EFF4FB
COLOR_BORDER = {"red": 0.820, "green": 0.855, "blue": 0.902}         # #D1DAE6
COLOR_EMERALD_BG = {"red": 0.820, "green": 0.980, "blue": 0.898}     # #D1FAE5
COLOR_EMERALD_FG = {"red": 0.024, "green": 0.373, "blue": 0.275}     # #065F46
COLOR_AMBER_BG = {"red": 0.996, "green": 0.953, "blue": 0.780}       # #FEF3C7
COLOR_AMBER_FG = {"red": 0.573, "green": 0.251, "blue": 0.055}       # #92400E
COLOR_CRIMSON_BG = {"red": 0.996, "green": 0.886, "blue": 0.886}     # #FEE2E2
COLOR_CRIMSON_FG = {"red": 0.600, "green": 0.106, "blue": 0.106}     # #991B1B
COLOR_SLATE_BADGE_BG = {"red": 0.886, "green": 0.910, "blue": 0.941} # #E2E8F0
COLOR_SLATE_BADGE_FG = {"red": 0.200, "green": 0.255, "blue": 0.333} # #334155


def _guard_spreadsheet_id(spreadsheet_id: str) -> None:
    if spreadsheet_id in FORBIDDEN_SPREADSHEET_IDS or spreadsheet_id != TARGET_SPREADSHEET_ID:
        raise ValueError(
            f"Refusing to modify spreadsheet '{spreadsheet_id}'. "
            f"Only Adult_Star_Tracker_Brick ({TARGET_SPREADSHEET_ID}) is allowed."
        )


def _param(key: str, fallback: Any) -> str:
    return f'IFERROR(VLOOKUP("{key}", PARAM_CONFIG_HUB!$A$2:$D$11, 4, FALSE), {fallback})'


# ---------------------------------------------------------------------------
# Tab Builders (11 Downstream Tabs)
# ---------------------------------------------------------------------------

def build_trait_intelligence() -> List[List[Any]]:
    """Tab 1: Trait_Intelligence (Col A = Trait_Tag, Col F = Live Score for TAXONOMY_MATRIX!F)."""
    headers = [
        "Trait_Tag",
        "Domain_Group",
        "Stated_Score",
        "Demonstrated_Avg",
        "Log_Count",
        "Trait_Intelligence_Score",
        "Stated_vs_Demo_Gap",
        "Roster_Prevalence",
        "Confidence_Tier",
    ]
    rows: List[List[Any]] = [headers]
    w_param = _param("WEIGHT_STATED_DEMO", 0.6)
    vb_param = _param("SCALE_VOL_BONUS", 0.05)
    base_param = _param("BASELINE_DEFAULT_RATING", 7)
    sat_param = _param("SATURATION_THRESHOLD", 10)

    for r in range(2, TRAIT_ROWS + 1):
        col_a = (
            '=IFERROR(FILTER(TAXONOMY_MATRIX!C2:C500, '
            '(TAXONOMY_MATRIX!C2:C500<>"")*'
            '(TAXONOMY_MATRIX!B2:B500<>"Scene_Niches")*'
            '(TAXONOMY_MATRIX!B2:B500<>"Filming_Positions")), "")'
            if r == 2
            else ""
        )
        col_b = (
            f'=IF(ISBLANK(A{r}), "", IFERROR(INDEX(TAXONOMY_MATRIX!$B$2:$B$500, '
            f'MATCH(A{r}, TAXONOMY_MATRIX!$C$2:$C$500, 0)), ""))'
        )
        col_c = (
            f'=IF(ISBLANK(A{r}), "", '
            f'IFERROR(INDEX(SORT(FILTER(Trait_Baseline_Logs!$F$2:$F$500, '
            f'LOWER(TRIM(Trait_Baseline_Logs!$D$2:$D$500))=LOWER(TRIM(A{r}))), '
            f'FILTER(Trait_Baseline_Logs!$A$2:$A$500, '
            f'LOWER(TRIM(Trait_Baseline_Logs!$D$2:$D$500))=LOWER(TRIM(A{r}))), FALSE), 1), '
            f'IFERROR(INDEX(TAXONOMY_MATRIX!$E$2:$E$500, '
            f'MATCH(A{r}, TAXONOMY_MATRIX!$C$2:$C$500, 0)), {base_param})))'
        )
        col_d = (
            f'=IF(ISBLANK(A{r}), "", LET('
            f'tag, ";" & LOWER(TRIM(A{r})) & ";", '
            f'names, Performer_Logs!$C$2:$C$500, '
            f'scores, ARRAYFORMULA(IF(names="", "", (Performer_Logs!$D$2:$D$500 + Performer_Logs!$E$2:$E$500 + Performer_Logs!$F$2:$F$500)/3)), '
            f'log_t, ARRAYFORMULA(";" & SUBSTITUTE(SUBSTITUTE(LOWER(TRIM(Performer_Logs!$I$2:$I$500)), "; ", ";"), " ;", ";") & ";"), '
            f'ros_t, ARRAYFORMULA(IF(names="", "", ";" & SUBSTITUTE(SUBSTITUTE(LOWER(TRIM('
            f'IFERROR(VLOOKUP(names, MODEL_ROSTER_INDEX!$B$2:$M$500, 8, FALSE), "") & ";" & '
            f'IFERROR(VLOOKUP(names, MODEL_ROSTER_INDEX!$B$2:$M$500, 9, FALSE), "") & ";" & '
            f'IFERROR(VLOOKUP(names, MODEL_ROSTER_INDEX!$B$2:$M$500, 10, FALSE), "") & ";" & '
            f'IFERROR(VLOOKUP(names, MODEL_ROSTER_INDEX!$B$2:$M$500, 12, FALSE), ""))), "; ", ";"), " ;", ";") & ";")), '
            f'mask, ARRAYFORMULA((names<>"") * ((ISNUMBER(SEARCH(tag, log_t)) + ISNUMBER(SEARCH(tag, ros_t))) > 0)), '
            f'IFERROR(ROUND(AVERAGE(FILTER(scores, mask)), 2), "")))'
        )
        col_e = (
            f'=IF(ISBLANK(A{r}), "", LET('
            f'tag, ";" & LOWER(TRIM(A{r})) & ";", '
            f'names, Performer_Logs!$C$2:$C$500, '
            f'log_t, ARRAYFORMULA(";" & SUBSTITUTE(SUBSTITUTE(LOWER(TRIM(Performer_Logs!$I$2:$I$500)), "; ", ";"), " ;", ";") & ";"), '
            f'ros_t, ARRAYFORMULA(IF(names="", "", ";" & SUBSTITUTE(SUBSTITUTE(LOWER(TRIM('
            f'IFERROR(VLOOKUP(names, MODEL_ROSTER_INDEX!$B$2:$M$500, 8, FALSE), "") & ";" & '
            f'IFERROR(VLOOKUP(names, MODEL_ROSTER_INDEX!$B$2:$M$500, 9, FALSE), "") & ";" & '
            f'IFERROR(VLOOKUP(names, MODEL_ROSTER_INDEX!$B$2:$M$500, 10, FALSE), "") & ";" & '
            f'IFERROR(VLOOKUP(names, MODEL_ROSTER_INDEX!$B$2:$M$500, 12, FALSE), ""))), "; ", ";"), " ;", ";") & ";")), '
            f'SUMPRODUCT((names<>"") * ((ISNUMBER(SEARCH(tag, log_t)) + ISNUMBER(SEARCH(tag, ros_t))) > 0))))'
        )
        col_f = (
            f'=IF(ISBLANK(A{r}), "", LET('
            f'w, {w_param}, vb, {vb_param}, '
            f'IF(OR(D{r}="", E{r}=0), ROUND(C{r}, 2), '
            f'MIN(10, MAX(1, ROUND(w*D{r} + (1-w)*C{r} + MIN(0.35, vb*LN(1+E{r})), 2))))))'
        )
        col_g = f'=IF(ISBLANK(A{r}), "", IF(D{r}="", "", ROUND(D{r} - C{r}, 2)))'
        col_h = (
            f'=IF(ISBLANK(A{r}), "", LET('
            f'tag, ";" & LOWER(TRIM(A{r})) & ";", '
            f'ros_names, MODEL_ROSTER_INDEX!$B$2:$B$500, '
            f'ros_all, ARRAYFORMULA(IF(ros_names="", "", ";" & SUBSTITUTE(SUBSTITUTE(LOWER(TRIM('
            f'MODEL_ROSTER_INDEX!$I$2:$I$500 & ";" & MODEL_ROSTER_INDEX!$J$2:$J$500 & ";" & '
            f'MODEL_ROSTER_INDEX!$K$2:$K$500 & ";" & MODEL_ROSTER_INDEX!$M$2:$M$500)), "; ", ";"), " ;", ";") & ";")), '
            f'SUMPRODUCT((ros_names<>"") * ISNUMBER(SEARCH(tag, ros_all)))))'
        )
        col_i = (
            f'=IF(ISBLANK(A{r}), "", LET(sat, {sat_param}, '
            f'IF(E{r}>=sat, "HIGH", IF(E{r}>=2, "BUILDING", IF(E{r}=1, "EARLY", "STATED_ONLY")))))'
        )
        rows.append([col_a, col_b, col_c, col_d, col_e, col_f, col_g, col_h, col_i])
    return rows


def build_niche_intelligence() -> List[List[Any]]:
    """Tab 2: Niche_Intelligence (Col A = Niche_Tag, Col F = Live Score for TAXONOMY_MATRIX!F)."""
    headers = [
        "Niche_Tag",
        "Domain_Group",
        "Stated_Score",
        "Demonstrated_Avg",
        "Log_Count",
        "Niche_Intelligence_Score",
        "Stated_vs_Demo_Gap",
        "Arousal_Impact_Baseline",
        "Confidence_Tier",
    ]
    rows: List[List[Any]] = [headers]
    w_param = _param("WEIGHT_STATED_DEMO", 0.6)
    vb_param = _param("SCALE_VOL_BONUS", 0.05)
    base_param = _param("BASELINE_DEFAULT_RATING", 7)
    sat_param = _param("SATURATION_THRESHOLD", 10)

    for r in range(2, NICHE_ROWS + 1):
        col_a = (
            '=IFERROR(FILTER(TAXONOMY_MATRIX!C2:C500, '
            '(TAXONOMY_MATRIX!C2:C500<>"")*'
            '((TAXONOMY_MATRIX!B2:B500="Scene_Niches")+(TAXONOMY_MATRIX!B2:B500="Filming_Positions")>0)), "")'
            if r == 2
            else ""
        )
        col_b = (
            f'=IF(ISBLANK(A{r}), "", IFERROR(INDEX(TAXONOMY_MATRIX!$B$2:$B$500, '
            f'MATCH(A{r}, TAXONOMY_MATRIX!$C$2:$C$500, 0)), ""))'
        )
        col_c = (
            f'=IF(ISBLANK(A{r}), "", '
            f'IFERROR(ROUND(AVERAGE('
            f'INDEX(SORT(FILTER(Niche_Baseline_Logs!$E$2:$E$500, LOWER(TRIM(Niche_Baseline_Logs!$D$2:$D$500))=LOWER(TRIM(A{r}))), '
            f'FILTER(Niche_Baseline_Logs!$A$2:$A$500, LOWER(TRIM(Niche_Baseline_Logs!$D$2:$D$500))=LOWER(TRIM(A{r}))), FALSE), 1), '
            f'INDEX(SORT(FILTER(Niche_Baseline_Logs!$F$2:$F$500, LOWER(TRIM(Niche_Baseline_Logs!$D$2:$D$500))=LOWER(TRIM(A{r}))), '
            f'FILTER(Niche_Baseline_Logs!$A$2:$A$500, LOWER(TRIM(Niche_Baseline_Logs!$D$2:$D$500))=LOWER(TRIM(A{r}))), FALSE), 1)'
            f'), 2), IFERROR(INDEX(TAXONOMY_MATRIX!$E$2:$E$500, '
            f'MATCH(A{r}, TAXONOMY_MATRIX!$C$2:$C$500, 0)), {base_param})))'
        )
        col_d = (
            f'=IF(ISBLANK(A{r}), "", LET('
            f'tag, ";" & LOWER(TRIM(A{r})) & ";", '
            f'names, Performer_Logs!$C$2:$C$500, '
            f'scores, ARRAYFORMULA(IF(names="", "", (Performer_Logs!$D$2:$D$500 + Performer_Logs!$E$2:$E$500 + Performer_Logs!$F$2:$F$500)/3)), '
            f'log_n, ARRAYFORMULA(";" & SUBSTITUTE(SUBSTITUTE(LOWER(TRIM(Performer_Logs!$G$2:$G$500)), "; ", ";"), " ;", ";") & ";"), '
            f'ros_n, ARRAYFORMULA(IF(names="", "", ";" & SUBSTITUTE(SUBSTITUTE(LOWER(TRIM('
            f'IFERROR(VLOOKUP(names, MODEL_ROSTER_INDEX!$B$2:$M$500, 12, FALSE), ""))), "; ", ";"), " ;", ";") & ";")), '
            f'mask, ARRAYFORMULA((names<>"") * ((ISNUMBER(SEARCH(tag, log_n)) + ISNUMBER(SEARCH(tag, ros_n))) > 0)), '
            f'IFERROR(ROUND(AVERAGE(FILTER(scores, mask)), 2), "")))'
        )
        col_e = (
            f'=IF(ISBLANK(A{r}), "", LET('
            f'tag, ";" & LOWER(TRIM(A{r})) & ";", '
            f'names, Performer_Logs!$C$2:$C$500, '
            f'log_n, ARRAYFORMULA(";" & SUBSTITUTE(SUBSTITUTE(LOWER(TRIM(Performer_Logs!$G$2:$G$500)), "; ", ";"), " ;", ";") & ";"), '
            f'ros_n, ARRAYFORMULA(IF(names="", "", ";" & SUBSTITUTE(SUBSTITUTE(LOWER(TRIM('
            f'IFERROR(VLOOKUP(names, MODEL_ROSTER_INDEX!$B$2:$M$500, 12, FALSE), ""))), "; ", ";"), " ;", ";") & ";")), '
            f'SUMPRODUCT((names<>"") * ((ISNUMBER(SEARCH(tag, log_n)) + ISNUMBER(SEARCH(tag, ros_n))) > 0))))'
        )
        col_f = (
            f'=IF(ISBLANK(A{r}), "", LET('
            f'w, {w_param}, vb, {vb_param}, '
            f'IF(OR(D{r}="", E{r}=0), ROUND(C{r}, 2), '
            f'MIN(10, MAX(1, ROUND(w*D{r} + (1-w)*C{r} + MIN(0.35, vb*LN(1+E{r})), 2))))))'
        )
        col_g = f'=IF(ISBLANK(A{r}), "", IF(D{r}="", "", ROUND(D{r} - C{r}, 2)))'
        col_h = (
            f'=IF(ISBLANK(A{r}), "", IFERROR(INDEX(SORT(FILTER(Niche_Baseline_Logs!$F$2:$F$500, '
            f'LOWER(TRIM(Niche_Baseline_Logs!$D$2:$D$500))=LOWER(TRIM(A{r}))), '
            f'FILTER(Niche_Baseline_Logs!$A$2:$A$500, '
            f'LOWER(TRIM(Niche_Baseline_Logs!$D$2:$D$500))=LOWER(TRIM(A{r}))), FALSE), 1), ""))'
        )
        col_i = (
            f'=IF(ISBLANK(A{r}), "", LET(sat, {sat_param}, '
            f'IF(E{r}>=sat, "HIGH", IF(E{r}>=2, "BUILDING", IF(E{r}=1, "EARLY", "STATED_ONLY")))))'
        )
        rows.append([col_a, col_b, col_c, col_d, col_e, col_f, col_g, col_h, col_i])
    return rows


def build_studio_intelligence() -> List[List[Any]]:
    """Tab 3: Studio_Intelligence (Auto-scored from Performer_Logs + optional explicit boost)."""
    headers = [
        "Studio_Name",
        "Auto_Demo_Score",
        "Log_Count",
        "Roster_Count",
        "Explicit_Baseline_Score",
        "Explicit_Boost_Delta",
        "Studio_Intelligence_Score",
        "Scoring_Mode",
    ]
    rows: List[List[Any]] = [headers]
    boost_param = _param("STUDIO_BOOST_WEIGHT", 0.15)
    base_param = _param("BASELINE_DEFAULT_RATING", 7)
    vb_param = _param("SCALE_VOL_BONUS", 0.05)

    for r in range(2, STUDIO_ROWS + 1):
        col_a = (
            '=IFERROR(LET('
            's1, ARRAYFORMULA(TRIM(Studio_Baseline_Logs!C2:C500)), '
            's2, ARRAYFORMULA(TRIM(Performer_Logs!H2:H500)), '
            's3, IFERROR(TRANSPOSE(ARRAYFORMULA(TRIM(SPLIT(TEXTJOIN(";", TRUE, MODEL_ROSTER_INDEX!L2:L500), ";")))), ""), '
            'all_s, VSTACK(s1, s2, s3), '
            'SORT(UNIQUE(FILTER(all_s, all_s<>"")))), "")'
            if r == 2
            else ""
        )
        col_b = (
            f'=IF(ISBLANK(A{r}), "", LET('
            f'st, ";" & LOWER(TRIM(A{r})) & ";", '
            f'names, Performer_Logs!$C$2:$C$500, '
            f'scores, ARRAYFORMULA(IF(names="", "", (Performer_Logs!$D$2:$D$500 + Performer_Logs!$E$2:$E$500 + Performer_Logs!$F$2:$F$500)/3)), '
            f'log_s, ARRAYFORMULA(";" & SUBSTITUTE(SUBSTITUTE(LOWER(TRIM(Performer_Logs!$H$2:$H$500)), "; ", ";"), " ;", ";") & ";"), '
            f'ros_s, ARRAYFORMULA(IF(names="", "", ";" & SUBSTITUTE(SUBSTITUTE(LOWER(TRIM('
            f'IFERROR(VLOOKUP(names, MODEL_ROSTER_INDEX!$B$2:$M$500, 11, FALSE), ""))), "; ", ";"), " ;", ";") & ";")), '
            f'mask, ARRAYFORMULA((names<>"") * ((ISNUMBER(SEARCH(st, log_s)) + ISNUMBER(SEARCH(st, ros_s))) > 0)), '
            f'IFERROR(ROUND(AVERAGE(FILTER(scores, mask)), 2), "")))'
        )
        col_c = (
            f'=IF(ISBLANK(A{r}), "", LET('
            f'st, ";" & LOWER(TRIM(A{r})) & ";", '
            f'names, Performer_Logs!$C$2:$C$500, '
            f'log_s, ARRAYFORMULA(";" & SUBSTITUTE(SUBSTITUTE(LOWER(TRIM(Performer_Logs!$H$2:$H$500)), "; ", ";"), " ;", ";") & ";"), '
            f'ros_s, ARRAYFORMULA(IF(names="", "", ";" & SUBSTITUTE(SUBSTITUTE(LOWER(TRIM('
            f'IFERROR(VLOOKUP(names, MODEL_ROSTER_INDEX!$B$2:$M$500, 11, FALSE), ""))), "; ", ";"), " ;", ";") & ";")), '
            f'SUMPRODUCT((names<>"") * ((ISNUMBER(SEARCH(st, log_s)) + ISNUMBER(SEARCH(st, ros_s))) > 0))))'
        )
        col_d = (
            f'=IF(ISBLANK(A{r}), "", LET('
            f'st, ";" & LOWER(TRIM(A{r})) & ";", '
            f'ros_names, MODEL_ROSTER_INDEX!$B$2:$B$500, '
            f'ros_s, ARRAYFORMULA(IF(ros_names="", "", ";" & SUBSTITUTE(SUBSTITUTE(LOWER(TRIM(MODEL_ROSTER_INDEX!$L$2:$L$500)), "; ", ";"), " ;", ";") & ";")), '
            f'SUMPRODUCT((ros_names<>"") * ISNUMBER(SEARCH(st, ros_s)))))'
        )
        col_e = (
            f'=IF(ISBLANK(A{r}), "", IFERROR(ROUND(AVERAGE('
            f'INDEX(SORT(FILTER(Studio_Baseline_Logs!$D$2:$D$500, LOWER(TRIM(Studio_Baseline_Logs!$C$2:$C$500))=LOWER(TRIM(A{r}))), '
            f'FILTER(Studio_Baseline_Logs!$A$2:$A$500, LOWER(TRIM(Studio_Baseline_Logs!$C$2:$C$500))=LOWER(TRIM(A{r}))), FALSE), 1), '
            f'INDEX(SORT(FILTER(Studio_Baseline_Logs!$E$2:$E$500, LOWER(TRIM(Studio_Baseline_Logs!$C$2:$C$500))=LOWER(TRIM(A{r}))), '
            f'FILTER(Studio_Baseline_Logs!$A$2:$A$500, LOWER(TRIM(Studio_Baseline_Logs!$C$2:$C$500))=LOWER(TRIM(A{r}))), FALSE), 1)'
            f'), 2), ""))'
        )
        col_f = (
            f'=IF(ISBLANK(A{r}), "", IF(E{r}="", 0, '
            f'ROUND((E{r} - {base_param}) * {boost_param}, 3)))'
        )
        col_g = (
            f'=IF(ISBLANK(A{r}), "", LET(vb, {vb_param}, base_d, {base_param}, '
            f'IF(AND(B{r}<>"", C{r}>0), MIN(10, MAX(1, ROUND(B{r} + F{r} + MIN(0.30, vb*LN(1+C{r})), 2))), '
            f'IF(E{r}<>"", ROUND(E{r}, 2), ROUND(base_d, 2)))))'
        )
        col_h = (
            f'=IF(ISBLANK(A{r}), "", '
            f'IF(AND(B{r}<>"", E{r}<>""), "AUTO + EXPLICIT_BOOST", '
            f'IF(B{r}<>"", "AUTO_ONLY", '
            f'IF(E{r}<>"", "EXPLICIT_ONLY", "ROSTER_DEFAULT"))))'
        )
        rows.append([col_a, col_b, col_c, col_d, col_e, col_f, col_g, col_h])
    return rows


def build_calc_performer_power() -> List[List[Any]]:
    """Tab 4: CALC_Performer_Power (Performer-First bidirectional synergy & ReRank engine)."""
    headers = [
        "Stage_Name",
        "Log_Count",
        "Direct_Composite_Avg",
        "Appearance_Avg",
        "Performance_Avg",
        "Energy_Vibe_Avg",
        "Trait_Synergy_Score",
        "Niche_Synergy_Score",
        "Studio_Power_Score",
        "ReRank_Matches",
        "ReRank_Win_Rate",
        "ReRank_Net_Margin",
        "ReRank_Consistency_Score",
        "ReRank_Delta",
        "Volume_Dampened_Bonus",
        "Taxonomy_Predicted_Score",
    ]
    rows: List[List[Any]] = [headers]
    base_param = _param("BASELINE_DEFAULT_RATING", 7)
    vb_param = _param("SCALE_VOL_BONUS", 0.05)
    sat_param = _param("SATURATION_THRESHOLD", 10)

    for r in range(2, PERFORMER_ROWS + 1):
        col_a = (
            '=IFERROR(LET('
            'all_p, VSTACK(ARRAYFORMULA(TRIM(MODEL_ROSTER_INDEX!B2:B500)), ARRAYFORMULA(TRIM(Performer_Logs!C2:C500))), '
            'SORT(UNIQUE(FILTER(all_p, all_p<>"")))), "")'
            if r == 2
            else ""
        )
        col_b = (
            f'=IF(ISBLANK(A{r}), "", '
            f'SUMPRODUCT((Performer_Logs!$C$2:$C$500<>"")*(LOWER(TRIM(Performer_Logs!$C$2:$C$500))=LOWER(TRIM(A{r})))))'
        )
        col_c = (
            f'=IF(ISBLANK(A{r}), "", IF(B{r}=0, "", '
            f'IFERROR(ROUND(AVERAGE(FILTER('
            f'ARRAYFORMULA((Performer_Logs!$D$2:$D$500 + Performer_Logs!$E$2:$E$500 + Performer_Logs!$F$2:$F$500)/3), '
            f'LOWER(TRIM(Performer_Logs!$C$2:$C$500))=LOWER(TRIM(A{r})))), 2), "")))'
        )
        col_d = (
            f'=IF(ISBLANK(A{r}), "", IF(B{r}=0, "", '
            f'IFERROR(ROUND(AVERAGE(FILTER(Performer_Logs!$D$2:$D$500, '
            f'LOWER(TRIM(Performer_Logs!$C$2:$C$500))=LOWER(TRIM(A{r})))), 2), "")))'
        )
        col_e = (
            f'=IF(ISBLANK(A{r}), "", IF(B{r}=0, "", '
            f'IFERROR(ROUND(AVERAGE(FILTER(Performer_Logs!$E$2:$E$500, '
            f'LOWER(TRIM(Performer_Logs!$C$2:$C$500))=LOWER(TRIM(A{r})))), 2), "")))'
        )
        col_f = (
            f'=IF(ISBLANK(A{r}), "", IF(B{r}=0, "", '
            f'IFERROR(ROUND(AVERAGE(FILTER(Performer_Logs!$F$2:$F$500, '
            f'LOWER(TRIM(Performer_Logs!$C$2:$C$500))=LOWER(TRIM(A{r})))), 2), "")))'
        )
        col_g = (
            f'=IF(ISBLANK(A{r}), "", LET('
            f'r_tags, IFERROR(VLOOKUP(A{r}, MODEL_ROSTER_INDEX!$B$2:$M$500, 8, FALSE), "") & ";" & '
            f'IFERROR(VLOOKUP(A{r}, MODEL_ROSTER_INDEX!$B$2:$M$500, 9, FALSE), "") & ";" & '
            f'IFERROR(VLOOKUP(A{r}, MODEL_ROSTER_INDEX!$B$2:$M$500, 10, FALSE), "") & ";" & '
            f'IFERROR(VLOOKUP(A{r}, MODEL_ROSTER_INDEX!$B$2:$M$500, 12, FALSE), ""), '
            f'l_tags, IFERROR(TEXTJOIN(";", TRUE, FILTER(Performer_Logs!$I$2:$I$500, LOWER(TRIM(Performer_Logs!$C$2:$C$500))=LOWER(TRIM(A{r})))), ""), '
            f'blob, ";" & SUBSTITUTE(SUBSTITUTE(LOWER(TRIM(r_tags & ";" & l_tags)), "; ", ";"), " ;", ";") & ";", '
            f't_names, Trait_Intelligence!$A$2:$A${TRAIT_ROWS}, '
            f't_scores, Trait_Intelligence!$F$2:$F${TRAIT_ROWS}, '
            f'IFERROR(ROUND(AVERAGE(FILTER(t_scores, (t_names<>"") * ISNUMBER(SEARCH(";" & LOWER(TRIM(t_names)) & ";", blob)))), 2), "")))'
        )
        col_h = (
            f'=IF(ISBLANK(A{r}), "", LET('
            f'r_tags, IFERROR(VLOOKUP(A{r}, MODEL_ROSTER_INDEX!$B$2:$M$500, 12, FALSE), ""), '
            f'l_tags, IFERROR(TEXTJOIN(";", TRUE, FILTER(Performer_Logs!$G$2:$G$500, LOWER(TRIM(Performer_Logs!$C$2:$C$500))=LOWER(TRIM(A{r})))), ""), '
            f'blob, ";" & SUBSTITUTE(SUBSTITUTE(LOWER(TRIM(r_tags & ";" & l_tags)), "; ", ";"), " ;", ";") & ";", '
            f'n_names, Niche_Intelligence!$A$2:$A${NICHE_ROWS}, '
            f'n_scores, Niche_Intelligence!$F$2:$F${NICHE_ROWS}, '
            f'IFERROR(ROUND(AVERAGE(FILTER(n_scores, (n_names<>"") * ISNUMBER(SEARCH(";" & LOWER(TRIM(n_names)) & ";", blob)))), 2), "")))'
        )
        col_i = (
            f'=IF(ISBLANK(A{r}), "", LET('
            f'r_st, IFERROR(VLOOKUP(A{r}, MODEL_ROSTER_INDEX!$B$2:$M$500, 11, FALSE), ""), '
            f'l_st, IFERROR(TEXTJOIN(";", TRUE, FILTER(Performer_Logs!$H$2:$H$500, LOWER(TRIM(Performer_Logs!$C$2:$C$500))=LOWER(TRIM(A{r})))), ""), '
            f'blob, ";" & SUBSTITUTE(SUBSTITUTE(LOWER(TRIM(r_st & ";" & l_st)), "; ", ";"), " ;", ";") & ";", '
            f's_names, Studio_Intelligence!$A$2:$A${STUDIO_ROWS}, '
            f's_scores, Studio_Intelligence!$G$2:$G${STUDIO_ROWS}, '
            f'IFERROR(ROUND(AVERAGE(FILTER(s_scores, (s_names<>"") * ISNUMBER(SEARCH(";" & LOWER(TRIM(s_names)) & ";", blob)))), 2), "")))'
        )
        col_j = (
            f'=IF(ISBLANK(A{r}), "", '
            f'SUMPRODUCT(((LOWER(TRIM(ReRanks!$C$2:$C$500))=LOWER(TRIM(A{r}))) + '
            f'(LOWER(TRIM(ReRanks!$D$2:$D$500))=LOWER(TRIM(A{r})))) > 0))'
        )
        col_k = (
            f'=IF(ISBLANK(A{r}), "", IF(J{r}=0, "", '
            f'ROUND(SUMPRODUCT((LOWER(TRIM(ReRanks!$E$2:$E$500))=LOWER(TRIM(A{r}))) * '
            f'(((LOWER(TRIM(ReRanks!$C$2:$C$500))=LOWER(TRIM(A{r})))+(LOWER(TRIM(ReRanks!$D$2:$D$500))=LOWER(TRIM(A{r}))))>0)) / J{r}, 3)))'
        )
        col_l = (
            f'=IF(ISBLANK(A{r}), "", IF(J{r}=0, "", LET('
            f'in_m, ((LOWER(TRIM(ReRanks!$C$2:$C$500))=LOWER(TRIM(A{r}))) + (LOWER(TRIM(ReRanks!$D$2:$D$500))=LOWER(TRIM(A{r})))) > 0, '
            f'won, LOWER(TRIM(ReRanks!$E$2:$E$500))=LOWER(TRIM(A{r})), '
            f'mg, ReRanks!$F$2:$F$500, '
            f'ROUND(SUMPRODUCT(in_m * won * mg) - SUMPRODUCT(in_m * (NOT(won)) * mg), 3))))'
        )
        col_m = (
            f'=IF(ISBLANK(A{r}), "", IF(J{r}=0, "", LET('
            f'wins, K{r}*J{r}, '
            f'swr, (wins + 1) / (J{r} + 2), '
            f'amg, L{r} / J{r}, '
            f'base_d, {base_param}, '
            f'MIN(10, MAX(1, ROUND(base_d + 0.5 + (swr - 0.5)*5 + MAX(-1, MIN(1, amg*1.5)), 2))))))'
        )
        col_n = (
            f'=IF(ISBLANK(A{r}), "", IF(J{r}=0, 0, LET('
            f'wins, K{r}*J{r}, '
            f'swr, (wins + 1) / (J{r} + 2), '
            f'amg, L{r} / J{r}, '
            f'ROUND(MAX(-0.75, MIN(0.75, (swr - 0.5)*1.2 + MAX(-0.35, MIN(0.35, amg*0.5)))), 3))))'
        )
        col_o = (
            f'=IF(ISBLANK(A{r}), "", IF(B{r}=0, 0, LET('
            f'vb, {vb_param}, sat, {sat_param}, '
            f'ROUND(vb * sat * (1 - EXP(-B{r} / sat)), 3))))'
        )
        col_p = (
            f'=IF(ISBLANK(A{r}), "", LET('
            f'wt, IF(ISNUMBER(G{r}), 0.50, 0), '
            f'wn, IF(ISNUMBER(H{r}), 0.30, 0), '
            f'ws, IF(ISNUMBER(I{r}), 0.20, 0), '
            f'tot_w, wt + wn + ws, '
            f'IF(tot_w=0, {base_param}, '
            f'ROUND((IF(ISNUMBER(G{r}), G{r}*wt, 0) + IF(ISNUMBER(H{r}), H{r}*wn, 0) + IF(ISNUMBER(I{r}), I{r}*ws, 0)) / tot_w, 2))))'
        )
        rows.append([
            col_a, col_b, col_c, col_d, col_e, col_f, col_g, col_h,
            col_i, col_j, col_k, col_l, col_m, col_n, col_o, col_p,
        ])
    return rows


def build_performer_intelligence() -> List[List[Any]]:
    """Tab 5: Performer_Intelligence (Executive performer dossier with stated-vs-demo blend)."""
    headers = [
        "Stage_Name",
        "Roster_ID",
        "Debut_Year",
        "Cup_Tag",
        "Natural_or_Enhanced",
        "WHR",
        "Direct_Log_Avg",
        "Taxonomy_Predicted",
        "Blended_Base_Score",
        "ReRank_Consistency",
        "ReRank_Delta",
        "Volume_Bonus",
        "Performer_Intelligence_Score",
        "Log_Count",
        "Last_Logged_Date",
        "Tracking_Status",
    ]
    rows: List[List[Any]] = [headers]
    w_param = _param("WEIGHT_STATED_DEMO", 0.6)

    for r in range(2, PERFORMER_ROWS + 1):
        col_a = (
            f'=IFERROR(FILTER(CALC_Performer_Power!A2:A{PERFORMER_ROWS}, '
            f'CALC_Performer_Power!A2:A{PERFORMER_ROWS}<>""), "")'
            if r == 2
            else ""
        )
        col_b = f'=IF(ISBLANK(A{r}), "", IFERROR(INDEX(MODEL_ROSTER_INDEX!$A$2:$A$500, MATCH(A{r}, MODEL_ROSTER_INDEX!$B$2:$B$500, 0)), "UNLISTED"))'
        col_c = f'=IF(ISBLANK(A{r}), "", IFERROR(INDEX(MODEL_ROSTER_INDEX!$D$2:$D$500, MATCH(A{r}, MODEL_ROSTER_INDEX!$B$2:$B$500, 0)), ""))'
        col_d = f'=IF(ISBLANK(A{r}), "", IFERROR(INDEX(MODEL_ROSTER_INDEX!$I$2:$I$500, MATCH(A{r}, MODEL_ROSTER_INDEX!$B$2:$B$500, 0)), ""))'
        col_e = f'=IF(ISBLANK(A{r}), "", IFERROR(INDEX(MODEL_ROSTER_INDEX!$J$2:$J$500, MATCH(A{r}, MODEL_ROSTER_INDEX!$B$2:$B$500, 0)), ""))'
        col_f = f'=IF(ISBLANK(A{r}), "", IFERROR(INDEX(MODEL_ROSTER_INDEX!$H$2:$H$500, MATCH(A{r}, MODEL_ROSTER_INDEX!$B$2:$B$500, 0)), ""))'
        col_g = f'=IF(ISBLANK(A{r}), "", IFERROR(INDEX(CALC_Performer_Power!$C$2:$C${PERFORMER_ROWS}, MATCH(A{r}, CALC_Performer_Power!$A$2:$A${PERFORMER_ROWS}, 0)), ""))'
        col_h = f'=IF(ISBLANK(A{r}), "", IFERROR(INDEX(CALC_Performer_Power!$P$2:$P${PERFORMER_ROWS}, MATCH(A{r}, CALC_Performer_Power!$A$2:$A${PERFORMER_ROWS}, 0)), ""))'
        col_i = (
            f'=IF(ISBLANK(A{r}), "", LET(w, {w_param}, '
            f'IF(G{r}="", IF(H{r}="", "", ROUND(H{r}, 2)), '
            f'ROUND(w*G{r} + (1-w)*H{r}, 2))))'
        )
        col_j = f'=IF(ISBLANK(A{r}), "", IFERROR(INDEX(CALC_Performer_Power!$M$2:$M${PERFORMER_ROWS}, MATCH(A{r}, CALC_Performer_Power!$A$2:$A${PERFORMER_ROWS}, 0)), ""))'
        col_k = f'=IF(ISBLANK(A{r}), "", IFERROR(INDEX(CALC_Performer_Power!$N$2:$N${PERFORMER_ROWS}, MATCH(A{r}, CALC_Performer_Power!$A$2:$A${PERFORMER_ROWS}, 0)), 0))'
        col_l = f'=IF(ISBLANK(A{r}), "", IFERROR(INDEX(CALC_Performer_Power!$O$2:$O${PERFORMER_ROWS}, MATCH(A{r}, CALC_Performer_Power!$A$2:$A${PERFORMER_ROWS}, 0)), 0))'
        col_m = f'=IF(ISBLANK(A{r}), "", IF(I{r}="", "", MIN(10, MAX(1, ROUND(I{r} + K{r} + L{r}, 2)))))'
        col_n = f'=IF(ISBLANK(A{r}), "", IFERROR(INDEX(CALC_Performer_Power!$B$2:$B${PERFORMER_ROWS}, MATCH(A{r}, CALC_Performer_Power!$A$2:$A${PERFORMER_ROWS}, 0)), 0))'
        col_o = (
            f'=IF(ISBLANK(A{r}), "", IF(N{r}=0, "", '
            f'IFERROR(MAX(FILTER(ARRAYFORMULA(IF(ISNUMBER(Performer_Logs!$A$2:$A$500), Performer_Logs!$A$2:$A$500, IFERROR(DATEVALUE(Performer_Logs!$A$2:$A$500), ""))), '
            f'LOWER(TRIM(Performer_Logs!$C$2:$C$500))=LOWER(TRIM(A{r})))), "")))'
        )
        col_p = (
            f'=IF(ISBLANK(A{r}), "", '
            f'IF(AND(N{r}>0, J{r}<>""), "CALIBRATED", '
            f'IF(N{r}>0, "LOGGED", "SCOUTING")))'
        )
        rows.append([
            col_a, col_b, col_c, col_d, col_e, col_f, col_g, col_h,
            col_i, col_j, col_k, col_l, col_m, col_n, col_o, col_p,
        ])
    return rows


def build_total_rankings() -> List[List[Any]]:
    """Tab 6: Total_Rankings (Movie-Tracker mirror with Era & Memory Half-Life Decay)."""
    headers = [
        "Stage_Name",
        "Direct_Avg",
        "Log_Count",
        "Trait_Score",
        "Niche_Score",
        "Studio_Score",
        "ReRank_Consistency",
        "Era_Decay_Factor",
        "Memory_Decay_Factor",
        "Intangible_Synergy_Score",
        "Volume_Bonus",
        "Master_Score",
        "Final_Active_Score",
        "Active_Rank",
        "Tracking_Status",
    ]
    rows: List[List[Any]] = [headers]
    era_hl = _param("ERA_DECAY_HALFLIFE_DAYS", 730)
    mem_hl = _param("MEM_DECAY_HALFLIFE_DAYS", 90)

    for r in range(2, PERFORMER_ROWS + 1):
        col_a = (
            f'=IFERROR(FILTER(Performer_Intelligence!A2:A{PERFORMER_ROWS}, '
            f'Performer_Intelligence!A2:A{PERFORMER_ROWS}<>""), "")'
            if r == 2
            else ""
        )
        col_b = f'=IF(ISBLANK(A{r}), "", IFERROR(INDEX(Performer_Intelligence!$G$2:$G${PERFORMER_ROWS}, MATCH(A{r}, Performer_Intelligence!$A$2:$A${PERFORMER_ROWS}, 0)), ""))'
        col_c = f'=IF(ISBLANK(A{r}), "", IFERROR(INDEX(Performer_Intelligence!$N$2:$N${PERFORMER_ROWS}, MATCH(A{r}, Performer_Intelligence!$A$2:$A${PERFORMER_ROWS}, 0)), 0))'
        col_d = f'=IF(ISBLANK(A{r}), "", IFERROR(INDEX(CALC_Performer_Power!$G$2:$G${PERFORMER_ROWS}, MATCH(A{r}, CALC_Performer_Power!$A$2:$A${PERFORMER_ROWS}, 0)), ""))'
        col_e = f'=IF(ISBLANK(A{r}), "", IFERROR(INDEX(CALC_Performer_Power!$H$2:$H${PERFORMER_ROWS}, MATCH(A{r}, CALC_Performer_Power!$A$2:$A${PERFORMER_ROWS}, 0)), ""))'
        col_f = f'=IF(ISBLANK(A{r}), "", IFERROR(INDEX(CALC_Performer_Power!$I$2:$I${PERFORMER_ROWS}, MATCH(A{r}, CALC_Performer_Power!$A$2:$A${PERFORMER_ROWS}, 0)), ""))'
        col_g = f'=IF(ISBLANK(A{r}), "", IFERROR(INDEX(Performer_Intelligence!$J$2:$J${PERFORMER_ROWS}, MATCH(A{r}, Performer_Intelligence!$A$2:$A${PERFORMER_ROWS}, 0)), ""))'
        col_h = (
            f'=IF(ISBLANK(A{r}), "", LET('
            f'dy, IFERROR(INDEX(Performer_Intelligence!$C$2:$C${PERFORMER_ROWS}, MATCH(A{r}, Performer_Intelligence!$A$2:$A${PERFORMER_ROWS}, 0)), ""), '
            f'hl, {era_hl}, '
            f'IF(OR(dy="", NOT(ISNUMBER(dy))), "", ROUND(0.5^(MAX(0, (YEAR(TODAY()) - dy)*365.25) / hl), 4))))'
        )
        col_i = (
            f'=IF(ISBLANK(A{r}), "", LET('
            f'ld, IFERROR(INDEX(Performer_Intelligence!$O$2:$O${PERFORMER_ROWS}, MATCH(A{r}, Performer_Intelligence!$A$2:$A${PERFORMER_ROWS}, 0)), ""), '
            f'hl, {mem_hl}, '
            f'IF(OR(ld="", NOT(ISNUMBER(ld))), "", ROUND(0.5^(MAX(0, TODAY() - ld) / hl), 4))))'
        )
        col_j = f'=IF(ISBLANK(A{r}), "", IFERROR(INDEX(Performer_Intelligence!$H$2:$H${PERFORMER_ROWS}, MATCH(A{r}, Performer_Intelligence!$A$2:$A${PERFORMER_ROWS}, 0)), ""))'
        col_k = f'=IF(ISBLANK(A{r}), "", IFERROR(INDEX(Performer_Intelligence!$L$2:$L${PERFORMER_ROWS}, MATCH(A{r}, Performer_Intelligence!$A$2:$A${PERFORMER_ROWS}, 0)), 0))'
        col_l = f'=IF(ISBLANK(A{r}), "", IFERROR(INDEX(Performer_Intelligence!$M$2:$M${PERFORMER_ROWS}, MATCH(A{r}, Performer_Intelligence!$A$2:$A${PERFORMER_ROWS}, 0)), ""))'
        col_m = (
            f'=IF(ISBLANK(A{r}), "", IF(L{r}="", "", '
            f'MIN(10, MAX(1, ROUND(L{r} * (0.90 + 0.04*IF(ISNUMBER(H{r}), H{r}, 0) + 0.06*IF(ISNUMBER(I{r}), I{r}, 0)), 2)))))'
        )
        col_n = f'=IF(ISBLANK(A{r}), "", IF(M{r}="", "", RANK(M{r}, $M$2:$M${PERFORMER_ROWS}, 0)))'
        col_o = f'=IF(ISBLANK(A{r}), "", IFERROR(INDEX(Performer_Intelligence!$P$2:$P${PERFORMER_ROWS}, MATCH(A{r}, Performer_Intelligence!$A$2:$A${PERFORMER_ROWS}, 0)), ""))'
        rows.append([
            col_a, col_b, col_c, col_d, col_e, col_f, col_g, col_h,
            col_i, col_j, col_k, col_l, col_m, col_n, col_o,
        ])
    return rows


def build_master_leaderboard() -> List[List[Any]]:
    """Tab 7: Master_Leaderboard (Executive HUD with KPI ribbon, sorted rankings & Top-10 panels)."""
    cap_param = _param("ACTIVE_ROSTER_TARGET", 50)
    rows: List[List[Any]] = []

    # Row 1: Executive Title Banner (A1:R1)
    rows.append([
        "⭐ ADULT STAR TRACKER — MASTER LEADERBOARD (PERFORMER-FIRST STANDALONE)",
        "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "",
    ])

    # Row 2: Live KPI Strip (A2:R2)
    rows.append([
        "ROSTER",
        '=IF(COUNTA(MODEL_ROSTER_INDEX!B2:B500)=0, "", COUNTA(MODEL_ROSTER_INDEX!B2:B500))',
        "LOGGED",
        f'=IF(COUNTA(Performer_Intelligence!A2:A{PERFORMER_ROWS})=0, "", COUNTIF(Performer_Intelligence!N2:N{PERFORMER_ROWS}, ">0"))',
        "LOGS",
        '=IF(COUNTA(Performer_Logs!B2:B500)=0, "", COUNTA(Performer_Logs!B2:B500))',
        "DUELS",
        '=IF(COUNTA(ReRanks!B2:B500)=0, "", COUNTA(ReRanks!B2:B500))',
        "TOP ACTIVE",
        '=IF(ISBLANK(B5), "", B5)',
        "AVG ACTIVE",
        f'=IFERROR(ROUND(AVERAGE(FILTER(Total_Rankings!M2:M{PERFORMER_ROWS}, Total_Rankings!C2:C{PERFORMER_ROWS}>0)), 2), "")',
        "CAPACITY",
        f'=IF(COUNTA(MODEL_ROSTER_INDEX!B2:B500)=0, "", ROUND(COUNTA(MODEL_ROSTER_INDEX!B2:B500) / {cap_param}, 3))',
        "",
        "MODE",
        "STANDALONE_READY",
        '=TEXT(NOW(), "yyyy-mm-dd hh:mm")',
    ])

    # Row 3: Section Headers
    rows.append([
        "🏆 ACTIVE PERFORMER LEADERBOARD (SORTED BY FINAL ACTIVE SCORE)",
        "", "", "", "", "", "", "", "", "", "", "", "", "", "",
        "🔥 TOP 10 TRAITS", "", "",
    ])

    # Row 4: Column Headers
    rows.append([
        "Rank",
        "Stage_Name",
        "Final_Active",
        "Master_Score",
        "Direct_Avg",
        "Trait_Score",
        "Niche_Score",
        "Studio_Score",
        "ReRank_Score",
        "Era_Fresh",
        "Mem_Fresh",
        "Logs",
        "Status",
        "Power_Gauge",
        "",
        "Trait_Tag",
        "Domain_Group",
        "Score",
    ])

    # Rows 5..54: Sorted table spill at A5, blank-safe SPARKLINE in Col N, plus side Top-10 panels in P:R
    for idx in range(5, LEADERBOARD_ROWS + 1):
        row = [""] * 18
        if idx == 5:
            row[0] = (
                f'=IF(COUNTA(Total_Rankings!A2:A{PERFORMER_ROWS})=0, "", '
                f'IFERROR(ARRAY_CONSTRAIN('
                f'SORT(FILTER({{'
                f'Total_Rankings!N2:N{PERFORMER_ROWS}, '
                f'Total_Rankings!A2:A{PERFORMER_ROWS}, '
                f'Total_Rankings!M2:M{PERFORMER_ROWS}, '
                f'Total_Rankings!L2:L{PERFORMER_ROWS}, '
                f'Total_Rankings!B2:B{PERFORMER_ROWS}, '
                f'Total_Rankings!D2:D{PERFORMER_ROWS}, '
                f'Total_Rankings!E2:E{PERFORMER_ROWS}, '
                f'Total_Rankings!F2:F{PERFORMER_ROWS}, '
                f'Total_Rankings!G2:G{PERFORMER_ROWS}, '
                f'Total_Rankings!H2:H{PERFORMER_ROWS}, '
                f'Total_Rankings!I2:I{PERFORMER_ROWS}, '
                f'Total_Rankings!C2:C{PERFORMER_ROWS}, '
                f'Total_Rankings!O2:O{PERFORMER_ROWS}'
                f'}}, Total_Rankings!A2:A{PERFORMER_ROWS}<>""), 3, FALSE), '
                f'{cap_param}, 13), ""))'
            )
            # Top 10 Traits spill at P5:R14
            row[15] = (
                f'=IFERROR(SORTN(FILTER({{'
                f'Trait_Intelligence!A2:A{TRAIT_ROWS}, '
                f'Trait_Intelligence!B2:B{TRAIT_ROWS}, '
                f'Trait_Intelligence!F2:F{TRAIT_ROWS}'
                f'}}, Trait_Intelligence!A2:A{TRAIT_ROWS}<>""), 10, 0, 3, FALSE), "")'
            )
        # Blank-safe native SPARKLINE gauge in Col N (index 13)
        row[13] = (
            f'=IF(ISBLANK(B{idx}), "", IF(NOT(ISNUMBER(C{idx})), "", '
            f'SPARKLINE(C{idx}, {{"charttype","bar";"max",10;"color1",'
            f'IF(C{idx}>=9,"#10B981",IF(C{idx}>=7.5,"#F59E0B","#EF4444"))}})))'
        )
        # Side Panel 2: Top 10 Niches (Row 16 section, Row 17 headers, Row 18 spill)
        if idx == 16:
            row[15] = "🎯 TOP 10 NICHES"
        elif idx == 17:
            row[15], row[16], row[17] = "Niche_Tag", "Domain_Group", "Score"
        elif idx == 18:
            row[15] = (
                f'=IFERROR(SORTN(FILTER({{'
                f'Niche_Intelligence!A2:A{NICHE_ROWS}, '
                f'Niche_Intelligence!B2:B{NICHE_ROWS}, '
                f'Niche_Intelligence!F2:F{NICHE_ROWS}'
                f'}}, Niche_Intelligence!A2:A{NICHE_ROWS}<>""), 10, 0, 3, FALSE), "")'
            )
        # Side Panel 3: Top 10 Studios (Row 29 section, Row 30 headers, Row 31 spill)
        elif idx == 29:
            row[15] = "🎬 TOP 10 STUDIOS"
        elif idx == 30:
            row[15], row[16], row[17] = "Studio_Name", "Scoring_Mode", "Score"
        elif idx == 31:
            row[15] = (
                f'=IFERROR(SORTN(FILTER({{'
                f'Studio_Intelligence!A2:A{STUDIO_ROWS}, '
                f'Studio_Intelligence!H2:H{STUDIO_ROWS}, '
                f'Studio_Intelligence!G2:G{STUDIO_ROWS}'
                f'}}, Studio_Intelligence!A2:A{STUDIO_ROWS}<>""), 10, 0, 3, FALSE), "")'
            )
        rows.append(row)
    return rows


def build_growth_ledger() -> List[List[Any]]:
    """Tab 8: GROWTH_LEDGER (Catalog velocity & staged LifeOS-ready telemetry, zero live push)."""
    cap_param = _param("ACTIVE_ROSTER_TARGET", 50)
    xp_param = _param("P4_XP_PER_LOG", 25)
    tax_param = _param("P0_P1_DOPAMINE_TAX", 15)

    rows: List[List[Any]] = [
        ["📈 GROWTH LEDGER — CATALOG VELOCITY & LIFEOS-READY STAGED TELEMETRY", "", "", "", "", "", ""],
        ["Metric_Key", "Current_Value", "Target_Or_Unit", "Coverage_Pct", "Status_Tag", "Notes", ""],
        [
            "CATALOG_ROSTER_SIZE",
            '=IF(COUNTA(MODEL_ROSTER_INDEX!B2:B500)=0, "", COUNTA(MODEL_ROSTER_INDEX!B2:B500))',
            f'={cap_param}',
            '=IF(OR(B3="", C3=""), "", ROUND(B3 / C3, 3))',
            '=IF(B3="", "", IF(D3>=1, "AT_CAPACITY", IF(D3>=0.5, "GROWING", "SEEDING")))',
            "Active performers tracked in MODEL_ROSTER_INDEX vs ACTIVE_ROSTER_TARGET",
            "",
        ],
        [
            "LOGGED_PERFORMER_COVERAGE",
            f'=IF(COUNTA(Performer_Intelligence!A2:A{PERFORMER_ROWS})=0, "", COUNTIF(Performer_Intelligence!N2:N{PERFORMER_ROWS}, ">0"))',
            '=IF(B3="", "", B3)',
            '=IF(OR(B4="", C4="", C4=0), "", ROUND(B4 / C4, 3))',
            '=IF(B4="", "", IF(D4>=0.75, "DEEP_COVERAGE", IF(D4>=0.3, "BUILDING", "EARLY_STAGE")))',
            "Unique roster performers with at least 1 Performer_Log entry",
            "",
        ],
        [
            "TOTAL_PERFORMER_LOGS",
            '=IF(COUNTA(Performer_Logs!B2:B500)=0, "", COUNTA(Performer_Logs!B2:B500))',
            "Performer-First Logs",
            "",
            '=IF(B5="", "EMPTY", "ACTIVE")',
            "Write-only performer-first log count (female performer primary entity)",
            "",
        ],
        [
            "RERANK_CALIBRATION_DUELS",
            '=IF(COUNTA(ReRanks!B2:B500)=0, "", COUNTA(ReRanks!B2:B500))',
            "Pairwise Duels",
            "",
            '=IF(B6="", "UNCALIBRATED", IF(B6>=10, "CALIBRATED", "WARMING_UP"))',
            "Head-to-head ReRanks duels calibrating performer consistency",
            "",
        ],
        [
            "TAXONOMY_DEMO_COVERAGE",
            f'=IF(COUNTA(TAXONOMY_MATRIX!C2:C500)=0, "", COUNTIF(Trait_Intelligence!E2:E{TRAIT_ROWS}, ">0") + COUNTIF(Niche_Intelligence!E2:E{NICHE_ROWS}, ">0"))',
            '=IF(COUNTA(TAXONOMY_MATRIX!C2:C500)=0, "", COUNTA(TAXONOMY_MATRIX!C2:C500))',
            '=IF(OR(B7="", C7="", C7=0), "", ROUND(B7 / C7, 3))',
            '=IF(B7="", "", IF(D7>=0.5, "RICH_SIGNAL", "EXPANSION_READY"))',
            "Taxonomy tags with >=1 demonstrated performer log out of total matrix",
            "",
        ],
        [
            "STUDIO_AUTO_COVERAGE",
            f'=IF(COUNTA(Studio_Intelligence!A2:A{STUDIO_ROWS})=0, "", COUNTIF(Studio_Intelligence!C2:C{STUDIO_ROWS}, ">0"))',
            f'=IF(COUNTA(Studio_Intelligence!A2:A{STUDIO_ROWS})=0, "", COUNTA(Studio_Intelligence!A2:A{STUDIO_ROWS}))',
            '=IF(OR(B8="", C8="", C8=0), "", ROUND(B8 / C8, 3))',
            '=IF(B8="", "", "AUTO_SCORING_LIVE")',
            "Auto-discovered studios with demonstrated performer log evidence",
            "",
        ],
        [
            "STAGED_P4_SYSTEMS_XP",
            f'=IF(B5="", "", B5 * {xp_param})',
            f'={xp_param}',
            "",
            "STAGED_STANDALONE",
            "Staged locally via P4_XP_PER_LOG — NOT pushed to LifeOS while standalone",
            "",
        ],
        [
            "STAGED_P0_P1_DOPAMINE_TAX",
            f'=IF(B5="", "", B5 * {tax_param})',
            f'={tax_param}',
            "",
            "STAGED_STANDALONE",
            "Staged locally via P0_P1_DOPAMINE_TAX — NOT pushed to LifeOS while standalone",
            "",
        ],
        ["", "", "", "", "", "", ""],
        ["🕒 CHRONOLOGICAL PERFORMER & RERANK ACTIVITY FEED", "", "", "", "", "", ""],
        ["Timestamp", "Entry_Type", "Entity_Summary", "Score_Or_Margin", "Staged_XP", "Staged_Tax", "Notes"],
        [
            f'=IFERROR(SORT(VSTACK('
            f'FILTER({{Performer_Logs!A2:A500, ARRAYFORMULA(IF(Performer_Logs!B2:B500="", "", "PERFORMER_LOG")), '
            f'Performer_Logs!C2:C500, '
            f'ARRAYFORMULA(IF(Performer_Logs!C2:C500="", "", ROUND((Performer_Logs!D2:D500+Performer_Logs!E2:E500+Performer_Logs!F2:F500)/3, 2))), '
            f'ARRAYFORMULA(IF(Performer_Logs!B2:B500="", "", {xp_param})), '
            f'ARRAYFORMULA(IF(Performer_Logs!B2:B500="", "", {tax_param})), '
            f'Performer_Logs!J2:J500}}, Performer_Logs!C2:C500<>""), '
            f'FILTER({{ReRanks!A2:A500, ARRAYFORMULA(IF(ReRanks!B2:B500="", "", "RERANK_DUEL")), '
            f'ARRAYFORMULA(IF(ReRanks!E2:E500="", "", ReRanks!E2:E500 & " > " & IF(ReRanks!E2:E500=ReRanks!C2:C500, ReRanks!D2:D500, ReRanks!C2:C500))), '
            f'ReRanks!F2:F500, '
            f'ARRAYFORMULA(IF(ReRanks!B2:B500="", "", 0)), '
            f'ARRAYFORMULA(IF(ReRanks!B2:B500="", "", 0)), '
            f'ReRanks!H2:H500}}, ReRanks!E2:E500<>"")'
            f'), 1, FALSE), "")',
            "", "", "", "", "", "",
        ],
    ]
    return rows


def build_module_meta() -> List[List[Any]]:
    """Tab 9: MODULE_META (LifeOS-Ready Brick metadata operating in STANDALONE_READY mode)."""
    return [
        ["Field", "Value", "Notes"],
        ["Brick_Name", "Adult_Star_Tracker_Brick", "Standalone Performer-First Taxonomy & Ranking Brick"],
        ["Brick_Version", "2.0.0-standalone", "Performer-First architecture (no scene logging)"],
        ["Operating_Mode", "STANDALONE_READY", "Independent outside live LifeOS; ready to plug in later"],
        ["Source_Workbook_ID", TARGET_SPREADSHEET_ID, "Target Google Spreadsheet ID"],
        ["Entity_Primary_Key", "Stage_Name (Female Performer)", "All scoring centers on Performer_Logs + ReRanks + Roster"],
        ["Glyph", "⭐", "Executive HUD icon"],
        ["Domain_Pillar", "Standalone (Future: Pillar 0 Shadow / Pillar 4 Systems)", "LifeOS AQAL mapping once connected"],
        ["Taxonomy_Enrichment", "Boobpedia MediaWiki API (https://www.boobpedia.com/wiki/api.php)", "Automated + manual/form performer & tag enrichment"],
        ["Signals_Published", "AST_ROSTER_COUNT, AST_LOGGED_PERFORMERS, AST_TOTAL_LOGS, AST_AVG_ACTIVE_SCORE, AST_TOP_TRAIT_SCORE, AST_TOP_NICHE_SCORE, AST_TOP_STUDIO_SCORE, AST_STAGED_P4_XP, AST_STAGED_DOPAMINE_TAX", "Local SIGNALS_OUT range ready for future LifeOS_Master_Bus pull"],
        ["Context_Subscribed", "DAILY_MOOD, DOPAMINE_BUDGET_STATUS, OPS_GOVERNOR_FOCUS, SHADOW_AWARENESS_INDEX", "Dormant CONTEXT_IN slots for future LifeOS_feed_hub wiring"],
        ["Hub_Spreadsheet_ID", "", "Intentionally blank while standalone — set when wiring to LifeOS"],
        ["Last_Synced", '=TEXT(NOW(), "yyyy-mm-dd hh:mm") & " LOCAL"', "Dynamic local formula timestamp"],
    ]


def build_context_in() -> List[List[Any]]:
    """Tab 10: CONTEXT_IN (Dormant 6-col LifeOS inbound contract — zero live IMPORTRANGE)."""
    return [
        ["Signal_Key", "Live_Value", "Normalized_Score_0_100", "State_Tag", "Freshness_Status", "Hub_Auth_Trigger"],
        ["DAILY_MOOD", "", "", "STANDALONE_DORMANT", "OFFLINE_READY", "Dormant — wire IMPORTRANGE when plugging into LifeOS"],
        ["DOPAMINE_BUDGET_STATUS", "", "", "STANDALONE_DORMANT", "OFFLINE_READY", "Dormant — wire IMPORTRANGE when plugging into LifeOS"],
        ["OPS_GOVERNOR_FOCUS", "", "", "STANDALONE_DORMANT", "OFFLINE_READY", "Dormant — wire IMPORTRANGE when plugging into LifeOS"],
        ["SHADOW_AWARENESS_INDEX", "", "", "STANDALONE_DORMANT", "OFFLINE_READY", "Dormant — wire IMPORTRANGE when plugging into LifeOS"],
    ]


def build_signals_out() -> List[List[Any]]:
    """Tab 11: SIGNALS_OUT (10-col LifeOS outbound contract computed strictly from local tabs)."""
    cap_param = _param("ACTIVE_ROSTER_TARGET", 50)
    ts_formula = '=TEXT(NOW(), "yyyy-mm-dd hh:mm")'
    return [
        [
            "Signal_Key", "Source_Brick", "Glyph", "Domain_Pillar",
            "Raw_Value", "Normalized_Score_0_100", "State_Tag",
            "Last_Updated", "TTL_Hours", "Notes",
        ],
        [
            "AST_ROSTER_COUNT", "Adult_Star_Tracker_Brick", "📋", "Standalone / Catalog",
            '=IF(COUNTA(MODEL_ROSTER_INDEX!B2:B500)=0, "", COUNTA(MODEL_ROSTER_INDEX!B2:B500))',
            f'=IF(ISBLANK(E2), "", MIN(100, ROUND(E2 / {cap_param} * 100, 1)))',
            '=IF(ISBLANK(E2), "", E2 & " Performers Indexed")',
            ts_formula, 168, "Total performers in MODEL_ROSTER_INDEX vs ACTIVE_ROSTER_TARGET",
        ],
        [
            "AST_LOGGED_PERFORMERS", "Adult_Star_Tracker_Brick", "⭐", "Standalone / Catalog",
            f'=IF(COUNTA(Performer_Intelligence!A2:A{PERFORMER_ROWS})=0, "", COUNTIF(Performer_Intelligence!N2:N{PERFORMER_ROWS}, ">0"))',
            '=IF(OR(ISBLANK(E3), ISBLANK(E2), E2=0), "", ROUND(E3 / E2 * 100, 1))',
            '=IF(ISBLANK(E3), "", E3 & " Logged Stars")',
            ts_formula, 168, "Unique performers with >=1 Performer_Log (% of indexed roster)",
        ],
        [
            "AST_TOTAL_LOGS", "Adult_Star_Tracker_Brick", "📝", "Standalone / Activity",
            '=IF(COUNTA(Performer_Logs!B2:B500)=0, "", COUNTA(Performer_Logs!B2:B500))',
            '=IF(ISBLANK(E4), "", MIN(100, ROUND(E4, 1)))',
            '=IF(ISBLANK(E4), "", E4 & " Performer Logs")',
            ts_formula, 24, "Total write-only Performer_Logs count (100 logs = 100%)",
        ],
        [
            "AST_AVG_ACTIVE_SCORE", "Adult_Star_Tracker_Brick", "🏆", "Standalone / Preference",
            f'=IFERROR(ROUND(AVERAGE(FILTER(Total_Rankings!M2:M{PERFORMER_ROWS}, Total_Rankings!C2:C{PERFORMER_ROWS}>0)), 2), "")',
            '=IF(ISBLANK(E5), "", ROUND(E5 * 10, 1))',
            '=IF(ISBLANK(E5), "", IF(E5>=9, "ELITE_CURATION", IF(E5>=7.5, "HIGH_QUALITY", "CALIBRATING")))',
            ts_formula, 168, "Mean Final_Active_Score across logged performers (0-10 -> 0-100)",
        ],
        [
            "AST_TOP_TRAIT_SCORE", "Adult_Star_Tracker_Brick", "🧬", "Standalone / Taxonomy",
            f'=IFERROR(ROUND(MAX(Trait_Intelligence!F2:F{TRAIT_ROWS}), 2), "")',
            '=IF(ISBLANK(E6), "", ROUND(E6 * 10, 1))',
            f'=IF(ISBLANK(E6), "", IFERROR(INDEX(Trait_Intelligence!A2:A{TRAIT_ROWS}, MATCH(E6, Trait_Intelligence!F2:F{TRAIT_ROWS}, 0)), ""))',
            ts_formula, 168, "Highest live Trait_Intelligence_Score and leading trait tag",
        ],
        [
            "AST_TOP_NICHE_SCORE", "Adult_Star_Tracker_Brick", "🎯", "Standalone / Taxonomy",
            f'=IFERROR(ROUND(MAX(Niche_Intelligence!F2:F{NICHE_ROWS}), 2), "")',
            '=IF(ISBLANK(E7), "", ROUND(E7 * 10, 1))',
            f'=IF(ISBLANK(E7), "", IFERROR(INDEX(Niche_Intelligence!A2:A{NICHE_ROWS}, MATCH(E7, Niche_Intelligence!F2:F{NICHE_ROWS}, 0)), ""))',
            ts_formula, 168, "Highest live Niche_Intelligence_Score and leading niche tag",
        ],
        [
            "AST_TOP_STUDIO_SCORE", "Adult_Star_Tracker_Brick", "🎬", "Standalone / Studios",
            f'=IFERROR(ROUND(MAX(Studio_Intelligence!G2:G{STUDIO_ROWS}), 2), "")',
            '=IF(ISBLANK(E8), "", ROUND(E8 * 10, 1))',
            f'=IF(ISBLANK(E8), "", IFERROR(INDEX(Studio_Intelligence!A2:A{STUDIO_ROWS}, MATCH(E8, Studio_Intelligence!G2:G{STUDIO_ROWS}, 0)), ""))',
            ts_formula, 168, "Highest Studio_Intelligence_Score and leading studio",
        ],
        [
            "AST_STAGED_P4_XP", "Adult_Star_Tracker_Brick", "⚡", "Future / Pillar 4 Systems",
            '=IF(ISBLANK(GROWTH_LEDGER!B9), "", GROWTH_LEDGER!B9)',
            '=IF(ISBLANK(E9), "", MIN(100, ROUND(E9 / 10, 1)))',
            "STAGED_STANDALONE",
            ts_formula, 168, "Staged Pillar 4 Systems XP (local only while standalone)",
        ],
        [
            "AST_STAGED_DOPAMINE_TAX", "Adult_Star_Tracker_Brick", "🛡️", "Future / Pillar 0-1",
            '=IF(ISBLANK(GROWTH_LEDGER!B10), "", GROWTH_LEDGER!B10)',
            '=IF(ISBLANK(E10), "", MIN(100, ROUND(E10 / 10, 1)))',
            "STAGED_STANDALONE",
            ts_formula, 24, "Staged Pillar 0/1 Dopamine Tax (local only while standalone)",
        ],
    ]


def build_all_tab_definitions() -> Dict[str, List[List[Any]]]:
    """Generate complete cell matrices for all 11 downstream tabs."""
    return {
        "Trait_Intelligence": build_trait_intelligence(),
        "Niche_Intelligence": build_niche_intelligence(),
        "Studio_Intelligence": build_studio_intelligence(),
        "CALC_Performer_Power": build_calc_performer_power(),
        "Performer_Intelligence": build_performer_intelligence(),
        "Total_Rankings": build_total_rankings(),
        "Master_Leaderboard": build_master_leaderboard(),
        "GROWTH_LEDGER": build_growth_ledger(),
        "MODULE_META": build_module_meta(),
        "CONTEXT_IN": build_context_in(),
        "SIGNALS_OUT": build_signals_out(),
    }


def audit_all_tab_definitions(tabs: Dict[str, List[List[Any]]]) -> List[str]:
    """Run static safety audits over all generated tab formulas and contents."""
    issues: List[str] = []
    for tab_name, rows in tabs.items():
        for r_idx, row in enumerate(rows, start=1):
            for c_idx, cell in enumerate(row, start=1):
                if not isinstance(cell, str):
                    continue
                if not audit_no_scene_logs_dependency(cell):
                    issues.append(f"{tab_name}!R{r_idx}C{c_idx}: forbidden Scene_Logs reference")
                if not audit_no_live_lifeos_wiring(cell):
                    issues.append(f"{tab_name}!R{r_idx}C{c_idx}: forbidden live LifeOS/IMPORTRANGE reference")
                if cell.startswith("="):
                    ok, msg = audit_formula_blank_safety(cell)
                    if not ok:
                        issues.append(f"{tab_name}!R{r_idx}C{c_idx}: {msg}")
    return issues


# ---------------------------------------------------------------------------
# Executive Dark-Obsidian Formatting (raw-batch Sheets API requests)
# ---------------------------------------------------------------------------

def _header_format_req(sheet_id: int, end_col: int, row_index: int = 0, bg: Dict[str, float] = COLOR_OBSIDIAN) -> Dict[str, Any]:
    return {
        "repeatCell": {
            "range": {
                "sheetId": sheet_id,
                "startRowIndex": row_index,
                "endRowIndex": row_index + 1,
                "startColumnIndex": 0,
                "endColumnIndex": end_col,
            },
            "cell": {
                "userEnteredFormat": {
                    "backgroundColor": bg,
                    "textFormat": {
                        "foregroundColor": COLOR_WHITE,
                        "bold": True,
                        "fontSize": 10,
                    },
                    "horizontalAlignment": "CENTER",
                    "verticalAlignment": "MIDDLE",
                    "wrapStrategy": "WRAP",
                }
            },
            "fields": "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment,wrapStrategy)",
        }
    }


def _freeze_req(sheet_id: int, frozen_rows: int, frozen_cols: int = 1, hide_gridlines: bool = False) -> Dict[str, Any]:
    return {
        "updateSheetProperties": {
            "properties": {
                "sheetId": sheet_id,
                "gridProperties": {
                    "frozenRowCount": frozen_rows,
                    "frozenColumnCount": frozen_cols,
                    "hideGridlines": hide_gridlines,
                },
            },
            "fields": "gridProperties.frozenRowCount,gridProperties.frozenColumnCount,gridProperties.hideGridlines",
        }
    }


def _score_cf_rules(sheet_id: int, start_row: int, end_row: int, col_index: int) -> List[Dict[str, Any]]:
    """Semantic Crimson / Amber / Emerald conditional formatting on a 1-10 score column."""
    rng = {
        "sheetId": sheet_id,
        "startRowIndex": start_row,
        "endRowIndex": end_row,
        "startColumnIndex": col_index,
        "endColumnIndex": col_index + 1,
    }
    return [
        {
            "addConditionalFormatRule": {
                "rule": {
                    "ranges": [rng],
                    "booleanRule": {
                        "condition": {"type": "NUMBER_GREATER_THAN_EQ", "values": [{"userEnteredValue": "9"}]},
                        "format": {
                            "backgroundColor": COLOR_EMERALD_BG,
                            "textFormat": {"foregroundColor": COLOR_EMERALD_FG, "bold": True},
                        },
                    },
                },
                "index": 0,
            }
        },
        {
            "addConditionalFormatRule": {
                "rule": {
                    "ranges": [rng],
                    "booleanRule": {
                        "condition": {
                            "type": "NUMBER_BETWEEN",
                            "values": [{"userEnteredValue": "7.5"}, {"userEnteredValue": "8.99"}],
                        },
                        "format": {
                            "backgroundColor": COLOR_AMBER_BG,
                            "textFormat": {"foregroundColor": COLOR_AMBER_FG, "bold": True},
                        },
                    },
                },
                "index": 1,
            }
        },
        {
            "addConditionalFormatRule": {
                "rule": {
                    "ranges": [rng],
                    "booleanRule": {
                        "condition": {"type": "NUMBER_LESS", "values": [{"userEnteredValue": "7.5"}]},
                        "format": {
                            "backgroundColor": COLOR_CRIMSON_BG,
                            "textFormat": {"foregroundColor": COLOR_CRIMSON_FG, "bold": True},
                        },
                    },
                },
                "index": 2,
            }
        },
    ]


def _col_width_req(sheet_id: int, start_col: int, end_col: int, px: int) -> Dict[str, Any]:
    return {
        "updateDimensionProperties": {
            "range": {
                "sheetId": sheet_id,
                "dimension": "COLUMNS",
                "startIndex": start_col,
                "endIndex": end_col,
            },
            "properties": {"pixelSize": px},
            "fields": "pixelSize",
        }
    }


def _row_height_req(sheet_id: int, start_row: int, end_row: int, px: int) -> Dict[str, Any]:
    return {
        "updateDimensionProperties": {
            "range": {
                "sheetId": sheet_id,
                "dimension": "ROWS",
                "startIndex": start_row,
                "endIndex": end_row,
            },
            "properties": {"pixelSize": px},
            "fields": "pixelSize",
        }
    }


def build_formatting_requests() -> List[Dict[str, Any]]:
    """Build Sheets API raw-batch formatting requests for all 11 tabs."""
    reqs: List[Dict[str, Any]] = []

    standard_tables: List[Tuple[str, int, int, int]] = [
        # (tab_name, num_cols, end_row, score_col_idx)
        ("Trait_Intelligence", 9, TRAIT_ROWS, 5),
        ("Niche_Intelligence", 9, NICHE_ROWS, 5),
        ("Studio_Intelligence", 8, STUDIO_ROWS, 6),
        ("CALC_Performer_Power", 16, PERFORMER_ROWS, 15),
        ("Performer_Intelligence", 16, PERFORMER_ROWS, 12),
        ("Total_Rankings", 15, PERFORMER_ROWS, 12),
    ]

    for tab_name, num_cols, end_row, score_col in standard_tables:
        sid = SHEET_IDS[tab_name]
        reqs.append(_freeze_req(sid, frozen_rows=1, frozen_cols=1, hide_gridlines=False))
        reqs.append(_header_format_req(sid, num_cols, row_index=0, bg=COLOR_OBSIDIAN))
        reqs.append(_row_height_req(sid, 0, 1, 34))
        reqs.append(_col_width_req(sid, 0, 1, 185))
        reqs.append(_col_width_req(sid, 1, num_cols, 130))
        reqs.extend(_score_cf_rules(sid, 1, end_row, score_col))

    # Master_Leaderboard (Executive HUD, hidden gridlines)
    ml_id = SHEET_IDS["Master_Leaderboard"]
    reqs.append(_freeze_req(ml_id, frozen_rows=4, frozen_cols=2, hide_gridlines=True))
    reqs.append(_header_format_req(ml_id, 18, row_index=0, bg=COLOR_OBSIDIAN))
    reqs.append(_row_height_req(ml_id, 0, 1, 40))
    reqs.append(_row_height_req(ml_id, 1, 2, 32))
    reqs.append(_row_height_req(ml_id, 2, 3, 28))
    reqs.append(_row_height_req(ml_id, 3, 4, 30))
    reqs.append({
        "repeatCell": {
            "range": {"sheetId": ml_id, "startRowIndex": 1, "endRowIndex": 2, "startColumnIndex": 0, "endColumnIndex": 18},
            "cell": {
                "userEnteredFormat": {
                    "backgroundColor": COLOR_KPI_BG,
                    "textFormat": {"bold": True, "fontSize": 10},
                    "horizontalAlignment": "CENTER",
                    "verticalAlignment": "MIDDLE",
                }
            },
            "fields": "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)",
        }
    })
    reqs.append(_header_format_req(ml_id, 14, row_index=2, bg=COLOR_SLATE))
    reqs.append(_header_format_req(ml_id, 14, row_index=3, bg=COLOR_ACCENT))
    # Side panel headers P3:R4, P16:R17, P29:R30
    for sec_row, hdr_row in [(2, 3), (15, 16), (28, 29)]:
        reqs.append({
            "repeatCell": {
                "range": {"sheetId": ml_id, "startRowIndex": sec_row, "endRowIndex": sec_row + 1, "startColumnIndex": 15, "endColumnIndex": 18},
                "cell": {
                    "userEnteredFormat": {
                        "backgroundColor": COLOR_SLATE,
                        "textFormat": {"foregroundColor": COLOR_WHITE, "bold": True, "fontSize": 10},
                        "horizontalAlignment": "CENTER",
                    }
                },
                "fields": "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)",
            }
        })
        reqs.append({
            "repeatCell": {
                "range": {"sheetId": ml_id, "startRowIndex": hdr_row, "endRowIndex": hdr_row + 1, "startColumnIndex": 15, "endColumnIndex": 18},
                "cell": {
                    "userEnteredFormat": {
                        "backgroundColor": COLOR_ACCENT,
                        "textFormat": {"foregroundColor": COLOR_WHITE, "bold": True, "fontSize": 9},
                        "horizontalAlignment": "CENTER",
                    }
                },
                "fields": "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)",
            }
        })
    reqs.append(_col_width_req(ml_id, 0, 1, 65))
    reqs.append(_col_width_req(ml_id, 1, 2, 175))
    reqs.append(_col_width_req(ml_id, 2, 13, 105))
    reqs.append(_col_width_req(ml_id, 13, 14, 150))  # Power_Gauge sparkline
    reqs.append(_col_width_req(ml_id, 14, 15, 28))   # Spacer
    reqs.append(_col_width_req(ml_id, 15, 17, 155))
    reqs.append(_col_width_req(ml_id, 17, 18, 85))
    reqs.extend(_score_cf_rules(ml_id, 4, LEADERBOARD_ROWS, 2))

    # GROWTH_LEDGER
    gl_id = SHEET_IDS["GROWTH_LEDGER"]
    reqs.append(_freeze_req(gl_id, frozen_rows=2, frozen_cols=1, hide_gridlines=True))
    reqs.append(_header_format_req(gl_id, 7, row_index=0, bg=COLOR_OBSIDIAN))
    reqs.append(_header_format_req(gl_id, 7, row_index=1, bg=COLOR_SLATE))
    reqs.append(_header_format_req(gl_id, 7, row_index=11, bg=COLOR_OBSIDIAN))
    reqs.append(_header_format_req(gl_id, 7, row_index=12, bg=COLOR_SLATE))
    reqs.append(_col_width_req(gl_id, 0, 1, 220))
    reqs.append(_col_width_req(gl_id, 1, 5, 145))
    reqs.append(_col_width_req(gl_id, 5, 7, 290))

    # Brick Contract Tabs (MODULE_META, CONTEXT_IN, SIGNALS_OUT)
    for tab_name, num_cols in [("MODULE_META", 3), ("CONTEXT_IN", 6), ("SIGNALS_OUT", 10)]:
        sid = SHEET_IDS[tab_name]
        reqs.append(_freeze_req(sid, frozen_rows=1, frozen_cols=1, hide_gridlines=False))
        reqs.append(_header_format_req(sid, num_cols, row_index=0, bg=COLOR_OBSIDIAN))
        reqs.append(_row_height_req(sid, 0, 1, 32))
        reqs.append(_col_width_req(sid, 0, 1, 210))
        reqs.append(_col_width_req(sid, 1, num_cols, 170))

    return reqs


# ---------------------------------------------------------------------------
# gsheets CLI Execution Helpers
# ---------------------------------------------------------------------------

def _run_gsheets(args: List[str]) -> str:
    cmd = ["gsheets"] + args
    proc = subprocess.run(cmd, capture_output=True, text=True, check=False)
    if proc.returncode != 0:
        raise RuntimeError(f"gsheets command failed ({proc.returncode}): {' '.join(cmd)}\n{proc.stderr}\n{proc.stdout}")
    return proc.stdout


def apply_to_spreadsheet(spreadsheet_id: str) -> None:
    """Write all 11 tabs and executive formatting into Adult_Star_Tracker_Brick."""
    _guard_spreadsheet_id(spreadsheet_id)
    tabs = build_all_tab_definitions()
    issues = audit_all_tab_definitions(tabs)
    if issues:
        raise RuntimeError("Static formula audit failed:\n" + "\n".join(issues))

    batch_ops = [
        {"op": "write", "range": f"{tab_name}!A1", "data": rows}
        for tab_name, rows in tabs.items()
    ]
    with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False) as tf:
        json.dump(batch_ops, tf)
        batch_path = tf.name
    try:
        print(f"Writing {len(batch_ops)} downstream tabs to {spreadsheet_id}...")
        _run_gsheets(["mutate", "batch", spreadsheet_id, "-f", batch_path])
    finally:
        os.unlink(batch_path)

    fmt_reqs = {"requests": build_formatting_requests()}
    with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False) as tf:
        json.dump(fmt_reqs, tf)
        fmt_path = tf.name
    try:
        print(f"Applying {len(fmt_reqs['requests'])} executive formatting requests...")
        _run_gsheets(["mutate", "raw-batch", spreadsheet_id, "-f", fmt_path])
    finally:
        os.unlink(fmt_path)

    print("Successfully deployed all 11 downstream tabs and executive styling.")


def verify_spreadsheet(spreadsheet_id: str) -> Dict[str, Any]:
    """Read back evaluated values from all 11 downstream tabs + TAXONOMY_MATRIX!F to verify zero errors."""
    _guard_spreadsheet_id(spreadsheet_id)
    error_tokens = ("#REF!", "#NAME?", "#VALUE!", "#DIV/0!", "#ERROR!", "#N/A", "#NUM!")
    tabs_to_check = [
        ("TAXONOMY_MATRIX", "TAXONOMY_MATRIX!A1:H101"),
        ("Trait_Intelligence", "Trait_Intelligence!A1:I90"),
        ("Niche_Intelligence", "Niche_Intelligence!A1:I25"),
        ("Studio_Intelligence", "Studio_Intelligence!A1:H35"),
        ("CALC_Performer_Power", "CALC_Performer_Power!A1:P35"),
        ("Performer_Intelligence", "Performer_Intelligence!A1:P35"),
        ("Total_Rankings", "Total_Rankings!A1:O35"),
        ("Master_Leaderboard", "Master_Leaderboard!A1:R42"),
        ("GROWTH_LEDGER", "GROWTH_LEDGER!A1:G30"),
        ("MODULE_META", "MODULE_META!A1:C15"),
        ("CONTEXT_IN", "CONTEXT_IN!A1:F10"),
        ("SIGNALS_OUT", "SIGNALS_OUT!A1:J12"),
    ]
    report: Dict[str, Any] = {"spreadsheet_id": spreadsheet_id, "errors": [], "tabs": {}}
    for tab_name, rng in tabs_to_check:
        out = _run_gsheets(["readonly", "read", spreadsheet_id, rng, "--json"])
        # Strip any trailing non-JSON lines if present
        json_end = out.rfind("]")
        rows = json.loads(out[: json_end + 1]) if json_end != -1 else []
        non_empty = sum(1 for r in rows[1:] if any(str(c).strip() != "" for c in r))
        tab_errors = []
        for r_i, row in enumerate(rows, start=1):
            for c_i, val in enumerate(row, start=1):
                s = str(val)
                if any(tok in s for tok in error_tokens):
                    tab_errors.append(f"{tab_name}!R{r_i}C{c_i}={s}")
        report["errors"].extend(tab_errors)
        report["tabs"][tab_name] = {
            "populated_rows": non_empty,
            "error_count": len(tab_errors),
            "sample_row_2": rows[1] if len(rows) > 1 else [],
        }
    return report


def lookup_boobpedia_live(stage_name: str) -> Dict[str, Any]:
    """Fetch a performer's Boobpedia wikitext via MediaWiki API and parse a roster record."""
    url = build_boobpedia_query_url(stage_name)
    req = urllib.request.Request(url, headers={"User-Agent": "AdultStarTrackerStandalone/2.0"})
    with urllib.request.urlopen(req, timeout=15) as resp:
        payload = json.loads(resp.read().decode("utf-8"))
    pages = payload.get("query", {}).get("pages", {})
    for page_id, page in pages.items():
        if str(page_id) == "-1":
            raise LookupError(f"Performer '{stage_name}' not found on Boobpedia.")
        revs = page.get("revisions", [])
        wikitext = ""
        if revs:
            slots = revs[0].get("slots", {})
            wikitext = slots.get("main", {}).get("*", "") or revs[0].get("*", "")
        cats = [c.get("title", "") for c in page.get("categories", [])]
        return parse_boobpedia_page(page.get("title", stage_name), wikitext, categories=cats)
    raise LookupError(f"No Boobpedia pages returned for '{stage_name}'.")


def main() -> int:
    parser = argparse.ArgumentParser(description="Build, deploy, and verify Adult_Star_Tracker_Brick.")
    parser.add_argument("--dry-run", action="store_true", help="Generate and audit tab formulas without writing to Sheets.")
    parser.add_argument("--apply", action="store_true", help="Deploy all 11 tabs and formatting to Adult_Star_Tracker_Brick.")
    parser.add_argument("--emit-batch-files", type=str, default="", help="Write gsheets batch JSON & raw-batch formatting JSON into a directory.")
    parser.add_argument("--verify", action="store_true", help="Verify evaluated formulas across all tabs in Adult_Star_Tracker_Brick.")
    parser.add_argument("--export-manifest", type=str, default="", help="Optional path to export tab JSON manifest.")
    parser.add_argument("--lookup-boobpedia", type=str, default="", help="Query Boobpedia API for a performer name.")
    args = parser.parse_args()

    if args.lookup_boobpedia:
        rec = lookup_boobpedia_live(args.lookup_boobpedia)
        print(json.dumps(rec, indent=2))
        return 0

    if args.emit_batch_files:
        tabs = build_all_tab_definitions()
        issues = audit_all_tab_definitions(tabs)
        if issues:
            for item in issues[:20]:
                print(f"  [FAIL] {item}")
            return 1
        os.makedirs(args.emit_batch_files, exist_ok=True)
        batch_ops = [
            {"op": "write", "range": f"{tab_name}!A1", "data": rows}
            for tab_name, rows in tabs.items()
        ]
        batch_path = os.path.join(args.emit_batch_files, "ast_values_batch.json")
        fmt_path = os.path.join(args.emit_batch_files, "ast_format_raw_batch.json")
        with open(batch_path, "w", encoding="utf-8") as f:
            json.dump(batch_ops, f)
        with open(fmt_path, "w", encoding="utf-8") as f:
            json.dump({"requests": build_formatting_requests()}, f)
        print(f"Wrote {batch_path} ({len(batch_ops)} ops) and {fmt_path}")
        return 0

    if args.dry_run or args.export_manifest:
        tabs = build_all_tab_definitions()
        issues = audit_all_tab_definitions(tabs)
        print(f"Generated {len(tabs)} downstream tabs; static audit issues: {len(issues)}")
        for tab_name, rows in tabs.items():
            print(f"  - {tab_name}: {len(rows)} rows x {len(rows[0])} cols")
        if issues:
            for item in issues[:20]:
                print(f"  [FAIL] {item}")
            return 1
        if args.export_manifest:
            with open(args.export_manifest, "w", encoding="utf-8") as f:
                json.dump(tabs, f, indent=2)
            print(f"Exported tab manifest to {args.export_manifest}")

    if args.apply:
        apply_to_spreadsheet(TARGET_SPREADSHEET_ID)

    if args.verify:
        report = verify_spreadsheet(TARGET_SPREADSHEET_ID)
        print(json.dumps(report, indent=2))
        if report["errors"]:
            print(f"FAILED: {len(report['errors'])} formula errors detected.")
            return 1
        print("VERIFIED: 0 formula errors across all checked tabs.")

    if not any([args.dry_run, args.apply, args.verify, args.export_manifest, args.lookup_boobpedia]):
        parser.print_help()
    return 0


if __name__ == "__main__":
    sys.exit(main())
