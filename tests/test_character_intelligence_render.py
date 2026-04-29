import unittest
from pathlib import Path


class CharacterIntelligenceRenderTests(unittest.TestCase):
    def test_dossier_template_includes_character_intelligence_hook(self):
        template_text = Path("render/dashboard_template.html").read_text(encoding="utf-8")

        self.assertIn('class="info-box char-card-intelligence-shell"', template_text)
        self.assertIn('class="char-card-intelligence-profile"', template_text)

    def test_dossier_js_includes_character_intelligence_builder_and_labels(self):
        js_text = Path("render/src/js/features/character_dossier/dossier_view.js").read_text(encoding="utf-8")
        runtime_text = Path("render/script.js").read_text(encoding="utf-8")

        self.assertIn("function buildDossierIntelligencePanel", js_text)
        self.assertIn("Character Intelligence", js_text)
        self.assertIn("Recent Field Signals", js_text)
        self.assertIn("Recent Changes", js_text)
        self.assertIn("Recognition", js_text)
        self.assertIn("Recently active", js_text)
        self.assertIn("Quiet lately", js_text)
        self.assertIn("Inactive lately", js_text)
        self.assertIn("Raid ready", js_text)
        self.assertIn("Staging for raid", js_text)
        self.assertIn("Needs gear", js_text)
        self.assertIn("Still advancing", js_text)
        self.assertIn("No extra intelligence is recorded for this hero yet.", js_text)
        self.assertIn("buildDossierIntelligencePanel({", runtime_text)
        self.assertIn("timelineEvents: typeof timelineData !== 'undefined' ? timelineData : []", runtime_text)


if __name__ == "__main__":
    unittest.main()
