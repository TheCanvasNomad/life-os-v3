# LifeOS v3.0 — Apps Script & Trigger Readiness Manifest

> **Audit Date:** `2026-11-26`  
> **Scope:** Complete audit of all active modules in `schemas/workbook_registry.json`, `LifeOS_feed_hub!MODULE_REGISTRY`, `LifeOS_Master_Bus!WORKBOOK_DIRECTORY`, and the live Google Spreadsheets inside `LifeOS_v3_Control` (`1cCrkeThYdMl4BOTI0ww8dhSxlpBPE53J`).  
> **Architectural Laws Enforced:** Law 1 (Layer-1 Raw Tabs Strictly Read-Only), Law 2 (Two-Pass Non-Circular Hub Routing), Law 7 (Strict Zero-PII / Zero-Private-Prose Boundary on `LOOKER_*` & `SIGNALS_OUT`), Concurrency Locking (`LockService.getScriptLock()`), and Idempotent One-Click `setupTriggers()` Installers.

---

## 1. Executive Summary

| Ecosystem Tier | Total Audited | `SCRIPT_REQUIRED` | `ZERO_SCRIPT_FORMULA_PURE` | Ready-to-Paste `.gs` Files |
| :--- | :---: | :---: | :---: | :---: |
| **Core Hubs & Character HUD** | 3 | **1** (`ID_FEED_HUB`) | **2** (`LifeOS_Master_Bus`, `ID_CHARACTER_HUD`) | `scripts/gas/ID_FEED_HUB.gs` |
| **Standalone Lego Bricks** | 26 | **11** | **15** | 11 files in `scripts/gas/` |
| **Utilities & CRM/Biometric Engines** | 6 | **4** (`XP`, `BIO_CORE`, `Core_CRM`, `Contacts`) | **2** (`Purged_Vault`, `NotebookLM_Social`) | 4 files in `scripts/gas/` |
| **The 7 Pillars (`Pillar 0–6`)** | 7 | **7** | **0** | 7 files in `scripts/gas/` |
| **Legacy Bound Log (`ID_MASTER_LOG`)** | 1 | **0** | **1** *(superseded)* | None needed |
| **Layer-1 `RAW_DATA_*` Silos** | 22 | **0** *(Law 1 Write-Only)* | **22** | None permitted (Law 1) |
| **TOTAL ECOSYSTEM** | **65** | **23** | **42** | **23 verified `.gs` bundles** |

### Key Takeaways
- **42 workbooks (19 active bricks/hubs/vaults + 1 legacy log + 22 Layer-1 `RAW_DATA_*` silos) work 100% out-of-the-box with pure Google Sheets formulas**—zero Apps Script or triggers required.
- **23 active workbooks require Apps Script (`.gs`) + installable triggers** across the Four Functional Gates:
  - **10 newly authored / upgraded Tier-1 Brick scripts** (previously `No Script Attached` or missing `FormApp` bindings).
  - **13 consolidated Hub, Utility & Pillar scripts** (previously split across `src/`, now bundled into single paste-ready `scripts/gas/<KEY>.gs` files with unified `onOpen()` menus and one-click `setupTriggers()`).

---

## 2. Four Functional Script-Dependency Gates

| Gate | Capability | Why Pure Formulas Cannot Do It |
| :---: | :--- | :--- |
| **Gate 1** | **Dynamic Form Dropdown Sync (`FormApp.openById`)** | Google Forms cannot read live ranges from Google Sheets; Apps Script must push updated Titles/Prompts/Trips/Habits/Contacts/Categories into Form `LIST` / `MULTIPLE_CHOICE` items. |
| **Gate 2** | **Append-Only Historical Snapshot Archiving (`onFormSubmit`)** | Dynamic formulas always evaluate the latest state or recompute live; freezing point-in-time historical runs (Saboteurs, Sovereignty, Grit, RIASEC, Daily XP) into immutable archive rows requires an `onFormSubmit` / daily append handler. |
| **Gate 3** | **External Workspace & API Ingestion (`CalendarApp`, `People`, `DriveApp`, `DocumentApp`, `UrlFetchApp`, `doPost`)** | Formulas cannot write Google Calendar events, sync Google Contacts via People API, provision Drive folders, append Mythos Codex Docs, or ingest Health Connect / Obsidian webhooks. |
| **Gate 4** | **Hub Heartbeat, Stale-Cache Nudge & Menu Controls (`onOpen` / Time-Driven)** | Periodic `SpreadsheetApp.flush()` + metadata heartbeat stamps prevent idle `IMPORTRANGE` / `SIGNAL_BUS` / `LOOKER_*` cache staleness and expose one-click manual sync menus. |

---

## 3. Master Script & Trigger Matrix — Part A: `SCRIPT_REQUIRED` (23 Workbooks)

> Every workbook below has a dedicated, syntax-validated, copy-paste-ready `.gs` file at **`scripts/gas/<REGISTRY_KEY>.gs`** with a single **`setupTriggers()`** installer.

| Brick / Workbook Name & Registry Key | Script Verdict | Current Script Status | Required Script Function(s) | Required Trigger Type & Cadence | Linked Form ID / External Scope Needed | Ready-to-Paste Script |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **🧠 LifeOS_feed_hub** (`ID_FEED_HUB`) | `SCRIPT_REQUIRED` *(Gates 3 & 4)* | `Script Present / Missing Trigger` *(upgraded from `src/hub/calendar_sync.gs`)* | `syncLifeOSCalendarAll`, `pullEventsToLog`, `pushQuestsToCalendar`, `runHubHeartbeatNudge`, `onOpen`, `setupTriggers` | `Time-driven: Every 15 min` (Cal) + `Every 6 hours` (Heartbeat) + `On open` | `SpreadsheetApp`, `CalendarApp`, `ScriptApp`, `LockService`, `PropertiesService` | [`ID_FEED_HUB.gs`](../scripts/gas/ID_FEED_HUB.gs) |
| **🎬 Cinema_Intelligence_Brick** (`ID_MOVIES`) | `SCRIPT_REQUIRED` *(Gates 1 & 4)* | `Script Present / Missing Trigger` *(upgraded w/ live `FormApp` sync)* | `syncAllCinemaForms`, `onCinemaFormSubmit`, `onOpen`, `setupTriggers` | `On form submit` + `Time-driven: Every 6 hours` + `On open` | `FormApp` (F2 `17hYrzrY6nPiGiNNADcyLjiUGEvIiaaUKjCF93o2IomY`, F3 `1boYElMlLHpeJzKIEaktInJjfRbsClzgoL6Ej4wDp_qE`, F4 `1Jkt13uUTkSJFaHGYaDLvfxmpfDyZWg1dAHfHqE48Pps`, F5 `1Lyzqdg-5nU-qUkpuYZK-Vkn02vAw_RzK-2PmMdsaunY`), `SpreadsheetApp`, `LockService` | [`ID_MOVIES.gs`](../scripts/gas/ID_MOVIES.gs) |
| **⚖️ Belief & Stance Tracker (Life OS)** (`ID_BELIEF_TRACKER`) | `SCRIPT_REQUIRED` *(Gates 1 & 4)* | `No Script Attached` | `syncBeliefPromptDropdown`, `onBeliefFormSubmit`, `onOpen`, `setupTriggers` | `On form submit` + `Time-driven: Every 6 hours` + `On open` | `FormApp` (Form B `1lcFB-I_hc2uXv2ONbx5kHs25L16Zmd4luiUzssK7AqQ`; Form A `1vnjN31gigBJp5RFQVtn7ODcnpYOsVvn_b5ckbYkbt2c`), `SpreadsheetApp`, `LockService` | [`ID_BELIEF_TRACKER.gs`](../scripts/gas/ID_BELIEF_TRACKER.gs) |
| **🎭 PQ_Saboteur_Brick** (`ID_PQ`) | `SCRIPT_REQUIRED` *(Gates 2 & 4)* | `No Script Attached` | `archivePQSnapshotOnSubmit`, `backfillMissingPQSnapshots`, `onOpen`, `setupTriggers` | `On form submit` + `On open` | Linked Form `1OFsoVZQNhQCjGvxw7bBOLnpGt2T-ptUY5JJbX3IuuaI`; `SpreadsheetApp`, `ScriptApp`, `LockService` | [`ID_PQ.gs`](../scripts/gas/ID_PQ.gs) |
| **⚖️ Sovereignty_Desire_Brick** (`ID_SOVEREIGNTY_DESIRE`) | `SCRIPT_REQUIRED` *(Gates 2 & 4)* | `No Script Attached` | `archiveSovereigntySnapshotOnSubmit`, `onOpen`, `setupTriggers` | `On form submit` + `On open` | Linked Form `1-a-vSCiBrDuKnwTqZI5I-OxTOVsYoCXvtsRVqOzlOpo`; `SpreadsheetApp`, `ScriptApp`, `LockService` | [`ID_SOVEREIGNTY_DESIRE.gs`](../scripts/gas/ID_SOVEREIGNTY_DESIRE.gs) |
| **🏛️ Civic_Sovereignty_Brick** (`ID_CIVIC_SOVEREIGNTY`) | `SCRIPT_REQUIRED` *(Gates 2 & 4)* | `No Script Attached` | `archiveCivicSnapshotOnSubmit`, `onOpen`, `setupTriggers` | `On form submit` + `On open` | Linked Form `1_TzoBT8sMzuG2r0N6dmi5oZkU2U-jzHdIHerLMqMPYA`; `SpreadsheetApp`, `ScriptApp`, `LockService` | [`ID_CIVIC_SOVEREIGNTY.gs`](../scripts/gas/ID_CIVIC_SOVEREIGNTY.gs) |
| **🔥 Grit Score Assessment** (`ID_GRIT`) | `SCRIPT_REQUIRED` *(Gates 2 & 4)* | `No Script Attached` | `archiveGritSnapshotOnSubmit`, `onOpen`, `setupTriggers` | `On form submit` + `On open` | Linked Form `1MKMfXAtb-ooZnGHccTyqjjudk3PyMdwSGKTpXSFKFbY`; `SpreadsheetApp`, `ScriptApp`, `LockService` | [`ID_GRIT.gs`](../scripts/gas/ID_GRIT.gs) |
| **🧭 RIASEC_Brick** (`ID_RIASEC`) | `SCRIPT_REQUIRED` *(Gates 2 & 4)* | `No Script Attached` | `archiveRiasecSnapshotOnSubmit`, `onOpen`, `setupTriggers` | `On form submit` + `On open` | Linked Form `1oG9UIE5IFPSqnDhb5jzFcW-6_y7YTupB1DbvIRN7I8w`; `SpreadsheetApp`, `ScriptApp`, `LockService` | [`ID_RIASEC.gs`](../scripts/gas/ID_RIASEC.gs) |
| **🌍 Travel_Tracker_Brick** (`ID_TRAVEL`) | `SCRIPT_REQUIRED` *(Gates 1, 3 & 4)* | `No Script Attached` | `syncTravelReviewDropdown`, `onTravelFormSubmit`, `syncUpcomingTripsToCalendar`, `runTravelDailySync`, `onOpen`, `setupTriggers` | `On form submit` + `Time-driven: Daily 6:00 AM` + `On open` | `FormApp` (Form A `18g_CLV1ry5gXdzx3iZWO3G95vK1LlA2hVSotqoNPwkU`, Form B `1D9IWDydIGrmxNUiY-mJkeQT8LMryaOJpWEjS2dkWb1M`), `CalendarApp`, `SpreadsheetApp` | [`ID_TRAVEL.gs`](../scripts/gas/ID_TRAVEL.gs) |
| **💼 LifeOS Career and Experience Intake** (`ID_CAREER_INTAKE`) | `SCRIPT_REQUIRED` *(Gates 1 & 4)* | `No Script Attached` | `syncCareerIntakeDropdowns`, `onCareerFormSubmit`, `onOpen`, `setupTriggers` | `On form submit` + `Time-driven: Daily 7:00 AM` + `On open` | `FormApp` (Form `1ONcs8wlxWBzrz8_0Gbj68jkyR-OoH2JG0Ucq4lK0LO4`), `SpreadsheetApp`, `LockService` | [`ID_CAREER_INTAKE.gs`](../scripts/gas/ID_CAREER_INTAKE.gs) |
| **🏅 Achievements_Engine_Brick** (`ID_ACHIEVEMENTS`) | `SCRIPT_REQUIRED` *(Gates 1 & 4)* | `Script Present / Missing Trigger` *(bundled from `src/bricks_sync/`)* | `syncAchievementFormDropdowns`, `onAchievementFormSubmit`, `onOpen`, `setupTriggers` | `On form submit` + `Time-driven: Every 6 hours` + `On open` | `FormApp` (Form `1GQxmuG2avfYZXPKOXxgdQwHVoqXp-Pc3hwz4oVeTOa0`), `SpreadsheetApp`, `LockService` | [`ID_ACHIEVEMENTS.gs`](../scripts/gas/ID_ACHIEVEMENTS.gs) |
| **🧭 Daily_Intake_Brick** (`ID_DAILY_INTAKE`) | `SCRIPT_REQUIRED` *(Gates 2, 3 & 4)* | `No Script Attached` | `onDailyIntakeSubmit`, `syncDailyPulseToCalendar`, `onOpen`, `setupTriggers` | `On form submit` + `Time-driven: Daily 10:00 PM` + `On open` | Linked Form `1ruSKA_komkQJWNCpM8OzsyCKJWGf2gde7bm6QFxRot0`; `CalendarApp` (Zero-PII numeric summary only), `SpreadsheetApp` | [`ID_DAILY_INTAKE.gs`](../scripts/gas/ID_DAILY_INTAKE.gs) |
| **🎮 XP Leveler** (`ID_XP_HUB`) | `SCRIPT_REQUIRED` *(Gates 2 & 4)* | `Script Present / Missing Trigger` *(bundled from `src/utilities/xp_hub/`)* | `syncPillarXpToLedger`, `onOpen`, `setupTriggers` | `Time-driven: Daily 11:55 PM` + `On open` | `SpreadsheetApp`, `ScriptApp`, `LockService` | [`ID_XP_HUB.gs`](../scripts/gas/ID_XP_HUB.gs) |
| **🩺 BIO_CORE** (`ID_BIO_CORE`) | `SCRIPT_REQUIRED` *(Gates 3 & 4)* | `Script Present / Missing Trigger` *(bundled from `src/utilities/bio_core/` + `biometric_core/`)* | `doPost`, `doGet`, `logSummaryToCalendar`, `onOpen`, `setupTriggers` | `Time-driven: Daily 11:00 PM` + Web App (`doPost`) + `On open` | `CalendarApp`, `SpreadsheetApp`, `PropertiesService`, Web App Webhook | [`ID_BIO_CORE.gs`](../scripts/gas/ID_BIO_CORE.gs) |
| **📇 Core_CRM** (`ID_CORE_CRM`) | `SCRIPT_REQUIRED` *(Gates 3 & 4)* | `Script Present / Missing Trigger` *(bundled from `src/utilities/crm_core/`)* | `syncCrmCalendarTwoWay`, `runFullSymbiosisOrchestrator`, `executeBulkCohortAction`, `quickPurgeEmailOnlyToVault`, `onOpen`, `setupTriggers` | `Time-driven: Every 6 hours` (Cal) + `Daily 6:00 AM` (Symbiosis) + `On open` | `CalendarApp`, `People` (Advanced Service), `SpreadsheetApp`, `LockService` | [`ID_CORE_CRM.gs`](../scripts/gas/ID_CORE_CRM.gs) |
| **📱 Master_Contacts_Sync** (`ID_MASTER_CONTACTS_SYNC`) | `SCRIPT_REQUIRED` *(Gates 3 & 4)* | `Script Present / Missing Trigger` *(bundled from `src/utilities/crm_core/`)* | `syncGoogleContactsTwoWay`, `runFullTwoWaySync`, `pullFromGoogleContacts`, `pushSheetEditsToGoogleContacts`, `executeVaultActions`, `onOpen`, `setupTriggers` | `Time-driven: Every 15 minutes` + `On open` | `People` (Google Contacts Advanced Service), `SpreadsheetApp`, `LockService` | [`ID_MASTER_CONTACTS_SYNC.gs`](../scripts/gas/ID_MASTER_CONTACTS_SYNC.gs) |
| **🌑 Pillar_0_Shadow_Self** (`ID_PILLAR_0`) | `SCRIPT_REQUIRED` *(Gates 1, 3 & 4)* | `Script Present / Missing Trigger` *(bundled from `src/pillars/p0_shadow/`)* | `sealIntegratedShadowsToObsidianVault`, `routeShadowTripwiresToQuests`, `upgradeShadowJournalFormToV3`, `onOpen`, `setupTriggers` | `Time-driven: Daily 11:30 PM` (Obsidian) + `Every 6 hours` (Tripwires) + `On open` | `FormApp` (`1ND9p5_lNx_6KAi2Tts9x96HB-k4epKi_7gaMtr-F_kA`), `UrlFetchApp`, `DriveApp`, `SpreadsheetApp`, `PropertiesService` | [`ID_PILLAR_0.gs`](../scripts/gas/ID_PILLAR_0.gs) |
| **💚 Pillar_1_Health** (`ID_PILLAR_1`) | `SCRIPT_REQUIRED` *(Gates 1 & 4)* | `Script Present / Missing Trigger` *(bundled from `src/pillars/p1_health/`)* | `syncDailyHabitsToForm`, `handleHabitManagerEdit`, `setupAndAlignDailyCheckInForm`, `onOpen`, `setupTriggers` | `On edit` + `Time-driven: Daily 5:00 AM` + `On open` | `FormApp` (`1wJV0-OBFUHnCQVK9M3-nKh1EX_eLh842HAkMcU9b77U`), `SpreadsheetApp`, `PropertiesService` | [`ID_PILLAR_1.gs`](../scripts/gas/ID_PILLAR_1.gs) |
| **💰 Pillar_2_Wealth** (`ID_PILLAR_2`) | `SCRIPT_REQUIRED` *(Gates 1, 2 & 4)* | `Script Present / Missing Trigger` *(bundled from `src/pillars/p2_wealth/`)* | `syncLatestReviewAllocations`, `auditFinancialStatusAndGovernance`, `promptAndAllocateSurplus`, `upgradeFinancialReviewFormToV3`, `onOpen`, `setupTriggers` | `Time-driven: Daily 7:00 AM` & `7:15 AM` + `On open` | `FormApp` (`1v9vmAsluHo9jr49-BN-4XxLgUU3R6zV5j8sqpPVoTuY`), `SpreadsheetApp`, `LockService`, `PropertiesService` | [`ID_PILLAR_2.gs`](../scripts/gas/ID_PILLAR_2.gs) |
| **💞 Pillar_3_Relationships** (`ID_PILLAR_3`) | `SCRIPT_REQUIRED` *(Gates 1 & 4)* | `Script Present / Missing Trigger` *(bundled from `src/pillars/p3_relationships/`)* | `syncCrmDropdownsToForms`, `createMissingDossierSheets`, `onOpen`, `setupTriggers` | `Time-driven: Daily 6:00 AM` + `On open` | `FormApp` (Event Log Form via Script Property `UNIVERSAL_EVENT_LOG_FORM_ID`), `SpreadsheetApp` | [`ID_PILLAR_3.gs`](../scripts/gas/ID_PILLAR_3.gs) |
| **🛠️ Pillar_4_Skills_Mission** (`ID_PILLAR_4`) | `SCRIPT_REQUIRED` *(Gates 1, 3 & 4)* | `Script Present / Missing Trigger` *(bundled from `src/pillars/p4_skills/`)* | `runPillar4AutomationSuite`, `generateGapAnalysisQuests`, `importYouTubeLearningQueue`, `upgradeQuarterlyCareerFormToV3`, `onOpen`, `setupTriggers` | `Time-driven: Daily 8:00 AM` + `On open` | `FormApp` (`1V9D2L4pWx4D-gzKpUAA9CdVfXLQbh0r9Rza6npn5Lf4`), `YouTube` (optional Advanced Service), `SpreadsheetApp`, `LockService` | [`ID_PILLAR_4.gs`](../scripts/gas/ID_PILLAR_4.gs) |
| **🏆 Pillar_5_Experience_Legacy** (`ID_PILLAR_5`) | `SCRIPT_REQUIRED` *(Gates 1, 3 & 4)* | `Script Present / Missing Trigger` *(bundled from `src/pillars/p5_experience/`)* | `runPillar5AutomationSuite`, `syncParentQuestDropdownAndHerosJourney`, `provisionQuestDriveFolders`, `appendCompletedQuestsToMythosCodex`, `onOpen`, `setupTriggers` | `Time-driven: Every 6 hours` + `On open` | `FormApp` (`1OtyJa4NWMcxlYNj2JvNBmiRcBgXYBQ2z2yM6IoZ_scE`, `10Cfy5W3Mehew_GMaPfqcxjBXxSSDz9FSSACTzgFNtwM`), `DriveApp`, `DocumentApp`, `CalendarApp`, `SpreadsheetApp` | [`ID_PILLAR_5.gs`](../scripts/gas/ID_PILLAR_5.gs) |
| **🔮 Pillar_6_Esoteric_Self** (`ID_PILLAR_6`) | `SCRIPT_REQUIRED` *(Gates 1 & 4)* | `Script Present / Missing Trigger` *(bundled from `src/pillars/p6_esoteric/`)* | `upgradeAllPillar6Layer1Forms`, `insertNextSigilRow`, `stampPillar6WeeklyHeartbeat`, `onOpen`, `setupTriggers` | `Time-driven: Weekly Sunday 8:00 AM` + `On open` | `FormApp` (Daily Check-In, Annual Review, Quests, Event Log Forms), `SpreadsheetApp`, `LockService` | [`ID_PILLAR_6.gs`](../scripts/gas/ID_PILLAR_6.gs) |

---

## 4. Master Script & Trigger Matrix — Part B: `ZERO_SCRIPT_FORMULA_PURE` (20 Active/Bound Workbooks + 22 Layer-1 Silos)

> **Zero Apps Script needed.** Every workbook below runs 100% live via blank-safe dynamic Sheets formulas (`IF(ISBLANK(...), "", ...)`) and Two-Pass Hub `IMPORTRANGE` routing (`LifeOS_feed_hub!SIGNAL_BUS`).

| Brick / Workbook Name & Registry Key | Script Verdict | Current Script Status | Required Script Function(s) | Required Trigger Type & Cadence | Linked Form ID / External Scope Needed |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **⚡ LifeOS_Master_Bus** (`LifeOS_Master_Bus`) | `ZERO_SCRIPT_FORMULA_PURE` | `No Script Attached` | None *(1-link `HUB_SIGNAL_RELAY` pure formulas)* | `None` | None *(reads Hub `SIGNAL_BUS` dynamically)* |
| **🎮 CHARACTER_PROFILE_HUD** (`ID_CHARACTER_HUD`) | `ZERO_SCRIPT_FORMULA_PURE` | `No Script Attached` | None *(pure `DOSSIER_ENGINE` + `CONTEXT_IN`)* | `None` | None *(reads Hub `SIGNAL_BUS` dynamically)* |
| **🧬 Big-Five Personality Assessment** (`ID_OCEAN`) | `ZERO_SCRIPT_FORMULA_PURE` | `No Script Attached` | None *(pure IPIP-50 dynamic scoring)* | `None` | None *(static fixed-choice Likert Form)* |
| **🧩 Myers-Briggs Test** (`ID_MBTI`) | `ZERO_SCRIPT_FORMULA_PURE` | `No Script Attached` | None *(pure cognitive-stack formulas)* | `None` | None *(static fixed-choice Form)* |
| **🔯 Enneagram Assessment** (`ID_ENNEAGRAM`) | `ZERO_SCRIPT_FORMULA_PURE` | `No Script Attached` | None *(pure Tritype/Arrow formulas)* | `None` | None *(static fixed-choice Form)* |
| **🧪 Life OS // Cattell 16PF** (`ID_16PF`) | `ZERO_SCRIPT_FORMULA_PURE` | `No Script Attached` | None *(pure 16-factor + Global 5 formulas)* | `None` | None *(static fixed-choice Form)* |
| **🏛️ Maslow's Hierarchy of Needs** (`ID_MASLOW`) | `ZERO_SCRIPT_FORMULA_PURE` | `No Script Attached` | None *(pure 5-tier dynamic formulas)* | `None` | None *(static fixed-choice Form)* |
| **💠 Human Design OS** (`ID_HD`) | `ZERO_SCRIPT_FORMULA_PURE` | `No Script Attached` | None *(immutable natal chart + Hub `CONTEXT_IN`)* | `None` | None |
| **♈ Zodiac OS** (`ID_ZODIAC`) | `ZERO_SCRIPT_FORMULA_PURE` | `No Script Attached` | None *(immutable natal transits + `TODAY()` formulas)* | `None` | None |
| **🌳 Kaballah Tree of Life OS Engine** (`ID_KABBALAH`) | `ZERO_SCRIPT_FORMULA_PURE` | `No Script Attached` | None *(pure Sephirot + Hub `CONTEXT_IN`)* | `None` | None |
| **💞 Love_Styles_&_Languages_Brick** (`ID_LOVE_STYLES`) | `ZERO_SCRIPT_FORMULA_PURE` | `No Script Attached` | None *(pure formulas + consolidated `RAW_DATA_LoveLanguage` & `SenseOfTouch`)* | `None` | None |
| **🧠 Emotional_Intelligence_Brick** (`ID_EQ`) | `ZERO_SCRIPT_FORMULA_PURE` | `No Script Attached` | None *(pure 4-quadrant EQ formulas)* | `None` | None |
| **👤 Doppelganger_Brick** (`ID_DOPPELGANGER`) | `ZERO_SCRIPT_FORMULA_PURE` | `No Script Attached` | None *(pure Shadow Tax formulas via `CONTEXT_IN`)* | `None` | None |
| **🌡️ Dynamic_Stress_Brick** (`ID_DYNAMIC_STRESS`) | `ZERO_SCRIPT_FORMULA_PURE` | `No Script Attached` | None *(pure allostatic-load formulas)* | `None` | None |
| **🎭 Four_Temperaments_Brick** (`ID_FOUR_TEMPERAMENTS`) | `ZERO_SCRIPT_FORMULA_PURE` | `No Script Attached` | None *(pure temperament scoring formulas)* | `None` | None |
| **🏛️ Weekly_Maslow_Pulse** (`ID_WEEKLY_MASLOW_PULSE`) | `ZERO_SCRIPT_FORMULA_PURE` | `No Script Attached` | None *(pure weekly stability formulas)* | `None` | None |
| **⚡ Daily_State_Pulse** (`ID_DAILY_STATE_PULSE`) | `ZERO_SCRIPT_FORMULA_PURE` | `No Script Attached` | None *(pure daily pulse formulas)* | `None` | None |
| **🔒 Body Count 2.0** (`ID_BODY_COUNT`) | `ZERO_SCRIPT_FORMULA_PURE` | `No Script Attached` | None *(strictly private; internal `CRM_LOVE_LIFE_REF` data validation)* | `None` | None *(Zero external exposure)* |
| **🗄️ Purged_Contacts_Vault** (`ID_PURGED_CONTACTS_VAULT`) | `ZERO_SCRIPT_FORMULA_PURE` | `No Script Attached` | None *(passive vault written by `ID_MASTER_CONTACTS_SYNC` / `ID_CORE_CRM`)* | `None` | None |
| **📓 NotebookLM_Social_Workbook** (`ID_NOTEBOOKLM_SOCIAL`) | `ZERO_SCRIPT_FORMULA_PURE` | `No Script Attached` | None *(passive Zero-PII sink written by `ID_CORE_CRM`)* | `None` | None |
| **🗂️ LifeOS - Master Log** (`ID_MASTER_LOG`) | `ZERO_SCRIPT_FORMULA_PURE` | `No Script Attached` | None *(legacy bound log superseded by `LifeOS_feed_hub`)* | `None` | None |
| **🔴 All 22 Layer-1 `RAW_DATA_*` Silos** *(Write-Only)* | `ZERO_SCRIPT_FORMULA_PURE` | `No Script Attached` *(Law 1 Protected)* | **STRICTLY NONE** (`RAW_DATA_DailyCheckIn`, `Intake`, `EventLog`, `Quests`, `AnnualReview`, `CareerReview`, `FinancialReview`, `ShadowJournal`, `TravelBucketList`, `BucketListAudit`, `LoveLanguage`, `101_Traveler`, `RegretAudit`, `SenseOfTouch`, `FearInsecurities`, `PastReflections`, `FlowState`, `PersonalDevelopment`, `LifeAudit`, `5Q_LifeAudit`, `WeeklyRelationshipCheck`, `RomanticRelationships`, `KnowThySelf`, `Preference`) | `None` *(Law 1 immutable raw logs)* | None |

---

## 5. Prioritized "Top Bricks to Wire First" Installation Checklist

For EVERY workbook below, installation takes **~30 seconds**:
1. Open the Google Spreadsheet.
2. Click **Extensions → Apps Script**.
3. Replace `Code.gs` with the full contents of the linked `scripts/gas/<KEY>.gs` file and click **Save (`Ctrl+S`)**.
4. Select **`setupTriggers`** from the function dropdown at the top and click **Run** (approve the Google OAuth prompt once).

### Phase 1 — Highest Immediate System Impact (Wire These 8 First!)
- [ ] **1. `LifeOS_feed_hub`** (`ID_FEED_HUB`) — Paste [`scripts/gas/ID_FEED_HUB.gs`](../scripts/gas/ID_FEED_HUB.gs) → Run `setupTriggers()`  
  *Unlocks 15-min two-way Calendar sync + 6-hour Hub Heartbeat that keeps all 278 `SIGNAL_BUS` signals and 30 Looker tabs fresh.*
- [ ] **2. `🎬 Cinema_Intelligence_Brick`** (`ID_MOVIES`) — Paste [`scripts/gas/ID_MOVIES.gs`](../scripts/gas/ID_MOVIES.gs) → Run `setupTriggers()`  
  *Unlocks live dropdown syncing across all 4 re-rank/review Forms (Movie Title, Actor, Director, Genre).*
- [ ] **3. `⚖️ Belief & Stance Tracker`** (`ID_BELIEF_TRACKER`) — Paste [`scripts/gas/ID_BELIEF_TRACKER.gs`](../scripts/gas/ID_BELIEF_TRACKER.gs) → Run `setupTriggers()`  
  *Auto-populates Form B (`Prompt_Anchor`) whenever a new claim is logged in Form A.*
- [ ] **4. `🎭 PQ_Saboteur_Brick`** (`ID_PQ`) — Paste [`scripts/gas/ID_PQ.gs`](../scripts/gas/ID_PQ.gs) → Run `setupTriggers()`  
  *Freezes every new Saboteur retake into `Historical_Snapshots` without overwriting prior baselines.*
- [ ] **5. `⚖️ Sovereignty_Desire_Brick`** (`ID_SOVEREIGNTY_DESIRE`) — Paste [`scripts/gas/ID_SOVEREIGNTY_DESIRE.gs`](../scripts/gas/ID_SOVEREIGNTY_DESIRE.gs) → Run `setupTriggers()`  
  *Captures immutable longitudinal snapshots into `SNAPSHOT_ARCHIVE` on every diagnostic run.*
- [ ] **6. `🏛️ Civic_Sovereignty_Brick`** (`ID_CIVIC_SOVEREIGNTY`) — Paste [`scripts/gas/ID_CIVIC_SOVEREIGNTY.gs`](../scripts/gas/ID_CIVIC_SOVEREIGNTY.gs) → Run `setupTriggers()`  
  *Captures immutable Capture/Sovereignty snapshots into `SNAPSHOT_ARCHIVE` on every run.*
- [ ] **7. `🔥 Grit Score Assessment`** (`ID_GRIT`) — Paste [`scripts/gas/ID_GRIT.gs`](../scripts/gas/ID_GRIT.gs) → Run `setupTriggers()`  
  *Archives each new Grit retake alongside the 2025-02-05 pre-form baseline.*
- [ ] **8. `🧭 RIASEC_Brick`** (`ID_RIASEC`) — Paste [`scripts/gas/ID_RIASEC.gs`](../scripts/gas/ID_RIASEC.gs) → Run `setupTriggers()`  
  *Archives longitudinal Holland Code (`AIS`) drift snapshots automatically on form submit.*

### Phase 2 — Active Intake & Lifestyle Bricks (Wire Next)
- [ ] **9. `🌍 Travel_Tracker_Brick`** (`ID_TRAVEL`) — Paste [`scripts/gas/ID_TRAVEL.gs`](../scripts/gas/ID_TRAVEL.gs) → Run `setupTriggers()`
- [ ] **10. `💼 Career & Experience Intake`** (`ID_CAREER_INTAKE`) — Paste [`scripts/gas/ID_CAREER_INTAKE.gs`](../scripts/gas/ID_CAREER_INTAKE.gs) → Run `setupTriggers()`
- [ ] **11. `🏅 Achievements_Engine_Brick`** (`ID_ACHIEVEMENTS`) — Paste [`scripts/gas/ID_ACHIEVEMENTS.gs`](../scripts/gas/ID_ACHIEVEMENTS.gs) → Run `setupTriggers()`
- [ ] **12. `🧭 Daily_Intake_Brick`** (`ID_DAILY_INTAKE`) — Paste [`scripts/gas/ID_DAILY_INTAKE.gs`](../scripts/gas/ID_DAILY_INTAKE.gs) → Run `setupTriggers()`

### Phase 3 — Core Utilities & The 7 Pillars
- [ ] **13. `🎮 XP Leveler`** (`ID_XP_HUB`) — [`scripts/gas/ID_XP_HUB.gs`](../scripts/gas/ID_XP_HUB.gs)
- [ ] **14. `🩺 BIO_CORE`** (`ID_BIO_CORE`) — [`scripts/gas/ID_BIO_CORE.gs`](../scripts/gas/ID_BIO_CORE.gs) *(also Deploy → Web App for Health Connect `doPost`)*
- [ ] **15. `📱 Master_Contacts_Sync`** (`ID_MASTER_CONTACTS_SYNC`) — [`scripts/gas/ID_MASTER_CONTACTS_SYNC.gs`](../scripts/gas/ID_MASTER_CONTACTS_SYNC.gs) *(enable **People API** under Services `+`)*
- [ ] **16. `📇 Core_CRM`** (`ID_CORE_CRM`) — [`scripts/gas/ID_CORE_CRM.gs`](../scripts/gas/ID_CORE_CRM.gs) *(enable **People API** under Services `+`)*
- [ ] **17. `🌑 Pillar_0_Shadow_Self`** (`ID_PILLAR_0`) — [`scripts/gas/ID_PILLAR_0.gs`](../scripts/gas/ID_PILLAR_0.gs)
- [ ] **18. `💚 Pillar_1_Health`** (`ID_PILLAR_1`) — [`scripts/gas/ID_PILLAR_1.gs`](../scripts/gas/ID_PILLAR_1.gs)
- [ ] **19. `💰 Pillar_2_Wealth`** (`ID_PILLAR_2`) — [`scripts/gas/ID_PILLAR_2.gs`](../scripts/gas/ID_PILLAR_2.gs)
- [ ] **20. `💞 Pillar_3_Relationships`** (`ID_PILLAR_3`) — [`scripts/gas/ID_PILLAR_3.gs`](../scripts/gas/ID_PILLAR_3.gs)
- [ ] **21. `🛠️ Pillar_4_Skills_Mission`** (`ID_PILLAR_4`) — [`scripts/gas/ID_PILLAR_4.gs`](../scripts/gas/ID_PILLAR_4.gs)
- [ ] **22. `🏆 Pillar_5_Experience_Legacy`** (`ID_PILLAR_5`) — [`scripts/gas/ID_PILLAR_5.gs`](../scripts/gas/ID_PILLAR_5.gs)
- [ ] **23. `🔮 Pillar_6_Esoteric_Self`** (`ID_PILLAR_6`) — [`scripts/gas/ID_PILLAR_6.gs`](../scripts/gas/ID_PILLAR_6.gs)
