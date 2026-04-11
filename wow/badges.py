import json


def aggregate_war_effort_badges(historical_data):
    vanguard_tallies, campaign_tallies = {}, {}
    badge_events = []
    cat_map = {"xp": "XP", "hk": "HKs", "loot": "Loot", "zenith": "Zenith"}

    if historical_data:
        for row in historical_data:
            week_anchor = str(row.get('week_anchor', '') if isinstance(row, dict) else row[0] or '')
            cat = str(row.get('category', '') if isinstance(row, dict) else row[1] or '')
            v_json = row.get('vanguards', '[]') if isinstance(row, dict) else row[2]
            p_json = row.get('participants', '[]') if isinstance(row, dict) else row[3]

            if not week_anchor:
                continue

            label = cat_map.get(cat.lower(), cat.title())
            timestamp = f"{week_anchor}T12:00:00Z"

            try:
                for v in json.loads(v_json or '[]'):
                    v_lower = str(v).lower()
                    if v_lower not in vanguard_tallies:
                        vanguard_tallies[v_lower] = []
                    vanguard_tallies[v_lower].append(label)
                    badge_events.append({
                        "timestamp": timestamp,
                        "character_name": str(v).title(),
                        "type": "badge",
                        "badge_type": "vanguard",
                        "category": label,
                    })
            except Exception:
                pass

            try:
                for p in json.loads(p_json or '[]'):
                    p_lower = str(p).lower()
                    if p_lower not in campaign_tallies:
                        campaign_tallies[p_lower] = []
                    campaign_tallies[p_lower].append(label)
                    badge_events.append({
                        "timestamp": timestamp,
                        "character_name": str(p).title(),
                        "type": "badge",
                        "badge_type": "campaign",
                        "category": label,
                    })
            except Exception:
                pass

    return vanguard_tallies, campaign_tallies, badge_events


def aggregate_reigning_champ_badges(mvp_data):
    pve_champs, pvp_champs = {}, {}
    badge_events = []

    if mvp_data:
        for row in mvp_data:
            week_anchor = str(row.get('week_anchor', '') if isinstance(row, dict) else row[0] or '')
            champ = str(row.get('champion', '') if isinstance(row, dict) else row[1] or '').lower()
            cat = str(row.get('category', '') if isinstance(row, dict) else row[2] or '').lower()

            if not champ or not week_anchor:
                continue

            timestamp = f"{week_anchor}T12:00:00Z"

            if cat == 'pve':
                pve_champs[champ] = pve_champs.get(champ, 0) + 1
                badge_events.append({
                    "timestamp": timestamp,
                    "character_name": champ.title(),
                    "type": "badge",
                    "badge_type": "mvp_pve",
                    "category": "PvE Weekly Trend",
                })
            if cat == 'pvp':
                pvp_champs[champ] = pvp_champs.get(champ, 0) + 1
                badge_events.append({
                    "timestamp": timestamp,
                    "character_name": champ.title(),
                    "type": "badge",
                    "badge_type": "mvp_pvp",
                    "category": "PvP Weekly Trend",
                })

    return pve_champs, pvp_champs, badge_events


def aggregate_ladder_badges(ladder_data):
    ladder_medals = {}
    badge_events = []

    if ladder_data:
        for row in ladder_data:
            w_anchor = str(row.get('week_anchor', '') if isinstance(row, dict) else row[0] or '')
            cat = str(row.get('category', '') if isinstance(row, dict) else row[1] or '').lower()

            raw_rank = row.get('rank', 0) if isinstance(row, dict) else row[2]
            try:
                rank = int(raw_rank)
            except Exception:
                rank = 0

            champ = str(row.get('champion', '') if isinstance(row, dict) else row[3] or '').lower()

            if not champ or not w_anchor:
                continue

            timestamp = f"{w_anchor}T12:00:00Z"

            if champ not in ladder_medals:
                ladder_medals[champ] = {
                    'pve_gold': 0,
                    'pve_silver': 0,
                    'pve_bronze': 0,
                    'pvp_gold': 0,
                    'pvp_silver': 0,
                    'pvp_bronze': 0,
                }

            medal_type = 'gold' if rank == 1 else 'silver' if rank == 2 else 'bronze'
            if rank > 3 or rank < 1:
                continue

            medal_key = f"{cat}_{medal_type}"
            if medal_key in ladder_medals[champ]:
                ladder_medals[champ][medal_key] += 1

            cat_name = "PvE Leaderboard" if cat == 'pve' else "PvP Leaderboard"
            badge_events.append({
                "timestamp": timestamp,
                "character_name": champ.title(),
                "type": "badge",
                "badge_type": medal_key,
                "category": cat_name,
            })

    return ladder_medals, badge_events


def apply_badges_to_roster(roster_data, history_data, vanguard_tallies, campaign_tallies, pve_champs, pvp_champs, ladder_medals):
    for r in roster_data:
        if not r or not r.get("profile"):
            continue

        c_name = r["profile"].get("name", "").lower()

        v_badges = vanguard_tallies.get(c_name, [])
        c_badges = campaign_tallies.get(c_name, [])
        pve_count = pve_champs.get(c_name, 0)
        pvp_count = pvp_champs.get(c_name, 0)
        medals = ladder_medals.get(c_name, {
            'pve_gold': 0,
            'pve_silver': 0,
            'pve_bronze': 0,
            'pvp_gold': 0,
            'pvp_silver': 0,
            'pvp_bronze': 0,
        })

        r["profile"]["vanguard_badges"] = v_badges
        r["profile"]["campaign_badges"] = c_badges
        r["profile"]["pve_champ_count"] = pve_count
        r["profile"]["pvp_champ_count"] = pvp_count
        for k, v in medals.items():
            r["profile"][k] = v
            r[k] = v

        r["vanguard_badges"] = v_badges
        r["campaign_badges"] = c_badges
        r["pve_champ_count"] = pve_count
        r["pvp_champ_count"] = pvp_count

        if c_name in history_data:
            history_data[c_name]["vanguard_badges"] = v_badges
            history_data[c_name]["campaign_badges"] = c_badges
            history_data[c_name]["pve_champ_count"] = pve_count
            history_data[c_name]["pvp_champ_count"] = pvp_count
            for k, v in medals.items():
                history_data[c_name][k] = v
