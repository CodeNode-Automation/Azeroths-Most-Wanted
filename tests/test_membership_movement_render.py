import json
import os
import re
import unittest
from pathlib import Path
from unittest import mock

from render.html_dashboard import generate_html_dashboard
from tests.workspace_temp import workspace_temp_dir
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
                realm_data={"global_metrics": {}, "global_trends": {}},
                dashboard_feed=dashboard_feed,
                raw_guild_roster=[{"name": "Alpha", "level": 70}],
                prev_mvps={},
            )

        mock_write_timeline.assert_called_once()
        self.assertTrue(mock_fetch.await_count >= 1)
        self.assertTrue(
            any(
                "guild_membership_events" in call.args[1]
                and "WHERE detected_at >= strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '-7 days')" in call.args[1]
                and "LIMIT 500" in call.args[1]
                for call in mock_fetch.await_args_list
            )
        )
        self.assertFalse(any("WITH latest_scan AS" in call.args[1] for call in mock_fetch.await_args_list))
        self.assertTrue(mock_generate_html.call_count == 1)
        self.assertIn("membership_movement", mock_generate_html.call_args.kwargs)
        membership_movement = mock_generate_html.call_args.kwargs["membership_movement"]
        self.assertEqual(membership_movement["joined"], 1)
        self.assertEqual(membership_movement["departed"], 1)
        self.assertEqual(
            [event["character_name"] for event in membership_movement["recent"]],
            ["Alpha", "Bravo"],
        )
        self.assertIn("latest_changes", mock_generate_html.call_args.kwargs)
        latest_changes = mock_generate_html.call_args.kwargs["latest_changes"]
        self.assertEqual(latest_changes["title"], "Latest Changes")
        self.assertFalse(latest_changes["empty"])
        self.assertEqual(latest_changes["items"][0]["type"], "movement")
        self.assertEqual(
            [item["type"] for item in latest_changes["items"][:3]],
            ["movement", "level_up", "item"],
        )

    async def test_finalize_dashboard_output_uses_full_latest_scan_for_baseline_counts(self):
        recent_rows = [
            {
                "scan_id": "scan-99",
                "character_name": f"Hero {index:03d}",
                "event_type": "joined",
                "detected_at": "2026-04-29T12:00:00Z",
                "previous_status": None,
                "current_status": "active",
            }
            for index in range(1, 626)
        ]
        dashboard_feed = []

        def fetch_side_effect(session, query):
            if "guild_membership_events" in query:
                return recent_rows
            return []

        with (
            mock.patch("wow.output.fetch_turso", side_effect=fetch_side_effect) as mock_fetch,
            mock.patch("wow.output.write_timeline_output"),
            mock.patch("wow.output.generate_html_dashboard") as mock_generate_html,
        ):
            await finalize_dashboard_output(
                mock.MagicMock(),
                roster_data=[{"profile": {"name": "Alpha", "level": 70, "equipped_item_level": 120}}],
                realm_data={
                    "global_metrics": {
                        "total_members": 625,
                        "active_14_days": 268,
                        "raid_ready_count": 22,
                        "avg_ilvl_70": 107,
                    },
                    "global_trends": {},
                },
                dashboard_feed=dashboard_feed,
                raw_guild_roster=[{"name": "Alpha", "level": 70}],
                prev_mvps={},
            )

        self.assertTrue(mock_fetch.await_count >= 1)
        self.assertEqual(mock_generate_html.call_count, 1)
        generated = mock_generate_html.call_args.kwargs
        membership_movement = generated["membership_movement"]
        latest_changes = generated["latest_changes"]
        officer_brief = generated["officer_brief"]

        self.assertEqual(membership_movement["total"], 625)
        self.assertEqual(membership_movement["joined"], 625)
        self.assertEqual(len(membership_movement["recent"]), 5)
        self.assertTrue(latest_changes["empty"])
        self.assertEqual(latest_changes["items"], [])
        self.assertEqual(
            latest_changes["empty_text"],
            "Activity and trend changes will appear after comparison scans detect movement beyond the baseline.",
        )
        self.assertEqual(officer_brief["status"], "Building")
        self.assertEqual(
            officer_brief["summary"],
            "Early roster picture captured; confidence improves as comparison scans add more activity, readiness, and movement signals.",
        )
        self.assertNotIn("movement", [item["type"] for item in officer_brief["items"]])

    async def test_finalize_dashboard_output_prefers_latest_real_movement_scan_over_bootstrap_scan(self):
        recent_rows = [
            {
                "scan_id": "scan-200",
                "character_name": "Alpha",
                "event_type": "joined",
                "detected_at": "2026-05-01T12:00:00Z",
                "previous_status": None,
                "current_status": "active",
            },
            {
                "scan_id": "scan-200",
                "character_name": "Bravo",
                "event_type": "joined",
                "detected_at": "2026-05-01T12:00:00Z",
                "previous_status": None,
                "current_status": "active",
            },
            {
                "scan_id": "scan-200",
                "character_name": "Charlie",
                "event_type": "joined",
                "detected_at": "2026-05-01T12:00:00Z",
                "previous_status": None,
                "current_status": "active",
            },
            {
                "scan_id": "scan-100",
                "character_name": "Alpha",
                "event_type": "joined",
                "detected_at": "2026-04-29T12:00:00Z",
                "previous_status": "active",
                "current_status": "active",
            },
            {
                "scan_id": "scan-100",
                "character_name": "Bravo",
                "event_type": "departed",
                "detected_at": "2026-04-29T12:00:00Z",
                "previous_status": "active",
                "current_status": "departed",
            },
            {
                "scan_id": "scan-100",
                "character_name": "Charlie",
                "event_type": "rejoined",
                "detected_at": "2026-04-29T12:00:00Z",
                "previous_status": "departed",
                "current_status": "active",
            },
        ]

        def fetch_side_effect(session, query):
            if "guild_membership_events" in query:
                return recent_rows
            return []

        with (
            mock.patch("wow.output.fetch_turso", side_effect=fetch_side_effect) as mock_fetch,
            mock.patch("wow.output.write_timeline_output"),
            mock.patch("wow.output.generate_html_dashboard") as mock_generate_html,
        ):
            await finalize_dashboard_output(
                mock.MagicMock(),
                roster_data=[{"profile": {"name": "Alpha", "level": 70, "equipped_item_level": 120}}],
                realm_data={
                    "global_metrics": {
                        "total_members": 625,
                        "active_14_days": 268,
                        "raid_ready_count": 22,
                        "avg_ilvl_70": 107,
                    },
                    "global_trends": {},
                },
                dashboard_feed=[],
                raw_guild_roster=[{"name": "Alpha", "level": 70}],
                prev_mvps={},
            )

        self.assertTrue(mock_fetch.await_count >= 1)
        self.assertEqual(mock_generate_html.call_count, 1)
        membership_movement = mock_generate_html.call_args.kwargs["membership_movement"]

        self.assertEqual(membership_movement["joined"], 1)
        self.assertEqual(membership_movement["departed"], 1)
        self.assertEqual(membership_movement["rejoined"], 1)
        self.assertFalse(membership_movement["bootstrap"])
        self.assertEqual(
            [event["character_name"] for event in membership_movement["recent"]],
            ["Alpha", "Charlie", "Bravo"],
        )

    def test_generate_html_dashboard_serializes_membership_movement_payload(self):
        original_cwd = os.getcwd()
        temp_dir = workspace_temp_dir()

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
            latest_changes = {
                "title": "Latest Changes",
                "items": [
                    {
                        "type": "movement",
                        "label": "1 member recorded as the movement baseline",
                        "tone": "neutral",
                    }
                ],
                "empty": False,
                "empty_text": "No notable changes recorded yet.",
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
                latest_changes=latest_changes,
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
            self.assertIn("latest_changes", dashboard_config)
            self.assertEqual(dashboard_config["latest_changes"]["title"], "Latest Changes")
            self.assertEqual(dashboard_config["latest_changes"]["items"][0]["type"], "movement")
        finally:
            os.chdir(original_cwd)
            temp_dir.cleanup()

    def test_template_includes_guild_movement_card_markup_and_hook(self):
        template_text = Path("render/dashboard_template.html").read_text(encoding="utf-8")
        js_text = Path("render/src/js/features/home_analytics/home_overview.js").read_text(encoding="utf-8")
        css_text = Path("render/style.css").read_text(encoding="utf-8")

        self.assertIn('id="home-movement-card"', template_text)
        self.assertIn('id="home-movement-list"', template_text)
        self.assertIn('Latest roster movement', template_text)
        self.assertIn('Roster Movement', template_text)
        self.assertIn("renderHomeMovementCard", js_text)
        self.assertIn("function getHomeMovementCharacterTarget(characterName)", js_text)
        self.assertIn("movement baseline", js_text)
        self.assertIn("Guild roster currently reports", js_text)
        self.assertIn("detail-eligible characters are recorded as the movement baseline for profile, gear, activity, and movement intelligence.", js_text)
        self.assertIn("${total.toLocaleString()} detail-eligible characters are recorded as the movement baseline", js_text)
        self.assertIn('data-movement-state', js_text)
        self.assertIn("item.classList.add('is-clickable');", js_text)
        self.assertIn("item.setAttribute('role', 'button');", js_text)
        self.assertIn("window.selectCharacter(characterName.toLowerCase());", js_text)
        self.assertNotIn("processedRosterCount", js_text)
        self.assertIn("Very low-level characters and characters with restricted Blizzard profile privacy may appear in the guild roster and level distribution before full profile, equipment, activity, and statistics details are available.", js_text)
        self.assertIn("No processed character departure was identified, likely because the change involved a low-level or privacy-restricted roster entry.", js_text)
        self.assertIn('.home-movement-card[data-movement-state="bootstrap"] .home-nav-copy,', css_text)
        self.assertIn('.home-movement-card[data-movement-state="count-only"] .home-nav-copy,', css_text)
        self.assertIn('.home-movement-item.is-clickable {', css_text)
        self.assertIn('.home-movement-item.is-clickable:focus-visible {', css_text)

    def test_home_movement_card_declares_root_card_before_setting_state(self):
        js_text = Path("render/src/js/features/home_analytics/home_overview.js").read_text(encoding="utf-8")

        self.assertIn("function renderHomeMovementCard(dashboardConfig = {}) {", js_text)
        self.assertIn("const cardEl = document.getElementById('home-movement-card');", js_text)
        self.assertIn("if (!cardEl || !titleEl || !summaryEl || !listEl || !noteEl) return;", js_text)
        self.assertIn("cardEl.setAttribute('data-movement-state', movementState);", js_text)
        self.assertIn('data-movement-state', js_text)

    def test_template_includes_latest_changes_card_markup_and_hook(self):
        template_text = Path("render/dashboard_template.html").read_text(encoding="utf-8")
        js_text = Path("render/src/js/features/home_analytics/home_overview.js").read_text(encoding="utf-8")
        helper_text = Path("wow/change_summary.py").read_text(encoding="utf-8")

        self.assertIn('id="home-latest-changes-card"', template_text)
        self.assertIn('id="home-latest-changes-list"', template_text)
        self.assertIn('Latest Changes', template_text)
        self.assertIn('What changed recently', template_text)
        self.assertIn('renderHomeLatestChangesCard', js_text)
        self.assertIn('No notable changes recorded yet.', js_text)
        self.assertIn('Recent activity, trend shifts, and notable roster signals worth noting.', js_text)
        self.assertIn('Roster movement updated in the latest scan.', helper_text)
        self.assertIn(
            'Activity and trend changes will appear after comparison scans detect movement beyond the baseline.',
            helper_text,
        )

    def test_guild_pulse_copy_distinguishes_mains_alts_and_all_characters(self):
        template_text = Path("render/dashboard_template.html").read_text(encoding="utf-8")
        js_text = Path("render/src/js/features/home_analytics/home_overview.js").read_text(encoding="utf-8")
        script_text = Path("render/script.js").read_text(encoding="utf-8")
        css_text = Path("render/style.css").read_text(encoding="utf-8")

        self.assertIn('Guild Roster', template_text)
        self.assertIn('Active Mains', template_text)
        self.assertIn('Raid-Ready Mains', template_text)
        self.assertIn('Avg Level 70 iLvl', template_text)
        self.assertIn('id="home-pulse-total-support-a"', template_text)
        self.assertIn('id="home-pulse-active-support-a"', template_text)
        self.assertIn('id="home-pulse-raidready-support-a"', template_text)
        self.assertIn('id="home-pulse-ilvl-support-a"', template_text)
        self.assertIn("setHomePulseSupport", js_text)
        self.assertIn("setHomeTextVisibility", js_text)
        self.assertIn("Raw guild roster total", js_text)
        self.assertIn("Seen in the last 14 days.", js_text)
        self.assertIn("deployable roster strength", js_text)
        self.assertIn("Average equipped iLvl for level 70 mains.", js_text)
        self.assertIn("since previous scan", script_text)
        self.assertNotIn("▲ ${diff}", script_text)
        self.assertIn(".home-pulse-support-pill[hidden] {", css_text)
        self.assertIn(".home-pulse-context {", css_text)
        self.assertIn(".home-pulse-support {", css_text)
        self.assertIn(".home-pulse-support-pill {", css_text)
        self.assertIn(".view-all-btn:focus-visible", css_text)
        self.assertIn(".view-heroes-btn:focus-visible", css_text)
        war_effort_css_text = Path("render/src/css/features/war_effort/war_effort.css").read_text(encoding="utf-8")
        self.assertIn(".challenge-link:focus-visible", war_effort_css_text)
        self.assertNotIn(".challenge-link:focus-visible", css_text)

    def test_source_template_includes_favicon_and_github_links(self):
        template_text = Path("render/dashboard_template.html").read_text(encoding="utf-8")

        self.assertIn('rel="icon" type="image/svg+xml" href="asset/amw.svg"', template_text)
        self.assertIn('mailto:nullbit5@protonmail.com', template_text)
        self.assertNotIn('https://github.com/parvagans/Azeroths-Most-Wanted', template_text)
        self.assertNotIn('class="nav-btn nav-btn-source"', template_text)
        self.assertIn('class="nav-btn nav-btn-contact"', template_text)
        self.assertIn('Contact</a>', template_text)
        self.assertNotIn('class="footer-source-info"', template_text)
        self.assertIn('class="footer-contact-info"', template_text)
        self.assertIn('href="#campaign-archive"', template_text)
        self.assertIn('View Campaign Archive', template_text)
        self.assertIn('Campaign Archive', template_text)

    def test_home_command_tiles_are_navigation_tiles_not_duplicate_metrics(self):
        template_text = Path("render/dashboard_template.html").read_text(encoding="utf-8")
        js_text = Path("render/src/js/features/home_analytics/home_overview.js").read_text(encoding="utf-8")
        css_text = Path("render/style.css").read_text(encoding="utf-8")

        self.assertNotIn("Dispatch Board", template_text)
        self.assertNotIn("home-command-section", template_text)
        self.assertIn("Select View...", template_text)
        self.assertIn('id="charSearch"', template_text)
        self.assertIn('id="heroCharSearch"', template_text)
        self.assertIn(".home-command-card .home-nav-value", css_text)
        self.assertNotIn("setHomeText('home-command-total-value'", js_text)
        self.assertNotIn("setHomeText('home-command-active-value'", js_text)
        self.assertNotIn("setHomeText('home-command-raidready-value'", js_text)
        self.assertNotIn("setHomeText('home-command-badges-value'", js_text)
        self.assertNotIn("setHomeCardText('home-command-total-value', '.home-nav-copy'", js_text)
        self.assertNotIn("setHomeCardText('home-command-active-value', '.home-nav-copy'", js_text)
        self.assertNotIn("setHomeCardText('home-command-raidready-value', '.home-nav-copy'", js_text)
        self.assertNotIn("setHomeCardText('home-command-badges-value', '.home-nav-copy'", js_text)


if __name__ == "__main__":
    unittest.main()
