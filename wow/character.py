import asyncio
from wow.api import fetch_wow_endpoint
from wow.items import process_equipment
from wow.images import get_standardized_image_url
from config import REALM
from datetime import datetime, timezone

async def fetch_character_data(session, token, char, history_data):
    """Fetch and normalize the profile, stats, equipment, media, PvP, and spec data for one character."""
    # Kick off the independent character endpoints together to keep the refresh window short.
    profile_task = fetch_wow_endpoint(session, token, REALM, char)
    stats_task = fetch_wow_endpoint(session, token, REALM, char, "statistics")
    equipment_task = fetch_wow_endpoint(session, token, REALM, char, "equipment")
    media_task = fetch_wow_endpoint(session, token, REALM, char, "character-media")
    pvp_task = fetch_wow_endpoint(session, token, REALM, char, "pvp-summary")
    specs_task = fetch_wow_endpoint(session, token, REALM, char, "specializations")
    
    # Await all API calls simultaneously to minimize blocking network I/O
    profile, stats, equipment, media, pvp, specs = await asyncio.gather(
        profile_task, stats_task, equipment_task, media_task, pvp_task, specs_task
    )
    
    past_gear = history_data.get(char, {})
    equipped_dict = await process_equipment(session, token, equipment, past_gear)

    # Extract Honorable Kills and inject directly into the profile dict
    hk_count = pvp.get("honorable_kills", 0) if isinstance(pvp, dict) else 0
    if isinstance(profile, dict):
        profile["honorable_kills"] = hk_count

    # Determine Active Spec by finding the talent tree with the most spent points
    active_spec = ""
    if isinstance(specs, dict) and "specialization_groups" in specs:
        for group in specs["specialization_groups"]:
            if group.get("is_active"):
                highest_points = 0
                for spec_tree in group.get("specializations", []):
                    points = spec_tree.get("spent_points", 0)
                    if points > highest_points:
                        highest_points = points
                        active_spec = spec_tree.get("specialization_name", "")
                        
    if isinstance(profile, dict):
        profile["active_spec"] = active_spec

    # Extract the highest quality character render available
    render_url = None
    if media and 'assets' in media:
        for asset in media['assets']:
            if asset.get('key') == 'main-raw':
                render_url = asset.get('value')
        # Fallback to standard avatar if 'main-raw' is missing
        if not render_url:
            for asset in media['assets']:
                if asset.get('key') == 'avatar':
                    render_url = asset.get('value')

    portrait_url = get_standardized_image_url(render_url) if render_url else None

    # Compare the refreshed equipment snapshot against the stored state to detect upgrades.
    upgrades = []
    
    for slot, data in equipped_dict.items():
        past_slot = past_gear.get(slot)
        past_item_id = past_slot.get("item_id") if isinstance(past_slot, dict) else None
        
        if past_item_id != data.get("item_id"):
            data["is_new"] = True
            # Only broadcast to timeline if it is an existing character getting an upgrade
            if past_gear: 
                upgrades.append(data)  
        else:
            data["is_new"] = False

    # Track character level progression
    current_level = profile.get("level", 0) if isinstance(profile, dict) else 0
    past_level = past_gear.get("level", 0)
    level_up = None
    
    # Only trigger a level-up event if we have historical data (past_level > 0) and the level has increased
    if past_level > 0 and current_level > past_level:
        level_up = current_level

    # Return the normalized data payload for downstream HTML generation and state tracking
    return {
        "char": char,
        "profile": profile,
        "equipped": equipped_dict,
        "stats": stats,
        "render_url": portrait_url,
        "upgrades": upgrades,
        "level_up": level_up,
        "current_level": current_level
    }

def update_character_state(char_data, history_data, timeline_data):
    """Update the stored character snapshot and append any new timeline events."""
    char_key = char_data["char"]
    char_name = char_key.title()
    profile = char_data.get("profile", {})
    char_class = profile.get("character_class", {}).get("name", "Unknown") if isinstance(profile, dict) else "Unknown"
    
    # Generate a single timestamp for all events in this execution cycle
    timestamp = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")

    # Append level-up events before gear so the timeline keeps a stable event grouping.
    if char_data.get("level_up"):
        timeline_data.append({
            "timestamp": timestamp,
            "character": char_name,
            "class": char_class,
            "type": "level_up",
            "level": char_data["level_up"]
        })

    # Append gear upgrades using the same timestamp as the rest of this refresh.
    for upgrade in char_data.get("upgrades", []):
        timeline_data.append({
            "timestamp": timestamp,
            "character": char_name,
            "class": char_class,
            "type": "item",
            "item": upgrade
        })

    # Persist the equipment snapshot and flattened profile fields for downstream writes.
    stored_state = char_data["equipped"]
    stored_state["level"] = char_data.get("current_level", 0)
    history_data[char_key] = stored_state

    if isinstance(profile, dict):
        stored_state["last_login_ms"] = profile.get("last_login_timestamp")
        stored_state["equipped_item_level"] = profile.get("equipped_item_level")
        stored_state["portrait_url"] = char_data.get("render_url")
        
        # Blizzard name fields can arrive as either plain strings or localized-name dicts.
        def get_safe_name(key):
            obj = profile.get(key)
            if isinstance(obj, dict):
                name_obj = obj.get("name")
                if isinstance(name_obj, dict):
                    return name_obj.get("en_US")
                if isinstance(name_obj, str):
                    return name_obj
            return None

        stored_state["faction"] = get_safe_name("faction")
        stored_state["class"] = get_safe_name("character_class")
        stored_state["race"] = get_safe_name("race")
        stored_state["active_spec"] = profile.get("active_spec")
        stored_state["honorable_kills"] = profile.get("honorable_kills", 0)

        # Persist the statistics that feed the characters table and analytics views.
        stats = char_data.get("stats", {})
        if isinstance(stats, dict):
            stored_state["health"] = stats.get("health")
            stored_state["power"] = stats.get("power")
            
            pt = stats.get("power_type")
            stored_state["power_type"] = pt.get("name") if isinstance(pt, dict) else pt
            
            for base_eff in ["strength", "agility", "intellect", "stamina", "spirit", "armor", "defense"]:
                obj = stats.get(base_eff, {})
                if isinstance(obj, dict):
                    stored_state[f"{base_eff}_base"] = obj.get("base")
                    stored_state[f"{base_eff}_effective"] = obj.get("effective")
                else:
                    stored_state[f"{base_eff}_base"] = None
                    stored_state[f"{base_eff}_effective"] = None
                    
            def get_val(key):
                val = stats.get(key)
                return val.get("value") if isinstance(val, dict) else val

            stored_state["melee_crit_value"] = get_val("melee_crit")
            stored_state["melee_haste_value"] = get_val("melee_haste")
            stored_state["spell_crit_value"] = get_val("spell_crit")
            stored_state["ranged_crit"] = get_val("ranged_crit")
            stored_state["ranged_haste"] = get_val("ranged_haste")
            stored_state["spell_haste"] = get_val("spell_haste")
            stored_state["dodge"] = get_val("dodge")
            stored_state["parry"] = get_val("parry")
            stored_state["block"] = get_val("block")
            stored_state["mana_regen"] = get_val("mana_regen")
            stored_state["mana_regen_combat"] = get_val("mana_regen_combat")
            
            stored_state["attack_power"] = stats.get("attack_power")
            stored_state["spell_power"] = stats.get("spell_power")
            stored_state["spell_penetration"] = stats.get("spell_penetration")
            
            stored_state["main_hand_min"] = stats.get("main_hand_damage_min")
            stored_state["main_hand_max"] = stats.get("main_hand_damage_max")
            stored_state["main_hand_speed"] = stats.get("main_hand_speed")
            stored_state["main_hand_dps"] = stats.get("main_hand_dps")
                
            stored_state["off_hand_min"] = stats.get("off_hand_damage_min")
            stored_state["off_hand_max"] = stats.get("off_hand_damage_max")
            stored_state["off_hand_speed"] = stats.get("off_hand_speed")
            stored_state["off_hand_dps"] = stats.get("off_hand_dps")

    return history_data, timeline_data
