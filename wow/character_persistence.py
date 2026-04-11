import json


CHARACTER_UPSERT_QUERY = """
                        INSERT OR REPLACE INTO characters 
                        (name, level, class, race, faction, equipped_item_level, last_login_ms, portrait_url, active_spec, honorable_kills,
                        health, power, power_type, strength_base, strength_effective, agility_base, agility_effective, 
                        intellect_base, intellect_effective, stamina_base, stamina_effective, melee_crit_value, 
                        melee_haste_value, attack_power, main_hand_min, main_hand_max, main_hand_speed, main_hand_dps, 
                        off_hand_min, off_hand_max, off_hand_speed, off_hand_dps, spell_power, spell_penetration, 
                        spell_crit_value, mana_regen, mana_regen_combat, armor_base, armor_effective, dodge, parry, 
                        block, ranged_crit, ranged_haste, spell_haste, spirit_base, spirit_effective, defense_base, defense_effective,
                        vanguard_badges, campaign_badges, pve_champ_count, pvp_champ_count) 
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """


def build_character_row_lookup(char_rows):
    return {r["name"].lower(): r for r in char_rows}


def _build_badge_payload(safe_name, vanguard_tallies, campaign_tallies, pve_champs, pvp_champs):
    v_badges = vanguard_tallies.get(safe_name, [])
    c_badges = campaign_tallies.get(safe_name, [])
    pve_count = pve_champs.get(safe_name, 0)
    pvp_count = pvp_champs.get(safe_name, 0)

    return {
        "v_badges": v_badges,
        "c_badges": c_badges,
        "pve_count": pve_count,
        "pvp_count": pvp_count,
        "v_badges_json": json.dumps(v_badges),
        "c_badges_json": json.dumps(c_badges),
    }


def _should_write_character_row(orig, data, badge_payload):
    orig_v_badges = str(orig.get("vanguard_badges") or "[]")
    orig_c_badges = str(orig.get("campaign_badges") or "[]")

    return (
        orig.get("equipped_item_level") != data.get("equipped_item_level")
        or orig.get("level") != data.get("level")
        or orig.get("last_login_ms") != data.get("last_login_ms")
        or orig.get("honorable_kills") != data.get("honorable_kills")
        or orig.get("active_spec") != data.get("active_spec")
        or orig_v_badges != badge_payload["v_badges_json"]
        or orig_c_badges != badge_payload["c_badges_json"]
        or orig.get("pve_champ_count") != badge_payload["pve_count"]
        or orig.get("pvp_champ_count") != badge_payload["pvp_count"]
        or not orig
    )


def _build_character_upsert_statement(char_name, data, badge_payload):
    return {
        "q": CHARACTER_UPSERT_QUERY,
        "params": [
            char_name, data.get("level", 0), data.get("class"), data.get("race"), data.get("faction"),
            data.get("equipped_item_level"), data.get("last_login_ms"), data.get("portrait_url"),
            data.get("active_spec"), data.get("honorable_kills"),

            data.get("health"), data.get("power"), data.get("power_type"),
            data.get("strength_base"), data.get("strength_effective"),
            data.get("agility_base"), data.get("agility_effective"),
            data.get("intellect_base"), data.get("intellect_effective"),
            data.get("stamina_base"), data.get("stamina_effective"),
            data.get("melee_crit_value"), data.get("melee_haste_value"),
            data.get("attack_power"),
            data.get("main_hand_min"), data.get("main_hand_max"), data.get("main_hand_speed"), data.get("main_hand_dps"),
            data.get("off_hand_min"), data.get("off_hand_max"), data.get("off_hand_speed"), data.get("off_hand_dps"),
            data.get("spell_power"), data.get("spell_penetration"), data.get("spell_crit_value"),
            data.get("mana_regen"), data.get("mana_regen_combat"),
            data.get("armor_base"), data.get("armor_effective"),
            data.get("dodge"), data.get("parry"), data.get("block"),
            data.get("ranged_crit"), data.get("ranged_haste"), data.get("spell_haste"),
            data.get("spirit_base"), data.get("spirit_effective"),
            data.get("defense_base"), data.get("defense_effective"),

            badge_payload["v_badges_json"], badge_payload["c_badges_json"],
            badge_payload["pve_count"], badge_payload["pvp_count"],
        ],
    }


def build_character_write_batch(history_data, orig_chars, vanguard_tallies, campaign_tallies, pve_champs, pvp_champs):
    batch_stmts_chars = []

    for char_name, data in history_data.items():
        safe_name = char_name.lower()
        orig = orig_chars.get(safe_name, {})
        badge_payload = _build_badge_payload(safe_name, vanguard_tallies, campaign_tallies, pve_champs, pvp_champs)

        if _should_write_character_row(orig, data, badge_payload):
            batch_stmts_chars.append(_build_character_upsert_statement(char_name, data, badge_payload))

    return batch_stmts_chars
