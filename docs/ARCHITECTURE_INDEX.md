# LifeOS-v3 Live Architecture Index

> **Purpose**: Single-pane operational map reconciling every subsystem specified in [`blueprints/LIFEOS_V3_MASTER_SPEC.md`](../blueprints/LIFEOS_V3_MASTER_SPEC.md) against live Google Sheets in [`schemas/workbook_registry.json`](../schemas/workbook_registry.json), `LifeOS_feed_hub` (`1fSQ35RszC8xgC2hHKh3OHpkPl9NxdlYQUfmaUhuvS2U`), and `LifeOS_Master_Bus` (`1Ti15qi_hkJ27LJ4VopZR5w5Gbo-MQw4xx_APh8KY5iQ`).  
> **Last Verified**: `2026-11-23` (26 bound workbooks, 26 live tab snapshots in `schemas/live_snapshots/`).

### Status Legend
- `🟢 ONLINE & WIRED` — Live workbook/tab exists, bound in `workbook_registry.json`, and actively publishing live telemetry.
- `🟡 ONLINE — NEEDS WIRING / STANDARDIZATION` — Live workbook exists and is bound, but needs canonical 10-column `SIGNALS_OUT` / 6-column `CONTEXT_IN`, `IMPORTRANGE` auth, `#REF!` / column-shift repair, or `RULES_ENGINE` weight extraction.
- `🟠 PARTIAL / SPLIT` — Implemented partially across `LifeOS_feed_hub`, `LifeOS_Master_Bus`, or standalone Bricks; needs consolidation.
- `🔴 NOT BUILT` — Specified in `LIFEOS_V3_MASTER_SPEC.md` with no live workbook/tab yet; queued for creation.

---

## 1. Core OS Hub Subsystems (Layer 3)

Currently split across two Hub workbooks (`LifeOS_feed_hub` + `LifeOS_Master_Bus`) and `ID_XP_HUB` (`XP Leveler`).

| Master Spec Subsystem | Status | Live Location & Tab(s) | Gap / Next Action |
| :--- | :---: | :--- | :--- |
| **`IMPORTS` / `SIGNAL_BUS`** | 🟢 ONLINE — AWAITING 1-CLICK AUTH | `ID_FEED_HUB` (`SIGNAL_BUS` 63 signals + `MODULE_REGISTRY` 24 workbooks w/ `J3:J25` one-click auth anchors) + `LifeOS_Master_Bus` (`Workbook_Directory` 18 workbooks, `Signal_Bus`, `Engine_Outputs`, 13 `SRC_*` tabs) | Fixed `SRC_XP_HUB`/`SRC_KABBALAH`/`SRC_16PF` `#REF!` spill bugs, fixed all 19 shifted `SIGNAL_BUS` rows & 3 shifted `MODULE_REGISTRY` rows, fixed `TRAVEL_*` freshness formulas, fixed 3 static `Signal_Bus` rows, and added `ID_TRAVEL`, `ID_BELIEF_TRACKER`, `ID_BODY_COUNT`, `ID_MOVIES`, `ID_FEED_HUB`. Complete browser clicks in [`docs/HUB_AUTH_CHECKLIST.md`](./HUB_AUTH_CHECKLIST.md). |
| **`RULES_ENGINE`** | 🟢 ONLINE & WIRED | `ID_FEED_HUB` (`RULES_ENGINE` Sections 1–8: Maslow XP, Tesla 3-6-9, Fibonacci, 3-Tier Stat Stacking, blank-safe `EFFECT_CONDITIONS`, `AQAL_QUADRANT_MAP`, `AQAL_BALANCE_THRESHOLDS`, `AQAL_DIRECTIVE_MATRIX`) | Fixed `G42` `#ERROR!` & false-active blank condition bugs; expand with remaining Master Spec lexicon tables (`BLOOM_TAXONOMY_MODIFIERS`, `ICK_INDICATOR_LEXICON`, `STATUS_GAME_LEXICON`) in Wave 2. |
| **`CHARACTER_SHEET`** | 🟢 ONLINE & WIRED | `ID_FEED_HUB` (`CHARACTER_SHEET` w/ live AQAL & `OPS_GOVERNOR` panel + dynamic `QUERY` loadout from `MODULE_REGISTRY`) + `LifeOS_Master_Bus` (`SYMBIOSIS_HUD` Law 8 upgraded) + `ID_XP_HUB` (`Player_HUD`) | Zero static streak/loadout cells remaining; lights up completely once `MODULE_REGISTRY!J3:J25` auth clicks finish. |
| **`AQAL_VIEW`** | 🟢 ONLINE & WIRED | `ID_FEED_HUB` (`AQAL_VIEW` 2×2 Meta-Balancing Engine + `RULES_ENGINE` Sections 6–8 + 6 `AQAL_*` rows in `SIGNAL_BUS`) | 100% dynamic formula-first Law 8 HUD live; click **Allow access** on `MODULE_REGISTRY!J3:J25` to populate all 4 quadrants live. |
| **`SWORD_VIEW`** | 🟢 ONLINE & WIRED | `ID_FEED_HUB` (`SWORD_VIEW` — 7-part Archetypal Sword with `SPARKLINE` gauges, Mastery badges & dynamic Forge Focus) | Built & verified live (`0` formula errors, Law 8 dark-obsidian HUD, `hideGridlines: true`). |
| **`MASLOW_ENGINE`** | 🟢 ONLINE & WIRED | `ID_FEED_HUB` (`MASLOW_ENGINE` — 5-tier weighted Sovereignty Score `30/25/20/15/10%`, `90%` Mastery Gate & `ID_MASLOW` parity check) + `ID_MASLOW` + `ID_WEEKLY_MASLOW_PULSE` | Built & verified live (`0` formula errors, Law 8 dark-obsidian HUD, `hideGridlines: true`). |
| **`LEXICON_ENGINE`** | 🔴 NOT BUILT | *Not yet provisioned* | Create `LEXICON_ENGINE` tab (`Word \| Category \| Base_Score \| Polarity \| Framework_Source`) plus Values Alignment Shadow comparison (Stated vs. 90-day Demonstrated Values). |
| **`DOPPELGANGER`** | 🟢 ONLINE & WIRED | `ID_FEED_HUB` (`DOPPELGANGER` Shadow Arena HUD) + standalone `ID_DOPPELGANGER` (`Doppelganger_Brick`) | Hub HUD built & verified (`0` formula errors); click `MODULE_REGISTRY!J10` to authorize `Doppelganger_Brick` live feed. |
| **`OPS_GOVERNOR` (WIP ≤ 2)** | 🟢 ONLINE & WIRED | `ID_ZODIAC` (`OPS_GOVERNOR`) + `LifeOS_Master_Bus` (`SRC_ZODIAC`, `SYMBIOSIS_HUD`) + `ID_FEED_HUB` (`SIGNAL_BUS!ZODIAC_WIP_COUNT`, `RULES_ENGINE!OPS_GOVERNOR_WIP_CAP`) | Live `0/2` WIP ceiling active across both hubs; ready for `src/android_hud/` readout. |
| **`AI_Synthesis_Report`** | 🟢 ONLINE & WIRED | `ID_FEED_HUB` (`AI_Synthesis_Report` — dynamic Markdown briefing in `A4` via `TEXTJOIN` + structured digest table) | Built & verified live (`0` formula errors, Law 5 NotebookLM/Gemini Markdown ready); add `src/core_os_hub/report_generator.gs` in Wave 2 for scheduled Google Doc push. |
| **`PUBLIC_DATA`** | 🔴 NOT BUILT | *Not yet provisioned* | Create anonymized non-PII `PUBLIC_DATA` tab in Core OS Hub for Looker Studio / external dashboards. |

---

## 2. Pillar Spokes (Pillars 0–6) & Standalone Utilities Map

| Pillar / Utility | Master Spec Target | Online Live Bricks (`workbook_registry.json`) | Online Status | What Needs to Be Wired or Created Next |
| :--- | :--- | :--- | :---: | :--- |
| **Pillar 0: Shadow Self** | `Pillar_0_Shadow_Self`, `RAW_DATA_ShadowJournal`, Shadow Work Bench, Obsidian Seal | `ID_DOPPELGANGER` (*Doppelganger_Brick*), `ID_PQ` (*Saboteur Assessment*) | 🟡 PARTIAL | **Wire**: Add `CONTEXT_IN`/`SIGNALS_OUT` to `ID_PQ`; authorize `ID_DOPPELGANGER` in `LifeOS_feed_hub`. **Create**: *Shadow Journal Form*, write-only `RAW_DATA_ShadowJournal`, `Pillar_0_Shadow_Self` (`P0_WISDOM_SCORE`, Antifragility XP, Obsidian Markdown export). |
| **Pillar 1: Health & Vitality + `BIO_CORE`** | `Pillar_1_Health`, `RAW_DATA_DailyCheckIn`, `RAW_DATA_Biometrics`, `HABIT_MANAGER`, Bio-Rhythm Harmonizer, LoC + Psychometric Baseline | `ID_DAILY_INTAKE`, `ID_DYNAMIC_STRESS`, `ID_MBTI`, `ID_OCEAN`, `ID_ENNEAGRAM`, `ID_16PF`, `ID_GRIT`, `ID_FOUR_TEMPERAMENTS`, `ID_BELIEF_TRACKER` *(+ Tier 2 historical: `Health Data Export`, `LifeOS - Master Log`, `LifeOS Database`)* | 🟡 PARTIAL | **Wire**: Standardize `MBTI`/`OCEAN`/`ENNEAGRAM` (remove emoji tabs, add `Glyph`); fix `ID_16PF` `#REF!` + `0/188` blank guards; add contracts to `ID_GRIT` & `ID_BELIEF_TRACKER`; authorize `ID_DAILY_INTAKE`, `ID_DYNAMIC_STRESS`, `ID_FOUR_TEMPERAMENTS`. **Create**: `BIO_CORE` (`RAW_DATA_Biometrics` + `src/utilities/biometric_core/`), harvest `Health Data Export` & 3,772 habit rows from `LifeOS - Master Log`, build `Pillar_1_Health` rollup (`Health_Base_Score`). |
| **Pillar 2: Wealth & Resources** | `Pillar_2_Wealth`, `RAW_DATA_FinancialReview`, `ASSETS` ledger, FIRE Score, Financial Pyramid | *None bound yet* *(Drive holds raw `sep-2026-statement.csv` + 7 crypto explorer sheets)* | 🔴 NOT BUILT | **Create**: *Financial Review Form*, write-only `RAW_DATA_FinancialReview`, `Pillar_2_Wealth` (`ASSETS`, Capital Gains/Loss, 5-level Financial Pyramid, `FIRE_Score`, `Wealth_Base_Score`, `CONTEXT_IN`, `SIGNALS_OUT`). |
| **Pillar 3: Relationships & Connection + `CRM_CORE`** | `Pillar_3_Relationships`, `RAW_DATA_Intake`, `RAW_DATA_EventLog`, Two-Meter System, Keeper/Sleeper Classifier, `DOSSIER_TEMPLATE` | `ID_BODY_COUNT` (*Body Count 2.0*, 39 tabs + linked Form) | 🟡 PARTIAL | **Wire**: Add anonymized aggregate `CONTEXT_IN`/`SIGNALS_OUT` to `ID_BODY_COUNT` (zero PII exported to Hub), fix `IFERROR(..., 0)` & `0.035` age-decay weight. **Create**: *Universal Intake Report Form* (Friend/Family/Network spheres), *Universal Event Log Form* (with Perspective-Taking & Impact `-3..+3`), `CRM_CORE` (`src/utilities/crm_core/`), and `Pillar_3_Relationships` (`Relationship_Base_Score`). |
| **Pillar 4: Skills & Mission** | `Pillar_4_Skills_Mission`, `RAW_DATA_CareerReview`, `SKILL_TREE`, Ikigai Score, Bloom True Mastery Gate, `Perspective-Taking` | `ID_RIASEC` (*RAISEC Intake*), `ID_CAREER_INTAKE` (*LifeOS Career & Experience Intake*) | 🟡 PARTIAL | **Wire**: Add `CONTEXT_IN`/`SIGNALS_OUT` to `ID_RIASEC` (fix blank `SIG_RIASEC_FLOW`) & `ID_CAREER_INTAKE` (USCG Sea Days). **Create**: `Pillar_4_Skills_Mission` (`Ikigai_Score`, `100 × Level²` Skill Tree, Bloom 6-level True Mastery Gate, `Skills_Base_Score`). |
| **Pillar 5: Experience & Legacy** | `Pillar_5_Experience_Legacy`, `RAW_DATA_Quests`, `CLEAN_QUEST_LOG`, Temporal Compression / Skip Tokens, 12-Stage Hero's Journey, Annual Review | `ID_TRAVEL` (*🌍 Travel_Tracker_Brick*, 13 tabs + 2 Forms), `ID_MOVIES` (*Movie Tracker*, 37 tabs + 5 Forms), `ID_XP_HUB` (*XP Leveler*, 15 tabs) *(+ Tier 2: `Achievements`, `Google Maps Reviews`, `Master Atlas`)* | 🟡 PARTIAL | **Wire**: Authorize 7 `TRAVEL_*` signals in `LifeOS_feed_hub` & register `ID_TRAVEL` + `ID_MOVIES` in `LifeOS_Master_Bus`; fix `SRC_XP_HUB` `#REF!`; add `CONTEXT_IN`/`SIGNALS_OUT` & blank guards to `ID_MOVIES`. **Create**: *New Quest Form*, *Quarterly Life Audit Form*, *Annual Vision Review Form*, `RAW_DATA_Quests`, and `Pillar_5_Experience_Legacy` (`Experience_Base_Score`, Hero's Journey, Skip Tokens). |
| **Pillar 6: Esoteric Self** | `Pillar_6_Esoteric_Self`, Prana 1–10 stability, True Will Alignment (90-day), Sigil Manifestation, Dark Night Protocol | `ID_HD` (*Human Design OS*, 15 tabs), `ID_ZODIAC` (*Zodiac OS*, 14 tabs), `ID_KABBALAH` (*Kaballah Tree of Life OS Engine*, 15 tabs) | 🟡 MOSTLY ONLINE | **Wire**: Fix `SRC_KABBALAH` `#REF!` + blank `-0.1` penalty bug; standardize `ID_KABBALAH` plain tab names + `Glyph`; upgrade `ID_HD` & `ID_ZODIAC` `SIGNALS_OUT` to 10-col canonical schema & authorize in `LifeOS_feed_hub`; move HD/Kabbalah/Zodiac weights to `RULES_ENGINE`. **Create**: Thin `Pillar_6_Esoteric_Self` aggregator adding Prana stability, Sigil tracker, True Will 90-day alignment, and Dark Night Protocol trigger. |

---

## 3. Standalone Lego Brick Readiness Matrix (13 Core Bricks + 8 Supporting Bricks)

| Brick | Registry Key | Live Sheet Status | `LifeOS_Master_Bus` | `LifeOS_feed_hub` | Action Required |
| :--- | :--- | :---: | :---: | :---: | :--- |
| **MBTI Cognitive Stack** | `ID_MBTI` | 🟢 ONLINE (19 tabs) | 🟢 `SRC_MBTI` LIVE | 🟡 3 `#VALUE!` shifted | Rename emoji tabs → plain `CONTEXT_IN`/`SIGNALS_OUT` + add `Glyph`; replace `"Awaiting Intake"` with `""`. |
| **Enneagram Tritype** | `ID_ENNEAGRAM` | 🟢 ONLINE (19 tabs) | 🟢 `SRC_ENNEAGRAM` LIVE | 🟡 Missing `SIGNAL_BUS` rows | Rename emoji tabs → plain + add `Glyph`; wire `ENN_*` signals to `SIGNAL_BUS`; guard 202 formulas. |
| **Kabbalah Tree of Life** | `ID_KABBALAH` | 🟢 ONLINE (15 tabs) | 🔴 `SRC_KABBALAH` `#REF!` | 🟡 5 `#VALUE!` shifted | Fix `SRC_KABBALAH!A2` spill collision; fix blank `-0.1` bug in `E4`; plain tabs + `Glyph`; move weights to `RULES_ENGINE`. |
| **Big Five OCEAN** | `ID_OCEAN` | 🟢 ONLINE (19 tabs) | 🟢 `SRC_OCEAN` LIVE *(fix `5140%` bug)* | 🟡 7 `#VALUE!` shifted | Fix percentage scaling (`5140%`/`7430%`); plain tabs + `Glyph`; guard `Executive_Dashboard!A4,E4`. |
| **Human Design OS** | `ID_HD` | 🟢 ONLINE (15 tabs) | 🟢 `SRC_HD` LIVE | 🟡 4 `#VALUE!` + 2 `AWAITING_AUTH` | Upgrade `SIGNALS_OUT` to 10-col canonical; guard `HD_DECISION_ENGINE!I7:I`; move gate weights (`20/25/30/15/10`) to `RULES_ENGINE`. |
| **Zodiac OS** | `ID_ZODIAC` | 🟢 ONLINE (14 tabs) | 🟢 `SRC_ZODIAC` LIVE | 🟡 3 `AWAITING_AUTH` | Upgrade `SIGNALS_OUT` to 10-col canonical; authorize `IMPORTRANGE`; link `OPS_GOVERNOR` ceiling `2` to `RULES_ENGINE`. |
| **Maslow's Hierarchy** | `ID_MASLOW` | 🟢 ONLINE (10 tabs) | 🟢 `SRC_MASLOW` LIVE | 🟡 Via `Weekly_Maslow_Pulse` (`AWAITING_AUTH`) | Add canonical `CONTEXT_IN`/`SIGNALS_OUT`; externalize 6 weights in `B5` (`0.65/0.35/0.88/0.75/0.25`); guard 60 formulas. |
| **Grit Score Assessment** | `ID_GRIT` | 🟢 ONLINE (6 tabs) | 🟢 `SRC_GRIT` LIVE | 🔴 Not wired | Add canonical `CONTEXT_IN`/`SIGNALS_OUT`; fix false `0`s in `Timeline_Progression!N2:O2`; wire to `SIGNAL_BUS`. |
| **RIASEC Intake** | `ID_RIASEC` | 🟢 ONLINE (6 tabs) | 🟢 `SRC_RIASEC` LIVE *(blank `G16`)* | 🔴 Not wired | Add canonical `CONTEXT_IN`/`SIGNALS_OUT`; fix blank `SIG_RIASEC_FLOW`; guard `RIASEC_Dashboard!D10:F15`. |
| **Travel Tracker Brick** | `ID_TRAVEL` | 🟢 ONLINE (13 tabs) | 🔴 Not registered | 🟡 7 `AWAITING_AUTH` | Add `Notes` col (`J`) for 10-col parity; authorize `IMPORTRANGE` in `LifeOS_feed_hub`; register `SRC_TRAVEL` in `LifeOS_Master_Bus`. |
| **Belief & Stance Tracker** | `ID_BELIEF_TRACKER` | 🟢 ONLINE (10 tabs) | 🔴 Not registered | 🔴 Not wired | Add canonical `CONTEXT_IN`/`SIGNALS_OUT`; register in Hub & Master Bus; fix `IFERROR(COUNTIF(...), 0)`. |
| **Body Count 2.0** | `ID_BODY_COUNT` | 🟢 ONLINE (39 tabs) | 🔴 Not registered | 🔴 Not wired | Add anonymized aggregate `CONTEXT_IN`/`SIGNALS_OUT` (zero PII); fix `IFERROR(..., 0)` & `0.035` age-decay weight; register in Hub. |
| **Movie Tracker** | `ID_MOVIES` | 🟢 ONLINE (37 tabs) | 🔴 Not registered | 🔴 Not wired | Add canonical `CONTEXT_IN`/`SIGNALS_OUT`; guard `0/20` unguarded formulas & `IFERROR(..., 0)`; externalize decay/power weights; register in Hub. |
| **Saboteur Assessment (PQ)** | `ID_PQ` | 🟢 ONLINE (5 tabs) | 🟢 `SRC_PQ` LIVE | 🔴 Not wired | Add canonical `CONTEXT_IN`/`SIGNALS_OUT`; move `100` reps & `7.5` threshold to `RULES_ENGINE`. |
| **Cattell 16PF** | `ID_16PF` | 🟢 ONLINE (10 tabs) | 🔴 `SRC_16PF` `#REF!` | 🔴 Not wired | Fix `SRC_16PF!A2` spill; fix `0/188` blank guards (`16PF_Profile!E4:E5`); replace 6 ad-hoc `Import_*` tabs with `CONTEXT_IN`/`SIGNALS_OUT`. |
| **Career & Experience Intake** | `ID_CAREER_INTAKE` | 🟢 ONLINE (9 tabs) | 🟢 `SRC_CAREER` LIVE | 🔴 Not wired | Add canonical `CONTEXT_IN`/`SIGNALS_OUT`; move `180` USCG sea-day target to `RULES_ENGINE`. |
| **Doppelgänger / Stress / Temperaments / Daily & Weekly Pulses** | `ID_DOPPELGANGER`, `ID_DYNAMIC_STRESS`, `ID_FOUR_TEMPERAMENTS`, `ID_WEEKLY_MASLOW_PULSE`, `ID_DAILY_INTAKE` | 🟢 ONLINE (4–5 tabs each) | 🔴 Not in `Master_Bus` | 🟡 `AWAITING_AUTH` (21 rows) | Upgrade `SIGNALS_OUT` from 5-col → 10-col canonical; authorize `IMPORTRANGE` links; guard unlogged formulas (`ID_DOPPELGANGER` `0/40`). |

---

## 4. Core Forms & Modular `.gs` Automation Suite Coverage

### 9 Master Spec Google Forms
| # | Master Spec Form | Status | Live Form / Gap |
| :---: | :--- | :---: | :--- |
| 1 | Character Generation Form | 🟡 LEGACY | `CHARACTER CREATION: STATIC DOSSIER` exists (Tier 2 harvest → `BASELINE_SNAPSHOT`). |
| 2 | Daily Check-In Form | 🟢 ONLINE | `DAILY INTAKE FORM (Responses)` (`ID_DAILY_INTAKE`). |
| 3 | Weekly Review Form | 🟡 PARTIAL | `Weekly_Maslow_Pulse` covers Maslow; missing Weekly LoC & Regret Log fields. |
| 4 | Quarterly Life Audit Form | 🔴 NOT BUILT | Create for Phase 4 "CEO Day" reviews (`RAW_DATA_QuarterlyAudit`). |
| 5 | Annual Vision & Philosophy Review | 🔴 NOT BUILT | Create for True Will & 1/5/10-Year Vision (`RAW_DATA_AnnualReview`). |
| 6 | Universal Intake Report Form | 🟡 PARTIAL | `Body Count` form covers Love Life sphere; expand or add Friend/Family/Network intake for `CRM_CORE`. |
| 7 | Universal Event Log Form | 🔴 NOT BUILT | High-priority creation: feeds Dynamic Reality Score, Perspective-Taking, Antifragility XP & Values Alignment Shadow. |
| 8 | Shadow Journal Form | 🔴 NOT BUILT | High-priority creation for Pillar 0 (`RAW_DATA_ShadowJournal` + Obsidian Seal). |
| 9 | New Quest Form | 🔴 NOT BUILT | High-priority creation for Pillar 4/5 (`RAW_DATA_Quests`, Bloom multipliers, Temporal Compression, Hero's Journey). |

### 9 Modular `.gs` Apps Script Files (`src/`)
| Script Module | Workspace Path | Status | Notes |
| :--- | :--- | :---: | :--- |
| `main.gs` | `src/core_os_hub/main.gs` | 🔴 NOT BUILT | Menu hooks & sync orchestration. |
| `rules_engine_automations.gs` | `src/core_os_hub/rules_engine_automations.gs` | 🔴 NOT BUILT | `EFFECT_CONDITIONS`, `OPS_GOVERNOR` max-2 WIP lock, Values Alignment Shadow. |
| `dynamic_challenges.gs` | `src/core_os_hub/dynamic_challenges.gs` | 🔴 NOT BUILT | Nightly KPI threshold check & corrective micro-quest injection. |
| `report_generator.gs` | `src/core_os_hub/report_generator.gs` | 🔴 NOT BUILT | `AI_Synthesis_Report` → Markdown & `LifeOS_Master_Synthesis_Report` Google Doc. |
| `achievements_monitor.gs` | `src/core_os_hub/achievements_monitor.gs` | 🔴 NOT BUILT | Daily milestone unlock scan (`The Sovereign` ≥ 90, etc.). |
| `doppelganger_engine.gs` | `src/pillars/p0_shadow/doppelganger_engine.gs` | 🔴 NOT BUILT | Discipline vs. Vice nemesis calculation & Redemption Quest trigger. |
| `ecosystem_integrators.gs` | `src/bricks_sync/ecosystem_integrators.gs` | 🔴 NOT BUILT | Drive Epic Quest folder creation, `#LifeOS_Inbox`, Obsidian Markdown export. |
| `biometric_importer.gs` | `src/utilities/biometric_core/biometric_importer.gs` | 🔴 NOT BUILT | Native OAuth2 Fitbit / Health Connect ingestion into `RAW_DATA_Biometrics`. |
| `calendar_sync.gs` | `src/pillars/p5_legacy/calendar_sync.gs` | 🔴 NOT BUILT | Idempotent Quest-to-Google-Calendar sync (also runnable via Antigravity `gcalendar` CLI). |

---

## 5. Recommended Next Execution Queue (OPS_GOVERNOR WIP ≤ 2)

1. **Immediate Repair (Active Initiative #1 — Hub & Bus Stabilization)**:
   - Patch `A2` `#REF!` spill bugs on `LifeOS_Master_Bus` (`SRC_XP_HUB`, `SRC_KABBALAH`, `SRC_16PF`), fix `5140%`/`7430%` OCEAN scaling, fix column shifts in `LifeOS_feed_hub`, and authorize all 31 `AWAITING_AUTH` signals.
2. **Tier 1 Contract & Law 8 Standardization (Active Initiative #2)**:
   - Standardize all 21 Tier 1 Bricks to the canonical 10-column plain `SIGNALS_OUT` + 6-column `CONTEXT_IN`, fix high-priority blank-cell bugs (`ID_16PF`, `ID_KABBALAH`, `ID_HD`, `ID_MOVIES`, `ID_DOPPELGANGER`, `ID_MASLOW`), move hard-coded weights into `RULES_ENGINE`, and wire `ID_TRAVEL`, `ID_BELIEF_TRACKER`, `ID_BODY_COUNT`, and `ID_MOVIES` into `LifeOS_Master_Bus`.
3. **Queued Next (After Initiatives #1–2 Close)**:
   - Build missing Pillar engines (`Pillar_2_Wealth`, `Pillar_0_Shadow_Self`, `Pillar_4_Skills_Mission`, `Pillar_5_Experience_Legacy`, `BIO_CORE`, `CRM_CORE`), missing Hub views (`AQAL_VIEW`, `SWORD_VIEW`, `LEXICON_ENGINE`, `AI_Synthesis_Report`), and the 9 modular `.gs` scripts under `src/`.
