import unittest
from pathlib import Path

from wow.campaign_archive import build_campaign_archive_payload, parse_archive_name_list


class CampaignArchiveTests(unittest.TestCase):
    def test_parse_archive_name_list_trims_and_skips_empty_values(self):
        self.assertEqual(
            parse_archive_name_list('["  Alpha  ", "", null, "Beta"]'),
            ["Alpha", "Beta"],
        )
        self.assertEqual(parse_archive_name_list("not-json"), [])
        self.assertEqual(parse_archive_name_list('{"not": "a list"}'), [])

    def test_build_campaign_archive_payload_groups_and_sorts_entries(self):
        payload = build_campaign_archive_payload(
            war_effort_rows=[
                {
                    "week_anchor": "2026-04-21",
                    "category": "xp",
                    "vanguards": '[" Bravo ", "Alpha"]',
                    "participants": '["Zulu"]',
                },
                {
                    "week_anchor": "2026-04-21",
                    "category": "readiness",
                    "vanguards": '["Charlie", "Alpha"]',
                    "participants": '["Charlie", "Delta"]',
                }
            ],
            ladder_rows=[
                {
                    "week_anchor": "2026-04-21",
                    "category": "pvp",
                    "rank": 2,
                    "champion": "Second",
                    "score": 200,
                },
                {
                    "week_anchor": "2026-04-21",
                    "category": "pvp",
                    "rank": 1,
                    "champion": "First",
                    "score": 300,
                },
            ],
            reigning_rows=[
                {
                    "week_anchor": "2026-04-21",
                    "category": "pve",
                    "champion": "Champion",
                    "score": "42",
                }
            ],
        )

        self.assertEqual(payload["latest_week"], "2026-04-21")
        self.assertEqual(payload["archived_weeks"], 1)
        self.assertEqual(payload["total_campaign_entries"], 4)
        self.assertEqual(payload["reigning_titles_logged"], 1)

        week = payload["weeks"][0]
        self.assertEqual(week["week_anchor"], "2026-04-21")
        self.assertEqual(week["war_effort_entry_count"], 2)
        self.assertEqual(week["ladder_entry_count"], 2)
        self.assertEqual(week["reigning_entry_count"], 1)
        self.assertEqual(week["war_effort"][0]["category"], "xp")
        self.assertEqual(week["war_effort"][0]["vanguards"], ["Bravo", "Alpha"])
        self.assertEqual(week["war_effort"][0]["participant_count"], 1)
        self.assertEqual(week["war_effort"][1]["category"], "readiness")
        self.assertEqual(week["war_effort"][1]["label"], "Warden's Standard")
        self.assertEqual(week["war_effort"][1]["vanguards"], ["Charlie", "Alpha"])
        self.assertEqual(week["war_effort"][1]["participants"], ["Charlie", "Delta"])
        self.assertEqual(week["war_effort"][1]["participant_count"], 2)
        self.assertEqual(week["ladder"]["pve"], [])
        self.assertEqual([entry["rank"] for entry in week["ladder"]["pvp"]], [1, 2])
        self.assertEqual([entry["champion"] for entry in week["ladder"]["pvp"]], ["First", "Second"])
        self.assertEqual(week["reigning_titles"][0]["category"], "pve")
        self.assertEqual(week["reigning_titles"][0]["score"], 42)

    def test_build_campaign_archive_payload_keeps_latest_reigning_week_first(self):
        payload = build_campaign_archive_payload(
            war_effort_rows=[],
            ladder_rows=[],
            reigning_rows=[
                {
                    "week_anchor": "2026-04-14",
                    "category": "pve",
                    "champion": "Past Champion",
                    "score": "10",
                },
                {
                    "week_anchor": "2026-04-21",
                    "category": "pve",
                    "champion": "Current Champion",
                    "score": "25",
                },
            ],
        )

        self.assertEqual(payload["latest_week"], "2026-04-21")
        self.assertEqual(payload["weeks"][0]["reigning_titles"][0]["champion"], "Current Champion")
        self.assertEqual(payload["weeks"][0]["reigning_titles"][0]["score"], 25)

    def test_campaign_archive_frontend_recognizes_readiness_category(self):
        archive_view_text = Path("render/src/js/features/campaign_archive/archive_view.js").read_text(encoding="utf-8")

        self.assertIn("CAMPAIGN_ARCHIVE_CATEGORY_ICONS", archive_view_text)
        self.assertIn("const cleanCategory = String(category || '').trim().toLowerCase();", archive_view_text)
        self.assertIn("CAMPAIGN_ARCHIVE_CATEGORY_ICONS[cleanCategory] || '\\u{1F396}\\uFE0F'", archive_view_text)
        self.assertIn("readiness: '\\u{1F3F0}'", archive_view_text)
        self.assertIn("CAMPAIGN_ARCHIVE_CATEGORY_LABELS", archive_view_text)
        self.assertIn("readiness: \"Warden's Standard\"", archive_view_text)
        self.assertIn("buildCampaignArchiveWarEffortTitle(category, label)", archive_view_text)
        self.assertIn("String(label || '').trim() || CAMPAIGN_ARCHIVE_CATEGORY_LABELS[cleanCategory] || cleanCategory || 'War Effort';", archive_view_text)
        self.assertIn("Hero's Journey", archive_view_text)
        self.assertIn("Blood of the Enemy", archive_view_text)
        self.assertIn("Dragon's Hoard", archive_view_text)
        self.assertIn("The Zenith Cohort", archive_view_text)
        self.assertNotIn("WS", archive_view_text)
        self.assertNotIn("READY", archive_view_text)
        self.assertNotIn("WARDEN", archive_view_text)
        self.assertNotIn("DH", archive_view_text)
        self.assertNotIn("PVE", archive_view_text)
        self.assertNotIn("BOE", archive_view_text)
        self.assertNotIn("ZN", archive_view_text)
        self.assertNotIn("__amwReadinessPatched", archive_view_text)
        self.assertNotIn("patchedGetHallOfHeroes", archive_view_text)
        self.assertNotIn("badge.removeAttribute('title');", archive_view_text)
        self.assertNotIn("badge.style.pointerEvents = 'none';", archive_view_text)


if __name__ == "__main__":
    unittest.main()
