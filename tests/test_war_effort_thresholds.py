import unittest
from pathlib import Path

from wow.war_effort import HK_THRESHOLD, LOOT_THRESHOLD, XP_THRESHOLD, ZENITH_THRESHOLD


class WarEffortThresholdTests(unittest.TestCase):
    def test_python_threshold_constants_match_requested_values(self):
        self.assertEqual(XP_THRESHOLD, 500)
        self.assertEqual(HK_THRESHOLD, 1000)
        self.assertEqual(LOOT_THRESHOLD, 40)
        self.assertEqual(ZENITH_THRESHOLD, 5)

    def test_source_templates_and_shells_reflect_updated_thresholds(self):
        template_text = Path("render/dashboard_template.html").read_text(encoding="utf-8")
        shell_text = Path("render/src/js/features/war_effort/war_effort_shell.js").read_text(encoding="utf-8")
        script_text = Path("render/script.js").read_text(encoding="utf-8")
        backend_text = Path("wow/war_effort.py").read_text(encoding="utf-8")

        self.assertIn("0 / 500 Levels Gained", template_text)
        self.assertIn("0 / 1000 HKs Gained", template_text)
        self.assertIn("0 / 40 Epics Looted", template_text)
        self.assertIn("0 / 5 New Level 70s", template_text)

        self.assertIn("window.WAR_EFFORT_THRESHOLDS = window.WAR_EFFORT_THRESHOLDS || Object.freeze({", shell_text)
        self.assertIn("window.WAR_EFFORT_THRESHOLDS.xp", shell_text)
        self.assertIn("window.WAR_EFFORT_THRESHOLDS.hk", shell_text)
        self.assertIn("window.WAR_EFFORT_THRESHOLDS.loot", shell_text)
        self.assertIn("window.WAR_EFFORT_THRESHOLDS.zenith", shell_text)

        self.assertIn(
            "renderBar('guild-xp-fill', 'guild-xp-text', totalLevels, window.WAR_EFFORT_THRESHOLDS.xp, 'XP');",
            script_text,
        )
        self.assertIn(
            "renderBar('guild-hk-fill', 'guild-hk-text', totalHks, window.WAR_EFFORT_THRESHOLDS.hk, 'HK');",
            script_text,
        )
        self.assertIn(
            "renderBar('guild-loot-fill', 'guild-loot-text', totalLoot, window.WAR_EFFORT_THRESHOLDS.loot, 'LOOT');",
            script_text,
        )
        self.assertIn(
            "renderBar('guild-zenith-fill', 'guild-zenith-text', totalZenith, window.WAR_EFFORT_THRESHOLDS.zenith, 'ZENITH');",
            script_text,
        )

        self.assertIn("XP_THRESHOLD = 500", backend_text)
        self.assertIn("HK_THRESHOLD = 1000", backend_text)
        self.assertIn("LOOT_THRESHOLD = 40", backend_text)
        self.assertIn("ZENITH_THRESHOLD = 5", backend_text)
        self.assertNotIn("const WAR_EFFORT_THRESHOLDS", shell_text)
        self.assertNotIn("const WAR_EFFORT_THRESHOLDS", script_text)


if __name__ == "__main__":
    unittest.main()
