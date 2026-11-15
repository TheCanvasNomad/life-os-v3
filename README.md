# LifeOS v3.0 — Modular Hub-and-Spoke Operating System

## Architecture Principles
1. **Hub-and-Spoke + Bidirectional `SIGNAL_BUS`:** `LifeOS_feed_hub` acts as the single central telemetry router. Standalone framework workbooks ("Lego Bricks") communicate strictly through `SIGNAL_BUS` rather than brittle `IMPORTRANGE` webs.
2. **Universal 3-Tab Connector:** Every module implements `MODULE_META`, `CONTEXT_IN`, and `SIGNALS_OUT`.
3. **100% Dynamic Advisory Law:** Guidance is computed dynamically via `Archetype × Live Telemetry State` matrices (`INDEX/MATCH`), eliminating static archetype paragraphs.
4. **Blank-Safe & TTL-Aware Formulas:** All formulas preserve blank cells (`IF(OR(ISBLANK(...), ...=""), "", ...)`) and enforce Time-To-Live (`TTL_Hours`) decay so stale telemetry never distorts active recommendations.
5. **Zero-Hardcode Security:** All private Google Drive/Sheets/Docs IDs and credentials are injected at runtime via Colab Secrets and scrubbed into `{{PLACEHOLDER}}` tokens prior to GitHub commits.

## Current Build Progress
- [x] **Phase 0.1 & 0.2:** Control Workspace, Live State Doc & Colab Secrets Keyring
- [x] **Phase 1.1:** `LifeOS_feed_hub` Master Sheet (`SIGNAL_BUS`, `MODULE_REGISTRY`, `RULES_ENGINE`)
- [ ] **Phase 1.2:** Cadence Pulse Forms (`Daily_State_Pulse` & `Weekly_Maslow_Pulse`)
- [ ] **Phase 2.1 & 2.2:** Upgrade `Zodiac` & `Human Design` Bricks to Universal 3-Tab Connector
- [ ] **Phase 3.1 & 3.2:** `Four Temperaments` & `Dynamic Stress Assessment` Bricks
