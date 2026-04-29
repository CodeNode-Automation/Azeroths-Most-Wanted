import unittest

from wow.membership_movement import build_recent_membership_movement_query
from wow.membership_movement import summarize_membership_events


class MembershipMovementSummaryTests(unittest.TestCase):
    def test_build_recent_membership_movement_query_targets_table_and_limit(self):
        query = build_recent_membership_movement_query(limit=7)

        self.assertIn("guild_membership_events", query)
        self.assertIn("ORDER BY detected_at DESC, id DESC", query)
        self.assertIn("LIMIT 7", query)

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


if __name__ == "__main__":
    unittest.main()
