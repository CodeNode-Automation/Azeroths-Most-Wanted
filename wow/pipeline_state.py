def build_prev_mvps(prev_mvp_rows):
    top_prev_pve = None
    top_prev_pvp = None
    max_prev_ilvl = 0
    max_prev_hks = 0

    for row in prev_mvp_rows:
        if row.get("prev_trend_ilvl", 0) > max_prev_ilvl:
            max_prev_ilvl = row["prev_trend_ilvl"]
            top_prev_pve = row["char_name"]
        if row.get("prev_trend_hks", 0) > max_prev_hks:
            max_prev_hks = row["prev_trend_hks"]
            top_prev_pvp = row["char_name"]

    return {
        "pve": {"name": top_prev_pve, "score": max_prev_ilvl} if top_prev_pve else None,
        "pvp": {"name": top_prev_pvp, "score": max_prev_hks} if top_prev_pvp else None,
    }


def build_historical_state(char_rows, gear_rows, trend_rows, gt_rows, timeline_rows):
    history_data = {row["name"]: dict(row) for row in char_rows}

    for row in gear_rows:
        char_state = history_data.setdefault(row["character_name"], {})
        char_state[row["slot"]] = {
            "item_id": row["item_id"],
            "name": row["name"],
            "quality": row["quality"],
            "icon_data": row["icon_data"],
            "tooltip_params": row["tooltip_params"],
        }

    past_char_records = {row["char_name"]: row for row in trend_rows}
    global_trend_record = gt_rows[0] if gt_rows else None

    known_timeline = set()
    for row in timeline_rows:
        char_key = str(row.get("character_name", "")).lower()
        if row["type"] == "level_up":
            known_timeline.add(f"{char_key}_level_{row['level']}")
        else:
            known_timeline.add(f"{char_key}_item_{row['item_id']}")

    return history_data, past_char_records, global_trend_record, known_timeline
