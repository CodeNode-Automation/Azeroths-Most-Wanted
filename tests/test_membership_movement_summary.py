import unittest

from wow.membership_movement import build_latest_membership_movement_query
from wow.membership_movement import build_recent_membership_movement_query
from wow.membership_movement import summarize_membership_events
from wow.trends import process_global_trends


class MembershipMovementSummaryTests(unittest.TestCase):
    def test_build_recent_membership_movement_query_targets_recent_window_and_limit(self):
        query = build_recent_membership_movement_query(limit=7, days=7)

        self.assertIn("guild_membership_events", query)
        self.assertIn("SELECT id, scan_id, character_name, event_type, detected_at, previous_status, current_status", query)
        self.assertIn("WHERE detected_at >= strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '-7 days')", query)
        self.assertIn("ORDER BY detected_at DESC, id DESC", query)
        self.assertIn("LIMIT 7", query)

    def test_build_recent_membership_movement_query_defaults_to_7_day_window_and_500_limit(self):
        query = build_recent_membership_movement_query()

        self.assertIn("WHERE detected_at >= strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '-7 days')", query)
        self.assertIn("LIMIT 500", query)

    def test_build_latest_membership_movement_query_targets_latest_scan_without_limit(self):
        query = build_latest_membership_movement_query()

        self.assertIn("WITH latest_scan AS", query)
        self.assertIn("SELECT scan_id", query)
        self.assertIn("WHERE scan_id = (SELECT scan_id FROM latest_scan)", query)
        self.assertIn("ORDER BY detected_at DESC, id DESC", query)
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

    def test_summarize_membership_events_counts_latest_scan_and_keeps_recent_window_rows(self):
        summary = summarize_membership_events(
            [
                {
                    "id": 1,
                    "scan_id": "scan-1",
                    "character_name": "Legacy",
                    "event_type": "departed",
                    "detected_at": "2026-04-29T09:00:00Z",
                    "previous_status": "active",
                    "current_status": "departed",
                },
                {
                    "id": 2,
                    "scan_id": "scan-2",
                    "character_name": "Bravo",
                    "event_type": "departed",
                    "detected_at": "2026-04-29T10:00:00Z",
                    "previous_status": "active",
                    "current_status": "departed",
                },
                {
                    "id": 3,
                    "scan_id": "scan-2",
                    "character_name": "Alpha",
                    "event_type": "rejoined",
                    "detected_at": "2026-04-29T10:00:00Z",
                    "previous_status": "departed",
                    "current_status": "active",
                },
                {
                    "id": 4,
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
        self.assertEqual(summary["recent_joined"], 1)
        self.assertEqual(summary["recent_departed"], 2)
        self.assertEqual(summary["recent_rejoined"], 1)
        self.assertEqual(summary["recent_total"], 4)
        self.assertFalse(summary["bootstrap"])
        self.assertEqual(
            [event["character_name"] for event in summary["recent"]],
            ["Charlie", "Alpha", "Bravo", "Legacy"],
        )
        self.assertEqual(
            [event["id"] for event in summary["recent"]],
            [4, 3, 2, 1],
        )

    def test_summarize_membership_events_uses_latest_scan_for_counts_and_7_day_recent_rows(self):
        summary = summarize_membership_events(
            [
                {
                    "id": 10,
                    "scan_id": "scan-old",
                    "character_name": "Old Departed",
                    "event_type": "departed",
                    "detected_at": "2026-04-24T08:00:00Z",
                    "previous_status": "active",
                    "current_status": "departed",
                },
                {
                    "id": 20,
                    "scan_id": "scan-latest",
                    "character_name": "Latest Joined",
                    "event_type": "joined",
                    "detected_at": "2026-04-29T10:00:00Z",
                    "previous_status": None,
                    "current_status": "active",
                },
                {
                    "id": 21,
                    "scan_id": "scan-latest",
                    "character_name": "Latest Departed",
                    "event_type": "departed",
                    "detected_at": "2026-04-29T10:00:00Z",
                    "previous_status": "active",
                    "current_status": "departed",
                },
                {
                    "id": 22,
                    "scan_id": "scan-latest",
                    "character_name": "Latest Rejoined",
                    "event_type": "rejoined",
                    "detected_at": "2026-04-29T10:00:00Z",
                    "previous_status": "departed",
                    "current_status": "active",
                },
                {
                    "id": 23,
                    "scan_id": "scan-latest",
                    "character_name": "Latest Joined B",
                    "event_type": "joined",
                    "detected_at": "2026-04-29T10:00:00Z",
                    "previous_status": None,
                    "current_status": "active",
                },
            ],
            limit=10,
        )

        self.assertEqual(summary["scan_id"], "scan-latest")
        self.assertEqual(summary["joined"], 2)
        self.assertEqual(summary["departed"], 1)
        self.assertEqual(summary["rejoined"], 1)
        self.assertEqual(summary["total"], 4)
        self.assertEqual(summary["recent_joined"], 2)
        self.assertEqual(summary["recent_departed"], 2)
        self.assertEqual(summary["recent_rejoined"], 1)
        self.assertEqual(summary["recent_total"], 5)
        self.assertEqual(
            [event["character_name"] for event in summary["recent"]],
            ["Latest Joined B", "Latest Rejoined", "Latest Departed", "Latest Joined", "Old Departed"],
        )

    def test_summarize_membership_events_does_not_treat_small_all_joined_scan_as_bootstrap(self):
        summary = summarize_membership_events(
            [
                {
                    "id": 647,
                    "scan_id": "2026-05-08T00:00:53.016089Z",
                    "character_name": "Syeara",
                    "event_type": "joined",
                    "detected_at": "2026-05-08T00:00:53.016089Z",
                    "previous_status": None,
                    "current_status": "active",
                },
                {
                    "id": 646,
                    "scan_id": "2026-05-08T00:00:53.016089Z",
                    "character_name": "Sikahunt",
                    "event_type": "joined",
                    "detected_at": "2026-05-08T00:00:53.016089Z",
                    "previous_status": None,
                    "current_status": "active",
                },
                {
                    "id": 645,
                    "scan_id": "2026-05-07T23:58:12.000000Z",
                    "character_name": "Shelidoni",
                    "event_type": "departed",
                    "detected_at": "2026-05-07T23:58:12.000000Z",
                    "previous_status": "active",
                    "current_status": "departed",
                },
            ],
            limit=5,
        )

        self.assertFalse(summary["bootstrap"])
        self.assertEqual(summary["scan_id"], "2026-05-08T00:00:53.016089Z")
        self.assertEqual(summary["joined"], 2)
        self.assertEqual(summary["departed"], 0)
        self.assertEqual(summary["rejoined"], 0)
        self.assertEqual(summary["total"], 2)
        self.assertEqual(summary["recent_joined"], 2)
        self.assertEqual(summary["recent_departed"], 1)
        self.assertEqual(summary["recent_rejoined"], 0)
        self.assertEqual(summary["recent_total"], 3)
        self.assertEqual(
            [event["character_name"] for event in summary["recent"][:2]],
            ["Syeara", "Sikahunt"],
        )

    def test_summarize_membership_events_still_suppresses_large_initial_seed_scan(self):
        summary = summarize_membership_events(
            [
                {
                    "id": index,
                    "scan_id": "scan-seed",
                    "character_name": f"Seed {index:03d}",
                    "event_type": "joined",
                    "detected_at": "2026-04-01T10:00:00Z",
                    "previous_status": None,
                    "current_status": "active",
                }
                for index in range(1, 31)
            ],
            limit=5,
        )

        self.assertTrue(summary["bootstrap"])
        self.assertEqual(summary["joined"], 30)
        self.assertEqual(summary["departed"], 0)
        self.assertEqual(summary["rejoined"], 0)
        self.assertEqual(summary["total"], 30)
        self.assertEqual(summary["scan_id"], "scan-seed")
        self.assertEqual(summary["recent_joined"], 30)
        self.assertEqual(summary["recent_departed"], 0)
        self.assertEqual(summary["recent_rejoined"], 0)
        self.assertEqual(summary["recent_total"], 30)
        self.assertEqual(len(summary["recent"]), 5)

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
