import json
import os
import re
import tempfile
import unittest
from pathlib import Path
from unittest import mock

from render.html_dashboard import generate_html_dashboard
from wow.output import finalize_dashboard_output


class OfficerBriefRenderTests(unittest.IsolatedAsyncioTestCase):
    async def test_finalize_dashboard_output_passes_officer_brief_to_renderer(self):
        recent_rows = [
            {
                "scan_id": "scan-18",
                "character_name": "Alpha",
                "event_type": "joined",
                "detected_at": "2026-04-29T11:30:00Z",
                "previous_status": None,
                "current_status": "active",
            },
            {
                "scan_id": "scan-18",
                "character_name": "Bravo",
                "event_type": "departed",
                "detected_at": "2026-04-29T11:30:00Z",
                "previous_status": "active",
                "current_status": "departed",
            },
        ]
        dashboard_feed = [
            {
                "timestamp": "2026-04-29T11:45:00Z",
                "character_name": "Charlie",
                "type": "level_up",
                "level": 70,
            },
            {
                "timestamp": "2026-04-29T11:44:00Z",
                "character_name": "Delta",
                "type": "item",
                "item_name": "Shiny Axe",
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
                realm_data={
                    "global_metrics": {
                        "total_members": 18,
                        "active_14_days": 9,
                        "raid_ready_count": 4,
                        "avg_ilvl_70": 108,
                    },
                    "global_trends": {
                        "trend_active_mains": 1,
                        "trend_ready_mains": 1,
                    },
                },
                dashboard_feed=dashboard_feed,
                raw_guild_roster=[{"name": "Alpha", "level": 70}],
                prev_mvps={},
            )

        mock_write_timeline.assert_called_once()
        self.assertTrue(mock_fetch.await_count >= 1)
        self.assertEqual(mock_generate_html.call_count, 1)
        self.assertIn("officer_brief", mock_generate_html.call_args.kwargs)
        officer_brief = mock_generate_html.call_args.kwargs["officer_brief"]
        self.assertEqual(officer_brief["title"], "Officer Brief")
        self.assertFalse(officer_brief["empty"])
        self.assertEqual(officer_brief["status"], "Watch")
        self.assertEqual(officer_brief["items"][0]["type"], "movement")

    def test_generate_html_dashboard_serializes_officer_brief_payload(self):
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
            officer_brief = {
                "title": "Officer Brief",
                "status": "Stable",
                "tone": "positive",
                "summary": "Roster activity is steady with raid readiness holding.",
                "items": [
                    {"type": "activity", "label": "Activity looks steady across the latest snapshot", "tone": "positive"}
                ],
                "empty": False,
                "empty_text": "No roster health signals are available yet.",
            }

            generate_html_dashboard(
                roster_data=roster_data,
                realm_data=realm_data,
                timeline_data=[],
                raw_guild_roster=raw_guild_roster,
                roster_history={},
                prev_mvps={},
                campaign_archive={},
                officer_brief=officer_brief,
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
            self.assertIn("officer_brief", dashboard_config)
            self.assertEqual(dashboard_config["officer_brief"]["title"], "Officer Brief")
            self.assertEqual(dashboard_config["officer_brief"]["status"], "Stable")
            self.assertEqual(dashboard_config["officer_brief"]["items"][0]["type"], "activity")
        finally:
            os.chdir(original_cwd)
            temp_dir.cleanup()

    def test_template_includes_officer_brief_card_markup_and_hook(self):
        template_text = Path("render/dashboard_template.html").read_text(encoding="utf-8")
        js_text = Path("render/src/js/features/home_analytics/home_overview.js").read_text(encoding="utf-8")

        self.assertIn('id="home-officer-brief-card"', template_text)
        self.assertIn('id="home-officer-brief-status"', template_text)
        self.assertIn('id="home-officer-brief-list"', template_text)
        self.assertIn('Officer Brief', template_text)
        self.assertIn('Roster Health', template_text)
        self.assertIn('No roster health signals are available yet.', template_text)
        self.assertIn('renderHomeOfficerBriefCard', js_text)
        self.assertIn('formatHomeOfficerBriefItemType', js_text)


if __name__ == "__main__":
    unittest.main()
