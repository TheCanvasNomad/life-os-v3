# LifeOS v3.0 — Phase 3.2: Dynamic Stress Assessment Brick (`🌡️`) Blueprint

## Architecture Summary
- **Workbook:** `Dynamic_Stress_Brick` (`{{DYNAMIC_STRESS_BRICK_ID}}`)
- **Topology:** Two-Pass Hub-and-Spoke via `LifeOS_feed_hub` (`{{LIFEOS_FEED_HUB_ID}}`).
- **Pass 1 (`STRESS_ASSESSMENT` → `SIGNALS_OUT`):** Closed-loop 14-item diagnostic (`0–4` strict dropdowns with reverse-scored resilience items, blank-safe) exporting `STRESS_ALLOSTATIC_LOAD` and `SOMATIC_RECOVERY_CAPACITY`.
- **Pass 2 (`CONTEXT_IN` → `SIGNALS_OUT` & `ADVISORY_MATRIX`):** Computes `CONTEXT_ADJUSTED_STRAIN` by combining Pass-1 raw load with live `DAILY_ENERGY`, `ACUTE_STRESS`, and `MASLOW_SURVIVAL`, exports Tier 3 Live State Modifiers (`RULES_ENGINE!E33:E36`), and outputs state-conditioned directives via `INDEX/MATCH`.
