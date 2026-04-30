import unittest
from pathlib import Path


class HomepageCleanupTests(unittest.TestCase):
    def test_hero_logo_markup_and_styles_are_still_present(self):
        template_text = Path("render/dashboard_template.html").read_text(encoding="utf-8")
        css_text = Path("render/style.css").read_text(encoding="utf-8")

        self.assertIn('class="hero-logo-col"', template_text)
        self.assertIn('src="asset/amw.webp"', template_text)
        self.assertIn('.hero-logo-col .main-logo', css_text)

    def test_homepage_campaign_chronicle_surface_was_removed(self):
        template_text = Path("render/dashboard_template.html").read_text(encoding="utf-8")
        script_text = Path("render/script.js").read_text(encoding="utf-8")
        cards_text = Path("render/src/js/features/home_analytics/analytics_cards.js").read_text(encoding="utf-8")
        css_text = Path("render/style.css").read_text(encoding="utf-8")
        html_dashboard_text = Path("render/html_dashboard.py").read_text(encoding="utf-8")

        self.assertIn('class="home-roster-intelligence-section"', template_text)
        self.assertIn('id="home-roster-intelligence-sync"', template_text)
        self.assertIn('Roster Intelligence', template_text)
        self.assertIn('How these numbers are counted', template_text)
        self.assertIn('Metric Scope', template_text)
        self.assertIn('Tracked Characters:</strong> all scanned guild characters, including mains and alts.', template_text)
        self.assertIn('Roster Movement:</strong> guild membership snapshots used to detect joins, departures, and rejoins, so its baseline can differ from tracked-character totals.', template_text)
        self.assertIn('Movement, recent changes, and officer health from the latest guild snapshot.', template_text)
        self.assertIn('class="home-insights-row"', template_text)
        self.assertIn('id="home-latest-changes-card"', template_text)
        self.assertIn('id="home-officer-brief-card"', template_text)
        self.assertIn('class="dashboard-footer"', template_text)
        self.assertIn('Database Last Synced', template_text)
        self.assertIn('Contact: <a href="mailto:nullbit5@protonmail.com">nullbit5@protonmail.com</a>', template_text)
        self.assertIn('id="backToTopBtn"', template_text)
        self.assertIn('last_updated_display=last_updated_display', html_dashboard_text)
        self.assertIn('.home-insights-row {', css_text)
        self.assertIn('.home-roster-intelligence-section {', css_text)
        self.assertIn('.home-roster-intelligence-sync {', css_text)
        self.assertIn('.home-metric-scope {', css_text)
        self.assertIn('.home-metric-scope-summary {', css_text)
        self.assertIn('.home-metric-scope-panel {', css_text)
        self.assertIn('.dashboard-footer {', css_text)
        self.assertIn('.footer-disclaimer {', css_text)
        self.assertNotIn('analytics-intel-section-chronicle', template_text)
        self.assertNotIn('Campaign Chronicle', template_text)
        self.assertNotIn('Recent Campaign Activity', template_text)
        self.assertNotIn('Campaign Chronicle', script_text)
        self.assertNotIn('Recent Campaign Activity', script_text)
        self.assertNotIn('applyChronicleCard', cards_text)

    def test_character_dossier_timeline_support_remains_intact(self):
        script_text = Path("render/script.js").read_text(encoding="utf-8")

        self.assertIn('timeline-character-dossier', script_text)
        self.assertIn("title: `📜 ${formattedName}'s Recent Activity`", script_text)
        self.assertIn("subtitle: 'Recent loot drops, level gains, and earned honors recorded for this hero.'", script_text)


if __name__ == "__main__":
    unittest.main()
