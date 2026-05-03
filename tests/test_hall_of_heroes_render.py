import unittest
from pathlib import Path


class HallOfHeroesRenderTests(unittest.TestCase):
    def test_hall_of_heroes_frontend_recognizes_readiness(self):
        hall_text = Path("render/src/js/features/command_hall/hall_renderers.js").read_text(encoding="utf-8")
        data_text = Path("render/src/js/core/data.js").read_text(encoding="utf-8")

        self.assertIn("const readinessCount = weeklyBadgeTypes.filter(type => type === 'readiness').length;", hall_text)
        self.assertIn("if (readinessCount > 0) awards.push('readiness');", hall_text)
        self.assertIn("hasReadiness: readinessCount > 0", hall_text)
        self.assertIn('value: "Warden\'s Standard"', hall_text)
        self.assertIn("filterValue: 'readiness'", hall_text)
        self.assertIn("heroes maintained deployable readiness this cycle.", hall_text)
        self.assertIn("readiness: '\\u{1F3F0}'", Path("render/script.js").read_text(encoding="utf-8"))
        self.assertIn("if (cleanType === 'readiness') return 'readiness';", data_text)
        self.assertIn("if (cleanType === 'hk') return 'hks';", data_text)
        self.assertIn("Hero's Journey", hall_text)
        self.assertIn("Blood of the Enemy", hall_text)
        self.assertIn("Dragon's Hoard", hall_text)
        self.assertIn("The Zenith Cohort", hall_text)
        self.assertNotIn("WS", hall_text)
        self.assertNotIn("READY", hall_text)
        self.assertNotIn("WARDEN", hall_text)
        self.assertNotIn("DH", hall_text)
        self.assertNotIn("PVE", hall_text)
        self.assertNotIn("BOE", hall_text)
        self.assertNotIn("ZN", hall_text)
        self.assertNotIn("__amwReadinessPatched", hall_text)
        self.assertNotIn("patchedGetHallOfHeroes", hall_text)
        self.assertNotIn("badge.removeAttribute('title');", hall_text)
        self.assertNotIn("badge.style.pointerEvents = 'none';", hall_text)


if __name__ == "__main__":
    unittest.main()
