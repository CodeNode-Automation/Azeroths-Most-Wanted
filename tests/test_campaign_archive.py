import unittest

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
        self.assertEqual(payload["total_campaign_entries"], 3)
        self.assertEqual(payload["reigning_titles_logged"], 1)

        week = payload["weeks"][0]
        self.assertEqual(week["week_anchor"], "2026-04-21")
        self.assertEqual(week["war_effort_entry_count"], 1)
        self.assertEqual(week["ladder_entry_count"], 2)
        self.assertEqual(week["reigning_entry_count"], 1)
        self.assertEqual(week["war_effort"][0]["category"], "xp")
        self.assertEqual(week["war_effort"][0]["vanguards"], ["Bravo", "Alpha"])
        self.assertEqual(week["war_effort"][0]["participant_count"], 1)
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


if __name__ == "__main__":
    unittest.main()
