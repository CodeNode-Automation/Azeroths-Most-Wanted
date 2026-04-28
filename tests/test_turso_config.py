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


if __name__ == "__main__":
    unittest.main()
