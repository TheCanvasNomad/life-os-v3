# LifeOS-v3 Legacy Triage, Brick Standardization & Migration Plan

> **Status**: `DRAFT — AWAITING APPROVAL`  
> **Scope**: Read-only audit of all LifeOS Google Spreadsheets discovered in Google Drive (`cjack324@gmail.com`) and exported to `schemas/live_snapshots/*.json`. **No live Google Sheets have been modified.**  
> **Governing Laws**: [`.agents/skills/lifeos-architect/SKILL.md`](../.agents/skills/lifeos-architect/SKILL.md) (Laws 1–7) and [`schemas/workbook_registry.json`](../schemas/workbook_registry.json).

---

## Executive Summary

A full read-only inventory of Google Drive (100 spreadsheets + 27 Google Forms) and live formula sampling across 22 active workbooks (**3,395 formulas audited**) revealed:

| Category | Count | Architectural Action |
| :--- | :---: | :--- |
| **Core OS Hub / Master Bus** | 3 | Consolidate `LifeOS_Master_Bus`, `LifeOS_feed_hub`, and `XP Leveler` into unified Hub & `RULES_ENGINE`; repair 3 `#REF!` staging tabs and 31 `AWAITING_AUTH` signals. |
| **TIER 1 — Upgrade as Live Brick** | 21 | Standardize all 21 single-domain engines onto one canonical `CONTEXT_IN` + `SIGNALS_OUT` contract, enforce `IF(ISBLANK(...), "", ...)` blank-cell preservation, and externalize hard-coded weights into `RULES_ENGINE`. |
| **TIER 2 — Harvest Historical Data → Silos** | 11 | Extract historical habit, mood, spend, biometric, relationship, review, achievement, and static-dossier records into write-only `RAW_DATA_*` silos and `BASELINE_SNAPSHOT`, then retire source sheets. |
| **TIER 3 — Retire & Archive** | 9 (+ post-harvest Tier 2) | Move superseded monolithic dashboards, empty prototypes, and duplicate exports into a Drive `99_ARCHIVE_LIFEOS_LEGACY` folder with `[ARCHIVED]` prefixes. |

### Critical System-Wide Findings to Fix Upon Approval

1. **Three Incompatible `SIGNALS_OUT` Schemas (Law 4 Drift)**:
   - *Variant A (9-col, emoji tabs `📥 CONTEXT_IN` / `📤 SIGNALS_OUT`, missing `Glyph`)*: `ID_MBTI`, `ID_OCEAN`, `ID_ENNEAGRAM`, `ID_KABBALAH` — directly causing the 1-column left shift and 19 `#VALUE!` cells in `LifeOS_feed_hub -> SIGNAL_BUS`.
   - *Variant B (5-col, plain tabs `CONTEXT_IN` / `SIGNALS_OUT`)*: `ID_HD`, `ID_ZODIAC`, `ID_DOPPELGANGER`, `ID_DYNAMIC_STRESS`, `ID_FOUR_TEMPERAMENTS`, `ID_WEEKLY_MASLOW_PULSE`, `ID_DAILY_INTAKE`.
   - *Variant C (9-col, plain tabs with `Glyph`)*: `ID_TRAVEL` (closest to canonical Hub schema).
   - *Missing Contract (9 Tier 1 Bricks + `ID_XP_HUB`)*: `ID_PQ`, `ID_GRIT`, `ID_RIASEC`, `ID_16PF`, `ID_MASLOW`, `ID_CAREER_INTAKE`, `ID_BELIEF_TRACKER`, `ID_BODY_COUNT`, `ID_MOVIES`.
2. **Widespread Blank-Cell Preservation Violations (Law 3)**:
   - Out of **3,395** formulas sampled across Tier 1 Bricks, **1,500+ lack blank-cell guards** (`IF(ISBLANK(...), "", ...)`). Several emit false `0`s (`ID_HD`, `ID_GRIT`, `ID_MASLOW`, `ID_BELIEF_TRACKER`, `ID_MOVIES`, `ID_BODY_COUNT`), false penalties (`ID_KABBALAH` `-0.1` on blank grounding), or string placeholders (`"Awaiting Intake"`, `"0/7"`) that distort downstream averages and NotebookLM/Gemini synthesis.
3. **Hard-Coded Scoring Weights & Thresholds (Laws 1 & 5)**:
   - Critical domain weights (`ID_MASLOW` `0.65/0.35/0.88`, `ID_HD` `20/25/30/15/10`, `ID_KABBALAH` `0.15/-0.1/0.6`, `ID_16PF` `0.04`, `ID_DYNAMIC_STRESS` `1.1/0.25`, `ID_BODY_COUNT` `0.035/0.5`, `ID_ZODIAC` WIP ceiling `2`) are embedded inline inside formulas instead of driven by `RULES_ENGINE` lookup tables.
4. **Master Bus Staging Failures**:
   - `LifeOS_Master_Bus` has `#REF!` spill collisions in `A2` (`=FILTER(...)` colliding with `B2:E2`) on `SRC_XP_HUB`, `SRC_KABBALAH`, and `SRC_16PF`, breaking all 6 `Engine_Outputs` rows and forcing static fallbacks for XP and 16PF.

---

## Canonical Brick Exchange Standard (Target Contract for All Tier 1 Upgrades)

Every Tier 1 Brick will converge onto **plain ASCII tab names** (no leading emojis, preventing `IMPORTRANGE` escaping bugs) and identical column contracts:

### Canonical `CONTEXT_IN` Tab (Columns `A:F`, Row 1 Headers)
| Col | Header | Purpose |
| :---: | :--- | :--- |
| `A` | `Signal_Key` | Upstream key subscribed from `LifeOS_Master_Bus` (e.g., `VITAL_ENERGY`, `STRESS_ALLOSTATIC_LOAD`, `OPS_WIP_COUNT`). |
| `B` | `Live_Value` | Blank-safe inbound raw/formatted value (`=IF(ISBLANK(A2), "", IFERROR(..., ""))`). |
| `C` | `Normalized_Score_0_100` | Blank-safe `0–100` numeric score (`""` if unlogged/stale). |
| `D` | `State_Tag` | Canonical enum (`NOMINAL`, `ELEVATED`, `CRITICAL`, `LOCKED`, or `""`). |
| `E` | `Freshness_Status` | `FRESH` / `STALE` / `""` (never `"AWAITING_AUTH"` leaked into calculations). |
| `F` | `Hub_Auth_Trigger` | Single dedicated cell (`F2`) holding the lightweight `IMPORTRANGE(Master_Bus_ID, "Signal_Bus!A1")` auth anchor. |

### Canonical `SIGNALS_OUT` Tab (Columns `A:J`, Row 1 Headers)
| Col | Header | Purpose |
| :---: | :--- | :--- |
| `A` | `Signal_Key` | Canonical uppercase key (e.g., `TRAVEL_DAYS_YTD`, `MOVIES_AVG_RATING`). |
| `B` | `Source_Brick` | Canonical registry key (`ID_TRAVEL`, `ID_MOVIES`, etc.). |
| `C` | `Glyph` | Single display glyph for HUD/Markdown synthesis (`🌍`, `🎬`, `🧬`). |
| `D` | `Domain_Pillar` | Pillar + AQAL quadrant (e.g., `Pillar 5 / ITS`, `Pillar 0 / I`). |
| `E` | `Raw_Value` | Blank-safe raw metric (`IF(ISBLANK(...), "", ...)`). |
| `F` | `Normalized_Score_0_100` | Blank-safe `0–100` normalized score (`""` if unlogged). |
| `G` | `State_Tag` | Formula-resolved state from `RULES_ENGINE` thresholds (`""` if unlogged). |
| `H` | `Last_Updated` | ISO-8601 UTC timestamp of latest underlying log entry (`""` if never logged). |
| `I` | `TTL_Hours` | Numeric freshness TTL (`24`, `168`, `720`, `4320`, or `8760` for immutable natal). |
| `J` | `Notes` | Short provenance/context note for `AI_Synthesis_Report` (NotebookLM / Gemini). |

*(All `PRIMARY SPOKE MIRROR` blocks on `LifeOS_Master_Bus` `SRC_*` tabs will pull `SIGNALS_OUT!A1:J30` uniformly.)*

---

## Core OS Hub & Master Bus Infrastructure (3 Workbooks)

| Registry Key | Title & Spreadsheet ID | Current Role | Planned Upgrade |
| :--- | :--- | :--- | :--- |
| `LifeOS_Master_Bus` | **LifeOS_Master_Bus** (`1Ti15qi_hkJ27LJ4VopZR5w5Gbo-MQw4xx_APh8KY5iQ`) | 19-tab `SYMBIOSIS_HUD`, `Workbook_Directory`, `Signal_Bus`, `Engine_Outputs`, 13 `SRC_*` staging tabs. | Fix `A2` `#REF!` spill bug on `SRC_XP_HUB`, `SRC_KABBALAH`, `SRC_16PF`; add `SRC_TRAVEL`, `SRC_BELIEF`, `SRC_BODY_COUNT`, `SRC_MOVIES`; migrate all `RULES_ENGINE` weights here or to unified Hub. |
| `ID_FEED_HUB` | **LifeOS_feed_hub** (`1fSQ35RszC8xgC2hHKh3OHpkPl9NxdlYQUfmaUhuvS2U`) | 4-tab Core OS Hub (`SIGNAL_BUS`, `MODULE_REGISTRY`, `RULES_ENGINE`, `CHARACTER_SHEET`). | Fix column-shift bugs in `MODULE_REGISTRY` (rows 10–12) and `SIGNAL_BUS` (19 `#VALUE!` rows); authorize 31 `AWAITING_AUTH` signals; serve as canonical `RULES_ENGINE` + lean presentation Hub alongside `AQAL_VIEW`, `SWORD_VIEW`, `IMPORTS`, and `AI_Synthesis_Report`. |
| `ID_XP_HUB` | **XP Leveler** (`1_rVUsl98dIt_FO7qqVv1nC3r7jF1_Xg6Xo8QBNm2D4k`) | 15-tab RPG XP progression engine (`Player_HUD`, `XP_Ledger`, `Daily_Multiplier_Gate`, `Cross_Sheet_Bus`). | Expose canonical `CONTEXT_IN` / `SIGNALS_OUT` (`XP_CURRENT_LEVEL`, `XP_TOTAL`, `XP_GRAND_CYCLE_PCT`, `XP_DAILY_MULTIPLIER`); bind `Daily_Multiplier_Gate` weights to `RULES_ENGINE`; fix `SRC_XP_HUB` link in `LifeOS_Master_Bus`. |

---

## TIER 1: Upgrade as Live Bricks (21 Workbooks)

All 21 clean single-domain engines below remain active live Bricks and will be upgraded to conform to Laws 1–5.

| Key | Workbook & ID | Domain / Pillar | Current Contract Status | Target `CONTEXT_IN` Keys | Target `SIGNALS_OUT` Keys (10-Col Canonical) | Blank-Cell & Hard-Coded Weight Fixes Required |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `ID_MBTI` | **Myers-Briggs Test (Responses)** (`1uiQX7oyPcMAqovTBUkJBtbq7NSjWv45Lf0GQZza3TEw`) | Psychometrics / Pillar 1 (I) | Has `📥 CONTEXT_IN` & `📤 SIGNALS_OUT` *(emoji names, missing `Glyph` col)* | `STRESS_ALLOSTATIC_LOAD`, `OCEAN_OPENNESS`, `OCEAN_CONSCIENTIOUSNESS`, `VITAL_ENERGY` | `MBTI_TYPE_CODE`, `MBTI_E_PCT`, `MBTI_N_PCT`, `MBTI_T_PCT`, `MBTI_J_PCT`, `MBTI_TURB_PCT`, `MBTI_COHERENCE_INDEX`, `MBTI_SHADOW_RISK` | Rename tabs to plain `CONTEXT_IN`/`SIGNALS_OUT` + add `Glyph`; replace `"Awaiting Intake"`/`"Pending"` strings in `📊 MBTI_Dashboard!B2,F2` with `""`; move Grip risk threshold (`0.65`) to `RULES_ENGINE`. |
| `ID_OCEAN` | **Big-Five Personality Assessment (Responses)** (`12FwlHUeNWISYyiIVrASTDK6TlihFkfhVovIa4J2cObA`) | Psychometrics / Pillar 1 (I/IT) | Has `📥 CONTEXT_IN` & `📤 SIGNALS_OUT` *(emoji names, missing `Glyph` col)* | `STRESS_ALLOSTATIC_LOAD`, `MBTI_COHERENCE_INDEX`, `SLEEP_QUALITY` | `OCEAN_OPENNESS`, `OCEAN_CONSCIENTIOUSNESS`, `OCEAN_EXTRAVERSION`, `OCEAN_AGREEABLENESS`, `OCEAN_NEUROTICISM`, `OCEAN_PLASTICITY_BETA`, `OCEAN_STABILITY_ALPHA` | Rename tabs to plain `CONTEXT_IN`/`SIGNALS_OUT` + add `Glyph`; wrap unguarded `Executive_Dashboard!A4,E4` `INDEX/MATCH/MAX` calls in `IF(COUNTA(...)=0, "", ...)`; verify percentage scaling (`5140%`/`7430%` bug seen in `LifeOS_Master_Bus -> Signal_Bus` rows 5–6!). |
| `ID_ENNEAGRAM` | **Enneagram Assessment (Responses)** (`1nnu0Hw67g2OoAZiu0xmOALu3eFCgkKNL2M7gkv6-K3w`) | Psychometrics / Pillar 1 (I) | Has `📥 CONTEXT_IN` & `📤 SIGNALS_OUT` *(emoji names, missing `Glyph` col)* | `STRESS_ALLOSTATIC_LOAD`, `SHADOW_TAX_RATE`, `MBTI_SHADOW_RISK` | `ENN_CORE_TYPE`, `ENN_TRITYPE_CODE`, `ENN_TYPE_7_SCORE`, `ENN_TYPE_5_SCORE`, `ENN_INTEGRATION_INDEX`, `ENN_DISINTEGRATION_RISK` | Rename tabs to plain `CONTEXT_IN`/`SIGNALS_OUT` + add `Glyph`; guard 202 unguarded formulas across `Enneagram_Scoring_Engine` (e.g., `H9 =G9/25` -> `=IF(ISBLANK(G9), "", G9/RULES_ENGINE_MAX_SCORE)`). |
| `ID_PQ` | **Saboteur Assessment (Responses)** (`1NhqPJDFOp91qOp5Y9hPe0rIuqECKU_b08cZYXZAqxeE`) | Pillar 0 Shadow Self (I) | **Missing BOTH** | `STRESS_ALLOSTATIC_LOAD`, `DAILY_ENERGY`, `DOPPELGANGER_DOMINATION_INDEX` | `PQ_PRIMARY_SABOTEUR`, `PQ_AVOIDER_SCORE`, `PQ_HYPERRATIONAL_SCORE`, `PQ_JUDGE_SCORE`, `PQ_SAGE_INTERCEPT_STATUS` | Add `CONTEXT_IN` & `SIGNALS_OUT`; guard 42 unguarded cells in `PQ_Dashboard`; move `100` daily PQ reps target (`PQ_Dashboard!C8`), `7.5` alert threshold, and `*1.6` bar scale (`H13`) to `RULES_ENGINE`. |
| `ID_16PF` | **Life OS // Cattell 16PF (Responses)** (`1zOZVYFUZsQdRtPQzyK6izLLlxczi8vcDQTOSmh8yFho`) | Psychometrics / Pillar 1 (I) | **Missing BOTH** *(uses 6 ad-hoc `Import_*` tabs + `16PF_Nexus_Bridge`)* | `OCEAN_CONSCIENTIOUSNESS`, `PQ_AVOIDER_SCORE`, `HD_BIO_READINESS`, `ZODIAC_ALIGNMENT` | `PF16_BURNOUT_GUARD`, `PF16_INDEPENDENCE`, `PF16_ANXIETY`, `PF16_SELF_CONTROL`, `PF16_TOUGH_MINDEDNESS`, `PF16_EXTRAVERSION` | Consolidate 6 ad-hoc `Import_*` tabs into `CONTEXT_IN`; add `SIGNALS_OUT`; **HIGH PRIORITY Law 3 fix**: 0/188 sampled formulas guarded (`16PF_Profile!E4:E5` emit false `11` on blanks!); move `5.5` sten midpoint & `0.04` modifier weight (`K4:K`) to `RULES_ENGINE`. |
| `ID_MASLOW` | **Maslow's Hierarchy of Needs (Responses)** (`1M-F-p5IqYc0JMtJ-20bOGUvQgP1-63Ta3hryES_jHqg`) | Development / Foundation Engine (IT/ITS) | **Missing BOTH** *(uses `Maslow_Live_Telemetry`)* | `DAILY_ENERGY`, `ACUTE_STRESS`, `SLEEP_QUALITY`, `TRAVEL_ACTIVE_STATUS` | `MASLOW_PHYS_SCORE`, `MASLOW_SAFETY_SCORE`, `MASLOW_LOVE_SCORE`, `MASLOW_ESTEEM_SCORE`, `MASLOW_COGNITIVE_SCORE`, `MASLOW_AESTHETIC_SCORE`, `MASLOW_ACTUALIZATION_SCORE`, `MASLOW_TRANSCENDENCE_SCORE`, `MASLOW_EFFECTIVE_QUALITY`, `MASLOW_FRESHNESS_PCT` | Add `CONTEXT_IN` & `SIGNALS_OUT`; guard 60/62 unguarded formulas (replace `IFERROR(COUNTA(...), 0)` in `B12` with `IF(COUNTA(...)=0, "", ...)`); externalize **6 inline weights** in `Maslow_Live_Telemetry!B5` (`0.65`, `0.35`, `0.35`, `0.88`, `0.75`, `0.25`) into `RULES_ENGINE`; repair invalid chart-sheet tab names (`Water`, `Food`, `Sexual Intercourse`, `Sleep`) if referenced by scripts. |
| `ID_GRIT` | **Grit Score Assessment** (`1kCwx6wtYksmt92M3Izwe6oEIVS5uDv3kCLIzCBOJG-s`) | Psychometrics / Pillar 1 (IT) | **Missing BOTH** *(uses `OCEAN_Bridge`)* | `OCEAN_CONSCIENTIOUSNESS`, `OPS_WIP_COUNT`, `DOPPELGANGER_DOMINATION_INDEX` | `GRIT_OVERALL_SCORE`, `GRIT_PERSEVERANCE_EFFORT`, `GRIT_CONSISTENCY_INTEREST`, `GRIT_DRIFT_DELTA` | Add `CONTEXT_IN` & `SIGNALS_OUT`; fix `Timeline_Progression!N2:O2 =IF(A2="","",0)` emitting false `0`s for unlogged sub-metrics; move scale normalization `(x-1)/4` (`OCEAN_Bridge!E6:E7`) to `RULES_ENGINE`. |
| `ID_RIASEC` | **RAISEC Intake (Responses)** (`1RmJ9bDzm6Vs59EC1BV99lqHnYxgp-bchV589rQc6ybM`) | Psychometrics / Career Pillar 4–5 | **Missing BOTH** *(uses `LifeOS_Ledger_Sync`)* | `CAREER_CURRENCY_RATE`, `OPS_WIP_COUNT`, `OCEAN_OPENNESS` | `RIASEC_HOLLAND_CODE`, `RIASEC_FLOW_INDEX`, `RIASEC_TOP_1_SCORE`, `RIASEC_TOP_2_SCORE`, `RIASEC_TOP_3_SCORE`, `RIASEC_CONGRUENCE_SCORE` | Add `CONTEXT_IN` & `SIGNALS_OUT`; fix blank `SIG_RIASEC_FLOW` (`G16` currently empty in `LifeOS_Master_Bus`); wrap `RIASEC_Dashboard!D10:D15 (=C10/40)` and `F10:F15 (=REPT(...))` with `IF(ISBLANK(C10), "", ...)`; move max denominator `40` & bar scale `16` to `RULES_ENGINE`. |
| `ID_HD` | **Human Design OS** (`1yTiVyqmpz5FeZJSuN6_fmMfQZWq4HMcNCIKELBz8wp0`) | Pillar 6 Esoteric Self (I/IT) | Has `CONTEXT_IN` & `SIGNALS_OUT` *(5-col Variant B)* | `VITAL_ENERGY`, `STRESS_ALLOSTATIC_LOAD`, `ZODIAC_ALIGNMENT`, `MASLOW_PHYS_SCORE` | `HD_STRATEGY_COHERENCE`, `HD_AUTHORITY_CLARITY`, `HD_CONDITIONING_LOAD`, `HD_BIO_READINESS`, `HD_30D_ALIGNMENT_RATE` | Upgrade `SIGNALS_OUT` to 10-col canonical schema; guard `HD_DECISION_ENGINE!I7:I` with `IF(COUNTA(D7:H7)=0, "", ...)` (currently emits false `0` on blank rows); move **5 gate weights** (`20`, `25`, `30`, `10`, `15`, `10`) into `RULES_ENGINE`. |
| `ID_ZODIAC` | **Zodiac OS** (`1wQcAdR6ZxETOA1_nUmq1XYvPb9WvgSzmwcA4M0StH9M`) | Pillar 6 Esoteric Self + `OPS_GOVERNOR` | Has `CONTEXT_IN` & `SIGNALS_OUT` *(5-col Variant B)* | `DAILY_ENERGY`, `ACUTE_STRESS`, `MASLOW_PHYS_SCORE`, `HD_STRATEGY_COHERENCE` | `ZODIAC_ALIGNMENT`, `SOLAR_MOMENTUM`, `LUNAR_REGULATION`, `OPS_WIP_COUNT`, `OPS_GOVERNOR_STATUS` | Upgrade `SIGNALS_OUT` to 10-col canonical schema; guard 106/112 unguarded formulas; replace hard-coded `2` in `OPS_GOVERNOR!E25` with a lookup to `RULES_ENGINE` (`OPS_GOVERNOR_MAX_WIP = 2`) while preserving the strict max-2 WIP ceiling (Law 5). |
| `ID_KABBALAH` | **Kaballah Tree of Life OS Engine** (`19yYbAFijH5LH_PnQOQhpBNiYbmBbzqhSxZJEd4-tPw0`) | Pillar 6 Esoteric Self (Holistic) | Has `📥 CONTEXT_IN` & `📤 SIGNALS_OUT` *(emoji names, missing `Glyph` col)* | `DAILY_ENERGY`, `STRESS_ALLOSTATIC_LOAD`, `MASLOW_EFFECTIVE_QUALITY`, `SHADOW_TAX_RATE` | `KAB_EFFECTIVE_QUALITY`, `KAB_LIGHTNING_FLOW`, `KAB_PILLAR_EQUILIBRIUM`, `KAB_32_PATHS_FLOW`, `KAB_GROUNDING_INDEX`, `KAB_HOD_SPREAD`, `KAB_NET_XP_MULT` | Rename tabs to plain `CONTEXT_IN`/`SIGNALS_OUT` + add `Glyph`; **CRITICAL Law 3 fix**: `Kabbalah_Gamification_Bus!E4 =IF(D4<0.6,-0.1,0)` penalizes blank `D4` with `-0.1` -> wrap in `IF(ISBLANK(D4), "", ...)`; move `0.15` multiplier slope, `0.6` threshold, `-0.1` penalty, and `+200 XP` bonus (`E2, E4, G8`) to `RULES_ENGINE`. |
| `ID_TRAVEL` | **🌍 Travel_Tracker_Brick** (`11BgMqFD8djTpkqSLx9gf2YB1Tam_JZIg-CjZ_wvvKhc`) | Pillar 5 Experience & Legacy (ITS/IT) | Has `CONTEXT_IN` & `SIGNALS_OUT` *(9-col Variant C — closest to canonical)* | `DAILY_ENERGY`, `ACUTE_STRESS`, `MASLOW_PHYS_SCORE`, `OPS_WIP_COUNT` | `TRAVEL_ACTIVE_STATUS`, `TRAVEL_CONTINENTS_COUNT`, `TRAVEL_COUNTRIES_COUNT`, `TRAVEL_CITIES_COUNT`, `TRAVEL_DAYS_YTD`, `TRAVEL_REVIEWS_COUNT`, `TRAVEL_AVG_RATING` | Add `Notes` (Col `J`) to `SIGNALS_OUT` for 10-col parity; register `ID_TRAVEL` in `LifeOS_Master_Bus -> Workbook_Directory` & authorize `IMPORTRANGE` in `LifeOS_feed_hub`; guard `DASHBOARD` & `SIGNALS_OUT!F3` (`=IF(ISBLANK(DASHBOARD!B9), "", ...)`); move XP level divisor `100` (`DASHBOARD!L5`) and continent denominator `7` (`SIGNALS_OUT!F3`) to `RULES_ENGINE`. |
| `ID_BELIEF_TRACKER` | **Belief & Stance Tracker (Life OS)** (`1ZlhB5xNyI5I8MssGhsp5wydyDJQu29tHmry4iShc2z0`) | Pillar 1 / Epistemics (I/WE) | **Missing BOTH** | `OCEAN_OPENNESS`, `MBTI_COHERENCE_INDEX`, `STRESS_ALLOSTATIC_LOAD` | `BELIEF_ACTIVE_STANCES_COUNT`, `BELIEF_EVOLUTION_COUNT`, `BELIEF_CONVICTION_AVG`, `BELIEF_OPENNESS_DRIFT`, `BELIEF_LAST_REVIEW_DATE` | Add `CONTEXT_IN` & `SIGNALS_OUT`; register in `LifeOS_Master_Bus`; fix `Dashboard_Summary!B5,D5 =IFERROR(COUNTIF(...), 0)` to return `""` when no prompts exist; verify `Form A` / `Form B` enums match `schemas/`. |
| `ID_MOVIES` | **Movie Input Form (Responses)** (`1SIRiqfY1r62g8_XOkwe37d4KnZAr_-DBUx-r-wczkMY`) | Pillar 4/5 Cultural & Influence Telemetry | **Missing BOTH** | `DAILY_MOOD`, `TRAVEL_ACTIVE_STATUS`, `OCEAN_OPENNESS` | `MOVIES_LOGGED_COUNT`, `MOVIES_AVG_RATING`, `MOVIES_RERANK_DELTA_AVG`, `MOVIES_TOP_GENRE`, `MOVIES_TOP_ACTOR`, `MOVIES_TOP_DIRECTOR`, `MOVIES_CULTURAL_DIVERSITY_INDEX` | Add `CONTEXT_IN` & `SIGNALS_OUT`; register in `LifeOS_Master_Bus`; **HIGH PRIORITY Law 3 fix**: 0/20 sampled formulas guarded, `Total_Rankings!G2:H2` use `IFERROR(..., 0)` emitting false `0`s; move memory-decay curve constants & actor/director/genre power weights (`Total_Rankings`, `CALC_*_Power`) into `RULES_ENGINE`. |
| `ID_BODY_COUNT` | **Body Count 2.0** (`1aqYHU_bc-AqgREdvutE3VgG952_gd70yDKt4dMH6L1E`) | Pillar 3 Relationships & Connection | **Missing BOTH** | `STRESS_ALLOSTATIC_LOAD`, `MASLOW_LOVE_SCORE`, `TRAVEL_ACTIVE_STATUS`, `ENN_INTEGRATION_INDEX` | `REL_ENCOUNTER_COUNT`, `REL_AVG_OVERALL_SCORE`, `REL_AVG_VALUES_SCORE`, `REL_AVG_COMPATIBILITY_SCORE`, `REL_LOGISTICS_RISK_INDEX`, `REL_DOMESTIC_FOREIGN_RATIO` | Add `CONTEXT_IN` & `SIGNALS_OUT` (**strictly aggregate telemetry only — zero PII/names exposed to Master Bus or AI synthesis!**); register in `LifeOS_Master_Bus`; fix `MATH_Logistics_Aggregator!G2` `IFERROR(VLOOKUP(...), 0)` -> `""` and explicit `""` in `MATH_Age_Decay!E2`; externalize hard-coded age-decay slope `0.035` & floor `0.5` (`MATH_Age_Decay!E2`) and consolidate rubric weights with `RULES_ENGINE`. |
| `ID_CAREER_INTAKE` | **LifeOS Career and Experience Intake (Responses)** (`1iXxJVSv04MsRc_41p5bahCNRROXdugZ75iSivVy29GM`) | Pillar 5 Experience & Legacy (IT/ITS) | **Missing BOTH** | `RIASEC_HOLLAND_CODE`, `OPS_WIP_COUNT`, `GRIT_OVERALL_SCORE` | `CAREER_USCG_SEA_DAYS`, `CAREER_AB_SPECIAL_PCT`, `CAREER_CREDENTIAL_CURRENCY_RATE`, `CAREER_EXPIRING_CERTS_COUNT`, `CAREER_ACTIVE_MILESTONES` | Add `CONTEXT_IN` & `SIGNALS_OUT`; audit 56 unguarded formulas in `Education_Dashboard` / `Career_Dashboard`; move `180` USCG AB Special sea-day target to `RULES_ENGINE`. |
| `ID_DOPPELGANGER` | **Doppelganger_Brick** (`1rF8zWY_-HAUhxilX1SaPE0L_iSPEr_gQO6_ZtoWhyPg`) | Pillar 0 Shadow Self (I/ITS) | Has `CONTEXT_IN` & `SIGNALS_OUT` *(5-col Variant B)* | `INTAKE_DISCIPLINE_DELTA`, `INTAKE_VICE_DELTA`, `DAILY_ENERGY`, `STRESS_ALLOSTATIC_LOAD`, `HD_STRATEGY_COHERENCE` | `SHADOW_TAX_RATE`, `DOPPELGANGER_DOMINATION_INDEX`, `REDEMPTION_STREAK_DAYS` | Upgrade `SIGNALS_OUT` to 10-col canonical schema; **HIGH PRIORITY Law 3 fix**: 0/40 sampled formulas guarded (`SIGNALS_OUT!B4:C4` emit `0/7` when unlogged); move `7`-day redemption cap & Shadow Tax siphon rate to `RULES_ENGINE`. |
| `ID_DYNAMIC_STRESS` | **Dynamic_Stress_Brick** (`1RjW-hvUyTs85ThLgZeSfEDsWmKO_OHTF_PmuKl4faFo`) | Pillar 2 Vitality / Nervous System (IT/WE) | Has `CONTEXT_IN` & `SIGNALS_OUT` *(5-col Variant B)* | `DAILY_ENERGY`, `DAILY_MOOD`, `ACUTE_STRESS`, `MASLOW_PHYS_SCORE`, `HD_STRATEGY_COHERENCE`, `TEMPERAMENT_EQUILIBRIUM` | `STRESS_ALLOSTATIC_LOAD`, `SOMATIC_RECOVERY_CAPACITY`, `CONTEXT_ADJUSTED_STRAIN` | Upgrade `SIGNALS_OUT` to 10-col canonical schema; fix `SIGNALS_OUT!B8:B9 =IF(ISBLANK(C4), 1, ...)` returning fallback `1` instead of `""`; move `1.1` base & `0.25` strain slope to `RULES_ENGINE`. |
| `ID_FOUR_TEMPERAMENTS` | **Four_Temperaments_Brick** (`1VT2lwlz0wp7YDX2RR10HPrZWiCBCZhj1rInFFSXtF_M`) | Psychometrics / Pillar 1 (I/WE) | Has `CONTEXT_IN` & `SIGNALS_OUT` *(5-col Variant B)* | `DAILY_ENERGY`, `DAILY_MOOD`, `ACUTE_STRESS`, `ZODIAC_ALIGNMENT`, `HD_STRATEGY_COHERENCE` | `TEMPERAMENT_EQUILIBRIUM`, `CHOLERIC_DRIVE_INDEX`, `MELANCHOLIC_PRECISION_INDEX` | Upgrade `SIGNALS_OUT` to 10-col canonical schema; guard 36/45 unguarded formulas in `ADVISORY_MATRIX` & scoring tabs; authorize in `LifeOS_feed_hub`. |
| `ID_WEEKLY_MASLOW_PULSE` | **Weekly_Maslow_Pulse** (`1-GnXtI9ren5Bfw6KumDeNq7FUE5HYO0nSAevSzd5f40`) | Development / Weekly Cadence Spoke | Has `CONTEXT_IN` & `SIGNALS_OUT` *(5-col Variant B)* | `DAILY_ENERGY`, `ACUTE_STRESS` | `MASLOW_SURVIVAL`, `MASLOW_SAFETY`, `MASLOW_BELONGING`, `MASLOW_ESTEEM`, `MASLOW_ACTUALIZATION` | Upgrade `SIGNALS_OUT` to 10-col canonical schema; guard 16/26 unguarded formulas (`CONTEXT_IN` `IFERROR` strings); clarify cadence rollup into `ID_MASLOW` so there are zero competing Maslow baselines. |
| `ID_DAILY_INTAKE` | **DAILY INTAKE FORM (Responses)** (`16ohf5mBA9xrRsyv5sOYqY1s7gaOSpSOzK1rE1Gw6BNI`) | Write-Only Raw Silo + Daily Cadence Spoke | Has `CONTEXT_IN` & `SIGNALS_OUT` *(5-col Variant B)* | `MASLOW_SURVIVAL`, `MASLOW_SAFETY`, `ZODIAC_ALIGNMENT`, `HD_STRATEGY_COHERENCE` | `DAILY_ENERGY`, `DAILY_MOOD`, `ACUTE_STRESS`, `FLOW_COHERENCE`, `KABBALAH_BALANCE`, `INTAKE_DISCIPLINE_DELTA`, `INTAKE_VICE_DELTA` | Enforce Law 1 strict separation: keep raw form tab write-only (`RAW_DATA_DAILY_INTAKE`), upgrade `SIGNALS_OUT` to 10-col canonical schema, guard 27/41 unguarded cells, and authorize 5 `AWAITING_AUTH` signals in `LifeOS_feed_hub`. |

---

## TIER 2: Harvest Historical Data → Migrate to Write-Only Silos (11 Workbooks)

All 11 legacy trackers below hold irreplaceable historical records. Each will be harvested via an idempotent Apps Script / Python migration job into write-only `RAW_DATA_*` silos plus summary baselines in `BASELINE_SNAPSHOT`, validated by row count, and then moved to **TIER 3 (Archive)**.

### 1. `LifeOS - Master Log` (`1eaUGcN8AJEOr6Dl2zA4fipQNhif6cDBlKitTNveg8aA`) — 424 Tabs
- **Historical Value**: `Master Log` (3,772 ritual/habit rows), `Council Heatmap` (257 daily completion rows), `Council Weekly Digest` (21 weekly archetype summaries), `Tasks Map` (10 mappings), and ~420 daily `Captain's Log - YYYY-MM-DD` tabs.
- **Column Mapping**:

| Legacy Tab & Column | Destination Silo (`RAW_DATA_*`) | Destination Column | `BASELINE_SNAPSHOT` Metric |
| :--- | :--- | :--- | :--- |
| `Master Log!Date`, `Captain's Log` sheet date | `RAW_DATA_HABITS` | `Log_Date` (ISO `YYYY-MM-DD`) | `LEGACY_HABIT_START_DATE`, `LEGACY_HABIT_END_DATE` |
| `Master Log!Archetype`, `Captain's Log!Archetype` | `RAW_DATA_HABITS` | `Archetype_Domain` | `LEGACY_ARCHETYPE_COMPLETION_RATES` |
| `Captain's Log!Daily/Weekly Ritual`, `Tasks Map!TaskID` | `RAW_DATA_HABITS` | `Ritual_ID` / `Ritual_Name` | `LEGACY_TOP_CONSISTENT_RITUALS` |
| `Master Log!Completed`, `Captain's Log!Check` | `RAW_DATA_HABITS` | `Completed_Flag` (`TRUE`/`FALSE`/`""`) | `LEGACY_TOTAL_RITUAL_COMPLETIONS` (3,772 rows) |
| `Council Heatmap!Date`, `% Completed` | `BASELINE_SNAPSHOT` | `Historical_Daily_Completion_Pct` | `LEGACY_HABIT_MEAN_COMPLETION_PCT` (257 days) |
| `Council Weekly Digest!Date` + 7 Archetype cols | `BASELINE_SNAPSHOT` | `Historical_Council_Weekly_Balance` | `LEGACY_COUNCIL_WEEKLY_BASELINE` |

### 2. `LifeOS Database` (`1NLB5Fus8iSCeNKDHFuAAJK0uuPo8XFvNDvpRFJNCM5c`) — 1 Tab (`Daily Intake Form`)
- **Historical Value**: Earlier daily mood, location, Gunas (`Sattva`/`Rajas`/`Tamas`), Flow, Vice, Sleep Quality, and Estimated Spend logs.
- **Column Mapping**:

| Legacy Column (`Daily Intake Form`) | Destination Silo (`RAW_DATA_*`) | Destination Column | `BASELINE_SNAPSHOT` Metric |
| :--- | :--- | :--- | :--- |
| `Timestamp`, `Today's Date`, `Phase`, `Where are you?` | `RAW_DATA_DAILY_INTAKE` | `Timestamp`, `Log_Date`, `Day_Phase`, `Location_Context` | `LEGACY_DAILY_LOG_COUNT` |
| `Mood`, `How do you feel?`, `3. Log Type`, `Daily Afformation`, `80/20 Target` | `RAW_DATA_DAILY_INTAKE` | `Mood_Enum`, `Feeling_Note`, `Log_Type`, `Affirmation`, `Target_80_20` | `LEGACY_MOOD_BASELINE` |
| `Clarity (Sattva)`, `Drive (Rajas)`, `Resistance (Tamas)` | `RAW_DATA_DAILY_INTAKE` | `Guna_Sattva`, `Guna_Rajas`, `Guna_Tamas` | `LEGACY_GUNA_TRIAD_BASELINE` |
| `1. Activity Label`, `What dd you do?`, `2. Challenge Level`, `3. Skill Level`, `4. Environmental Pressure`, `5. OODA Loop Velocity` | `RAW_DATA_DAILY_INTAKE` | `Activity_Label`, `Activity_Detail`, `Flow_Challenge`, `Flow_Skill`, `Env_Pressure`, `OODA_Velocity` | `LEGACY_FLOW_COHERENCE_BASELINE` |
| `The Vice`, `Quantity`, `The Trigger`, `The Vibe Tag` | `RAW_DATA_SHADOW_VICE` | `Vice_Type`, `Vice_Qty`, `Trigger_Context`, `Vibe_Tag` | `LEGACY_VICE_FREQUENCY_BASELINE` |
| `2. Daily Polarity (The Tao)`, `Expansion (Mercy)`, `Contraction (Severity)`, `Harmony (Balance)`, `4. Primary Dukkha`, `5. Grit Check` | `RAW_DATA_DAILY_INTAKE` | `Tao_Polarity`, `Kab_Mercy`, `Kab_Severity`, `Kab_Balance`, `Primary_Dukkha`, `Grit_Check` | `LEGACY_KABBALAH_DAILY_BASELINE` |
| `Sleep Quality` | `RAW_DATA_BIOMETRICS_SLEEP` (`BIO_CORE`) | `Subjective_Sleep_Quality` | `LEGACY_SLEEP_QUALITY_MEAN` |
| `Estimated Spend ($)` | `RAW_DATA_FINANCE` (Pillar 2) | `Estimated_Daily_Spend_USD` | `LEGACY_DAILY_SPEND_MEAN_USD` |

### 3. `Health Data Export` (`18GclIpYdyk3lBpWRzgXQsy8p_t8NLHX-jH9o2GivB0I`) — 6 Tabs
- **Historical Value**: Wearable/Health Connect biometric history (`Activity`, `Sleep`, `Vitals`; `Body Measurements` and `Nutrition` currently empty).
- **Column Mapping**:

| Legacy Tab & Columns | Destination Silo (`BIO_CORE`) | Destination Columns | `BASELINE_SNAPSHOT` Metric |
| :--- | :--- | :--- | :--- |
| `Activity`: `Date`, `Source(s)`, `Timezone`, `Steps`, `Distance (m)`, `Elevation (m)`, `Floors climbed`, `Total/Active Calories`, `Power`, `Speed`, `VO2 max`, `Exercise Name/Duration/Calories/Distance` | `RAW_DATA_BIOMETRICS_ACTIVITY` | 1:1 normalized metric columns (preserving blanks as `""`, zero false `0`s) | `BIO_BASELINE_DAILY_STEPS`, `BIO_BASELINE_VO2_MAX`, `BIO_BASELINE_ACTIVE_KCAL` |
| `Sleep`: `Date`, `Source(s)`, `Timezone`, `Start Time`, `End Time`, `Light/Deep/REM/Awake (min)` | `RAW_DATA_BIOMETRICS_SLEEP` | `Log_Date`, `Source`, `TZ`, `Sleep_Start`, `Sleep_End`, `Light_Min`, `Deep_Min`, `REM_Min`, `Awake_Min` | `BIO_BASELINE_SLEEP_DURATION_MIN`, `BIO_BASELINE_DEEP_REM_PCT` |
| `Vitals`: `Date`, `Source(s)`, `Timezone`, `Heart rate min/max/avg`, `HRV min/max/avg`, `SpO2 min/max/avg`, `Respiratory rate`, `Resting HR`, `BP`, `Blood glucose`, `Body temp` | `RAW_DATA_BIOMETRICS_VITALS` | 1:1 normalized vital columns (blank-safe) | `BIO_BASELINE_RHR_BPM`, `BIO_BASELINE_HRV_MS`, `BIO_BASELINE_SPO2_PCT` |

### 4. `Achievements (Responses)` (`1oPwOgvsk49CJ7x9pmYIf0Ex2EBHlrKVpb7SO9Ja4-JQ`) — 27 Tabs
- **Historical Value**: Historical milestone/achievement unlocks, category weights, and quadrant mappings.
- **Column Mapping**:
  - `Answers` (`Timestamp`, `What would you like to do?`, `Select Category`, `Select Achievement`) -> `RAW_DATA_ACHIEVEMENTS` (`Timestamp`, `Action_Type`, `Category`, `Achievement_Name`) feeding `ID_XP_HUB`.
  - `Master List` (`Static Achievements`, `Status`) -> `BASELINE_SNAPSHOT` (`LEGACY_UNLOCKED_ACHIEVEMENTS_COUNT`).
  - `Categories` (`Sheet / Category`, `List Type`, `Primary Quadrant`, `Avg Weight`, `Weight Range`) -> Seed rows into Core OS Hub `RULES_ENGINE` XP category table (eliminating scattered weights!).

### 5. `🎮 CHARACTER CREATION: THE STATIC DOSSIER (Responses)` (`13fowIl8CIw9KgMp8OC4N5L-AwvAqANM8jNaUnujLo1E`) — 2 Tabs
- **Historical Value**: Immutable natal/biographical facts, values, freedom definition, passive income target, and bucket list.
- **Column Mapping**:
  - Birth/Natal cols (`Sun/Moon/Rising Sign`, `Human Design Type/Profile/Authority`, `Life Path Number`, `Birth Date/Time/Location`) -> `BASELINE_SNAPSHOT` (`STATIC_NATAL_IMPRINT`) + read-only `CONTEXT_IN` seed for `ID_HD` & `ID_ZODIAC`.
  - Biological baseline cols (`Blood Type`, `Height`, `Somatotype`, `BMR`) -> `BASELINE_SNAPSHOT` (`BIO_STATIC_PROFILE`) for `BIO_CORE`.
  - North Star & Goals cols (`Definition of Freedom`, `The "Big Why"`, `Top 3 Core Values`, `Moral Alignment`, `End-Game Location`, `Dream Home Focal Point`, `Passive Income Target`, `Life Goal Bucket List`) -> `RAW_DATA_GOALS` + `BASELINE_SNAPSHOT` (`NORTH_STAR_CHARTER`) for `CHARACTER_SHEET` & `AI_Synthesis_Report`.
  - Legacy Psychometric snapshots (`MBTI`, `Enneagram`, `CliftonStrengths Top 5`, `DISC`, `Attachment Style`, `Cognitive Bias Trigger`) -> `BASELINE_SNAPSHOT` (`STATIC_PSYCH_EXTRAS` — notably preserving CliftonStrengths, DISC, and Attachment Style which have no dedicated live Brick yet).

### 6. `Chris Jack's Google Maps Reviews` (`1Se9co4g0r9y9hdPOW1nnUWIsu-JCYfZyxm6_pMAzWsE`) — 1 Tab
- **Column Mapping**: `Table 1` (`Place Name`, `Category`, `Rating`, `Review Date`, `Review Summary`) -> Deduplicate & backfill into `ID_TRAVEL` (`REVIEWS_RAW` / `REVIEWS_ARCHIVE`) -> `BASELINE_SNAPSHOT` (`LEGACY_MAPS_REVIEWS_COUNT`).

### 7. `The Canvas Nomad - Master Atlas` (`1wt3pZaiwh76urztIVJwXB8Ye8EtfAQfuJG08M7iOn6s`) — 4 Tabs
- **Column Mapping**: `Master Ledger` (`Publication Date`, `Title`, `Summary`, `Primary Topic`, `Secondary Topic`) & `Taxonomy Map` (`Reading List`, `Goal & Semantic Alignment`, `Total Blogs`) -> `RAW_DATA_CREATIVE_LEGACY` (Pillar 5) + `BASELINE_SNAPSHOT` (`LEGACY_PUBLISHED_WORKS_COUNT`).

### 8. `MCU Movie Ratings (Responses)` (`1fQqLfm2zhSycY1oIK8c7nxYrB8e7WpohnnOjXLBX0Oo`) — 22 Tabs
- **Column Mapping**: `List` (`Ranking`, `Movie Title`, `My Score`, `Rating out of 5`) & `Answers` (`Timestamp`, movie rating cols) -> Diff against `ID_MOVIES` (`Initial Reviews` / `Full Database`), migrate any missing MCU titles to `ID_MOVIES` raw intake, and record `LEGACY_MCU_BACKFILL_COUNT` in `BASELINE_SNAPSHOT`.

### 9–10. `Love Life Revisited (Responses)` (`1Dx2Z5CAHVHyS7TzVTF349vtcimq6Ah6TswXaLJPB5pk`) & `Body Count (Responses)` (`1YgvP_hRYOkyvatEx8EwjWvUOg-uW5c-B3sI80bk_qBs`)
- **Column Mapping**: Both sheets appear partially or fully mirrored inside `ID_BODY_COUNT` (`Love_Life_Revisited_Data`, `Body_Count_Legacy_Data`, `LEGACY_NORMALIZED`). Run a read-only row-count & key parity check; migrate any unmigrated historical rows into `ID_BODY_COUNT` / `RAW_DATA_RELATIONSHIPS` and record `LEGACY_REL_PARITY_VERIFIED` in `BASELINE_SNAPSHOT`, then retire both to TIER 3.

### 11. Financial & Blockchain Ledger Exports (Drive CSVs / Spreadsheets)
- **Files**: `sep-2026-statement.csv` (`1ke7kTeNdGUqTjxrUbWRQwjN-G8XS3ZCP`) + 7 Ethereum/PulseChain block explorer sheets (items 63–69 in Drive).
- **Mapping**: Hold untouched until the Pillar 2 **Finance Brick** (`RAW_DATA_FINANCE`) is initialized; then map transaction date, asset, amount, and wallet/account into `RAW_DATA_FINANCE` and net-worth checkpoints into `BASELINE_SNAPSHOT`.

---

## TIER 3: Retire & Archive (9 Immediate + Post-Harvest Tier 2)

After confirming zero active `IMPORTRANGE` dependencies in `LifeOS_Master_Bus` and `LifeOS_feed_hub`, prefix each file with `[ARCHIVED]` and move it into a dedicated Drive archive folder (`99_ARCHIVE_LIFEOS_LEGACY`) — **never permanently delete raw historical data**.

| Spreadsheet Title | Spreadsheet ID | Reason for Retirement | Pre-Archive Safety Check |
| :--- | :--- | :--- | :--- |
| **Life OS - Factory Settings** | `1e9uy3NfwOCfWLcv-STR53FFdEPfzVZNABwA_yMSQCEc` | 39-tab superseded v1/v2 monolith (`Stats_Profile`, `Calc_Accumulator_Tab`, `Build_Out_Loadout`, `Command_Center`). | Verify `Stats_Profile` constants are captured in `BASELINE_SNAPSHOT` first. |
| **[ARCHIVED] Kabbalah Tree of Life OS (Responses)** | `1qJwuFtFXB69btim6JnhFgk6N_klbkHQb5atS9loBp8A` | Already archived; fully superseded by `ID_KABBALAH` (`19yYbAFijH5LH_PnQOQhpBNiYbmBbzqhSxZJEd4-tPw0`). | Confirm `Longitudinal_Analytics` rows exist in `ID_KABBALAH`. |
| **Life OS // Zodiac & Natal Telemetry** | `1kSDRGreZXcQkvh1MFfEL5wt2u618w7_-XgvL2xi5_0E` | Early 5-tab prototype superseded by `ID_ZODIAC` (`1wQcAdR6ZxETOA1_nUmq1XYvPb9WvgSzmwcA4M0StH9M`). | Confirm `Aries_Archetype_Dossier` / natal coordinates exist in `ID_ZODIAC`. |
| **Daily_State_Pulse** | `1fchASnJwIMEVavAB-EXRJnmHlUlRkHki42LVbd3g-1g` | Completely empty `Sheet1` (`0` populated rows); superseded by `ID_DAILY_INTAKE`. | Safe to archive immediately. |
| **Body Count LM** | `1PtpG6_Ym-s6ZPj6smkBVByFbIBnZWdURjEZSn4NZXxg` | Legacy NotebookLM flat export duplicate of `ID_BODY_COUNT`. | Safe to archive immediately (superseded by Law 5 `AI_Synthesis_Report`). |
| **Extrovert vs. Introvert (Responses)** | `1A-v1gdwFIvCPGcJPAGfZ7jfwQGSb0DdSJuECGd4I6D8` | 1-entry prototype superseded by `ID_MBTI` and `ID_OCEAN`. | Safe to archive immediately. |
| **Sky Weather OS** | `1RJJ7Hn2D1GmX1FGbfEx5962io6Dhs9YA6CfwSudG1Yk` | 3-tab transit lookup (`LIVE_SKY_HUB`, `RAVE_MANDALA_LOOKUP`, `SEASONAL_INGRESS_CALENDAR`) superseded by `ID_ZODIAC` + `ID_HD`. | Verify `RAVE_MANDALA_LOOKUP` & `SEASONAL_INGRESS_CALENDAR` are copied into `ID_HD` / `ID_ZODIAC` reference tabs before archiving. |
| **Duplicate Legacy Exports & Drafts** | `Body Count 2.0.xlsx/.csv/.tsv` (8 files), `Untitled spreadsheet` (4 files), duplicate `Articles and Essays` / `Blog Posts` copies | Point-in-time file exports and blank scratch spreadsheets cluttering Drive discovery. | Verify `Untitled spreadsheet` tabs are blank before archiving. |
| **Post-Harvest Tier 2 Workbooks** | All 11 Tier 2 spreadsheets above | Retire **only after** silo row-count parity and `BASELINE_SNAPSHOT` checksums pass 100%. | Archive with `[ARCHIVED_MIGRATED]` prefix. |

### Out-of-Scope / Non-Telemetry Drive Spreadsheets (Do Not Touch)
Keep cleanly separated from LifeOS telemetry ingestion: `Zenith` (18-tab creative fiction worldbuilding), `TheCanvasNomad` (brand platform directory), `T.U.F.F. League Database` (shared), `CRM template by Teamopipe` (shared), `Etherscan APIs Integration` (shared), academic transcripts & maritime training quizzes (`Piney Point Grades`, `RFPNW Practice Quizzes`, `Basic Training`, `Student Transcript*`), and `Marvel Snap` tracker.

---

## Tier 1 Formula Audit Summary (Law 3 & Law 5 Compliance Matrix)

| Brick | Sampled Formulas | Blank-Guarded | Unguarded | Priority Law 3 (`ISBLANK`) Issue | Priority Hard-Coded Weights → `RULES_ENGINE` |
| :--- | :---: | :---: | :---: | :--- | :--- |
| `ID_16PF` | 188 | 0 | **188** | `16PF_Profile!E4:E5` emit false `11` on empty inputs | Sten midpoint `5.5` & modifier slope `0.04` (`K4:K`) |
| `ID_MOVIES` | 20 | 0 | **20** | `Total_Rankings!G2:H2` `IFERROR(..., 0)` emits false `0` | Memory-decay constants & actor/director/genre power weights |
| `ID_DOPPELGANGER` | 40 | 0 | **40** | `SIGNALS_OUT!B4` emits `0/7` when unlogged | `7`-day streak cap & Shadow Tax siphon curve |
| `ID_MASLOW` | 62 | 2 | **60** | `Maslow_Live_Telemetry!B12` `IFERROR(..., 0)` | 6 weights in `B5`: `0.65`, `0.35`, `0.35`, `0.88`, `0.75`, `0.25` |
| `ID_KABBALAH` | 160 | 13 | **147** | `Kabbalah_Gamification_Bus!E4` emits false `-0.1` on blank | `0.15` XP slope, `0.6` threshold, `-0.1` penalty, `+200 XP` |
| `ID_HD` | 130 | 12 | **118** | `HD_DECISION_ENGINE!I7:I` emits false `0` on blank rows | Gate weights `20`, `25`, `30`, `10`, `15`, `10` |
| `ID_ZODIAC` | 112 | 6 | **106** | Unguarded `CONTEXT_IN` & `OPS_GOVERNOR` rows | Inline WIP ceiling `2` (`OPS_GOVERNOR!E25`) |
| `ID_MBTI` | 224 | 40 | **184** | `"Awaiting Intake"` / `"Pending"` text in KPI cells | Turbulent Grip threshold `0.65` |
| `ID_OCEAN` | 102 | 24 | **78** | Unguarded `INDEX/MATCH/MAX` in `Executive_Dashboard!A4,E4` | Scale divisors `/10` + fix `5140%`/`7430%` scaling in Master Bus |
| `ID_ENNEAGRAM` | 301 | 99 | **202** | Unguarded divisions (`Enneagram_Scoring_Engine!H9:H`) | Max scale denominator `25` |
| `ID_PQ` | 57 | 15 | **42** | Mixed numeric/text fallbacks in `PQ_Dashboard` | `100` reps/day target, `7.5` alert threshold, `*1.6` bar scale |
| `ID_TRAVEL` | 77 | 9 | **68** | Unguarded `SIGNALS_OUT!F3` division | XP divisor `100` (`DASHBOARD!L5`), `/7` continents |
| `ID_DYNAMIC_STRESS` | 48 | 14 | **34** | `SIGNALS_OUT!B8:B9` returns fallback `1` on blank `C4` | Base `1.1` & strain slope `0.25` |
| `ID_BODY_COUNT` | 28 | 9 | **19** | `MATH_Logistics_Aggregator!G2` `IFERROR(..., 0)` | Age-decay floor `0.5` & slope `0.035` (`MATH_Age_Decay!E2`) |
| `ID_GRIT` | 849 | 773 | **76** | `Timeline_Progression!N2:O2` returns `0` on unlogged cols | Scale normalization `(x-1)/4` |
| `ID_RIASEC` | 400 | 362 | **38** | Unguarded `C10/40` & `REPT(...)` on `RIASEC_Dashboard` | Denominator `40` & bar width `16` |
| `ID_BELIEF_TRACKER` | 850 | 792 | **58** | `Dashboard_Summary!B5,D5` `IFERROR(..., 0)` | Review cadence thresholds |
| `ID_CAREER_INTAKE` | 188 | 132 | **56** | Unguarded dashboard filter metrics | USCG AB Special `180` sea-day target |
| `ID_FOUR_TEMPERAMENTS` | 45 | 9 | **36** | Unguarded `ADVISORY_MATRIX` lookups | Quadrant weights (verify against `RULES_ENGINE`) |
| `ID_WEEKLY_MASLOW_PULSE` | 26 | 10 | **16** | `CONTEXT_IN` `IFERROR` error text | Cadence rollup weights into `ID_MASLOW` |
| `ID_DAILY_INTAKE` | 41 | 14 | **27** | `CONTEXT_IN` `IFERROR` error text | Discipline/Vice delta weights into `ID_DOPPELGANGER` |

---

## Phased Execution Order (Respecting `OPS_GOVERNOR` Max-2 Active Initiatives)

To stay strictly aligned with **Law 5 (`OPS_GOVERNOR` WIP Ceiling: max 2 active initiatives)**, execution is sequenced into 4 gated waves — **no wave begins until you approve this plan**:

1. **Wave 1 (Hub Repair & `RULES_ENGINE` Foundation)** — *Initiative 1*:
   - Fix `A2` `#REF!` spill bug on `LifeOS_Master_Bus` (`SRC_XP_HUB`, `SRC_KABBALAH`, `SRC_16PF`).
   - Fix column shifts in `LifeOS_feed_hub` (`MODULE_REGISTRY` rows 10–12 & `SIGNAL_BUS` 19 `#VALUE!` rows).
   - Stand up centralized `RULES_ENGINE` lookup tables for all extracted weights & thresholds.
2. **Wave 2 (Tier 1 Brick Contract Standardization — Batch A & B)** — *Initiative 2*:
   - Batch A: Normalize `CONTEXT_IN` / `SIGNALS_OUT` to the 10-col canonical plain-ASCII schema on the 11 bricks that already have contracts (`ID_MBTI`, `ID_OCEAN`, `ID_ENNEAGRAM`, `ID_KABBALAH`, `ID_HD`, `ID_ZODIAC`, `ID_TRAVEL`, `ID_DOPPELGANGER`, `ID_DYNAMIC_STRESS`, `ID_FOUR_TEMPERAMENTS`, `ID_WEEKLY_MASLOW_PULSE`, `ID_DAILY_INTAKE`) + patch Law 3 blank-cell violations.
   - Batch B: Add canonical `CONTEXT_IN` / `SIGNALS_OUT` + blank-cell guards + `RULES_ENGINE` links to the 10 remaining bricks (`ID_PQ`, `ID_16PF`, `ID_MASLOW`, `ID_GRIT`, `ID_RIASEC`, `ID_CAREER_INTAKE`, `ID_BELIEF_TRACKER`, `ID_BODY_COUNT`, `ID_MOVIES`, `ID_XP_HUB`) and wire new `SRC_*` staging tabs in `LifeOS_Master_Bus`.
3. **Wave 3 (Tier 2 Historical Data Harvest)**:
   - Run automated read-only extract -> validate -> append migration scripts into `RAW_DATA_HABITS`, `RAW_DATA_DAILY_INTAKE`, `RAW_DATA_BIOMETRICS_*` (`BIO_CORE`), `RAW_DATA_ACHIEVEMENTS`, `RAW_DATA_CREATIVE_LEGACY`, `ID_TRAVEL`, `ID_MOVIES`, and `BASELINE_SNAPSHOT`.
4. **Wave 4 (Tier 3 Archival & Verification)**:
   - Verify row counts, zero `AWAITING_AUTH` / `#REF!` / `#VALUE!` errors across `LifeOS_Master_Bus` & `LifeOS_feed_hub`, refresh `schemas/live_snapshots/*.json`, and move all Tier 3 & migrated Tier 2 files into `99_ARCHIVE_LIFEOS_LEGACY`.
