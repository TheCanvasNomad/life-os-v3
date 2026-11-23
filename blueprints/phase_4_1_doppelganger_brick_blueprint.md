# LifeOS v3.0 — Phase 4.1: Doppelgänger Tracker Brick (`👤`) Blueprint

## Architecture Summary
- **Workbook:** `Doppelganger_Brick` (`{{DOPPELGANGER_BRICK_ID}}`)
- **Topology:** Strict Hub-and-Spoke via `LifeOS_feed_hub` (`{{LIFEOS_FEED_HUB_ID}}`)—ingests `INTAKE_DISCIPLINE_DELTA` and `INTAKE_VICE_DELTA` through `SIGNAL_BUS` with zero spoke-to-spoke `IMPORTRANGE` sprawl.
- **Shadow Arena (`SHADOW_ARENA`):** Tracks `The Nomad` (`Discipline_Score`) vs. `The Doppelgänger` (`Doppelganger_Score`) with a live `SPARKLINE` tug-of-war gauge, closed-loop habit/abstinence dropdowns, and a 7-day `[Redemption_Quest]` streak counter.
- **Shadow Tax & Consequence Engine:** Publishes `SHADOW_TAX_RATE` and `DOPPELGANGER_DOMINATION_INDEX` to `SIGNAL_BUS`, computing `XP_Siphoned_To_Shadow` and `Net_Sovereign_XP` on `CHARACTER_SHEET` and activating `[Dominated]` in `RULES_ENGINE` whenever the Doppelgänger leads.
