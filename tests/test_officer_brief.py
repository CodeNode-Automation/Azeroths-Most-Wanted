import unittest

from wow.officer_brief import build_officer_brief


class OfficerBriefTests(unittest.TestCase):
    def test_empty_inputs_return_calm_empty_state(self):
        summary = build_officer_brief()

        self.assertEqual(summary["title"], "Officer Brief")
        self.assertEqual(summary["status"], "Unknown")
        self.assertEqual(summary["tone"], "neutral")
        self.assertTrue(summary["empty"])
        self.assertEqual(summary["items"], [])
        self.assertEqual(summary["summary"], "No roster health signals are available yet.")

    def test_stable_snapshot_uses_snapshot_counts_and_latest_changes(self):
        summary = build_officer_brief(
            roster_summary={
                "total_members": 657,
                "active_14_days": 256,
                "raid_ready_count": 21,
                "avg_ilvl_70": 107,
            },
            latest_changes={
                "title": "Latest Changes",
                "items": [
                    {"type": "item", "label": "1 gear upgrade recorded", "tone": "positive"},
                    {"type": "badge", "label": "1 award recorded", "tone": "neutral"},
                ],
                "empty": False,
            },
            limit=5,
        )

        self.assertFalse(summary["empty"])
        self.assertEqual(summary["status"], "Stable")
        self.assertEqual(summary["tone"], "positive")
        self.assertEqual(
            [item["type"] for item in summary["items"]],
            ["activity", "readiness", "changes"],
        )
        self.assertEqual(
            summary["items"][0]["label"],
            "Activity looks steady across the latest snapshot",
        )
        self.assertEqual(summary["items"][1]["label"], "Raid readiness is building")
        self.assertEqual(
            summary["items"][2]["label"],
            "Recent changes are being tracked: 1 gear upgrade recorded and 1 award recorded",
        )

    def test_departures_trigger_watch_language_without_alarm(self):
        summary = build_officer_brief(
            roster_summary={
                "total_members": 18,
                "active_14_days": 5,
                "raid_ready_count": 1,
                "avg_ilvl_70": 98,
            },
            membership_movement={
                "joined": 1,
                "departed": 2,
                "rejoined": 1,
                "total": 4,
                "bootstrap": False,
            },
            trend_data={
                "global_trends": {
                    "trend_active_mains": -1,
                    "trend_ready_mains": -2,
                }
            },
        )

        self.assertEqual(summary["status"], "Watch")
        self.assertEqual(summary["tone"], "watch")
        self.assertEqual(summary["items"][0]["type"], "movement")
        self.assertEqual(
            summary["items"][0]["label"],
            "Latest movement scan recorded 1 joined, 2 departed, 1 rejoined",
        )
        self.assertIn("watch", summary["summary"].lower())

    def test_bootstrap_movement_stays_neutral(self):
        summary = build_officer_brief(
            roster_summary={
                "total_members": 200,
                "active_14_days": 138,
                "raid_ready_count": 12,
                "avg_ilvl_70": 103,
            },
            membership_movement={
                "joined": 200,
                "departed": 0,
                "rejoined": 0,
                "total": 200,
                "bootstrap": True,
            },
        )

        self.assertEqual(summary["status"], "Building")
        self.assertEqual(summary["tone"], "neutral")
        self.assertEqual(summary["items"][0]["type"], "movement")
        self.assertEqual(
            summary["items"][0]["label"],
            "Roster baseline captured from 200 members",
        )
        self.assertIn("baseline", summary["summary"].lower())
        self.assertNotIn("churn", summary["summary"].lower())

    def test_trend_signals_remain_conservative_and_deterministic(self):
        summary_a = build_officer_brief(
            roster_summary={
                "total_members": 120,
                "active_14_days": 54,
                "raid_ready_count": 9,
                "avg_ilvl_70": 106,
            },
            membership_movement={
                "joined": 2,
                "departed": 0,
                "rejoined": 1,
                "total": 3,
                "bootstrap": False,
            },
            trend_data={
                "global_trends": {
                    "trend_ready_mains": -1,
                    "trend_active_mains": 2,
                    "trend_total_mains": 0,
                }
            },
            limit=4,
        )

        summary_b = build_officer_brief(
            roster_summary={
                "avg_ilvl_70": 106,
                "raid_ready_count": 9,
                "active_14_days": 54,
                "total_members": 120,
            },
            membership_movement={
                "bootstrap": False,
                "rejoined": 1,
                "departed": 0,
                "joined": 2,
                "total": 3,
            },
            trend_data={
                "global_trends": {
                    "trend_total_mains": 0,
                    "trend_active_mains": 2,
                    "trend_ready_mains": -1,
                }
            },
            limit=4,
        )

        self.assertEqual(len(summary_a["items"]), 4)
        self.assertEqual(
            [item["type"] for item in summary_a["items"]],
            ["movement", "activity", "readiness", "trend"],
        )
        self.assertEqual(
            [item["type"] for item in summary_a["items"]],
            [item["type"] for item in summary_b["items"]],
        )
        self.assertEqual(
            [item["label"] for item in summary_a["items"]],
            [item["label"] for item in summary_b["items"]],
        )
        self.assertEqual(summary_a["items"][-1]["label"], "Recent trend is mixed but still manageable")


if __name__ == "__main__":
    unittest.main()
