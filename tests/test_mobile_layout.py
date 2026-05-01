import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


class MobileLayoutTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.template = (ROOT / "render/dashboard_template.html").read_text(encoding="utf-8")
        cls.style = (ROOT / "render/style.css").read_text(encoding="utf-8")
        cls.mobile_css = (ROOT / "render/src/css/features/mobile/mobile.css").read_text(encoding="utf-8")
        cls.analytics_css = (ROOT / "render/src/css/features/analytics/analytics.css").read_text(encoding="utf-8")
        cls.pipelines_css = (ROOT / "render/src/css/features/architecture/pipelines.css").read_text(encoding="utf-8")
        cls.archive_css = (ROOT / "render/src/css/features/campaign/archive.css").read_text(encoding="utf-8")
        cls.dossier_css = (ROOT / "render/src/css/features/character/dossier.css").read_text(encoding="utf-8")
        cls.search_css = (ROOT / "render/src/css/features/search/autocomplete.css").read_text(encoding="utf-8")
        cls.timeline_css = (ROOT / "render/src/css/features/timeline/activity.css").read_text(encoding="utf-8")
        cls.war_effort_css = (ROOT / "render/src/css/features/war_effort/war_effort.css").read_text(encoding="utf-8")
        cls.html_dashboard = (ROOT / "render/html_dashboard.py").read_text(encoding="utf-8")
        cls.script = (ROOT / "render/script.js").read_text(encoding="utf-8")

    def test_mobile_stylesheet_is_loaded_after_base_and_feature_css(self):
        html_dashboard = self.html_dashboard
        self.assertIn('"features", "mobile", "mobile.css"', html_dashboard)

        foundation_index = html_dashboard.index('os.path.join(base_dir, "src", "css", "base", "foundation.css")')
        analytics_index = html_dashboard.index(
            'os.path.join(base_dir, "src", "css", "features", "analytics", "analytics.css")'
        )
        style_index = html_dashboard.index('os.path.join(base_dir, "style.css")')
        mobile_index = html_dashboard.index(
            'os.path.join(base_dir, "src", "css", "features", "mobile", "mobile.css")'
        )

        self.assertLess(foundation_index, analytics_index)
        self.assertLess(analytics_index, style_index)
        self.assertGreater(mobile_index, style_index)

    def test_mobile_css_has_clear_section_ownership(self):
        mobile_css = self.mobile_css
        for section in (
            "Touch/mobile tooltip behavior",
            "Global mobile shell, nav, drawer, selector, and search",
            "Phone layouts: home, roster cards, archive, analytics, dossier",
            "Compact phone stats and metric scopes",
            "Narrow-phone root alignment",
            "Very narrow phones and bottom-browser chrome",
        ):
            self.assertIn(section, mobile_css)

    def test_mobile_nav_search_and_safe_area_rules_live_in_mobile_css(self):
        self.assertIn("mobile-menu-toggle", self.template)
        self.assertIn("nav-links-container", self.template)
        self.assertIn("nav-mobile-groups", self.template)

        self.assertIn(".mobile-menu-toggle {\n    display: inline-flex;", self.mobile_css)
        self.assertIn(".nav-links-container {\n    position: fixed;", self.mobile_css)
        self.assertIn(".nav-links-container.open {\n    transform: translateX(0);", self.mobile_css)
        self.assertIn(".search-autocomplete {\n    width: 100%;", self.mobile_css)
        self.assertIn("env(safe-area-inset-bottom, 0px)", self.mobile_css)

    def test_mobile_root_width_alignment_is_width_safe(self):
        self.assertIn(
            ".dashboard-layout,\n  .dashboard-layout.dashboard-layout-home,\n  .dashboard-layout.dashboard-layout-solo {\n    flex-direction: column;\n    align-items: center;\n    width: 100%;\n    max-width: 100%;",
            self.mobile_css,
        )
        self.assertIn(
            ".main-content {\n    width: 100%;\n    max-width: 100%;\n    margin-left: auto;\n    margin-right: auto;",
            self.mobile_css,
        )
        self.assertIn(
            "@media (max-width: 390px) {\n  html,\n  body {\n    width: 100%;\n    max-width: 100%;",
            self.mobile_css,
        )
        self.assertNotIn("overflow-x: hidden", self.mobile_css)

    def test_narrow_phone_controls_row_is_balanced_around_center(self):
        self.assertIn(
            "@media (max-width: 430px) {\n  .controls-wrapper {\n    grid-template-columns: 44px minmax(0, 1fr) 44px;",
            self.mobile_css,
        )
        self.assertIn(
            ".controls-wrapper::after {\n    content: \"\";\n    display: block;\n    grid-column: 3 / 4;\n    grid-row: 1 / 2;\n    width: 44px;\n    height: 44px;",
            self.mobile_css,
        )
        self.assertIn(
            ".nav-utility-cluster {\n    grid-column: 2 / 3;\n    width: 100%;\n    max-width: 100%;",
            self.mobile_css,
        )
        self.assertNotIn(
            "@media (max-width: 390px) {\n  html,\n  body {\n    width: 100%;\n    max-width: 100%;\n  }\n\n  .navbar {\n    padding: 8px 10px;\n  }\n\n  .controls-wrapper {\n    grid-template-columns: 44px minmax(0, 1fr) 44px;",
            self.mobile_css,
        )

    def test_mobile_css_covers_key_dashboard_routes(self):
        mobile_css = self.mobile_css
        self.assertIn(".home-dashboard-grid", mobile_css)
        self.assertIn(".concise-char-bar", mobile_css)
        self.assertIn(".stat-box-container", mobile_css)
        self.assertIn(".hall-stage-spotlight", mobile_css)
        self.assertIn(".war-effort-home-card-footer", mobile_css)
        self.assertIn(".campaign-archive-grid,\n  .campaign-archive-grid-war-effort,\n  .campaign-archive-grid-dual", mobile_css)
        self.assertIn(".analytics-snapshot-grid", mobile_css)
        self.assertIn(".analytics-campaign-history-metrics", mobile_css)
        self.assertIn(".analytics-campaign-history-footer", mobile_css)
        self.assertIn(".analytics-readiness-funnel-stages", mobile_css)
        self.assertIn(".analytics-readiness-funnel-card", mobile_css)
        self.assertIn(".analytics-roster-composition-grid", mobile_css)
        self.assertIn(".analytics-roster-composition-card", mobile_css)
        self.assertIn(".analytics-roster-composition-panel", mobile_css)
        self.assertIn(".analytics-roster-composition-row-head", mobile_css)
        self.assertIn(".analytics-roster-composition-row-value", mobile_css)
        self.assertIn(".analytics-roster-composition-row-meta", mobile_css)
        self.assertIn(".analytics-roster-composition-footer-note", mobile_css)
        self.assertIn(".char-card-deployment-grid", mobile_css)
        self.assertIn(".timeline-container.timeline-home-board .monuments-grid", mobile_css)
        self.assertIn(".arch-pipeline", mobile_css)

    def test_mobile_breakpoints_cover_target_phone_widths(self):
        for breakpoint in (
            "1180px",
            "1120px",
            "1100px",
            "1080px",
            "1024px",
            "980px",
            "920px",
            "900px",
            "820px",
            "800px",
            "780px",
            "760px",
            "680px",
            "640px",
            "600px",
            "560px",
            "520px",
            "430px",
            "412px",
            "390px",
            "360px",
        ):
            self.assertIn(f"@media (max-width: {breakpoint})", self.mobile_css)

    def test_phone_tablet_max_width_rules_are_centralized(self):
        for css_text in (
            self.style,
            self.analytics_css,
            self.pipelines_css,
            self.archive_css,
            self.dossier_css,
            self.search_css,
            self.timeline_css,
            self.war_effort_css,
        ):
            self.assertNotIn("@media (max-width:", css_text)

    def test_runtime_safety_hotfixes_remain(self):
        script = self.script
        self.assertNotIn("display_total_members", script)
        self.assertIn("const analyticsGuildRosterTotal = getNumericConfigValue(", script)
        self.assertIn("guildRosterValue: analyticsGuildRosterTotal", script)
        self.assertIn("const cardEl = document.getElementById('home-movement-card');", Path(
            ROOT / "render/src/js/features/home_analytics/home_overview.js"
        ).read_text(encoding="utf-8"))

    def test_public_cleanup_and_removed_homepage_surfaces_remain_absent(self):
        self.assertNotIn("github.com", self.template)
        self.assertNotIn("Source: GitHub", self.template)
        self.assertNotIn("Recent Campaign Activity", self.template)
        self.assertNotIn("Campaign Chronicle", self.template)


if __name__ == "__main__":
    unittest.main()
