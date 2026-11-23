---
name: lifeos-architect
description: >-
  Enforces the five immutable LifeOS-v3 architectural laws on all generated
  Apps Script code, spreadsheet formulas, form schemas, Brick contracts,
  Android HUD integrations, and documentation in the LifeOS workspace. Use
  whenever creating, modifying, reviewing, or auditing any code, schema,
  formula, or architectural document in LifeOS-v3.
---

# LifeOS-v3 Architect Skill

This skill governs all engineering, schema design, formula authoring, and
documentation inside the LifeOS-v3 workspace. Every artifact produced must
strictly satisfy all **five immutable LifeOS laws** below without exception.

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

## Workspace Directory Map

Place all new files strictly in their designated workspace directory:

| Directory | Responsibility |
| :--- | :--- |
| `src/core_os_hub/` | Modular Apps Script projects for Core OS Hub (`CHARACTER_SHEET`, `RULES_ENGINE`, `AQAL_VIEW`, `SWORD_VIEW`, `IMPORTS`, `AI_Synthesis_Report`). |
| `src/pillars/` | Modular Apps Script engines for Pillar 0 (Shadow Self) through Pillar 6 (Esoteric Self). |
| `src/utilities/biometric_core/` | Standalone `BIO_CORE` biometric ingestion, normalization, and metric modules. |
| `src/utilities/crm_core/` | Standalone `CRM_CORE` relationship/contact intelligence modules. |
| `src/bricks_sync/` | `LifeOS_Master_Bus` connectors and Brick sync adapters implementing `CONTEXT_IN` and `SIGNALS_OUT` / `PRIMARY SPOKE MIRROR`. |
| `src/android_hud/` | Android HUD client code and telemetry widgets consuming Core OS Hub / Governor state. |
| `schemas/` | Canonical JSON/YAML/Markdown schemas for Forms, Raw Data Silos, Pillars, Bricks, `LifeOS_Master_Bus`, and `OPS_GOVERNOR`. |
| `docs/` | Architecture Decision Records (ADRs), data-flow diagrams, runbooks, and synthesis templates. |

---

## Pre-Delivery Compliance Checklist

Before finalizing or committing any code, schema, formula, or documentation in
LifeOS-v3, verify all five gates:

1. **Unidirectional Flow Gate**: Does data move strictly `Forms -> Raw Silos (write-only) -> Pillars/Utilities -> Core OS Hub` with zero mutations to Raw Data Silos?
2. **Modularity Gate**: Are all `.gs` files single-purpose and compartmentalized (zero monolithic scripts)?
3. **Closed-Loop & Blank-Safety Gate**: Do Forms favor structured inputs, and do all formulas guard unlogged cells with `IF(ISBLANK(...), "", ...)` (zero false `0`s or `"N/A"`s)?
4. **Brick Contract Gate**: Do all Brick schemas and sync scripts define both `CONTEXT_IN` and `SIGNALS_OUT` / `PRIMARY SPOKE MIRROR` blocks targeting `LifeOS_Master_Bus`?
5. **Governor & Telemetry Gate**: Is the `OPS_GOVERNOR` max-2 active initiatives WIP ceiling enforced, and are synthesis outputs clean Markdown/Doc ready for NotebookLM and Gemini?
