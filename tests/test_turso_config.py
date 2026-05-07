import os
import unittest
from unittest import mock

from wow.turso import fetch_turso
from wow.turso import push_turso_batch
from wow.turso import setup_database


class TursoConfigTests(unittest.IsolatedAsyncioTestCase):
    @mock.patch.dict(os.environ, {}, clear=True)
    async def test_fetch_turso_raises_when_database_url_is_missing(self):
        session = mock.MagicMock()

        with self.assertRaisesRegex(RuntimeError, "TURSO_DATABASE_URL"):
            await fetch_turso(session, "SELECT 1")

        session.post.assert_not_called()

    @mock.patch.dict(
        os.environ,
        {
            "TURSO_DATABASE_URL": "https://example.turso.io",
        },
        clear=True,
    )
    async def test_fetch_turso_raises_when_auth_token_is_missing(self):
        session = mock.MagicMock()

        with self.assertRaisesRegex(RuntimeError, "TURSO_AUTH_TOKEN"):
            await fetch_turso(session, "SELECT 1")

        session.post.assert_not_called()

    @mock.patch.dict(
        os.environ,
        {
            "TURSO_DATABASE_URL": "https://example.turso.io",
            "TURSO_AUTH_TOKEN": "secret-token",
        },
        clear=True,
    )
    async def test_fetch_turso_rejects_unsupported_url_schemes(self):
        session = mock.MagicMock()

        for invalid_url in ("ftp://example.com", "example.com"):
            with self.subTest(invalid_url=invalid_url):
                with mock.patch.dict(
                    os.environ,
                    {
                        "TURSO_DATABASE_URL": invalid_url,
                        "TURSO_AUTH_TOKEN": "secret-token",
                    },
                    clear=True,
                ):
                    with self.assertRaisesRegex(RuntimeError, "Turso database URL"):
                        await fetch_turso(session, "SELECT 1")

        session.post.assert_not_called()

    @mock.patch.dict(os.environ, {}, clear=True)
    async def test_push_turso_batch_raises_when_config_is_missing(self):
        session = mock.MagicMock()

        with self.assertRaisesRegex(RuntimeError, "TURSO_DATABASE_URL"):
            await push_turso_batch(session, [{"q": "SELECT 1"}])

        session.post.assert_not_called()

    @mock.patch.dict(os.environ, {}, clear=True)
    async def test_setup_database_raises_when_config_is_missing(self):
        session = mock.MagicMock()

        with self.assertRaisesRegex(RuntimeError, "TURSO_DATABASE_URL"):
            await setup_database(session)

        session.post.assert_not_called()

    @mock.patch.dict(
        os.environ,
        {
            "TURSO_DATABASE_URL": "ftp://example.com",
            "TURSO_AUTH_TOKEN": "secret-token",
        },
        clear=True,
    )
    async def test_push_turso_batch_rejects_unsupported_url_schemes(self):
        session = mock.MagicMock()

        with self.assertRaisesRegex(RuntimeError, "Turso database URL"):
            await push_turso_batch(session, [{"q": "SELECT 1"}])

        session.post.assert_not_called()

    @mock.patch.dict(
        os.environ,
        {
            "TURSO_DATABASE_URL": "libsql://example.turso.io",
            "TURSO_AUTH_TOKEN": "secret-token",
        },
        clear=True,
    )
    async def test_fetch_turso_normalizes_libsql_url_and_posts_query(self):
        response = mock.AsyncMock()
        response.json.return_value = [
            {
                "results": {
                    "columns": ["name"],
                    "rows": [["Alpha"]],
                }
            }
        ]

        post_context = mock.AsyncMock()
        post_context.__aenter__.return_value = response
        post_context.__aexit__.return_value = False

        session = mock.MagicMock()
        session.post.return_value = post_context

        result = await fetch_turso(session, "SELECT name FROM characters")

        self.assertEqual(result, [{"name": "Alpha"}])
        session.post.assert_called_once()
        called_url = session.post.call_args.args[0]
        called_payload = session.post.call_args.kwargs["json"]
        called_headers = session.post.call_args.kwargs["headers"]

        self.assertEqual(called_url, "https://example.turso.io")
        self.assertEqual(called_payload, {"statements": ["SELECT name FROM characters"]})
        self.assertEqual(called_headers["Authorization"], "Bearer secret-token")
        self.assertEqual(called_headers["Content-Type"], "application/json")

    @mock.patch.dict(
        os.environ,
        {
            "TURSO_DATABASE_URL": "libsql://example.turso.io",
            "TURSO_AUTH_TOKEN": "secret-token",
            "AMW_TURSO_QUERY_AUDIT": "1",
        },
        clear=True,
    )
    async def test_fetch_turso_audit_mode_logs_compact_query_shape(self):
        response = mock.AsyncMock()
        response.json.return_value = [
            {
                "results": {
                    "columns": ["name", "level"],
                    "rows": [["Alpha", 70]],
                }
            }
        ]

        post_context = mock.AsyncMock()
        post_context.__aenter__.return_value = response
        post_context.__aexit__.return_value = False

        session = mock.MagicMock()
        session.post.return_value = post_context

        with mock.patch("builtins.print") as mock_print:
            result = await fetch_turso(session, "SELECT name, level FROM characters WHERE level = 70")

        self.assertEqual(result, [{"name": "Alpha", "level": 70}])
        self.assertTrue(any(
            call.args and call.args[0].startswith("[turso-audit] ")
            and "rows=1" in call.args[0]
            and "tables=characters" in call.args[0]
            and "SELECT name, level FROM characters WHERE level = 70" in call.args[0]
            for call in mock_print.call_args_list
        ))

    @mock.patch.dict(
        os.environ,
        {
            "TURSO_DATABASE_URL": "libsql://example.turso.io",
            "TURSO_AUTH_TOKEN": "secret-token",
        },
        clear=True,
    )
    async def test_push_turso_batch_normalizes_libsql_url_and_posts(self):
        response = mock.AsyncMock()
        response.status = 200

        post_context = mock.AsyncMock()
        post_context.__aenter__.return_value = response
        post_context.__aexit__.return_value = False

        session = mock.MagicMock()
        session.post.return_value = post_context

        await push_turso_batch(session, [{"q": "INSERT INTO test VALUES (1)"}])

        session.post.assert_called_once()
        called_url = session.post.call_args.args[0]
        called_payload = session.post.call_args.kwargs["json"]
        called_headers = session.post.call_args.kwargs["headers"]

        self.assertEqual(called_url, "https://example.turso.io")
        self.assertEqual(
            called_payload,
            {
                "statements": [
                    {"q": "BEGIN"},
                    {"q": "INSERT INTO test VALUES (1)"},
                    {"q": "COMMIT"},
                ]
            },
        )
        self.assertEqual(called_headers["Authorization"], "Bearer secret-token")
        self.assertEqual(called_headers["Content-Type"], "application/json")

    @mock.patch.dict(
        os.environ,
        {
            "TURSO_DATABASE_URL": "libsql://example.turso.io",
            "TURSO_AUTH_TOKEN": "secret-token",
        },
        clear=True,
    )
    async def test_setup_database_emits_history_and_membership_indexes(self):
        session = mock.MagicMock()
        schema_rows = [
            [{"name": "last_total_mains"}, {"name": "trend_total_mains"}, {"name": "last_active_mains"}, {"name": "trend_active_mains"}, {"name": "last_ready_mains"}, {"name": "trend_ready_mains"}],
            [{"name": "total_roster_mains"}, {"name": "active_roster_mains"}, {"name": "avg_ilvl_70_mains"}],
        ]

        with (
            mock.patch("wow.turso.fetch_turso", side_effect=schema_rows) as mock_fetch,
            mock.patch("wow.turso.push_turso_batch") as mock_push,
        ):
            await setup_database(session)

        self.assertEqual(mock_fetch.await_count, 2)
        schema_statements = mock_push.await_args_list[0].args[1]
        schema_sql = "\n".join(stmt["q"] for stmt in schema_statements)
        self.assertIn("idx_timeline_lower_character_name", schema_sql)
        self.assertIn("idx_guild_membership_events_scan_id_detected_at_id", schema_sql)
        self.assertIn("idx_guild_membership_events_detected_at_id", schema_sql)
        self.assertIn("idx_char_history_record_date_char_name", schema_sql)
        self.assertIn("idx_war_effort_history_week_category", schema_sql)
        self.assertIn("idx_ladder_history_week_category_rank", schema_sql)
        self.assertIn("idx_reigning_champs_history_week_category", schema_sql)


if __name__ == "__main__":
    unittest.main()
