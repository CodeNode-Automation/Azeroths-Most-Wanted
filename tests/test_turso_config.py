import os
import unittest
from unittest import mock

from wow.turso import fetch_turso


class TursoConfigTests(unittest.IsolatedAsyncioTestCase):
    @mock.patch.dict(os.environ, {}, clear=True)
    async def test_fetch_turso_returns_empty_list_without_required_env(self):
        session = mock.MagicMock()

        result = await fetch_turso(session, "SELECT 1")

        self.assertEqual(result, [])
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


if __name__ == "__main__":
    unittest.main()
