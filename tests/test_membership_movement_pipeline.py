import pathlib
import unittest
from unittest import mock

from wow.membership_movement import build_latest_membership_status_query
from wow.membership_movement import persist_membership_movement


class MembershipMovementPipelineTests(unittest.IsolatedAsyncioTestCase):
    async def test_persist_membership_movement_fetches_latest_statuses_and_pushes_events(self):
        fetch_fn = mock.AsyncMock(return_value=[
            {"character_name": "Alpha", "current_status": "active"},
        ])
        push_fn = mock.AsyncMock()

        events = await persist_membership_movement(
            mock.MagicMock(),
            ["Alpha", "Bravo"],
            scan_id="scan-7",
            detected_at="2026-04-29T10:30:00Z",
            fetch_fn=fetch_fn,
            push_fn=push_fn,
        )

        self.assertEqual(len(events), 1)
        self.assertEqual(events[0]["character_name"], "Bravo")
        self.assertEqual(events[0]["event_type"], "joined")
        fetch_fn.assert_awaited_once()
        fetch_args = fetch_fn.await_args.args
        self.assertEqual(fetch_args[1], build_latest_membership_status_query())
        push_fn.assert_awaited_once()
        push_args = push_fn.await_args.args
        self.assertEqual(push_args[1][0]["params"][0], "scan-7")
        self.assertEqual(push_args[1][0]["params"][1], "Bravo")

    async def test_persist_membership_movement_skips_push_when_no_events(self):
        fetch_fn = mock.AsyncMock(return_value=[
            {"character_name": "Alpha", "current_status": "active"},
        ])
        push_fn = mock.AsyncMock()

        events = await persist_membership_movement(
            mock.MagicMock(),
            ["Alpha"],
            scan_id="scan-8",
            detected_at="2026-04-29T10:35:00Z",
            fetch_fn=fetch_fn,
            push_fn=push_fn,
        )

        self.assertEqual(events, [])
        fetch_fn.assert_awaited_once()
        push_fn.assert_not_awaited()

    def test_main_calls_membership_persistence_before_departed_purge(self):
        main_text = pathlib.Path("main.py").read_text(encoding="utf-8")
        call_index = main_text.index("persist_membership_movement(")
        purge_index = main_text.index("# Drop departed guild members from the live Turso tables.")

        self.assertLess(call_index, purge_index)

    def test_main_uses_compact_gear_cache_and_recent_timeline_window(self):
        main_text = pathlib.Path("main.py").read_text(encoding="utf-8")

        self.assertIn("ensure_current_gear_cache(session)", main_text)
        self.assertIn(
            "SELECT character_name, slot, item_id, name, quality, icon_data, tooltip_params FROM gear_current",
            main_text,
        )
        self.assertIn(
            "SELECT * FROM timeline WHERE timestamp >= datetime('now', '-7 days') ORDER BY timestamp DESC LIMIT 15000",
            main_text,
        )
        self.assertIn("INSERT OR REPLACE INTO gear_current", main_text)
        self.assertIn("DELETE FROM gear_current WHERE lower(character_name) IN", main_text)


if __name__ == "__main__":
    unittest.main()
