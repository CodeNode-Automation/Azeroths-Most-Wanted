import unittest

from wow.membership_movement import build_latest_membership_movement_query
from wow.membership_movement import build_recent_membership_movement_query
from wow.membership_movement import summarize_membership_events
from wow.trends import process_global_trends


class MembershipMovementSummaryTests(unittest.TestCase):
    def test_build_recent_membership_movement_query_targets_table_and_limit(self):
        query = build_recent_membership_movement_query(limit=7)

        self.assertIn("guild_membership_events", query)
        self.assertIn("ORDER BY detected_at DESC, id DESC", query)
        self.assertIn("LIMIT 7", query)

    def test_build_latest_membership_movement_query_targets_latest_scan_without_limit(self):
        query = build_latest_membership_movement_query()

        self.assertIn("WITH latest_scan AS", query)
        self.assertIn("SELECT scan_id", query)
        self.assertIn("WHERE scan_id = (SELECT scan_id FROM latest_scan)", query)
        self.assertNotIn("LIMIT 200", query)

    def test_summarize_membership_events_handles_empty_input(self):
        self.assertEqual(
            summarize_membership_events([]),
            {
                "joined": 0,
                "departed": 0,
                "rejoined": 0,
                "total": 0,
                "recent": [],
                "bootstrap": False,
                "scan_id": None,
                "detected_at": None,
            },
        )

    def test_summarize_membership_events_counts_latest_scan_and_orders_recent_rows(self):
        summary = summarize_membership_events(
            [
                {
                    "scan_id": "scan-1",
                    "character_name": "Legacy",
                    "event_type": "joined",
                    "detected_at": "2026-04-29T09:00:00Z",
                    "previous_status": None,
                    "current_status": "active",
                },
                {
                    "scan_id": "scan-2",
                    "character_name": "Bravo",
                    "event_type": "departed",
                    "detected_at": "2026-04-29T10:00:00Z",
                    "previous_status": "active",
                    "current_status": "departed",
                },
                {
                    "scan_id": "scan-2",
                    "character_name": "Alpha",
                    "event_type": "rejoined",
                    "detected_at": "2026-04-29T10:00:00Z",
                    "previous_status": "departed",
                    "current_status": "active",
                },
                {
                    "scan_id": "scan-2",
                    "character_name": "Charlie",
                    "event_type": "joined",
                    "detected_at": "2026-04-29T10:00:00Z",
                    "previous_status": None,
                    "current_status": "active",
                },
            ],
            limit=5,
        )

        self.assertEqual(summary["scan_id"], "scan-2")
        self.assertEqual(summary["detected_at"], "2026-04-29T10:00:00Z")
        self.assertEqual(summary["joined"], 1)
        self.assertEqual(summary["departed"], 1)
        self.assertEqual(summary["rejoined"], 1)
        self.assertEqual(summary["total"], 3)
        self.assertFalse(summary["bootstrap"])
        self.assertEqual(
            [event["character_name"] for event in summary["recent"]],
            ["Charlie", "Alpha", "Bravo"],
        )

    def test_summarize_membership_events_marks_initial_capture_as_bootstrap(self):
        summary = summarize_membership_events(
            [
                {
                    "scan_id": "scan-9",
                    "character_name": "Alpha",
                    "event_type": "joined",
                    "detected_at": "2026-04-29T11:00:00Z",
                    "previous_status": None,
                    "current_status": "active",
                },
                {
                    "scan_id": "scan-9",
                    "character_name": "Bravo",
                    "event_type": "joined",
                    "detected_at": "2026-04-29T11:00:00Z",
                    "previous_status": None,
                    "current_status": "active",
                },
            ],
            limit=1,
        )

        self.assertTrue(summary["bootstrap"])
        self.assertEqual(summary["joined"], 2)
        self.assertEqual(summary["total"], 2)
        self.assertEqual(len(summary["recent"]), 1)

    def test_process_global_trends_serializes_raw_totals_for_count_only_deltas(self):
        roster_data = [
            {
                "profile": {
                    "name": "Alpha",
                    "level": 70,
                    "equipped_item_level": 120,
                    "last_login_timestamp": 0,
                }
            }
        ]
        raw_guild_roster = [
            {
                "name": "Alpha",
                "level": 70,
                "rank": "Member",
            }
        ]

        realm_data, _, _ = process_global_trends(
            roster_data,
            raw_guild_roster,
            {"global_metrics": {}, "global_trends": {}},
            {
                "last_total": 658,
                "last_active": 0,
                "last_ready": 0,
                "last_total_mains": 658,
                "last_active_mains": 0,
                "last_ready_mains": 0,
            },
        )

        self.assertIn("global_trends", realm_data)
        self.assertEqual(realm_data["global_trends"]["total_members"], 1)
        self.assertEqual(realm_data["global_trends"]["previous_total_members"], 658)


if __name__ == "__main__":
    unittest.main()
