import os
import tempfile
import unittest
from pathlib import Path

from render.html_dashboard import generate_html_dashboard


class LocalSmokeTests(unittest.TestCase):
    def test_generate_html_dashboard_creates_expected_outputs(self):
        original_cwd = os.getcwd()
        temp_dir = tempfile.TemporaryDirectory()

        try:
            os.chdir(temp_dir.name)

            roster_data = [
                {
                    "profile": {
                        "name": "SmokeTest",
                        "level": 70,
                        "equipped_item_level": 123,
                        "last_login_timestamp": 0,
                        "guild_rank": "Member",
                    }
                }
            ]
            realm_data = {"global_metrics": {}, "global_trends": {}}
            raw_guild_roster = [
                {
                    "name": "SmokeTest",
                    "level": 70,
                    "class": "Warrior",
                    "race": "Human",
                    "rank": "Member",
                }
            ]

            generate_html_dashboard(
                roster_data=roster_data,
                realm_data=realm_data,
                timeline_data=[],
                raw_guild_roster=raw_guild_roster,
                roster_history={},
                prev_mvps={},
                campaign_archive={},
            )

            index_html = Path("index.html")
            roster_json = Path("asset/roster.json")
            raw_roster_json = Path("asset/raw_roster.json")

            self.assertTrue(index_html.exists())
            self.assertTrue(roster_json.exists())
            self.assertTrue(raw_roster_json.exists())

            index_html_text = index_html.read_text(encoding="utf-8")
            self.assertIn("asset/roster.json", index_html_text)
            self.assertNotIn("assets/roster.json", index_html_text)
        finally:
            os.chdir(original_cwd)
            temp_dir.cleanup()


if __name__ == "__main__":
    unittest.main()
