import os
import unittest
from unittest import mock

from wow.membership_movement import build_latest_membership_status_query
from wow.membership_movement import build_membership_event_insert_statements
from wow.turso import setup_database


class MembershipMovementPersistenceTests(unittest.IsolatedAsyncioTestCase):
    def test_build_membership_event_insert_statements_returns_empty_for_no_events(self):
        self.assertEqual(build_membership_event_insert_statements([]), [])

    def test_build_membership_event_insert_statements_builds_parameterized_statements(self):
        events = [
            {
                "scan_id": "scan-1",
                "character_name": "Charlie",
                "event_type": "joined",
                "detected_at": "2026-04-29T10:00:00Z",
                "previous_status": None,
                "current_status": "active",
            },
            {
                "scan_id": "scan-1",
                "character_name": "Alpha",
                "event_type": "departed",
                "detected_at": "2026-04-29T10:00:00Z",
                "previous_status": "active",
                "current_status": "departed",
            },
            {
                "scan_id": "scan-1",
                "character_name": "Bravo",
                "event_type": "rejoined",
                "detected_at": "2026-04-29T10:00:00Z",
                "previous_status": "departed",
                "current_status": "active",
            },
        ]

        statements = build_membership_event_insert_statements(events)

        self.assertEqual(len(statements), 3)
        self.assertTrue(all("guild_membership_events" in stmt["q"] for stmt in statements))
        self.assertEqual(
            [stmt["params"][1] for stmt in statements],
            ["Charlie", "Bravo", "Alpha"],
        )
        self.assertEqual(
            [stmt["params"][2] for stmt in statements],
            ["joined", "rejoined", "departed"],
        )
        self.assertEqual(statements[0]["params"][0], "scan-1")
        self.assertEqual(statements[0]["params"][3], "2026-04-29T10:00:00Z")
        self.assertIsNone(statements[0]["params"][4])
        self.assertEqual(statements[0]["params"][5], "active")

    def test_build_latest_membership_status_query_targets_membership_events_table(self):
        query = build_latest_membership_status_query()

        self.assertIn("guild_membership_events", query)
        self.assertIn("ROW_NUMBER() OVER", query)
        self.assertIn("PARTITION BY lower(character_name)", query)
        self.assertIn("ORDER BY detected_at DESC, id DESC", query)

    @mock.patch.dict(
        os.environ,
        {
            "TURSO_DATABASE_URL": "https://example.turso.io",
            "TURSO_AUTH_TOKEN": "secret-token",
        },
        clear=True,
    )
    @mock.patch("wow.turso.fetch_turso")
    @mock.patch("wow.turso.push_turso_batch")
    async def test_setup_database_includes_membership_event_schema(self, mock_push, mock_fetch):
        async def fetch_side_effect(session, query):
            if query.startswith("PRAGMA table_info(global_trends)"):
                return [
                    {"name": "last_total_mains"},
                    {"name": "trend_total_mains"},
                    {"name": "last_active_mains"},
                    {"name": "trend_active_mains"},
                    {"name": "last_ready_mains"},
                    {"name": "trend_ready_mains"},
                ]
            if query.startswith("PRAGMA table_info(daily_roster_stats)"):
                return [
                    {"name": "total_roster_mains"},
                    {"name": "active_roster_mains"},
                    {"name": "avg_ilvl_70_mains"},
                ]
            return []

        mock_fetch.side_effect = fetch_side_effect

        await setup_database(mock.MagicMock())

        self.assertTrue(mock_push.await_count >= 1)
        schema_call = mock_push.await_args_list[0]
        schema_statements = schema_call.args[1]
        schema_sql = " ".join(stmt["q"] for stmt in schema_statements)

        self.assertIn("CREATE TABLE IF NOT EXISTS guild_membership_events", schema_sql)
        self.assertIn("idx_guild_membership_events_detected_at", schema_sql)
        self.assertIn("idx_guild_membership_events_character_name", schema_sql)
        self.assertIn("idx_guild_membership_events_event_type", schema_sql)
        mock_fetch.assert_any_await(mock.ANY, "PRAGMA table_info(global_trends)")
        mock_fetch.assert_any_await(mock.ANY, "PRAGMA table_info(daily_roster_stats)")


if __name__ == "__main__":
    unittest.main()
