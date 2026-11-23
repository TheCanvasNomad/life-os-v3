# Life OS v3.0: Full Technical Architecture Specification & Implementation Blueprint

> **Canonical Source**: Reconciled from Google Doc *"Life OS v3.0: Full Technical Architecture Specification & Implementation Blueprint"* (`1bYhUheKQv8fNbEpahEObBYkwH66anZStGwjrZlCNbO8`), `LifeOS_Architecture_Rules` (`1D3xP7J2L-P9FEMTw1s9ADlLA59caEp3kO9VVrf5SYaI`), and `LifeOS_Live_State` (`1m2oSx6_jquTnUM-xSmxgqws9ROaMnA3L54Q0VMo5sMM`).  
> **Repository**: `https://github.com/TheCanvasNomad/life-os-v3`  
> **Last Reconciled**: `2026-11-23`  
> **Governing Skill**: [`.agents/skills/lifeos-architect/SKILL.md`](../.agents/skills/lifeos-architect/SKILL.md) (Laws 1–8)

---

## 0. Architecture Reconciliation & v3.0 Live Constitution

This modernized master blueprint reconciles the original 9-section Life OS v3.0 specification with the active **LifeOS Constitution** (`LifeOS_Architecture_Rules`), **Live Build State** (`LifeOS_Live_State`), and **Antigravity-First Engineering Standards** (Laws 1–8):

| Architectural Dimension | Original Master Spec | Reconciled v3.0 Standard (`LifeOS_Architecture_Rules` + Antigravity) |
| :--- | :--- | :--- |
| **Data Topology** | Strict 3-layer unidirectional Hub-and-Spoke (`Forms → Raw Silos → Pillar Spokes → Core OS Hub`). | Preserves strict unidirectional raw ingestion while adding the **Two-Pass Bidirectional `SIGNAL_BUS`** (Pass 1 raw score publishes to Hub → Pass 2 contextualized `Archetype × Live State` guidance pulls via `CONTEXT_IN`, zero circular deadlocks). |
| **Modular Spokes** | 7 Pillar workbooks (`Pillar_0` – `Pillar_6`). | Extended with standalone **Lego Brick** workbooks (Psychometrics, Maslow, Grit, RIASEC, Human Design, Zodiac, Kabbalah, Travel, Belief Tracker, Body Count 2.0, Movies), each exposing the mandatory 3-tab connector (`MODULE_META`, `CONTEXT_IN`, `SIGNALS_OUT`). |
| **Advisory & Formula Standard** | Static tables & Apps Script menu evaluations. | **Law 8 (Dynamic Formula-First & Executive Sheet UI)**: 100% dynamic native Sheets formulas (`ARRAYFORMULA`, `XLOOKUP`, `QUERY`, `FILTER`, `LET`, `LAMBDA`, `SPARKLINE`), zero static archetype paragraphs (`ADVISORY_MATRIX` = `Archetype × Live Telemetry State`), strict blank-cell preservation (`IF(ISBLANK(...), "", ...)`), and TTL freshness decay (`FRESH` / `STALE`). |
| **RPG Math & Stacking** | Maslow pyramid + `100 × Level²` skill curves + Bloom multipliers. | Unified **3-Tier RPG Stat Stacking** (`Tier 1 Natal Base × Tier 2 Psychometric Traits × Tier 3 Live State`), **Kabbalah 10-Sephirot Skill Trees**, **Maslow XP tiers** (`10/10/20/30/50`), **Fibonacci global leveling** (`100, 200, 300, 500, 800, 1300...`), and **Tesla 3-6-9 streak multipliers** (`1.5x / 2.0x / 2.5x`). |
| **Build & Execution Engine** | Manual Sheets / Apps Script + legacy Colab `LifeOS_Mission_Control.ipynb`. | **Antigravity-First Execution**: Local workspace Python/MCP workflows (`gdrive`/`gsheets` CLIs, `src/` modules) continuously synced to GitHub (`TheCanvasNomad/life-os-v3`) under Law 6, governed by [`schemas/workbook_registry.json`](../schemas/workbook_registry.json) (Law 7) so no duplicate workbooks are ever provisioned. |
| **Security & IDs** | Inline placeholder IDs in `.gs` examples. | **Zero-Hardcode Security**: Private Spreadsheet/Doc IDs live in `schemas/workbook_registry.json` (or Apps Script `PropertiesService` / `.env` excluded by `.gitignore`) and are scrubbed to `{{PLACEHOLDER}}` tokens in public code templates. |
| **Visual UI Standard** | Basic conditional formatting + Looker Studio. | Mandatory **Dark-Obsidian Executive HUD Styling** (`#0F172A`/`#1E293B` banners, crisp white bold text, `0–49%` crimson / `50–89%` amber / `90–100%` emerald badges, frozen headers, padded auto-fit columns, subtle row banding, `hideGridlines: true` on dashboards, native `SPARKLINE` vital bars & charts). |

---

## 1. Master System Architecture & Core Philosophy

Life OS v3.0 is a sovereign, gamified engine designed to transform chaotic reality into quantifiable data and actionable personal evolution. Operative reality presents a continuous stream of unstructured personal, physical, relational, and professional events. Without a sovereign architecture to capture and synthesize these streams, personal progress degrades into reactive management. Life OS v3.0 addresses this failure state by establishing a rigorous information processing system that converts real-world inputs into dynamic status metrics, explicit experience points (XP), and automated feedback loops for self-mastery.

```text
       +-------------------------------------------------------+
       |                  INPUT LAYER (FORMS)                  |
       |  Daily Check-In, Event Log, Intake, Shadow Journal... |
       +---------------------------+---------------------------+
                                   | (Unidirectional Append-Only Flow)
                                   v
       +-------------------------------------------------------+
       |           LAYER 1: UNTOUCHABLE RAW DATA SILOS         |
       |  RAW_DATA_DailyCheckIn, RAW_DATA_EventLog, etc.       |
       +---------------------------+---------------------------+
                                   | (IMPORTRANGE / Ingestion)
                                   v
       +-------------------------------------------------------+
       |      LAYER 2: PILLAR SPOKES & STANDALONE BRICKS       |
       |  Pillars 0–6, BIO_CORE, CRM_CORE & Lego Bricks        |
       |  [Pass 1: Raw Score -> SIGNALS_OUT]                   |
       |  [Pass 2: CONTEXT_IN -> Dynamic Archetype × State]    |
       +---------------------------+---------------------------+
                                   | (Normalized Signals & Base Scores)
                                   v
       +-------------------------------------------------------+
       |          LAYER 3: CORE OS HUB PRESENTATION LAYER      |
       |  CHARACTER_SHEET, RULES_ENGINE, SIGNAL_BUS,           |
       |  AQAL_VIEW, SWORD_VIEW, IMPORTS, AI_Synthesis_Report  |
       +-------------------------------------------------------+
```

### Hub-and-Spoke Topology & Two-Pass Evaluation

To guarantee long-term stability and eliminate circular dependencies, Life OS v3.0 enforces a strict three-layer Hub-and-Spoke architecture paired with Two-Pass Signal Evaluation:

- **Layer 1 — Untouchable Raw Data Silos (Source Layer):** Every Google Form dumps its responses into an isolated, dedicated write-only ledger (e.g., `RAW_DATA_DailyCheckIn`, `RAW_DATA_EventLog`, `RAW_DATA_ShadowJournal`). Manual editing or formatting inside Layer 1 silos is strictly prohibited.
- **Layer 2 — Independent Pillar Engines & Lego Bricks (Processing Layer):** Each of the seven life domains (`Pillar_0_Shadow_Self` through `Pillar_6_Esoteric_Self`), standalone utilities (`BIO_CORE`, `CRM_CORE`), and psychometric/esoteric/experience Lego Bricks runs in its own encapsulated Google Sheet with a standardized 3-tab connector (`MODULE_META`, `CONTEXT_IN`, `SIGNALS_OUT`). Spokes never create direct `IMPORTRANGE` spaghetti across Layer 2; all cross-domain routing passes centrally through Layer 3 (`SIGNAL_BUS`).
- **Layer 3 — Core OS Hub (Presentation & Routing Layer):** Functions as the central command dashboard, `SIGNAL_BUS` router, and `RULES_ENGINE` physics table. The Hub performs zero raw data processing; it ingests normalized scores and active flags from Layer 2 into `IMPORTS` / `SIGNAL_BUS` and feeds upstream context back via **Two-Pass Evaluation**:
  1. **Pass 1 (Native Raw Score):** Each Brick/Pillar computes its independent native metrics first and publishes them to `SIGNALS_OUT` → Hub `SIGNAL_BUS` (with `Last_Updated` and `TTL_Hours`).
  2. **Pass 2 (Contextualized Guidance):** Each Brick reads upstream cross-domain state from `CONTEXT_IN` to compute dynamic `Archetype × Live Telemetry State` advisories via `ADVISORY_MATRIX` lookup tables—never feeding its own composite score back as a recursive multiplier.

$$\text{Forms (Input)} \longrightarrow \text{Raw Data Silos (Write-Only)} \longrightarrow \text{Pillar Engines \& Bricks (Pass 1/2)} \longrightarrow \text{Core OS Hub (Presentation)}$$

### Theoretical Framework Integration

Life OS v3.0 integrates four foundational developmental and esoteric frameworks directly into its execution logic:

1. **Maslow's Hierarchy of Needs:** Functions as the primary physics engine and XP weighting system across five foundational levels (*Physiological*, *Safety*, *Love/Belonging*, *Esteem*, *Self-Actualization*). Lower-level stability mathematically preconditions upper-level advancement.
2. **Levels of Psychological Development (LPD):** Synthesizes developmental models from Maslow to Spiral Dynamics using eight explicit **Goal Verbs** (*Satisfy*, *Connect*, *Control*, *Conform*, *Achieve*, *Include*, *Integrate*, *Synergize*) that govern quest filtering in the *New Quest Form* and `RULES_ENGINE`. Higher LPD stages remain locked until the user advances the **Perspective-Taking** sub-skill in Pillar 4 (analyzing logged events from 1st, 2nd, and 3rd person perspectives in the *Universal Event Log*).
3. **Integral Theory's AQAL (All Quadrants, All Levels):** Maps all tracked metrics across a 2×2 balance matrix:
   - **Upper-Left (UL — "I"):** Subjective Interior (Consciousness / LoC, Shadow Integration, Psychometrics).
   - **Upper-Right (UR — "IT"):** Objective Individual (Biometrics, Health, Skill Execution).
   - **Lower-Left (LL — "WE"):** Intersubjective Collective (Relational Dynamics, Faction Reputation, Moral Alignment, Love Tank).
   - **Lower-Right (LR — "ITS"):** Interobjective Collective (Wealth Engine, FIRE Score, Sovereignty Score, Career & Systemic Assets).
4. **Kabbalah Tree of Life (10 Sephirot + Da'at):** Serves as the Core Skill Tree where earned XP routes into specific functional faculties (e.g., *Hod* for Logic/Systems, *Netzach* for Endurance/Execution, *Tiferet* for Balance, *Malkuth* for Grounded Embodiment).

### Cadence Tiers & Official Assessment Integrity

Official psychometric instruments are never watered down into a single uniform questionnaire; inputs stay separated by natural sampling cadence:

| Cadence Tier | Instruments / Feeds | TTL Window |
| :--- | :--- | :--- |
| **Immutable / Natal Blueprint** | Zodiac, Human Design, Numerology (enriched live via transits & `CONTEXT_IN`) | Permanent + `24h` transit overlay |
| **Daily (< 2 min)** | Daily Intake / State Pulse (mood, energy, Gunas, Prana, habits, vices) | `24h` – `48h` |
| **Weekly** | Weekly Maslow Pulse, Weekly Review (stress, LoC, Regret Log) | `168h` |
| **Monthly / Ad-Hoc** | Kabbalah calibration, Dynamic Stress, Four Temperaments, PQ Saboteurs, Travel, Belief Tracker, Movies, Relationships | `720h` / Event-driven |
| **6-Month Official** | Full unmodified MBTI, Enneagram, Big Five OCEAN (IPIP-50), Cattell 16PF, Grit, RIASEC | `4320h` |
| **Quarterly / Annual / Multi-Year** | Quarterly Life Audit (90-day "CEO Day"), Annual Vision & Philosophy Review (1/5/10-year horizon) | `2160h` / `8760h` |

### Sovereignty, Antifragility & Personal Intelligence Cycle

- **Architectural Sovereignty:** Zero dependence on fragile third-party glue platforms (IFTTT/Zapier) or "Two Masters" data duplication. All automations execute natively via Google Apps Script, Google Sheets formulas, and Antigravity Python/MCP workflows versioned in GitHub.
- **Antifragility Mechanics:** Negative setbacks logged in the *Universal Event Log* trigger conditional Shadow Work and Antifragile Narrative routines. Resolving and reframing shocks awards **Antifragility XP**, permanent *Stress Resilience* increments (Pillar 1), and **Wisdom Points**.
- **3-Step Personal Intelligence Cycle:**
  1. **Automated Synthesis & Export:** `AI_Synthesis_Report` compiles clean Markdown/Doc briefings pushed via `report_generator.gs` (or Antigravity workflows) to `LifeOS_Master_Synthesis_Report`.
  2. **Knowledge Grounding & Retrieval:** Synthesized outputs feed **NotebookLM** for unblinking factual recall (*"What happened?"* / *"When?"*).
  3. **Strategic Socratic Dialogue:** Retrieved context feeds **Gemini / Antigravity** for deep Socratic inquiry, Shadow reframing, and strategic execution (*"So what?"* / *"Now what?"*).

---

## 2. The 5-Phase Construction SOP Blueprint

```text
Phase 1: Core OS Hub, SIGNAL_BUS & RULES_ENGINE Physics
   │
   ▼
Phase 2: Prototype Spoke (Pillar 3 Build & Validation)
   │
   ▼
Phase 3: Remaining Pillar Spokes & Lego Bricks (Pillars 0, 1, 2, 4, 5, 6)
   │
   ▼
Phase 4: System-Wide Rituals ("CEO Day" Quarterly & Annual Cycles)
   │
   ▼
Phase 5: Final Integration, Executive UI, Android HUD & Automation Scripts
```

### Phase Breakdown

1. **Phase 1 — Building the Core:** Construct/unify the Core OS Hub (`IMPORTS` / `SIGNAL_BUS`, `MODULE_REGISTRY`, `RULES_ENGINE`, `CHARACTER_SHEET`, `AQAL_VIEW`, `SWORD_VIEW`, `MASLOW_ENGINE`, `LEXICON_ENGINE`, `PUBLIC_DATA`). Populate master `RULES_ENGINE` lookup tables (`ESOTERIC_MODIFIERS`, `PSYCHOLOGICAL_MODIFIERS`, `EFFECT_CONDITIONS`, `BLOOM_TAXONOMY_MODIFIERS`, `ICK_INDICATOR_LEXICON`, `STATUS_GAME_LEXICON`, plus Maslow XP, Fibonacci leveling, and Tesla 3-6-9 tables). Deploy `main.gs`.
2. **Phase 2 — Prototype Spoke (Pillar 3):** Stand up *Universal Intake Report Form* + *Universal Event Log Form* → write-only `RAW_DATA_Intake` & `RAW_DATA_EventLog` → `Pillar_3_Relationships` (`IMPORTS`, `DATABASE`, `CALCULATIONS`, `DASHBOARD`, `DOSSIER_TEMPLATE`, `CONTEXT_IN`, `SIGNALS_OUT`) → validate end-to-end Hub ingestion.
3. **Phase 3 — Remaining Pillar Spokes & Lego Bricks:** Build and standardize Pillars 0, 1 (`BIO_CORE`), 2, 4, 5, and 6 alongside all standalone Tier 1 Bricks (`schemas/workbook_registry.json`), wiring every normalized signal into the Hub and configuring `PUBLIC_DATA` for external visualization.
4. **Phase 4 — System-Wide Rituals:** Deploy *Quarterly Life Audit Form* (`RAW_DATA_QuarterlyAudit`) and *Annual Vision & Philosophy Review Form* (`RAW_DATA_AnnualReview`) for quarterly "CEO Day" recalibration, LPD validation, and annual archetype re-testing.
5. **Phase 5 — Final Integration & UI Layer:** Build `AI_Synthesis_Report`, deploy modular `.gs` automation suites (Law 2), apply executive dark-obsidian HUD styling (Law 8), and connect clean views to Looker Studio and `src/android_hud/`.

### Milestones & Validation Checkpoints

| Checkpoint | Target Phase | System State Requirement | Validation Method |
| :--- | :--- | :--- | :--- |
| **Checkpoint 1** | Phase 1 | Core OS Hub established; `RULES_ENGINE` populated; `CHARACTER_SHEET` displaying dynamic 3-tier modifiers. | Formula audit confirming zero static scores & live `main.gs` menu load. |
| **Checkpoint 2** | Phase 2 | Prototype Spoke (Pillar 3) operational; forms writing to write-only silos; Hub receiving live score. | Confirm `IMPORTRANGE` / `SIGNALS_OUT` link with `#REF!` authorization cleared. |
| **Checkpoint 3** | Phase 3 | All 7 Pillar Spokes (P0–P6) & Tier 1 Bricks encapsulated and publishing canonical `SIGNALS_OUT` to Hub. | Verify zero circular dependencies, zero `AWAITING_AUTH` errors, and blank-safe `""` preservation. |
| **Checkpoint 4** | Phases 4 & 5 | All 9 core Forms live; modular `.gs` triggers active; `AI_Synthesis_Report` exporting cleanly to NotebookLM/Gemini. | Execute nightly sync manually; verify corrective quest append & synthesis Doc/Markdown output. |

---

## 3. Granular Pillar Specifications (Pillars 0 through 6)

```text
+----------------------------------------+
|        THE SEVEN PILLAR SPOKES         |
+----------------------------------------+
| P0: The Shadow Self (Subconscious)     |
| P1: Health & Vitality (Body & Mind)    |
| P2: Wealth & Resources (The Treasury)  |
| P3: Relationships (Social Matrix)      |
| P4: Skills & Mission (The Craft)       |
| P5: Experience & Legacy (The Journey)  |
| P6: The Esoteric Self (Co-Creation)    |
+----------------------------------------+
```

### 3.1 Pillar 0: The Shadow Self (The Subconscious)
- **Primary Inputs:** *Shadow Journal Form* (Triggering Event/Feeling, Initial Emotion, Story I'm Telling Myself, Underlying Fear, Reframed Narrative / Deeper Truth, Lesson / Integrated Wisdom, Entry Status `Identified` vs `Integrated`, `Seal in Obsidian Vault` checkbox), plus `ID_DOPPELGANGER` and `ID_PQ` (Saboteurs).
- **Data Silo:** `RAW_DATA_ShadowJournal` (highest-privacy write-only asset).
- **Engine (`Pillar_0_Shadow_Self`):** `IMPORTS`, `DATABASE`, `CALCULATIONS` (*Hierarchy of Shadow Integration*: unconscious control → conscious awareness → full integration; computes `P0_WISDOM_SCORE`; toggling `Identified → Integrated` awards `+1 Wisdom Point` and `+100 Antifragility XP`), `DASHBOARD` (*Shadow Work Bench*), `CONTEXT_IN`, `SIGNALS_OUT`.
- **Core Metrics:** `P0_WISDOM_SCORE`, `Unintegrated_Shadows_Count`, `Antifragility_XP`, `Wisdom_Points`, `SHADOW_TAX_RATE`, `PQ_AVOIDER_SCORE`.
- **Cross-Pillar Dependencies:** Feeds `P0_WISDOM_SCORE` (40% weight) to Maslow Level 5. Checking `Seal in Obsidian Vault` triggers an export webhook formatting the integrated entry as Markdown for the user's private Obsidian Vault.

### 3.2 Pillar 1: Health & Vitality (Body & Mind) + `BIO_CORE`
- **Primary Inputs:** *Daily Check-In Form* (Sleep, Nutrition, Hydration, Mood, Energy, Focus, Stress, Dopamine Discipline Vices, Active Habit Compliance, Prana Level 1–10), Morning/Afternoon/Evening energy logs, and automated biometrics (`BIO_CORE` / Health Connect / Fitbit).
- **Data Silos:** `RAW_DATA_DailyCheckIn`, `RAW_DATA_Biometrics`.
- **Engine (`Pillar_1_Health` + `BIO_CORE`):** `IMPORTS`, `DATABASE` (`HABIT_MANAGER`), `CALCULATIONS` (*Hierarchy of Health & Vitality*: Level 1 Stability → Level 2 Proactive Health → Level 3 Peak Performance → Level 4 Embodiment; *Bio-Rhythm Harmonizer* identifying Peak Focus Windows; Level of Consciousness `LoC`; `Health_Base_Score`), `DASHBOARD`, `CONTEXT_IN`, `SIGNALS_OUT`.
- **Core Metrics:** `Health_Base_Score`, `Sleep_Quality_Avg`, `Habit_Compliance_Pct`, `Stress_Resilience`, `LoC_Score`, `HRV`, `RHR`, `Steps`.
- **Cross-Pillar Dependencies:** 30-day average Energy `> 8/10` triggers a global `+10% XP Boost` to Pillar 4 via `RULES_ENGINE`. Feeds `Maslow Level 1` (100%) and `Maslow Level 2` (20% Stress Resilience).

### 3.3 Pillar 2: Wealth & Resources (The Treasury)
- **Primary Inputs:** *Financial Review Form* (Income, Expenses, Emergency Fund, Debt, Investment Rate, Asset Allocation, Philanthropic Focus).
- **Data Silo:** `RAW_DATA_FinancialReview`.
- **Engine (`Pillar_2_Wealth`):** `IMPORTS`, `DATABASE` (`ASSETS` ledger & Capital Event Log), `CALCULATIONS` (*Hierarchy of Financial Needs*: Level 1 Cash Flow → Level 2 Safety → Level 3 Growth → Level 4 Independence → Level 5 Legacy; `Wealth_Base_Score`; `FIRE_Score`), `DASHBOARD`, `CONTEXT_IN`, `SIGNALS_OUT`.

$$\text{Capital Gains/Loss} = \text{Total Current Market Value} - \text{Total Deposited Capital}$$

- **Core Metrics:** `Wealth_Base_Score`, `FIRE_Score`, `Savings_Rate`, `Net_Worth`, `Financial_Hierarchy_Level`.
- **Cross-Pillar Dependencies:** Feeds `FIRE_Score` to AQAL Lower-Right (`ITS`) and `Maslow Level 2` (80%). Negative financial safety triggers `Scarcity` (`-5% Pillar 5 XP`) in `RULES_ENGINE`.

### 3.4 Pillar 3: Relationships & Connection (The Social Matrix) + `CRM_CORE`
- **Primary Inputs:** *Universal Intake Report Form* (Love Life, Friendship, Family, Professional Network spheres; objective scorecards, psychometrics, Love Languages/Styles, strategic intent, Relational Market Dynamics) and *Universal Event Log Form* (interactions, impact `-3..+3`, tags, 1st/2nd/3rd person perspective-taking), alongside `ID_BODY_COUNT` (*Body Count 2.0*).
- **Data Silos:** `RAW_DATA_Intake`, `RAW_DATA_EventLog`.
- **Engine (`Pillar_3_Relationships` + `CRM_CORE`):** `IMPORTS`, `DATABASE` (`MASTER_IDENTIFIER_LIST`), `CALCULATIONS` (*Relational Market Dynamics Engine*, *Two-Meter System*: Good Guy vs. Bad Boy Score, Quantitative Attractiveness Delta $\Delta H$, Crazy/Hot Matrix, Reciprocity Score, *Keeper vs. Sleeper Classifier* outputting pattern confidence %, *Hierarchy of Relationships*: Contact → Connection → Harmony → Synergistic Partnerships → Unconditional Connection; `Relationship_Base_Score`), `DASHBOARD`, `DOSSIER_TEMPLATE`, `CONTEXT_IN`, `SIGNALS_OUT` *(strictly anonymized aggregate telemetry exported to Hub—zero PII)*.
- **Core Metrics:** `Relationship_Base_Score`, `Faction_Reputation`, `Attractiveness_Delta`, `Reciprocity_Balance`.
- **Cross-Pillar Dependencies:** Rejection logs matching `ICK_INDICATOR_LEXICON` trigger targeted Pillar 0 Shadow prompts. Perspective-taking logs feed Pillar 4's `Perspective-Taking` sub-skill.

### 3.5 Pillar 4: Skills & Mission (The Craft)
- **Primary Inputs:** *Quarterly Career Review Form* (Status, Satisfaction, Goals, Skill/Experience Gap Analysis), *New Quest Form* (Learning Quests tagged by Bloom's Taxonomy), plus `ID_RIASEC` and `ID_CAREER_INTAKE`.
- **Data Silos:** `RAW_DATA_CareerReview`, `RAW_DATA_Quests`.
- **Engine (`Pillar_4_Skills_Mission`):** `IMPORTS`, `DATABASE`, `CALCULATIONS` (*Ikigai Score* 0–10 combining Passion, Mastery, Impact, Compensation; non-linear skill XP curve; Bloom's cognitive multipliers `1.0x–3.0x`; `Skills_Base_Score = 70% Ikigai + 30% Avg Skill Tree Level`), `SKILL_TREE` (`DASHBOARD`), `CONTEXT_IN`, `SIGNALS_OUT`.

$$\text{XP Required for Skill Level} = 100 \times (\text{Level})^2$$

- **True Mastery Gate:** Reaching Level 10 ("Master") in any skill requires completing at least one quest across **all six** Bloom levels (*Remembering → Creating*). Incomplete Bloom coverage hard-locks the skill at Level 9 and auto-injects a corrective `Learning_Quest` into `RAW_DATA_Quests`.
- **Core Metrics:** `Skills_Base_Score`, `Ikigai_Score`, `Career_Title`, `Skill_Levels`, `Perspective_Taking_Level`, `CAREER_USCG_SEA_DAYS`.

### 3.6 Pillar 5: Experience & Legacy (The Journey)
- **Primary Inputs:** *New Quest Form* (Epic/Major/Sub-Quests, optional `Time Benchmark (Hours)`, `Initiate as Hero's Journey?` checkbox), *Annual Vision & Philosophy Review Form* (1/5/10-Year Visions, Metagame Victory Condition), plus `ID_TRAVEL` (*Travel_Tracker_Brick*) and `ID_MOVIES` (*Movie Tracker*).
- **Data Silos:** `RAW_DATA_Quests`, `RAW_DATA_AnnualReview`, `TRIPS_RAW`, `REVIEWS_RAW`.
- **Engine (`Pillar_5_Experience_Legacy`):** `IMPORTS`, `DATABASE` (`CLEAN_QUEST_LOG` with Eisenhower Matrix), `CALCULATIONS`:
  - **Temporal Compression Mechanics:** Completing a benchmarked quest early awards `Compression_XP` toward **Skip Tokens** (usable to auto-complete task-level quests).
  - **12-Stage Hero's Journey Engine:** Flagging an Epic Quest as a Hero's Journey spawns a dedicated `HJ - <Quest Name>` tab via Apps Script tracking 12 archetypal stages; completing Stage 12 (*Return*) requires a mandatory **Blueprint Quest** before legacy XP unlocks.
  - Computes `Experience_Base_Score`.
- **Core Metrics:** `Experience_Base_Score`, `Epic_Quests_Completed_Pct`, `Skip_Tokens`, `Unlocked_Achievements`, `TRAVEL_DAYS_YTD`, `MOVIES_LOGGED_COUNT`.

### 3.7 Pillar 6: The Esoteric Self (Co-Creation & Reality Mechanics)
- **Primary Inputs:** *Daily Check-In Form* (Prana Level 1–10 slider), *Annual Vision & Philosophy Review Form* (True Will Declaration), *Universal Event Log Form* (Sigil dates, `Ritual`/`Metaphysics`/`Complained` tags), plus `ID_HD` (*Human Design OS*), `ID_ZODIAC` (*Zodiac OS* + `OPS_GOVERNOR`), and `ID_KABBALAH` (*Kaballah Tree of Life OS Engine*).
- **Data Silos:** `RAW_DATA_DailyCheckIn`, `RAW_DATA_EventLog`, `RAW_DATA_AnnualReview`.
- **Engine (`Pillar_6_Esoteric_Self`):** `IMPORTS`, `DATABASE` (Prana history, Sigil manifestation tracker, Sexual Alchemy logs), `CALCULATIONS` (Tiers: Student → Initiate → Practitioner → Alchemist; 90-day `True_Will_Alignment_Score`), `DASHBOARD`, `CONTEXT_IN`, `SIGNALS_OUT`.
- **Core Metrics:** `Prana_Level`, `True_Will_Alignment_Score`, `Sigil_Success_Rate`, `Energy_Control_Level`, `KAB_EFFECTIVE_QUALITY`, `HD_STRATEGY_COHERENCE`, `ZODIAC_ALIGNMENT`.
- **Cross-Pillar Dependencies:** `Prana > 8` triggers `High Vibration (+5% Global XP)`; `Prana < 3` triggers `Energy Leak (-5% Global XP)`. Chronic `Complained` tags or severe misalignment trigger the **Dark Night Protocol** (mandatory Pillar 0 Shadow Journal prompt).

---

## 4. The `RULES_ENGINE` & Master Physics Engine

The `RULES_ENGINE` tab inside the Core OS Hub serves as the single source of truth for all modifiers, weights, thresholds, and game physics—eliminating hard-coded magic numbers across every Brick and Pillar (Law 8).

### 3-Tier RPG Stat Stacking Order (`Base × Traits × Live State`)

1. **Tier 1 — Immutable Base Stats:** Natal bricks (`ID_ZODIAC`, `ID_HD`, Numerology) set permanent Character Class affinities and base stat modifiers.
2. **Tier 2 — Semi-Permanent Trait Modifiers:** 6-month psychometric bricks (`ID_OCEAN`, `ID_MBTI`, `ID_ENNEAGRAM`, `ID_16PF`, `ID_FOUR_TEMPERAMENTS`, `ID_GRIT`, `ID_RIASEC`) stack recalibratable Buffs/Debuffs atop Tier 1.
3. **Tier 3 — Live Situational Modifiers:** High-frequency telemetry (`ID_DAILY_INTAKE`, `ID_WEEKLY_MASLOW_PULSE`, `ID_DYNAMIC_STRESS`, `BIO_CORE`, live planetary/HD transits) applies real-time buffs and debuffs atop Tiers 1 + 2.

### Core `RULES_ENGINE` Lookup Tables

#### `ESOTERIC_MODIFIERS`
| Trait | Pillar Affected | Attribute | Modifier |
| :--- | :--- | :--- | :---: |
| Aries | Pillar 1 | Physical XP Gain | `+2%` |
| Aries | Pillar 1 | Impulse Control | `-1%` |
| Earth Dragon | Pillar 4 | Long-Term Goal Progress | `+1%` |
| Life Path 11 | Pillar 5 | Spiritual XP Gain | `+2%` |
| Life Path 11 | Pillar 1 | Stress Resilience | `-2%` |
| Manifesting Generator | Pillar 4 | New Project XP Gain | `+3%` |
| Manifesting Generator | Pillar 4 | Project Endurance | `-1%` |

#### `PSYCHOLOGICAL_MODIFIERS`
| Trait | Pillar Affected | Attribute | Modifier |
| :--- | :--- | :--- | :---: |
| INTJ | Pillar 4 | Strategic XP Gain | `+5%` |
| High_O (OCEAN) | Pillar 4 | Creative XP Gain | `+3%` |
| Low_C (OCEAN) | Pillar 1 | Routine Compliance | `-4%` |
| Assertive | Pillar 3 | Frame Control | `+2%` |

#### `EFFECT_CONDITIONS`
| Trigger_Metric | Condition | Threshold | Effect_Name | Target_Attribute | Modifier | Duration (Hours) |
| :--- | :---: | :---: | :--- | :--- | :---: | :---: |
| `Pillar1_Sleep_Score` | `<` | `4` | Fatigue | `Focus_Score` | `-10%` | `24` |
| `Pillar1_Exercise_Log` | `=` | `Yes` | Energized | `Energy_Score` | `+5%` | `12` |
| `Pillar1_Habit_Streak` | `>` | `7` | Clarity | `Pillar0_Wisdom_Gain` | `+2%` | `168` |
| `Pillar2_Financial_Status` | `=` | `Negative` | Scarcity | `Pillar5_XP_Gain` | `-5%` | `168` |
| `Prana_Level` | `>` | `8` | High Vibration | `Global_XP_Gain` | `+5%` | `24` |
| `Prana_Level` | `<` | `3` | Energy Leak | `Global_XP_Gain` | `-5%` | `24` |
| `Doppelgänger_Score` | `>` | `Discipline_Score` | Dominated | `Global_XP_Gain` | `-15%` | `72` |
| `Quadrant_Balance_Score` | `<` | `60` | Imbalance | `Systemic_XP_Cost` | `+20%` | `168` |
| `OPS_WIP_COUNT` | `>=` | `2` | Pipeline Freeze (`OPS_GOVERNOR`) | `New_Initiative_Intake` | `LOCKED` | `Active` |

#### `BLOOM_TAXONOMY_MODIFIERS`
| Cognitive Level | Base_XP_Multiplier | Rationale |
| :--- | :---: | :--- |
| Remembering | `1.0x` | Foundation; recalling facts. |
| Understanding | `1.2x` | Explaining ideas or concepts. |
| Applying | `1.5x` | Using information in new situations. |
| Analyzing | `2.0x` | Drawing connections among ideas. |
| Evaluating | `2.5x` | Justifying a stand or decision. |
| Creating | `3.0x` | Producing new or original work. |

#### `RPG_PROGRESSION_TABLES` (Reconciled from `LifeOS_Architecture_Rules`)
- **Maslow Base XP:** `Survival = 10 XP`, `Safety = 10 XP`, `Belonging = 20 XP`, `Esteem = 30 XP`, `Self-Actualization = 50 XP`.
- **Fibonacci Global Leveling Thresholds:** `100, 200, 300, 500, 800, 1300, 2100, 3400, 5500, 8900...`
- **Tesla 3-6-9 Streak Multipliers:** `0–2 days = 1.0x`, `3–5 days = 1.5x`, `6–8 days = 2.0x`, `9+ days = 2.5x` (locks in permanent stat boost and resets cycle).

#### `ICK_INDICATOR_LEXICON`
| Ick_Description | Ick_Type | Severity | Associated_Shadow | Targeted Prompt Trigger |
| :--- | :--- | :---: | :--- | :--- |
| Lives with parents | Type 1 (Not Masculine) | `5` | Fear of Independence | Deconstruct boundary fears and financial self-reliance. |
| Too Sensitive / Reactive | Type 1 (Not Masculine) | `4` | Vulnerability Rejection | Explore past instances where vulnerability led to punishment. |
| Validation Seeking (Mob) | Type 2 (Low Status) | `3` | External Approval Need | Deconstruct attachment to digital mob opinions; evaluate core need. |
| Reactive Outburst | Type 1 (Not Masculine) | `4` | Emotional Regulation | Deconstruct triggers causing loss of frame under acute pressure. |

#### `STATUS_GAME_LEXICON`
| Status_Tactic | Category | Counter_Strategy | Target_Sub_Skill | XP_Reward |
| :--- | :--- | :--- | :--- | :---: |
| Frame Test ("Shit Test") | Social Dynamics | Hold Frame / Agree & Amplify | Frame Control | `+50 XP` |
| Passive Aggression | Manipulation | Direct Socratic Inquiry | Psyop Recognition | `+75 XP` |
| Status Preemption | Power Moves | Strategic Silence / Re-frame | Status Dynamics | `+60 XP` |
| Gaslighting | Psychological | Fact Anchor / Document Ledgers | Narrative Intelligence | `+100 XP` |

### `LEXICON_ENGINE` & Values Alignment Shadow

The `LEXICON_ENGINE` tab assigns standardized numeric scores to qualitative tags (`Word | Category | Base_Score | Polarity | Framework_Source`). The **Values Alignment Shadow** continuously compares **Stated Values** (top 5 declared in Character Generation / Annual Review) against **Demonstrated Values** (top 5 most frequently tagged in rolling 90-day `RAW_DATA_EventLog` entries). Low alignment triggers an `Inauthenticity` alert, Metagame XP penalty, and mandatory Pillar 0 Shadow prompt; high alignment awards an **Integrity XP Bonus**.

---

## 5. Scoring Pyramids, XP Math & Mechanics

### Universal 5-Level Pyramid & 90% Mastery Gate

```text
+-----------------------------------------+
|   LEVEL 5: UNCONDITIONAL / LEGACY       |
+-----------------------------------------+
|   LEVEL 4: SYNERGISTIC / EMBODIMENT     |
+-----------------------------------------+
|   LEVEL 3: PEAK PERFORMANCE / GROWTH    |
+-----------------------------------------+
|   LEVEL 2: PROACTIVE / FORTRESS         |
+-----------------------------------------+
|   LEVEL 1: STABILITY / FOUNDATION       |
+-----------------------------------------+
```

- **Universal Mastery Threshold:** `90%`. Upper tiers remain mathematically locked until lower foundational tiers reach `>= 90%`.
- **Semantic Conditional Formatting (Law 8):**
  - `0% – 49%`: **Crimson** (Critical Failure / Foundational Drain)
  - `50% – 89%`: **Amber** (Progressing / Sub-Mastery)
  - `90% – 100%`: **Emerald** (Mastery Achieved / Tier Unlocked)

### Hybrid Scoring Engine (Reality Calibration)

Prevents self-assessment bias by weighting empirical real-world feedback (`2x`) over initial subjective hypothesis (`1x`):

$$\text{True Score} = \frac{\text{Baseline Score} + (2 \times \text{Dynamic Reality Score})}{3}$$

### `MASLOW_ENGINE` & Master Sovereignty Score (0–100)

$$\begin{aligned}
\text{Maslow Level 1 (Physiological)} &= \text{Health\_Base\_Score (Pillar 1)} \\
\text{Maslow Level 2 (Safety)} &= (\text{Wealth\_Base\_Score (Pillar 2)} \times 0.80) + (\text{Stress\_Resilience (Pillar 1)} \times 0.20) \\
\text{Maslow Level 3 (Love/Belonging)} &= \text{Relationship\_Base\_Score (Pillar 3)} \\
\text{Maslow Level 4 (Esteem)} &= (\text{Skills\_Base\_Score (Pillar 4)} \times 0.70) + (\text{Faction\_Reputation (Pillar 3)} \times 0.30) \\
\text{Maslow Level 5 (Self-Actualization)} &= (\text{Experience\_Base\_Score (Pillar 5)} \times 0.60) + (\text{P0\_WISDOM\_SCORE (Pillar 0)} \times 0.40)
\end{aligned}$$

$$\text{Sovereignty Score} = \sum_{k=1}^{5} \left(\text{Maslow Level}_k \times W_k\right) \quad \text{where } W = (0.30,\; 0.25,\; 0.20,\; 0.15,\; 0.10)$$

Dynamic difficulty scaling prevents advancing while lower tiers decay:

$$\text{Dynamic\_XP\_Required} = \text{Baseline\_XP\_for\_Next\_Level} \times \text{XP\_Multiplier}$$

*(All weights $0.80, 0.20, 0.70, 0.30, 0.60, 0.40$ and $W_1 \dots W_5$ MUST be stored in `RULES_ENGINE` cells and referenced dynamically—never hard-coded inside formulas.)*

---

## 6. Form Architecture & Write-Only Silo Schematics

All forms follow the **Closed-Loop Input Principle** (Law 3): structured dropdowns, bounded linear scales, checkboxes, and validated ranges replace free-text everywhere quantitative scoring occurs.

| # | Form Name | Cadence | Core Input Controls | Target Silo Sheet | Purpose |
| :---: | :--- | :--- | :--- | :--- | :--- |
| 1 | **Character Generation Form** | One-Time | Birth Date/Time/Location, HD Type, Life Path, MBTI, Big Five Percentiles (`0–100`), 15 Core Values dropdowns. | `RAW_DATA_CharacterGen` | Establishes Day 0 immutable character class & baseline charter. |
| 2 | **Daily Check-In Form** | Daily | Sleep/Nutrition/Hydration (`1–10`), Mood/Energy/Focus/Stress, Vices (Checkboxes), Habits, Prana (`1–10`). | `RAW_DATA_DailyCheckIn` | Drives daily vitality, habit streaks, Gunas, and Tier 3 buffs/debuffs. |
| 3 | **Weekly Review Form** | Weekly | Weekly Stress (`1–10`), Stress Source Pillar, Worldview/LoC selection, Regret Log by Pillar. | `RAW_DATA_WeeklyReview` | Calibrates momentum, LoC XP multipliers, and Regret Heat Map. |
| 4 | **Quarterly Life Audit Form** | Quarterly | 5 Philosophical Alignment prompts, Pillar Systems Audit (`1–10`), Primary Focus, Priority Quest, Timeline. | `RAW_DATA_QuarterlyAudit` | Drives "CEO Day" strategic cycle and LPD stage validation. |
| 5 | **Annual Vision & Philosophy Review** | Annual | 1/5/10-Year Visions, Metagame Victory Condition, Dynamic Archetype Re-tests, True Will Declaration. | `RAW_DATA_AnnualReview` | Prevents stagnation; updates True Will alignment baseline. |
| 6 | **Universal Intake Report Form** | As-Needed | Sphere dropdown (Love/Friend/Family/Network), Identifier, Objective Scorecards (`1–10`), Relational Market Dynamics, Strategic Intent. | `RAW_DATA_Intake` | Sovereign CRM entry point initializing contact dossiers. |
| 7 | **Universal Event Log Form** | High-Freq | Identifier dropdown, Event Date/Time, Description, Impact (`-3..+3`), Lexicon Tags, Paragon/Renegade/Neutral, Audio URL, 1st/2nd/3rd Perspective. | `RAW_DATA_EventLog` | Feeds Dynamic Reality Score, Antifragility XP, Values Alignment, Perspective-Taking. |
| 8 | **Shadow Journal Form** | Triggered | Trigger, Emotion, Story, Underlying Fear, Reframed Truth, Integrated Wisdom, Status (`Identified`/`Integrated`), `Seal in Obsidian Vault`. | `RAW_DATA_ShadowJournal` | Excavates subconscious blocks into Wisdom Points & Antifragility XP. |
| 9 | **New Quest Form** | As-Needed | Quest Name, Pillar, Tier (Epic/Major/Sub), Eisenhower Priority, Bloom Level, Due Date, Values, Time Benchmark (Hours), Hero's Journey toggle. | `RAW_DATA_Quests` | Universal goal intake feeding Skill Tree XP, Skip Tokens & Drive folders. |

---

## 7. Modular Google Apps Script (`.gs`) Automation Suite

Per **Law 2 (Modular Code Architecture)**, monolithic `.gs` files are strictly forbidden. Every automation project is compartmentalized into single-purpose `.gs` files reading IDs from `PropertiesService` (never hardcoded tokens):

```text
+-------------------------------------------------------+
|             GOOGLE APPS SCRIPT AUTOMATION             |
+-------------------------------------------------------+
| main.gs                  -> Custom Menu Setup          |
| rules_engine_automations -> Buffs/Debuffs & Emergent   |
| dynamic_challenges.gs    -> Nightly KPI Scan & Quests  |
| report_generator.gs      -> Google Doc / MD Synthesis  |
| biometric_importer.gs    -> Native OAuth2 Bio Sync     |
| calendar_sync.gs         -> Bi-directional Cal Sync    |
| achievements_monitor.gs  -> Daily Milestone Scan       |
| doppelganger_engine.gs   -> Nemesis Score Tracker      |
| ecosystem_integrators.gs -> Keep, Drive & Obsidian     |
+-------------------------------------------------------+
```

### 7.1 `main.gs` (`Core_OS_Hub`, `onOpen()`)
```javascript
/** @OnlyCurrentDoc */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('LifeOS')
    .addItem('Run System Sync', 'runSystemSync')
    .addItem('Execute Rules Engine Scan', 'runRulesEngineAutomations')
    .addItem('Evaluate Dynamic Challenges', 'evaluateDynamicChallenges')
    .addItem('Generate AI Briefing', 'pushSynthesisReport')
    .addItem('Scan Achievements', 'scanAchievements')
    .addItem('Process Doppelgänger Engine', 'processDoppelgangerEngine')
    .addToUi();
}

function runSystemSync() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  ss.toast('Initiating full system synchronization...', 'Life OS v3.0', 3);
  runRulesEngineAutomations();
  processDoppelgangerEngine();
  scanAchievements();
  ss.toast('System sync complete.', 'Life OS v3.0', 3);
}
```

### 7.2 `rules_engine_automations.gs` (`Core_OS_Hub`, Hourly Trigger)
Evaluates live `IMPORTS` / `SIGNAL_BUS` metrics against `RULES_ENGINE` (`EFFECT_CONDITIONS`), updates active Buffs/Debuffs (preserving blanks cleanly if unlogged—Law 3), enforces `OPS_GOVERNOR` max-2 WIP ceiling (Law 5), and monitors the Values Alignment Shadow.

```javascript
function runRulesEngineAutomations() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const rulesSheet = ss.getSheetByName('RULES_ENGINE');
  const charSheet = ss.getSheetByName('CHARACTER_SHEET');
  const importsSheet = ss.getSheetByName('IMPORTS');
  if (!rulesSheet || !charSheet || !importsSheet) return;

  const conditions = rulesSheet.getRange('EFFECT_CONDITIONS').getValues();
  const metricMap = {
    Pillar1_Sleep_Score: importsSheet.getRange('B2').getValue(),
    Prana_Level: importsSheet.getRange('B7').getValue(),
    'Doppelgänger_Score': importsSheet.getRange('B8').getValue(),
  };

  const activeEffects = [];
  for (let i = 1; i < conditions.length; i++) {
    const [metric, operator, threshold, effectName, , modifier] = conditions[i];
    const currentVal = metricMap[metric];
    if (currentVal === '' || currentVal === null || currentVal === undefined) continue;

    let met = false;
    if (operator === '<' && currentVal < threshold) met = true;
    if (operator === '>' && currentVal > threshold) met = true;
    if (operator === '>=' && currentVal >= threshold) met = true;
    if (operator === '=' && currentVal === threshold) met = true;
    if (met) activeEffects.push([effectName, modifier]);
  }

  charSheet.getRange('F5:G12').clearContent();
  if (activeEffects.length > 0) {
    charSheet.getRange(5, 6, activeEffects.length, 2).setValues(activeEffects);
  }
}
```

### 7.3 `dynamic_challenges.gs` (`Core_OS_Hub`, Nightly Trigger)
Reads KPI thresholds from `RULES_ENGINE` and appends corrective micro-quests into `RAW_DATA_Quests` (via `PropertiesService.getScriptProperties().getProperty('RAW_DATA_QUESTS_SHEET_ID')`) only when values are logged and below threshold (honoring `OPS_GOVERNOR` WIP caps).

### 7.4 `report_generator.gs` (`Core_OS_Hub`, Weekly/Quarterly or Manual)
Reads `AI_Synthesis_Report` and prepends a structured Markdown/Heading2 briefing into `LifeOS_Master_Synthesis_Report` (ID retrieved via `PropertiesService`, zero hardcoded IDs) for NotebookLM and Gemini ingestion.

### 7.5 `biometric_importer.gs` (`Pillar_1_Health` / `BIO_CORE`, Daily 4–5 AM Trigger)
Native OAuth2 client (Fitbit / Health Connect export pipeline; credentials stored strictly in `PropertiesService`) appending daily steps, sleep, HRV, and resting HR into write-only `RAW_DATA_Biometrics` (leaving unlogged fields blank `""`, never `0`).

### 7.6 `calendar_sync.gs` (`Pillar_5_Experience_Legacy`, Every 15–30 Min)
Scans `CLEAN_QUEST_LOG` for unscheduled incomplete quests with due dates, creates all-day events on the dedicated LifeOS Google Calendar (via `PropertiesService`), and writes back `Calendar_Event_ID` for idempotency.

### 7.7 `achievements_monitor.gs` (`Core_OS_Hub`, Daily Trigger)
Evaluates locked General Achievements (e.g., *The Sovereign* when `Sovereignty_Score >= 90`) against live Hub metrics and stamps unlock dates.

### 7.8 `doppelganger_engine.gs` (`Core_OS_Hub` / `ID_DOPPELGANGER`, Daily Trigger)
Compares daily habit compliance against logged vices to update `Doppelgänger_Score` vs. `Discipline_Score`; appends a high-priority `[Redemption Quest]` into `RAW_DATA_Quests` and raises the `Dominated` debuff when the nemesis leads.

### 7.9 `ecosystem_integrators.gs` (`Core_OS_Hub`, Hourly / `onFormSubmit`)
Parses `#LifeOS_Inbox` captures, provisions structured Google Drive project folders for new Epic/Major Quests (ID from `PropertiesService`), and handles Obsidian Vault Markdown sealing for integrated Pillar 0 Shadow entries.

---

## 8. User Interface, Executive Sheet Standards & Presentation Layer

### Core OS Hub Dashboard Views

1. **`CHARACTER_SHEET`** — Macro landing HUD displaying 4 Master `SPARKLINE` Vital Bars (**HP/Vitality**, **Mana/Focus**, **Stamina/Recovery**, **Coherence/Alignment**), Global Level & Fibonacci XP bar, Active Buffs/Debuffs, Priority Quests (`OPS_GOVERNOR` `0/2` – `2/2`), Equipped Brick Loadout, and Unlocked Achievements—100% formula-driven (`XLOOKUP`, `FILTER`, `SPARKLINE`) with zero static cells.
2. **`AQAL_VIEW`** — 2×2 Integral Balance Matrix:
   ```text
   +------------------------------------+------------------------------------+
   | UPPER-LEFT (UL - "I"): INTENTION   | UPPER-RIGHT (UR - "IT"): BEHAVIOR  |
   | Subjective Interior                | Objective Individual               |
   | - Level of Consciousness (LoC)     | - Pillar 1 Health & Vitality Score |
   | - Active Shadow Integration Count  | - Sleep / Biometric Baseline       |
   | - Psychometric Coherence           | - Pillar 4 Career Level / Title    |
   +------------------------------------+------------------------------------+
   | LOWER-LEFT (LL - "WE"): CULTURE    | LOWER-RIGHT (LR - "ITS"): SYSTEMS  |
   | Intersubjective Collective         | Interobjective Collective          |
   | - Pillar 3 Relationship Base Score | - Master Sovereignty Score (0-100) |
   | - Faction Reputation Scores        | - Pillar 2 FIRE Progress Score %   |
   | - Moral Alignment (Paragon/Reneg.) | - External Systems & Travel Index  |
   +------------------------------------+------------------------------------+
   ```
3. **`SWORD_VIEW`** — Archetypal Sword Metaphor Dashboard with 90-day `=SPARKLINE(...)` trends:
   ```text
          / \
         /   \     [POINT]:       Pillar 4 Mission Alignment Score
        |  |  |
        |  |  |    [EDGE]:        Pillar 3 Frame Control & Social Assertiveness
        |  |  |
        |  |  |    [SPINE]:       Values Alignment Score (Integrity Index)
        |  |  |
        |  |  |    [QUILLONS]:    Pillar 2 Financial Reserve & Safety Buffer
        |  |  |
        +--+--+    [KNUCKLE-BOW]: Pillar 1 Physical Defense & Health Base
           ||
           ||      [GRIP]:        Pillar 0 Subconscious Control & Shadow Integration
           ||
          (  )     [POMMEL]:      Pillar 5/6 Spiritual Base & Self-Actualization
   ```
4. **Looker Studio & Android HUD (`src/android_hud/`) — Fractal Progress Hierarchy:**
   - **Level 1 (Macro Overview):** Character Sheet, Sovereignty Score, 7 Pillar gauges, `OPS_GOVERNOR` WIP indicator.
   - **Level 2 (Domain Deep-Dives):** Click-through Pillar & Brick dashboards (Skill Tree, Ikigai Radar, Sephirot Radar, BodyGraph, Travel Timeline).
   - **Level 3 (Granular Micro-Actions):** Interactive Quest Log sub-tasks and daily habit compliance ledgers.

### Executive Visual Styling Standard (Law 8)

Every created or upgraded Google Sheet tab applies:
- **Banner Headers:** Dark-slate/obsidian (`#0F172A` / `#1E293B`) with bold white typography.
- **Pillar Palette:** Emerald HP/Mastery, Cyan Mana, Gold XP, Violet Esoteric/Kabbalah, Crimson Critical Alerts.
- **Semantic Badges:** Conditional formatting bands (`0–49%` Crimson, `50–89%` Amber, `90–100%` Emerald; plus `LIVE`/`FRESH`/`STALE`/`BUFF`/`DEBUFF`).
- **Layout Polish:** Frozen header rows/columns, auto-fitted padded column widths, subtle alternating row banding on tables, `hideGridlines: true` on executive HUD tabs, and native `SPARKLINE` gauges + embedded charts.

---

## 9. System Architecture Synthesis

Life OS v3.0 establishes a sovereign, self-contained personal operating system. Unidirectional raw data ingestion guarantees pristine write-only ledgers; encapsulated Pillar engines and standalone Lego Bricks compute domain intelligence via dynamic blank-safe formulas and Two-Pass `SIGNAL_BUS` context; and the Core OS Hub translates verified scores into transparent `RULES_ENGINE` physics, executive HUD dashboards, Android HUD telemetry, and clean Markdown/Doc synthesis for NotebookLM and Gemini—all engineered and version-controlled through Antigravity and GitHub (`TheCanvasNomad/life-os-v3`).
