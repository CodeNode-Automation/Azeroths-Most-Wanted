import json
import os
import re
import tempfile
import unittest
from pathlib import Path
from unittest import mock

from render.html_dashboard import generate_html_dashboard
from wow.output import finalize_dashboard_output


class MembershipMovementRenderTests(unittest.IsolatedAsyncioTestCase):
    async def test_finalize_dashboard_output_passes_membership_summary_to_renderer(self):
        recent_rows = [
            {
                "scan_id": "scan-12",
                "character_name": "Alpha",
                "event_type": "joined",
                "detected_at": "2026-04-29T11:30:00Z",
                "previous_status": None,
                "current_status": "active",
            },
            {
                "scan_id": "scan-12",
                "character_name": "Bravo",
                "event_type": "departed",
                "detected_at": "2026-04-29T11:30:00Z",
                "previous_status": "active",
                "current_status": "departed",
            },
        ]

        def fetch_side_effect(session, query):
            if "guild_membership_events" in query:
                return recent_rows
            return []

        with (
            mock.patch("wow.output.fetch_turso", side_effect=fetch_side_effect) as mock_fetch,
            mock.patch("wow.output.write_timeline_output") as mock_write_timeline,
            mock.patch("wow.output.generate_html_dashboard") as mock_generate_html,
        ):
            await finalize_dashboard_output(
                mock.MagicMock(),
                roster_data=[{"profile": {"name": "Alpha", "level": 70, "equipped_item_level": 120}}],
                realm_data={"global_metrics": {}, "global_trends": {}},
                dashboard_feed=[],
                raw_guild_roster=[{"name": "Alpha", "level": 70}],
                prev_mvps={},
            )

        mock_write_timeline.assert_called_once()
        self.assertTrue(mock_fetch.await_count >= 1)
        self.assertTrue(mock_generate_html.call_count == 1)
        self.assertIn("membership_movement", mock_generate_html.call_args.kwargs)
        membership_movement = mock_generate_html.call_args.kwargs["membership_movement"]
        self.assertEqual(membership_movement["joined"], 1)
        self.assertEqual(membership_movement["departed"], 1)
        self.assertEqual(
            [event["character_name"] for event in membership_movement["recent"]],
            ["Alpha", "Bravo"],
        )

    def test_generate_html_dashboard_serializes_membership_movement_payload(self):
        original_cwd = os.getcwd()
        temp_dir = tempfile.TemporaryDirectory()

        try:
            os.chdir(temp_dir.name)

            roster_data = [
                {
                    "profile": {
                        "name": "SmokeTest",
                        "level": 70,
                        "equipped_item_level": 123,
                        "last_login_timestamp": 0,
                        "guild_rank": "Member",
                    }
                }
            ]
            realm_data = {"global_metrics": {}, "global_trends": {}}
            raw_guild_roster = [
                {
                    "name": "SmokeTest",
                    "level": 70,
                    "class": "Warrior",
                    "race": "Human",
                    "rank": "Member",
                }
            ]
            membership_movement = {
                "joined": 1,
                "departed": 0,
                "rejoined": 0,
                "total": 1,
                "bootstrap": True,
                "recent": [
                    {
                        "scan_id": "scan-1",
                        "character_name": "SmokeTest",
                        "event_type": "joined",
                        "detected_at": "2026-04-29T11:45:00Z",
                        "previous_status": None,
                        "current_status": "active",
                    }
                ],
            }

            generate_html_dashboard(
                roster_data=roster_data,
                realm_data=realm_data,
                timeline_data=[],
                raw_guild_roster=raw_guild_roster,
                roster_history={},
                prev_mvps={},
                campaign_archive={},
                membership_movement=membership_movement,
            )

            index_html = Path("index.html")
            html_text = index_html.read_text(encoding="utf-8")
            config_match = re.search(
                r'<script id="dashboard-config" type="application/json">\s*(.*?)\s*</script>',
                html_text,
                re.S,
            )

            self.assertIsNotNone(config_match)
            dashboard_config = json.loads(config_match.group(1))
            self.assertIn("membership_movement", dashboard_config)
            self.assertEqual(dashboard_config["membership_movement"]["joined"], 1)
            self.assertEqual(
                dashboard_config["membership_movement"]["recent"][0]["character_name"],
                "SmokeTest",
            )
        finally:
            os.chdir(original_cwd)
            temp_dir.cleanup()

    def test_template_includes_guild_movement_card_markup_and_hook(self):
        template_text = Path("render/dashboard_template.html").read_text(encoding="utf-8")
        js_text = Path("render/src/js/features/home_analytics/home_overview.js").read_text(encoding="utf-8")

        self.assertIn('id="home-movement-card"', template_text)
        self.assertIn('id="home-movement-list"', template_text)
        self.assertIn('Latest roster movement', template_text)
        self.assertIn('Roster Movement', template_text)
        self.assertIn("renderHomeMovementCard", js_text)
        self.assertIn("movement baseline", js_text)
        self.assertIn("Future joins, departures, and rejoins will appear here.", js_text)


if __name__ == "__main__":
    unittest.main()
