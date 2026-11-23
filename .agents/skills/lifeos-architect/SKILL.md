---
name: lifeos-architect
description: >-
  Enforces the eight immutable LifeOS-v3 architectural, workbook-registry,
  dynamic-formula/executive-UI, and sync laws on all generated Apps Script
  code, spreadsheet formulas, form schemas, Brick contracts, Android HUD
  integrations, Colab notebooks, and documentation in the LifeOS workspace.
  Use whenever creating, modifying, reviewing, or auditing any Google Sheet,
  code, schema, formula, notebook, or architectural document in LifeOS-v3.
---

# LifeOS-v3 Architect Skill

This skill governs all engineering, Google Sheets operations, schema design,
formula authoring, executive spreadsheet styling, notebook synchronization,
and documentation inside the LifeOS-v3 workspace. Every artifact produced and
every task executed must strictly satisfy all **eight immutable LifeOS laws**
below without exception.

---

## Immutable Laws

### Law 1: Three-Layer Hub-and-Spoke Data Flow

All data movement MUST follow a strict unidirectional pipeline:

```text
Input Forms
   │  (append-only ingestion)
   ▼
Raw Data Silos  [WRITE-ONLY — NEVER EDITED]
   │  (read-only consumption)
   ▼
Pillar Engines & Standalone Utilities
   ├─ Pillar 0: Shadow Self
   ├─ Pillar 1 – Pillar 5: Core Life Pillars
   ├─ Pillar 6: Esoteric Self
   ├─ Utility: BIO_CORE  (src/utilities/biometric_core)
   └─ Utility: CRM_CORE  (src/utilities/crm_core)
   │  (normalized signals & summaries)
   ▼
Core OS Hub  [LEAN PRESENTATION LAYER]
   ├─ CHARACTER_SHEET
   ├─ RULES_ENGINE
   ├─ AQAL_VIEW
   ├─ SWORD_VIEW
   ├─ IMPORTS
   └─ AI_Synthesis_Report
```

**Enforcement rules:**
- **No reverse writes**: Neither Pillar Engines nor the Core OS Hub may mutate
  Raw Data Silos. Corrections are recorded as new append-only entries or
  downstream overrides, never in-place edits of raw logs.
- **No direct Form-to-Hub coupling**: Raw form responses land exclusively in
  Raw Data Silos before any transformation.
- **Lean Core OS Hub**: Domain math, scoring engines, and heavy transformations
  belong in Pillar Engines or Utilities (`BIO_CORE`, `CRM_CORE`). Core OS Hub
  tabs (`CHARACTER_SHEET`, `RULES_ENGINE`, `AQAL_VIEW`, `SWORD_VIEW`,
  `IMPORTS`, `AI_Synthesis_Report`) remain thin presentation, rules routing,
  and synthesis surfaces.

---

### Law 2: Modular Code Architecture

Monolithic `.gs` files are **strictly forbidden**.

- Every Google Apps Script project MUST be compartmentalized into focused,
  single-purpose `.gs` modules.
- Standard module separation pattern:
  - `main.gs` — Entry points, menu hooks, trigger dispatchers, and orchestration.
  - `rules_engine_automations.gs` — `RULES_ENGINE` evaluation, `OPS_GOVERNOR`
    enforcement, and state-driven automations.
  - `ecosystem_integrators.gs` — Cross-sheet ingestion, `LifeOS_Master_Bus`
    bridges, Brick sync, and external API connectors.
  - `report_generator.gs` — `AI_Synthesis_Report` builders and Markdown/Google
    Doc exporters for NotebookLM and Gemini.
  - `utilities.gs` — Pure helper functions, date/range utilities, blank-safe
    parsers, and shared constants.
- Never mix UI/trigger boilerplate, business rules, external sync logic, and
  report serialization in the same `.gs` file.
- Shared contracts and constants should be documented in `schemas/` and
  referenced consistently across modules.

---

### Law 3: Closed-Loop Input & Blank-Cell Preservation

#### Closed-Loop Forms
- Input Forms MUST prioritize structured controls (**dropdowns, linear scales,
  checkboxes, multiple-choice grids**) over free-text fields.
- Free-text inputs are permitted only for explicit reflection/journal fields or
  unstructured notes that are never parsed as numeric KPIs or strict enums.
- Enum values in Forms MUST match canonical schema definitions in `schemas/`.

#### Blank-Cell Preservation in Formulas
- Every spreadsheet formula operating on potentially unlogged entries MUST
  preserve empty strings (`""`) rather than emitting false `0`s, `FALSE`, or
  `"N/A"`.
- Required guard pattern:
  ```excel
  =IF(ISBLANK(A2), "", <computation>)
  ```
  Or for multi-cell / `ARRAYFORMULA` expressions:
  ```excel
  =ARRAYFORMULA(IF(A2:A="", "", <computation>))
  ```
- When wrapping lookups or divisions with `IFERROR`, return `""` (never `"N/A"`
  or `0`) for missing/unlogged inputs:
  ```excel
  =IF(ISBLANK(A2), "", IFERROR(<lookup_or_calc>, ""))
  ```
- Aggregations (`AVERAGE`, `MEDIAN`, `MIN`, `MAX`, trendlines) must ignore blank
  strings so unlogged days never distort baselines or scores.

---

### Law 4: Brick Exchange Contract

All standalone Bricks — including **Psychometrics**, **Human Design**,
**Zodiac**, **Kabbalah**, **Travel**, and **Belief Tracker** (plus any future
Brick) — MUST implement the standardized Brick Exchange Contract for ingestion
into `LifeOS_Master_Bus` via `IMPORTRANGE` or Apps Script (`src/bricks_sync/`).

Each Brick MUST expose two canonical interface blocks:

1. **`CONTEXT_IN`** (Inbound Context Block):
   - Receives read-only upstream context from `LifeOS_Master_Bus` (e.g., active
     date window, user identity/birth metadata, active `OPS_GOVERNOR` focus,
     or cross-pillar flags).
   - Fixed, versioned cell coordinates or named range so upstream pushes never
     break formulas.
2. **`SIGNALS_OUT` / `PRIMARY SPOKE MIRROR`** (Outbound Signal Block):
   - Exposes a flat, deterministic, schema-validated range of normalized signals
     (key, value, unit/type, timestamp/as-of date, status) ready for direct
     `IMPORTRANGE` or Apps Script pull into `LifeOS_Master_Bus` -> Core OS Hub
     `IMPORTS`.
   - Must strictly obey Law 3 (blank-cell preservation for missing signals).
   - Must never expose raw internal scratchpad calculations directly to the Hub.

---

### Law 5: Governor & Telemetry Alignment

#### OPS_GOVERNOR WIP Ceiling
- All task, project, and initiative schemas, rules, and automations MUST honor
  the **`OPS_GOVERNOR` WIP ceiling: maximum 2 active initiatives** at any time.
- Any attempt to activate a 3rd concurrent initiative must be flagged, blocked,
  or queued by `RULES_ENGINE` / `rules_engine_automations.gs` (never silently
  allowed).
- Core OS Hub views (`CHARACTER_SHEET`, `RULES_ENGINE`, `SWORD_VIEW`) and
  `src/android_hud` telemetry must surface current WIP count (`0/2`, `1/2`,
  `2/2`) and governor status clearly.

#### NotebookLM & Gemini Synthesis Telemetry
- Report generators (`report_generator.gs` -> `AI_Synthesis_Report`) MUST emit
  clean, deterministic **Markdown** and/or structured **Google Doc** outputs
  optimized for ingestion by **NotebookLM** and **Gemini**.
- Synthesis outputs MUST:
  - Use clear hierarchical Markdown headings (`#`, `##`, `###`) and structured
    tables/key-value frontmatter (date range, active initiatives, pillar state).
  - Omit blank/unlogged entries cleanly (no `"N/A"` noise or false `0` streaks).
  - Preserve provenance (source Pillar, Utility, or Brick name + as-of date).

---

### Law 6: Automated Git & Colab Sync Law

Local Antigravity workspace changes and browser-edited Google Colab notebooks
MUST remain continuously synchronized with `origin/main`
(`https://github.com/TheCanvasNomad/life-os-v3.git`).

#### Pre-Task Sync (Mandatory Before Starting Any Task)
- Before modifying files, running generators, or authoring schemas/code, ALWAYS
  pull the latest remote state (including notebooks saved from Google Colab):
  ```bash
  git pull --rebase origin main
  ```
- If local uncommitted changes exist prior to pulling, stash or review them
  cleanly before rebasing so remote Colab commits are never overwritten.

#### Post-Task Sync (Mandatory Upon Finishing Any Task)
1. **Secret & Credential Audit**: Verify `.gitignore` excludes all secrets,
   tokens, and credentials (`.env*`, `credentials.json`, `token.json`,
   `*client_secret*.json`, `service_account*.json`, `.clasprc.json`, `*.pem`,
   `*.key`, `*.keystore`, `*.jks`), and confirm `git status` shows zero
   sensitive files staged for commit.
2. **Stage & Commit**: Run `git add -A` and commit with a clear Conventional
   Commit message (e.g., `feat(pillars): ...`, `fix(bricks): ...`,
   `chore(colab): ...`, `docs(architecture): ...`).
3. **Push to Remote**: Run `git push origin main` and verify a clean working
   tree (`git status`).

---

### Law 7: Master Workbook Registry & Zero-Duplicate Sheet Law

Before creating or modifying **any** Google Sheet, spreadsheet formula,
`IMPORTRANGE` reference, or Google Apps Script project, agents **MUST** first
read [`schemas/workbook_registry.json`](../../../schemas/workbook_registry.json)
(and any corresponding tab snapshot in `schemas/live_snapshots/`).

**Enforcement rules:**
- **Zero duplicate workbooks**: Never create a new Google Spreadsheet if a
  matching workbook already exists in `schemas/workbook_registry.json` (either
  already `"status": "bound"` with a confirmed `spreadsheet_id` or listed as
  `"status": "awaiting_id_binding"`).
- **Bind before building**: If a target workbook is marked
  `"awaiting_id_binding"`, run `src/bricks_sync/discover_sheets.py` (or ask the
  user to bind its existing Spreadsheet ID) instead of generating a duplicate
  workbook.
- **Canonical IDs & live tabs**: Always reference the confirmed
  `spreadsheet_id` and verified `live_tabs` from
  `schemas/workbook_registry.json` and `schemas/live_snapshots/<KEY>.json` when
  wiring `IMPORTRANGE` formulas or Apps Script `openById(...)` calls.
- **Keep registry current**: Whenever a new approved workbook is created or a
  tab structure changes, immediately update `schemas/workbook_registry.json`
  and refresh `schemas/live_snapshots/`.

---

### Law 8: Dynamic Formula-First & Executive Sheet UI Law

#### Zero Static Cells Unless Necessary
- Never hard-code static scores, manual multipliers, static archetype advice
  paragraphs, or repetitive single-cell formulas when dynamic Google Sheets
  formulas (`ARRAYFORMULA`, `XLOOKUP`, `QUERY`, `FILTER`, `LET`, `LAMBDA`,
  `SPARKLINE`) referencing `RULES_ENGINE` lookup tables or `SIGNAL_BUS` can
  compute them live.
- Static values are permitted **ONLY** for:
  1. Immutable Day 0 natal/biographical constants.
  2. Raw user inputs captured via structured Forms (write-only silos).
  3. Canonical configuration keys, enum labels, and `RULES_ENGINE` lookup tables.
- All Brick advisories MUST evaluate dynamically as `Archetype × Live Telemetry State`
  via structured `ADVISORY_MATRIX` lookup tables (`INDEX/MATCH` or `XLOOKUP`),
  never bloated nested `IF()` prose or static paragraphs.

#### Beautified Spreadsheet UI Standard
Whenever creating or upgrading **any** Google Sheet tab, automatically apply
executive visual formatting via `gsheets` / Sheets API `batchUpdate`:
- **Banner Headers**: Dark-slate / obsidian header fills (`#0F172A` or `#1E293B`)
  with crisp white bold typography and clear section hierarchy.
- **Semantic Conditional Formatting Badges**:
  - `0% – 49%` → **Crimson** (critical / foundational drain)
  - `50% – 89%` → **Amber** (progressing / sub-mastery)
  - `90% – 100%` → **Emerald** (mastery unlocked)
  - Plus status pill badges (`LIVE`, `FRESH`, `STALE`, `BUFF`, `DEBUFF`, `LOCKED`).
- **Grid & Table Polish**:
  - Frozen header rows (and key identifier columns where appropriate).
  - Auto-fitted column widths with generous breathing padding.
  - Subtle alternating row banding on data tables.
  - Hidden gridlines (`hideGridlines: true`) on executive dashboard / HUD tabs.
  - Native `=SPARKLINE(...)` vital gauges and embedded charts alongside summary blocks.

#### Antigravity-First Execution
- Replace legacy Google Colab R&D/ETL scripts with **Antigravity Python/MCP
  workflows** (`gdrive` / `gsheets` CLIs and modular `src/` scripts) synced
  continuously to GitHub (`TheCanvasNomad/life-os-v3`).
- Use `schemas/workbook_registry.json` and `schemas/live_snapshots/` as the
  living control plane rather than ad-hoc Colab state cells.

---

## Workspace Directory Map

Place all new files strictly in their designated workspace directory:

| Directory | Responsibility |
| :--- | :--- |
| `src/core_os_hub/` | Modular Apps Script projects for Core OS Hub (`CHARACTER_SHEET`, `RULES_ENGINE`, `AQAL_VIEW`, `SWORD_VIEW`, `IMPORTS`, `AI_Synthesis_Report`). |
| `src/pillars/` | Modular Apps Script engines for Pillar 0 (Shadow Self) through Pillar 6 (Esoteric Self). |
| `src/utilities/biometric_core/` | Standalone `BIO_CORE` biometric ingestion, normalization, and metric modules. |
| `src/utilities/crm_core/` | Standalone `CRM_CORE` relationship/contact intelligence modules. |
| `src/bricks_sync/` | `LifeOS_Master_Bus` connectors, Brick sync adapters (`CONTEXT_IN` / `SIGNALS_OUT`), and Google Sheets discovery/snapshot tooling (`discover_sheets.py`). |
| `src/android_hud/` | Android HUD client code and telemetry widgets consuming Core OS Hub / Governor state. |
| `colab_notebooks/` | Legacy / optional browser-edited Google Colab `.ipynb` notebooks and GitHub teardown utilities. |
| `blueprints/` | Master technical specification (`LIFEOS_V3_MASTER_SPEC.md`) and phase design blueprints. |
| `schemas/` | Canonical schemas (`workbook_registry.json`, Brick/Hub JSON schemas, and `live_snapshots/` tab-header exports). |
| `docs/` | Architecture index (`ARCHITECTURE_INDEX.md`), migration plans (`LEGACY_MIGRATION_PLAN.md`), ADRs, and runbooks. |

---

## Pre-Delivery Compliance Checklist

Before finalizing or committing any code, schema, formula, notebook, or
documentation in LifeOS-v3, verify all eight gates:

1. **Unidirectional Flow Gate**: Does data move strictly `Forms -> Raw Silos (write-only) -> Pillars/Utilities -> Core OS Hub` with zero mutations to Raw Data Silos?
2. **Modularity Gate**: Are all `.gs` files single-purpose and compartmentalized (zero monolithic scripts)?
3. **Closed-Loop & Blank-Safety Gate**: Do Forms favor structured inputs, and do all formulas guard unlogged cells with `IF(ISBLANK(...), "", ...)` (zero false `0`s or `"N/A"`s)?
4. **Brick Contract Gate**: Do all Brick schemas and sync scripts define both `CONTEXT_IN` and `SIGNALS_OUT` / `PRIMARY SPOKE MIRROR` blocks targeting `LifeOS_Master_Bus`?
5. **Governor & Telemetry Gate**: Is the `OPS_GOVERNOR` max-2 active initiatives WIP ceiling enforced, and are synthesis outputs clean Markdown/Doc ready for NotebookLM and Gemini?
6. **Git & Colab Sync Gate**: Was `git pull --rebase origin main` run before starting, does `.gitignore` exclude all secrets/tokens/credentials, and were changes staged (`git add -A`), committed with a Conventional Commit message, and pushed (`git push origin main`)?
7. **Workbook Registry Gate**: Was `schemas/workbook_registry.json` read before touching any Google Sheet or Apps Script project, guaranteeing zero duplicate workbooks and verified Spreadsheet IDs / tab names?
8. **Dynamic Formula, Executive UI & Antigravity Gate**: Are all computed cells dynamic (`ARRAYFORMULA`/`XLOOKUP`/`QUERY`/`FILTER`/`LET`/`LAMBDA`/`SPARKLINE`) referencing `RULES_ENGINE`/`SIGNAL_BUS` with zero unnecessary static values, are created/upgraded sheets styled to the dark-obsidian executive UI standard (crimson/amber/emerald badges, frozen headers, padded widths, hidden gridlines on HUDs), and are workflows implemented Antigravity-first rather than legacy Colab-only?
