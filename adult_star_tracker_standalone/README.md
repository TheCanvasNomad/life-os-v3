# Adult Star & Taxonomy Tracker (Standalone, Performer-First)

Self-contained Google Sheets + Google Forms + Google Apps Script tracker expanding **`Adult_Star_Tracker_Brick`** (`1R7hlTI8GfeO5CWPHLPP4jWoEpKDjFd96qJIWmhvu5OI`).

- **Performer-First (No Scene Logging):** Centers strictly on the female performer (`MODEL_ROSTER_INDEX`, `Performer_Logs`, `ReRanks`) rather than individual scenes (`Scene_Logs` is untouched and unreferenced by all downstream tabs and scripts).
- **Standalone Outside Live LifeOS (LifeOS-Ready):** Zero live `IMPORTRANGE` links or writes into `LifeOS_feed_hub`, `LifeOS_Master_Bus`, or `Adult Star Intelligence & Taxonomy Tracker (LifeOS)`. Keeps `MODULE_META`, `CONTEXT_IN`, `SIGNALS_OUT`, `GROWTH_LEDGER`, and `PARAM_CONFIG_HUB` structured to plug in later.
- **No GitHub / No Google Colab:** Pure local Antigravity Python + Google Sheets / Forms / Apps Script workflow.

---

## Project Files

| File | Purpose |
| :--- | :--- |
| `tracker_helpers.py` | Pure Python helpers: delimiter-safe tag matching, B-W-H / WHR parsing, Boobpedia MediaWiki API wikitext parser, mathematical scoring mirrors, and static blank-safety / scope auditors. |
| `build_standalone_tracker.py` | Generates blank-safe (`IF(ISBLANK(...), "", ...)`) formulas and dark-obsidian executive formatting for all 11 downstream tabs, deploys via `gsheets`, and verifies zero formula errors live. |
| `apps_script_sync.gs` | Apps Script menu (`⭐ Star Tracker (Standalone)`), target workbook guard, manual performer quick-add, sequential ID trigger (`LOG-`, `RR-`, `ROST-`), and local `MODULE_META` sync stamp. |
| `apps_script_boobpedia.gs` | Boobpedia MediaWiki API (`https://www.boobpedia.com/wiki/api.php`) live performer lookup, infobox parser, category-to-`TAXONOMY_MATRIX` mapper, and selected-row enrichment. |
| `apps_script_forms.gs` | One-click builder & dropdown synchronizer for 3 Performer-First Google Forms (`Performer Log`, `ReRank Duel`, `Baseline Override`). |
| `test_standalone_tracker.py` | Local `unittest` suite verifying all pure scoring math, Boobpedia parsing, collision-free tag matching, blank-safety, and standalone isolation guards. |

---

## Bidirectional Scoring Architecture

```text
Performer_Logs + ReRanks + MODEL_ROSTER_INDEX + Baseline Logs + PARAM_CONFIG_HUB
        │
        ├──► Trait_Intelligence  (Col F feeds back into TAXONOMY_MATRIX!F)
        ├──► Niche_Intelligence  (Col F feeds back into TAXONOMY_MATRIX!F)
        ├──► Studio_Intelligence (Auto-scored from Performer_Logs + optional explicit boost)
        │
        ▼
CALC_Performer_Power (Trait/Niche/Studio Synergy + Bayesian ReRank + Saturation Volume Bonus)
        │
        ▼
Performer_Intelligence (Stated/Taxonomy vs Demonstrated Blend via WEIGHT_STATED_DEMO)
        │
        ▼
Total_Rankings (All-Time Master_Score + Era Decay + Memory Decay -> Final_Active_Score & Rank)
        │
        ▼
Master_Leaderboard (Executive HUD, Sparkline Gauges, Top-10 Traits / Niches / Studios)
        │
        ▼
GROWTH_LEDGER + MODULE_META + CONTEXT_IN (Dormant) + SIGNALS_OUT (Local Ready)
```

### Key Tunable Parameters (`PARAM_CONFIG_HUB`)
- `WEIGHT_STATED_DEMO` (`0.6`): Weight on **Demonstrated** evidence when logs exist (`1 - w = 0.4` anchors to Stated/Taxonomy baseline). Unlogged items stay cleanly on Stated/Taxonomy baseline.
- `SCALE_VOL_BONUS` (`0.05`) & `SATURATION_THRESHOLD` (`10`): Smooth exponential diminishing-returns bonus `vb * sat * (1 - EXP(-logs / sat))`.
- `STUDIO_BOOST_WEIGHT` (`0.15`): Scales optional explicit `Studio_Baseline_Logs` boost `(explicit_avg - BASELINE_DEFAULT_RATING) * boost_weight`; studios without baseline entries auto-score cleanly as `AUTO_ONLY`.
- `ERA_DECAY_HALFLIFE_DAYS` (`730`) & `MEM_DECAY_HALFLIFE_DAYS` (`90`): Exponential half-life freshness modifiers (`0.5^(age_days / halflife)`) applied gently (`Master_Score * (0.90 + 0.04 * Era + 0.06 * Memory)`) so `Master_Score` remains timeless while `Final_Active_Score` reflects active recency.

---

## Running Locally

```bash
# 1. Run local unit tests
python3 -m unittest discover -s adult_star_tracker_standalone -p "test_*.py" -v

# 2. Dry-run & static formula safety audit (no network write)
python3 adult_star_tracker_standalone/build_standalone_tracker.py --dry-run

# 3. Deploy all 11 tabs + executive formatting to Adult_Star_Tracker_Brick
python3 adult_star_tracker_standalone/build_standalone_tracker.py --apply

# 4. Verify live evaluated cells across all 11 downstream tabs + TAXONOMY_MATRIX!F
python3 adult_star_tracker_standalone/build_standalone_tracker.py --verify
```

---

## Manual Steps in Google Sheets / Apps Script

1. Open **`Adult_Star_Tracker_Brick`** in Google Sheets -> **Extensions -> Apps Script**.
2. Create three script files and paste their matching local modules:
   - `apps_script_sync.gs`
   - `apps_script_boobpedia.gs`
   - `apps_script_forms.gs`
3. Save and reload the spreadsheet to activate the **`⭐ Star Tracker (Standalone)`** custom menu.
4. From the menu, click:
   - **`Create Performer-First Google Forms`** (creates the 3 standalone forms, links them to this workbook, populates dropdowns, and installs the `onFormSubmit` sequential-ID trigger).
   - **`Lookup & Add Performer via Boobpedia…`** or **`Quick Add Performer Manually…`** whenever expanding `MODEL_ROSTER_INDEX`, followed by **`Sync Form Dropdowns`**.
5. *(Optional — Form Response Routing)*: When Google Forms creates new `Form Responses N` tabs, either point your entries directly into `Performer_Logs` / `ReRanks` or map them via simple append-only formulas so existing seed rows stay intact.

---

## Plugging Into LifeOS Later (When Desired)

1. In `MODULE_META`, update `Operating_Mode` to `ACTIVE_HUB_LINKED` and paste your `LifeOS_feed_hub` Spreadsheet ID into `Hub_Spreadsheet_ID`.
2. In `CONTEXT_IN`, replace the dormant placeholder cells in `Live_Value` / `Normalized_Score_0_100` with `IMPORTRANGE` formulas pointing to `LifeOS_feed_hub!SIGNAL_BUS`, and authorize access once.
3. In `LifeOS_Master_Bus`, add an `IMPORTRANGE` consumer targeting `Adult_Star_Tracker_Brick` range `SIGNALS_OUT!A1:J10` — all 9 signals (including staged `AST_STAGED_P4_XP` and `AST_STAGED_DOPAMINE_TAX`) are already normalized to `0–100`.
