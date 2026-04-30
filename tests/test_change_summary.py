import unittest

from wow.change_summary import build_change_summary


class ChangeSummaryTests(unittest.TestCase):
    def test_empty_summary_returns_calm_empty_state(self):
        self.assertEqual(
            build_change_summary(),
            {
                "title": "Latest Changes",
                "items": [],
                "empty": True,
                "empty_text": "No notable changes recorded yet.",
            },
        )

    def test_bootstrap_membership_movement_is_suppressed_from_latest_changes(self):
        summary = build_change_summary(
            membership_movement={
                "joined": 625,
                "departed": 0,
                "rejoined": 0,
                "total": 625,
                "bootstrap": True,
            },
            timeline_events=[],
            trend_data={},
        )

        self.assertTrue(summary["empty"])
        self.assertEqual(summary["items"], [])
        self.assertEqual(
            summary["empty_text"],
            "Activity and trend changes will appear after comparison scans detect movement beyond the baseline.",
        )

    def test_bootstrap_membership_movement_can_still_surface_other_change_items(self):
        summary = build_change_summary(
            membership_movement={
                "joined": 625,
                "departed": 0,
                "rejoined": 0,
                "total": 625,
                "bootstrap": True,
            },
            timeline_events=[
                {"type": "level_up"},
                {"type": "item"},
            ],
            trend_data={},
        )

        self.assertEqual([item["type"] for item in summary["items"]], ["level_up", "item"])
        self.assertNotIn("movement", [item["type"] for item in summary["items"]])

    def test_raw_roster_delta_is_summarized_when_no_named_movement_exists(self):
        summary = build_change_summary(
            membership_movement={},
            timeline_events=[],
            trend_data={
                "global_metrics": {
                    "total_members": 657,
                },
                "global_trends": {
                    "trend_total": -1,
                },
            },
        )

        self.assertEqual(len(summary["items"]), 1)
        self.assertEqual(summary["items"][0]["type"], "movement")
        self.assertEqual(
            summary["items"][0]["label"],
            "Guild roster decreased by 1 since the previous scan.",
        )
        self.assertEqual(summary["items"][0]["tone"], "neutral")

    def test_normal_membership_movement_counts_are_summarized_in_order(self):
        summary = build_change_summary(
            membership_movement={
                "joined": 3,
                "departed": 1,
                "rejoined": 2,
                "total": 6,
                "bootstrap": False,
            },
            timeline_events=[],
            trend_data={},
        )

        self.assertEqual(len(summary["items"]), 1)
        self.assertEqual(summary["items"][0]["label"], "3 joined, 1 departed, 2 rejoined")

    def test_timeline_events_are_grouped_by_type(self):
        summary = build_change_summary(
            membership_movement={},
            timeline_events=[
                {"type": "badge"},
                {"type": "item"},
                {"type": "level_up"},
                {"type": "item"},
                {"type": "badge"},
            ],
            trend_data={},
            limit=5,
        )

        self.assertEqual(
            [item["label"] for item in summary["items"]],
            [
                "1 level-up recorded",
                "2 gear upgrades recorded",
                "2 awards recorded",
            ],
        )
        self.assertEqual(
            [item["type"] for item in summary["items"]],
            ["level_up", "item", "badge"],
        )

    def test_trend_data_is_labeled_as_daily_snapshot_delta(self):
        summary = build_change_summary(
            membership_movement={},
            timeline_events=[],
            trend_data={
                "global_trends": {
                    "trend_total_mains": 0,
                    "trend_active_mains": 2,
                    "trend_ready_mains": -1,
                    "trend_total": 0,
                    "trend_active": 0,
                    "trend_ready": 0,
                }
            },
            limit=5,
        )

        self.assertEqual(len(summary["items"]), 1)
        self.assertEqual(summary["items"][0]["type"], "trend")
        self.assertEqual(
            summary["items"][0]["label"],
            "Daily trend vs previous snapshot: +2 active mains, -1 raid-ready mains",
        )

    def test_item_limit_is_respected_and_order_is_deterministic(self):
        summary_a = build_change_summary(
            membership_movement={
                "joined": 1,
                "departed": 1,
                "rejoined": 0,
                "total": 2,
                "bootstrap": False,
            },
            timeline_events=[
                {"type": "badge"},
                {"type": "item"},
                {"type": "level_up"},
            ],
            trend_data={
                "global_trends": {
                    "trend_active_mains": 1,
                }
            },
            limit=3,
        )

        summary_b = build_change_summary(
            membership_movement={
                "departed": 1,
                "rejoined": 0,
                "joined": 1,
                "total": 2,
                "bootstrap": False,
            },
            timeline_events=[
                {"type": "level_up"},
                {"type": "item"},
                {"type": "badge"},
            ],
            trend_data={
                "global_trends": {
                    "trend_active_mains": 1,
                }
            },
            limit=3,
        )

        self.assertEqual(len(summary_a["items"]), 3)
        self.assertEqual(
            [item["type"] for item in summary_a["items"]],
            ["movement", "level_up", "item"],
        )
        self.assertEqual(
            [item["label"] for item in summary_a["items"]],
            [item["label"] for item in summary_b["items"]],
        )


if __name__ == "__main__":
    unittest.main()
