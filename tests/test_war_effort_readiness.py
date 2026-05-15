import json
import unittest
from pathlib import Path

from tests.workspace_temp import workspace_temp_dir
from wow.badges import aggregate_war_effort_badges
from wow.war_effort import READINESS_COMBAT_SLOT_KEYS, build_readiness_week_state, load_war_effort_lock_data
from wow.war_effort import prepare_war_effort_history_purge


NOW_MS = 1_725_000_000_000
DAY_MS = 24 * 60 * 60 * 1000
RESET_ANCHOR_MS = NOW_MS - (3 * DAY_MS)


def make_equipped(
    slot_keys=None,
    include_shirt=True,
    include_tabard=True,
    extra_metadata=None,
    slot_key_transform=None,
):
    equipped = {}
    slot_keys = slot_keys or READINESS_COMBAT_SLOT_KEYS
    for index, slot_key in enumerate(slot_keys):
        key = slot_key_transform(slot_key) if slot_key_transform else slot_key
        equipped[key] = {"item_id": 10_000 + index}

    if include_shirt:
        equipped["shirt"] = {"item_id": 20_000}
    if include_tabard:
        equipped["tabard"] = {"item_id": 30_000}
    for key, value in (extra_metadata or {}).items():
        equipped[key] = value

    return equipped


def make_character(
    name,
    *,
    level=70,
    ilvl=110,
    last_seen_ms=NOW_MS - DAY_MS,
    combat_slots=17,
    include_shirt=True,
    include_tabard=True,
    include_profile=True,
    include_equipped=True,
    extra_profile=None,
    extra_equipped=None,
    slot_key_transform=None,
):
    character = {"char": name.lower()}

    if include_profile:
        profile = {
            "name": name,
            "level": level,
            "equipped_item_level": ilvl,
            "last_login_timestamp": last_seen_ms,
        }
        if extra_profile:
            profile.update(extra_profile)
        character["profile"] = profile

    if include_equipped:
        character["equipped"] = make_equipped(
            slot_keys=READINESS_COMBAT_SLOT_KEYS[:combat_slots],
            include_shirt=include_shirt,
            include_tabard=include_tabard,
            extra_metadata=extra_equipped,
            slot_key_transform=slot_key_transform,
        )

    return character


def build_state(roster, *, now_ms=NOW_MS, reset_anchor_ms=RESET_ANCHOR_MS, readiness_lock=None):
    return build_readiness_week_state(
        roster,
        {row["char"] for row in roster},
        now_ms=now_ms,
        readiness_lock=readiness_lock,
        reset_anchor_ms=reset_anchor_ms,
    )


class WarEffortReadinessTests(unittest.TestCase):
    def test_main_pipeline_threads_readiness_into_history_rows_without_schema_change(self):
        main_text = Path("main.py").read_text(encoding="utf-8")

        self.assertIn(
            "CREATE TABLE IF NOT EXISTS war_effort_history (week_anchor TEXT, category TEXT, vanguards TEXT, participants TEXT, PRIMARY KEY(week_anchor, category))",
            main_text,
        )
        self.assertIn("build_readiness_week_state(", main_text)
        self.assertIn("reset_anchor_ms=weekly_reset[\"last_reset_ms\"]", main_text)
        self.assertIn("smart_update_we(\n            'readiness',", main_text)

    def test_readiness_participants_require_recent_raid_ready_valid_gear_and_seventeen_slots(self):
        roster = [
            make_character("QualifiedOne"),
            make_character(
                "NoEnchantButQualified",
                extra_profile={"bis": False, "target_gear": {"main_hand": "not-used"}},
            ),
            make_character("TooLowIlvl", ilvl=109),
            make_character("TooOld", last_seen_ms=NOW_MS - (8 * DAY_MS)),
            make_character("NotEnoughGear", combat_slots=16),
            make_character("MissingProfile", include_profile=False),
            make_character("MissingEquipment", include_equipped=False),
            make_character(
                "ValidShirtTabard",
                combat_slots=17,
                include_shirt=True,
                include_tabard=True,
                extra_equipped={"metadata": {"source": "ignore-me"}},
            ),
        ]

        state = build_state(roster)

        self.assertEqual(state["active_raid_ready_baseline"], 5)
        self.assertEqual(state["active_raid_ready_count"], 5)
        self.assertEqual(state["total_raid_ready_count"], 6)
        self.assertEqual(state["target"], 4)
        self.assertEqual(
            state["participants"],
            ["noenchantbutqualified", "qualifiedone", "validshirttabard"],
        )
        self.assertEqual(state["vanguards"], [])
        self.assertEqual(state["participant_count"], 3)
        self.assertEqual(state["completion_pct"], 75)
        self.assertNotIn("toolowilvl", state["participants"])
        self.assertNotIn("tooold", state["participants"])
        self.assertNotIn("notenoughgear", state["participants"])
        self.assertNotIn("missingprofile", state["participants"])
        self.assertNotIn("missingequipment", state["participants"])

    def test_readiness_requires_post_reset_confirmation_even_when_pre_reset_activity_is_recent(self):
        roster = [
            make_character("PreResetActive", last_seen_ms=RESET_ANCHOR_MS - DAY_MS),
            make_character("PostResetActive", last_seen_ms=RESET_ANCHOR_MS + DAY_MS),
        ]

        state = build_state(roster, now_ms=RESET_ANCHOR_MS + (2 * DAY_MS))

        self.assertEqual(state["active_raid_ready_baseline"], 2)
        self.assertEqual(state["active_raid_ready_count"], 2)
        self.assertEqual(state["total_raid_ready_count"], 2)
        self.assertEqual(state["target"], 2)
        self.assertEqual(state["participants"], ["postresetactive"])
        self.assertEqual(state["participant_count"], 1)
        self.assertEqual(state["completion_pct"], 50)
        self.assertEqual(state["vanguards"], [])
        self.assertNotIn("preresetactive", state["participants"])

    def test_readiness_accepts_normalized_current_gear_slots_and_rejects_href_only_profile_equipment(self):
        roster = [
            make_character(
                "UppercaseGear",
                slot_key_transform=str.upper,
            ),
            make_character(
                "HrefOnlyProfileEquipment",
                include_equipped=False,
                extra_profile={"equipped": {"href": "https://example.invalid/equipment"}},
            ),
            make_character(
                "MissingOneUppercase",
                combat_slots=16,
                slot_key_transform=str.upper,
            ),
        ]

        state = build_state(roster)

        self.assertIn("uppercasegear", state["participants"])
        self.assertNotIn("hrefonlyprofileequipment", state["participants"])
        self.assertNotIn("missingoneuppercase", state["participants"])
        self.assertEqual(state["participant_count"], 1)
        self.assertEqual(state["vanguards"], [])

    def test_readiness_vanguards_remain_empty_until_objective_completes_then_lock(self):
        roster_before_completion = [
            make_character("Alpha", ilvl=120, last_seen_ms=NOW_MS - DAY_MS),
            make_character("Bravo", ilvl=119, last_seen_ms=NOW_MS - DAY_MS),
            make_character("Charlie", ilvl=118, last_seen_ms=NOW_MS - DAY_MS),
        ]

        before_completion = build_state(
            roster_before_completion,
            readiness_lock={
                "active_raid_ready_baseline": 4,
                "target": 4,
            },
        )

        self.assertEqual(before_completion["participant_count"], 3)
        self.assertEqual(before_completion["vanguards"], [])
        self.assertEqual(before_completion["completion_pct"], 75)

        roster_complete = roster_before_completion + [
            make_character("Delta", ilvl=117, last_seen_ms=NOW_MS - DAY_MS),
        ]

        after_completion = build_state(
            roster_complete,
            readiness_lock={
                "active_raid_ready_baseline": 4,
                "target": 4,
            },
        )

        self.assertEqual(after_completion["participant_count"], 4)
        self.assertEqual(after_completion["vanguards"], ["alpha", "bravo", "charlie"])
        self.assertEqual(after_completion["completion_pct"], 100)

    def test_readiness_vanguards_do_not_carry_over_without_post_reset_participants(self):
        roster = [
            make_character("OldVanguard", ilvl=125, last_seen_ms=RESET_ANCHOR_MS - DAY_MS),
            make_character("OldSupport", ilvl=124, last_seen_ms=RESET_ANCHOR_MS - (2 * DAY_MS)),
        ]

        state = build_state(
            roster,
            now_ms=RESET_ANCHOR_MS + DAY_MS,
            readiness_lock={
                "active_raid_ready_baseline": 2,
                "target": 2,
                "vanguards": ["oldvanguard"],
                "participants": ["oldvanguard"],
            },
        )

        self.assertEqual(state["participant_count"], 0)
        self.assertEqual(state["participants"], [])
        self.assertEqual(state["vanguards"], [])
        self.assertEqual(state["completion_pct"], 0)
        self.assertEqual(state["target"], 2)

    def test_extra_metadata_dicts_do_not_increase_combat_slot_count(self):
        roster = [
            make_character(
                "MetadataNoise",
                extra_equipped={
                    "metadata": {"note": "ignore"},
                    "transient": {"foo": "bar"},
                },
            )
        ]

        state = build_state(roster)

        self.assertEqual(state["participant_count"], 1)
        self.assertEqual(state["participants"], ["metadatanoise"])
        self.assertEqual(state["vanguards"], ["metadatanoise"])

    def test_readiness_baseline_target_freezes_for_week_and_distinguishes_active_and_total_counts(self):
        base_roster = [
            make_character(f"Active{i:02d}", last_seen_ms=NOW_MS - DAY_MS)
            for i in range(14)
        ]
        inactive_ready = [
            make_character(f"Inactive{i:02d}", last_seen_ms=NOW_MS - (10 * DAY_MS))
            for i in range(2)
        ]

        initial_state = build_state(base_roster + inactive_ready)

        self.assertEqual(initial_state["active_raid_ready_baseline"], 14)
        self.assertEqual(initial_state["active_raid_ready_count"], 14)
        self.assertEqual(initial_state["total_raid_ready_count"], 16)
        self.assertEqual(initial_state["target"], 10)

        midweek_roster = base_roster + inactive_ready + [
            make_character(f"LateJoin{i:02d}", last_seen_ms=NOW_MS - (2 * DAY_MS))
            for i in range(5)
        ]

        frozen_state = build_state(
            midweek_roster,
            now_ms=NOW_MS + (2 * DAY_MS),
            readiness_lock={
                "active_raid_ready_baseline": initial_state["active_raid_ready_baseline"],
                "target": initial_state["target"],
            },
        )

        self.assertEqual(frozen_state["active_raid_ready_baseline"], 14)
        self.assertEqual(frozen_state["active_raid_ready_count"], 19)
        self.assertEqual(frozen_state["total_raid_ready_count"], 21)
        self.assertEqual(frozen_state["target"], 10)

        empty_state = build_state([])
        self.assertEqual(empty_state["active_raid_ready_baseline"], 0)
        self.assertEqual(empty_state["active_raid_ready_count"], 0)
        self.assertEqual(empty_state["total_raid_ready_count"], 0)
        self.assertEqual(empty_state["target"], 0)
        self.assertEqual(empty_state["participant_count"], 0)

    def test_readiness_vanguards_use_equipped_item_level_and_deterministic_tiebreakers(self):
        roster = [
            make_character("alpha", ilvl=120, last_seen_ms=NOW_MS - DAY_MS),
            make_character("bravo", ilvl=120, last_seen_ms=NOW_MS - (2 * DAY_MS)),
            make_character("charlie", ilvl=120, last_seen_ms=NOW_MS - DAY_MS),
            make_character("delta", ilvl=119, last_seen_ms=NOW_MS - DAY_MS),
            make_character("echo", ilvl=118, last_seen_ms=NOW_MS - DAY_MS),
        ]

        state = build_state(roster)

        self.assertEqual(state["participant_count"], 5)
        self.assertEqual(state["vanguards"], ["alpha", "charlie", "bravo"])
        self.assertTrue(all(isinstance(name, str) for name in state["vanguards"]))
        self.assertEqual(state["participants"][:3], ["alpha", "charlie", "bravo"])
        self.assertNotIn("delta", state["vanguards"])
        self.assertNotIn("echo", state["vanguards"])

    def test_readiness_lock_data_is_preserved_even_when_empty(self):
        temp_dir = workspace_temp_dir()
        try:
            we_file = Path(temp_dir.name) / "asset" / "war_effort.json"
            we_file.parent.mkdir(parents=True, exist_ok=True)
            we_file.write_text(
                json.dumps(
                    {
                        "week_anchor": "2026-04-21",
                        "locks": {
                            "readiness": {
                                "vanguards": [],
                                "participants": [],
                                "active_raid_ready_baseline": 0,
                                "target": 0,
                                "participant_count": 0,
                            }
                        },
                    },
                    ensure_ascii=False,
                ),
                encoding="utf-8",
            )

            loaded = load_war_effort_lock_data(str(we_file), "2026-04-21", {"alpha"})
            self.assertIn("readiness", loaded["locks"])
            self.assertEqual(loaded["locks"]["readiness"]["vanguards"], [])
            self.assertEqual(loaded["locks"]["readiness"]["participants"], [])
            self.assertEqual(loaded["locks"]["readiness"]["target"], 0)
        finally:
            temp_dir.cleanup()

    def test_war_effort_history_purge_targets_departed_names_with_indexed_in_filters(self):
        purge_stmts = prepare_war_effort_history_purge(
            ["Alpha", "Bravo"],
            {"alpha", "bravo", "charlie"},
            {},
        )

        purge_sql = "\n".join(stmt["q"] for stmt in purge_stmts)
        self.assertIn("DELETE FROM reigning_champs_history WHERE lower(champion) IN", purge_sql)
        self.assertIn("DELETE FROM ladder_history WHERE lower(champion) IN", purge_sql)
        self.assertNotIn("NOT IN", purge_sql)
        self.assertEqual(purge_stmts[0]["params"], ["alpha", "bravo"])
        self.assertEqual(purge_stmts[1]["params"], ["alpha", "bravo"])

    def test_war_effort_badges_recognize_readiness_and_preserve_existing_categories(self):
        historical_data = [
            {
                "week_anchor": "2026-04-21",
                "category": "readiness",
                "vanguards": json.dumps(["alpha", "beta"]),
                "participants": json.dumps(["alpha", "beta", "charlie"]),
            },
            {
                "week_anchor": "2026-04-21",
                "category": "xp",
                "vanguards": json.dumps(["delta"]),
                "participants": json.dumps(["delta"]),
            },
            {
                "week_anchor": "2026-04-21",
                "category": "hk",
                "vanguards": json.dumps(["echo"]),
                "participants": json.dumps(["echo"]),
            },
            {
                "week_anchor": "2026-04-21",
                "category": "loot",
                "vanguards": json.dumps(["foxtrot"]),
                "participants": json.dumps(["foxtrot"]),
            },
            {
                "week_anchor": "2026-04-21",
                "category": "zenith",
                "vanguards": json.dumps(["golf"]),
                "participants": json.dumps(["golf"]),
            },
        ]

        vanguard_tallies, campaign_tallies, badge_events = aggregate_war_effort_badges(historical_data)

        self.assertEqual(vanguard_tallies["alpha"], ["Warden's Standard"])
        self.assertEqual(vanguard_tallies["beta"], ["Warden's Standard"])
        self.assertEqual(campaign_tallies["alpha"], ["Warden's Standard"])
        self.assertEqual(campaign_tallies["charlie"], ["Warden's Standard"])
        self.assertEqual(vanguard_tallies["delta"], ["XP"])
        self.assertEqual(vanguard_tallies["echo"], ["HKs"])
        self.assertEqual(vanguard_tallies["foxtrot"], ["Loot"])
        self.assertEqual(vanguard_tallies["golf"], ["Zenith"])
        self.assertTrue(any(event["category"] == "Warden's Standard" for event in badge_events))
        self.assertTrue(any(event["badge_type"] == "vanguard" for event in badge_events))
        self.assertTrue(any(event["badge_type"] == "campaign" for event in badge_events))


if __name__ == "__main__":
    unittest.main()
