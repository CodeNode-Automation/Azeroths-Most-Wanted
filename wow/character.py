import asyncio
from wow.api import fetch_wow_endpoint
from wow.items import process_equipment
from wow.images import get_standardized_image_url
from config import REALM
from datetime import datetime, timezone

async def fetch_character_data(session, token, char, history_data):
    """
    Coordinates the asynchronous retrieval and processing of a character's data.
    """
    # Initialize concurrent API requests for the character's core endpoints
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

    # Compare current equipment against historical state to detect new upgrades
    past_gear = history_data.get(char, {})
    upgrade_count = 0
    upgrades = []
    
    for slot, data in equipped_dict.items():
        # Using .get() safely handles items and prevents KeyError on missing slots
        past_item_id = past_gear.get(slot, {}).get("item_id") if isinstance(past_gear.get(slot), dict) else None
        
        if past_gear and past_item_id != data.get("item_id"):
            data["is_new"] = True
            upgrade_count += 1
            upgrades.append(data)  # Append the full item dictionary for the timeline
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
    """
    Updates the historical state and timeline feed with new gear upgrades and level-ups.
    """
    char_name = char_data["char"].title()
    char_class = char_data["profile"].get("character_class", {}).get("name", "Unknown") if isinstance(char_data.get("profile"), dict) else "Unknown"
    
    # Generate a single timestamp for all events in this execution cycle
    timestamp = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")

    # 1. Process Level-Ups
    if char_data.get("level_up"):
        timeline_data.append({
            "timestamp": timestamp,
            "character": char_name,
            "class": char_class,
            "type": "level_up",
            "level": char_data["level_up"]
        })

    # 2. Process Gear Upgrades
    for upgrade in char_data.get("upgrades", []):
        timeline_data.append({
            "timestamp": timestamp,
            "character": char_name,
            "class": char_class,
            "type": "item",
            "item": upgrade
        })

    # 3. Update the persistent historical state
    # Save the new equipment mapping and the current level to track future changes
    history_data[char_data["char"]] = char_data["equipped"]
    history_data[char_data["char"]]["level"] = char_data.get("current_level", 0)

    # NEW: Extract the missing profile data needed for the characters table
    profile = char_data.get("profile", {})
    if isinstance(profile, dict):
        history_data[char_data["char"]]["last_login_ms"] = profile.get("last_login_timestamp")
        history_data[char_data["char"]]["equipped_item_level"] = profile.get("equipped_item_level")
        history_data[char_data["char"]]["portrait_url"] = char_data.get("render_url")
        
        # BULLETPROOF EXTRACTION: Safely handle nulls and mixed types from Blizzard
        def get_safe_name(key):
            obj = profile.get(key)
            if isinstance(obj, dict):
                name_obj = obj.get("name")
                if isinstance(name_obj, dict):
                    return name_obj.get("en_US")
                if isinstance(name_obj, str):
                    return name_obj
            return None

        history_data[char_data["char"]]["faction"] = get_safe_name("faction")
        history_data[char_data["char"]]["class"] = get_safe_name("character_class")
        history_data[char_data["char"]]["race"] = get_safe_name("race")

    return history_data, timeline_data