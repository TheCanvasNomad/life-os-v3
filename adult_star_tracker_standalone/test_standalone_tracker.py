#!/usr/bin/env python3
"""Unit tests for the standalone Performer-First Adult Star & Taxonomy Tracker.

Covers:
  - Delimiter-safe tag parsing and exact matching (collision resistance)
  - Measurements B-W-H & WHR parsing + cup tag normalization
  - Boobpedia MediaWiki URL builders & wikitext infobox parser (offline fixtures)
  - Stated-vs-Demonstrated blending & volume confirmation lift
  - Studio auto-scoring with optional explicit boost
  - Re-Rank Bayesian consistency score & bounded delta
  - Exponential saturation-dampened volume bonus
  - Era & Memory half-life decay + Final Active Score
  - Static audits of all 11 generated Google Sheets tabs & .gs modules:
      * Blank-safety (`IF(ISBLANK(...), "", ...)`)
      * Zero `Scene_Logs` dependency
      * Zero live LifeOS Hub / `IMPORTRANGE` wiring
      * Zero GitHub / Colab references
      * Exact `TAXONOMY_MATRIX!F` VLOOKUP contract (Col A = Tag, Col F = Score)
"""

from __future__ import annotations

import os
import unittest

import build_standalone_tracker as builder
import tracker_helpers as th


class TestTagAndMeasurementHelpers(unittest.TestCase):
    def test_normalize_tag_list_deduplicates_and_trims(self):
        raw = " Natural Boobs ; Puffy Nipples; natural boobs ;  ; Curvy "
        self.assertEqual(
            th.normalize_tag_list(raw),
            ["Natural Boobs", "Puffy Nipples", "Curvy"],
        )

    def test_has_exact_tag_avoids_substring_collisions(self):
        # '34D' MUST NOT match '34DD/E' or '34DDD/F'
        self.assertFalse(th.has_exact_tag("34D", "34DD/E; Natural Boobs"))
        self.assertFalse(th.has_exact_tag("34D", "34DDD/F; Curvy"))
        self.assertTrue(th.has_exact_tag("34D", "34D; Curvy"))

        # 'Slim' MUST NOT match 'Slim Thick'
        self.assertFalse(th.has_exact_tag("Slim", "Slim Thick; Brunette"))
        self.assertTrue(th.has_exact_tag("Slim", "Slim; Petite; Pale Areolas"))

        # Special chars like '/' work cleanly without regex issues
        self.assertTrue(th.has_exact_tag("Titfuck/Paizuri", "Boy/Girl; Titfuck/Paizuri; Anal"))

    def test_parse_measurements_and_whr(self):
        parsed = th.parse_measurements_bwh("34DDD-26-36")
        self.assertIsNotNone(parsed)
        self.assertEqual(parsed["band"], 34)
        self.assertEqual(parsed["cup"], "DDD")
        self.assertEqual(parsed["waist"], 26.0)
        self.assertEqual(parsed["hip"], 36.0)
        self.assertAlmostEqual(parsed["whr"], 0.722, places=3)
        self.assertAlmostEqual(th.compute_whr("32C-23-34"), 0.676, places=3)
        self.assertIsNone(th.compute_whr(""))
        self.assertIsNone(th.compute_whr("invalid"))

    def test_normalize_cup_tag(self):
        self.assertEqual(th.normalize_cup_tag("34DD"), "34DD/E")
        self.assertEqual(th.normalize_cup_tag("34E"), "34DD/E")
        self.assertEqual(th.normalize_cup_tag("34DDD"), "34DDD/F")
        self.assertEqual(th.normalize_cup_tag("34F"), "34DDD/F")
        self.assertEqual(th.normalize_cup_tag("34G"), "34G")
        self.assertEqual(th.normalize_cup_tag("32B"), "32B")


class TestBoobpediaHelpers(unittest.TestCase):
    def test_boobpedia_urls(self):
        q_url = th.build_boobpedia_query_url("Angela White")
        self.assertIn("https://www.boobpedia.com/wiki/api.php", q_url)
        self.assertIn("titles=Angela_White", q_url)
        self.assertIn("rvslots=main", q_url)

        s_url = th.build_boobpedia_search_url("Gianna")
        self.assertIn("action=opensearch", s_url)
        self.assertIn("search=Gianna", s_url)

    def test_parse_boobpedia_page_fixture(self):
        wikitext = """
        {{Infobox person
        | name = Angela White
        | birth_date = {{birth date and age|1985|3|4}} March 4, 1985
        | years_active = 2003–present
        | height = 5' 3" (1.60 m)
        | measurements = 34G-27-38<ref>official bio</ref>
        | bra_size = 34G
        | boobs = [[Natural]]
        | ethnicity = [[Australian]] / Caucasian
        | studios = [[Brazzers]], [[Evil Angel]]
        }}
        """
        categories = [
            "Category:Natural boobs",
            "Category:Curvy models",
            "Category:Pale areolas",
            "Category:Titfuck performers",
        ]
        rec = th.parse_boobpedia_page("Angela White", wikitext, categories=categories)
        self.assertEqual(rec["Stage_Name"], "Angela White")
        self.assertEqual(rec["Boobpedia_Slug"], "angela_white")
        self.assertEqual(rec["Debut_Year"], 2003)
        self.assertEqual(rec["Birth_Year"], 1985)
        self.assertEqual(rec["Height"], "5'3\"")
        self.assertEqual(rec["Measurements_BWH"], "34G-27-38")
        self.assertAlmostEqual(rec["WHR"], 0.711, places=3)
        self.assertEqual(rec["Cup_Tag"], "34G")
        self.assertEqual(rec["Natural_or_Enhanced"], "Natural Boobs")
        self.assertEqual(rec["Heritage_Tag"], "White/European")
        self.assertEqual(rec["Primary_Studios"], "Brazzers; Evil Angel")
        self.assertIn("Curvy", rec["Auto_Categories"])
        self.assertIn("Pale Areolas", rec["Auto_Categories"])
        self.assertIn("Titfuck/Paizuri", rec["Auto_Categories"])
        self.assertEqual(rec["Source_Tag"], "Boobpedia_API")


class TestScoringEngines(unittest.TestCase):
    def test_stated_vs_demonstrated_blending(self):
        # Unlogged tag preserves Stated Baseline cleanly
        self.assertEqual(th.blend_stated_demonstrated(8.4, None, log_count=0), 8.4)
        self.assertEqual(th.blend_stated_demonstrated(None, None, log_count=0, default_baseline=7.0), 7.0)

        # Logged tag blends 60% demonstrated + 40% stated + small volume confirmation lift
        score = th.blend_stated_demonstrated(stated=7.0, demonstrated=9.5, log_count=4, weight_demo=0.6, vol_scale=0.05)
        # 0.6*9.5 + 0.4*7.0 = 8.5; + 0.05*ln(5) ~= 0.0805 -> 8.58
        self.assertAlmostEqual(score, 8.58, places=2)
        # Clamped cleanly at 10.0
        self.assertEqual(th.blend_stated_demonstrated(9.9, 10.0, log_count=20), 10.0)

    def test_studio_auto_scoring_and_optional_boost(self):
        # Auto-only studio (no Studio_Baseline_Logs entry)
        auto_only = th.compute_studio_score(auto_demo=9.2, explicit_baseline=None, log_count=2)
        self.assertEqual(auto_only["scoring_mode"], "AUTO_ONLY")
        self.assertEqual(auto_only["explicit_boost_delta"], 0.0)
        self.assertGreater(auto_only["studio_score"], 9.2)

        # Auto + explicit boost (Vixen explicit avg 9.65 -> (9.65 - 7.0) * 0.15 = +0.398)
        boosted = th.compute_studio_score(auto_demo=9.2, explicit_baseline=9.65, log_count=2, boost_weight=0.15)
        self.assertEqual(boosted["scoring_mode"], "AUTO + EXPLICIT_BOOST")
        self.assertAlmostEqual(boosted["explicit_boost_delta"], 0.398, places=3)
        self.assertGreater(boosted["studio_score"], auto_only["studio_score"])

        # Explicit only (no logs yet)
        explicit_only = th.compute_studio_score(auto_demo=None, explicit_baseline=9.4, log_count=0)
        self.assertEqual(explicit_only["scoring_mode"], "EXPLICIT_ONLY")
        self.assertEqual(explicit_only["studio_score"], 9.4)

        # Unlogged roster default
        default_only = th.compute_studio_score(auto_demo=None, explicit_baseline=None, log_count=0)
        self.assertEqual(default_only["scoring_mode"], "ROSTER_DEFAULT")
        self.assertEqual(default_only["studio_score"], 7.0)

    def test_rerank_bayesian_consistency_and_delta(self):
        # Zero duels -> blank consistency, zero delta
        empty = th.compute_rerank_metrics(0, 0, 0.0)
        self.assertIsNone(empty["win_rate"])
        self.assertIsNone(empty["consistency_score"])
        self.assertEqual(empty["rerank_delta"], 0.0)

        # Angela White (2-0, net margin +0.8)
        angela = th.compute_rerank_metrics(wins=2, losses=0, net_margin=0.8)
        self.assertEqual(angela["win_rate"], 1.0)
        self.assertGreater(angela["consistency_score"], 9.0)
        self.assertGreater(angela["rerank_delta"], 0.3)

        # Gianna Michaels (0-1 by narrow 0.2 margin) -> Bayesian shrinkage avoids harsh collapse
        gianna = th.compute_rerank_metrics(wins=0, losses=1, net_margin=-0.2)
        self.assertGreater(gianna["consistency_score"], 6.0)
        self.assertLess(gianna["rerank_delta"], 0.0)
        self.assertGreaterEqual(gianna["rerank_delta"], -0.75)

    def test_volume_dampened_bonus_monotonic_and_bounded(self):
        b0 = th.compute_volume_dampened_bonus(0, vol_scale=0.05, saturation_threshold=10.0)
        b1 = th.compute_volume_dampened_bonus(1, vol_scale=0.05, saturation_threshold=10.0)
        b10 = th.compute_volume_dampened_bonus(10, vol_scale=0.05, saturation_threshold=10.0)
        b100 = th.compute_volume_dampened_bonus(100, vol_scale=0.05, saturation_threshold=10.0)
        self.assertEqual(b0, 0.0)
        self.assertLess(b0, b1)
        self.assertLess(b1, b10)
        self.assertLess(b10, b100)
        self.assertLessEqual(b100, 0.5)

    def test_era_and_memory_decay_and_final_active_score(self):
        self.assertIsNone(th.compute_half_life_decay(None, 90))
        self.assertEqual(th.compute_half_life_decay(0, 90), 1.0)
        self.assertAlmostEqual(th.compute_half_life_decay(90, 90), 0.5, places=4)
        self.assertAlmostEqual(th.compute_half_life_decay(730, 730), 0.5, places=4)

        fresh = th.compute_final_active_score(master_score=9.5, era_decay=0.8, memory_decay=1.0)
        stale = th.compute_final_active_score(master_score=9.5, era_decay=0.05, memory_decay=0.0)
        self.assertGreater(fresh, stale)
        self.assertLessEqual(fresh, 10.0)
        self.assertGreaterEqual(stale, 8.5)
        self.assertIsNone(th.compute_final_active_score(None, 0.5, 0.5))


class TestGeneratedSheetSpecsAndScopeGuards(unittest.TestCase):
    def setUp(self):
        self.tabs = builder.build_all_tab_definitions()

    def test_all_11_downstream_tabs_present(self):
        expected = {
            "Trait_Intelligence",
            "Niche_Intelligence",
            "Studio_Intelligence",
            "CALC_Performer_Power",
            "Performer_Intelligence",
            "Master_Leaderboard",
            "Total_Rankings",
            "GROWTH_LEDGER",
            "MODULE_META",
            "CONTEXT_IN",
            "SIGNALS_OUT",
        }
        self.assertEqual(set(self.tabs.keys()), expected)

    def test_zero_static_audit_issues(self):
        issues = builder.audit_all_tab_definitions(self.tabs)
        self.assertEqual(issues, [], f"Formula audit issues found: {issues[:5]}")

    def test_taxonomy_matrix_vlookup_contract_preserved(self):
        # TAXONOMY_MATRIX!F calls VLOOKUP(C2, Trait_Intelligence!A:F, 6, FALSE)
        # and VLOOKUP(C2, Niche_Intelligence!A:F, 6, FALSE)
        trait_hdr = self.tabs["Trait_Intelligence"][0]
        niche_hdr = self.tabs["Niche_Intelligence"][0]
        self.assertEqual(trait_hdr[0], "Trait_Tag")
        self.assertEqual(trait_hdr[5], "Trait_Intelligence_Score")
        self.assertEqual(niche_hdr[0], "Niche_Tag")
        self.assertEqual(niche_hdr[5], "Niche_Intelligence_Score")

    def test_lifeos_ready_brick_contract_is_dormant_standalone(self):
        meta_map = {r[0]: r[1] for r in self.tabs["MODULE_META"][1:]}
        self.assertEqual(meta_map["Operating_Mode"], "STANDALONE_READY")
        self.assertEqual(meta_map["Hub_Spreadsheet_ID"], "")
        self.assertEqual(meta_map["Source_Workbook_ID"], th.TARGET_SPREADSHEET_ID)

        ctx_rows = self.tabs["CONTEXT_IN"][1:]
        self.assertGreaterEqual(len(ctx_rows), 4)
        for row in ctx_rows:
            self.assertEqual(row[3], "STANDALONE_DORMANT")
            self.assertEqual(row[4], "OFFLINE_READY")

        sig_hdr = self.tabs["SIGNALS_OUT"][0]
        self.assertEqual(len(sig_hdr), 10)
        self.assertEqual(sig_hdr[0], "Signal_Key")

    def test_target_guard_blocks_forbidden_spreadsheets(self):
        for bad_id in th.FORBIDDEN_SPREADSHEET_IDS:
            with self.assertRaises(ValueError):
                builder._guard_spreadsheet_id(bad_id)

    def test_apps_script_files_have_no_github_colab_scene_or_live_hub_wiring(self):
        base_dir = os.path.dirname(os.path.abspath(__file__))
        for fname in ("apps_script_sync.gs", "apps_script_boobpedia.gs", "apps_script_forms.gs"):
            path = os.path.join(base_dir, fname)
            with open(path, "r", encoding="utf-8") as f:
                content = f.read()
            self.assertTrue(th.audit_no_live_lifeos_wiring(content), f"{fname} contains live LifeOS wiring")
            self.assertNotIn("github.com", content.lower())
            self.assertNotIn("colab", content.lower())
            self.assertNotIn("scene_logs", content.lower())


if __name__ == "__main__":
    unittest.main(verbosity=2)
