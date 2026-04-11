import json
import os
from datetime import datetime, timedelta, timezone


def build_weekly_reset_context(berlin_tz):
    now_berlin = datetime.now(berlin_tz)
    days_since_tuesday = (now_berlin.weekday() - 1) % 7
    last_reset_berlin = now_berlin - timedelta(days=days_since_tuesday)
    last_reset_berlin = last_reset_berlin.replace(hour=0, minute=0, second=0, microsecond=0)

    return {
        "now_berlin": now_berlin,
        "last_reset_berlin": last_reset_berlin,
        "last_reset_iso": last_reset_berlin.astimezone(timezone.utc).strftime("%Y-%m-%d %H:%M:%S"),
        "week_anchor": last_reset_berlin.strftime("%Y-%m-%d"),
        "prev_week_anchor": (last_reset_berlin - timedelta(days=7)).strftime("%Y-%m-%d"),
    }


def filter_active_we_names(names, active_roster_set):
    filtered = []
    for name in names or []:
        clean = str(name).lower()
        if clean and clean in active_roster_set and clean not in filtered:
            filtered.append(clean)
    return filtered


def rebuild_locked_vanguards(existing_vanguards, ranked_names, active_roster_set, limit=3):
    final_vanguards = filter_active_we_names(existing_vanguards, active_roster_set)
    for name in ranked_names or []:
        clean = str(name).lower()
        if clean in active_roster_set and clean not in final_vanguards:
            final_vanguards.append(clean)
        if len(final_vanguards) >= limit:
            break
    return final_vanguards[:limit]


def load_war_effort_lock_data(we_file, week_anchor, active_roster_set):
    we_data = {"week_anchor": week_anchor, "locks": {}}
    if os.path.exists(we_file):
        try:
            with open(we_file, "r", encoding="utf-8") as f:
                old_we = json.load(f)
                if old_we.get("week_anchor") == we_data["week_anchor"]:
                    we_data["locks"] = old_we.get("locks", {})
        except Exception:
            pass

    for cat, lock in list(we_data["locks"].items()):
        if not isinstance(lock, dict):
            we_data["locks"].pop(cat, None)
            continue

        clean_vanguards = filter_active_we_names(lock.get("vanguards", []), active_roster_set)
        if clean_vanguards:
            we_data["locks"][cat]["vanguards"] = clean_vanguards
        else:
            we_data["locks"].pop(cat, None)

    return we_data


def build_war_effort_history_state(war_effort_history_rows):
    war_effort_history_state = {}
    for row in war_effort_history_rows:
        week = row.get('week_anchor') if isinstance(row, dict) else row[0]
        category = row.get('category') if isinstance(row, dict) else row[1]
        raw_v = row.get('vanguards') if isinstance(row, dict) else row[2]
        raw_p = row.get('participants') if isinstance(row, dict) else row[3]
        war_effort_history_state[(week, category)] = {
            'week_anchor': week,
            'category': category,
            'vanguards': raw_v or '[]',
            'participants': raw_p or '[]',
        }
    return war_effort_history_state


def prepare_war_effort_history_purge(roster_names, active_roster_set, war_effort_history_state):
    if not roster_names:
        return []

    placeholders = ",".join(["?"] * len(roster_names))
    purge_stmts = [
        {
            "q": f"DELETE FROM reigning_champs_history WHERE lower(champion) NOT IN ({placeholders})",
            "params": roster_names,
        },
        {
            "q": f"DELETE FROM ladder_history WHERE lower(champion) NOT IN ({placeholders})",
            "params": roster_names,
        },
    ]

    for row in list(war_effort_history_state.values()):
        week = row.get('week_anchor')
        category = row.get('category')
        raw_v = row.get('vanguards') or '[]'
        raw_p = row.get('participants') or '[]'

        try:
            old_v = json.loads(raw_v or '[]')
        except Exception:
            old_v = []

        try:
            old_p = json.loads(raw_p or '[]')
        except Exception:
            old_p = []

        clean_v = filter_active_we_names(old_v, active_roster_set)
        clean_p = filter_active_we_names(old_p, active_roster_set)

        old_v_json = json.dumps(old_v)
        old_p_json = json.dumps(old_p)
        clean_v_json = json.dumps(clean_v)
        clean_p_json = json.dumps(clean_p)

        if old_v_json != clean_v_json or old_p_json != clean_p_json:
            if not clean_v and not clean_p:
                purge_stmts.append({
                    "q": "DELETE FROM war_effort_history WHERE week_anchor = ? AND category = ?",
                    "params": [week, category],
                })
                war_effort_history_state.pop((week, category), None)
            else:
                purge_stmts.append({
                    "q": "INSERT OR REPLACE INTO war_effort_history (week_anchor, category, vanguards, participants) VALUES (?, ?, ?, ?)",
                    "params": [week, category, clean_v_json, clean_p_json],
                })
                war_effort_history_state[(week, category)] = {
                    'week_anchor': week,
                    'category': category,
                    'vanguards': clean_v_json,
                    'participants': clean_p_json,
                }

    return purge_stmts


def build_db_we_state(week_anchor, war_effort_history_state, we_data, active_roster_set):
    db_we_state = {}
    we_rows = [
        row for row in war_effort_history_state.values()
        if row.get('week_anchor') == week_anchor
    ]

    for r in we_rows:
        cat = r.get('category') if isinstance(r, dict) else r[0]
        v = r.get('vanguards') if isinstance(r, dict) else r[1]
        p = r.get('participants') if isinstance(r, dict) else r[2]
        db_we_state[cat] = {'vanguards': v, 'participants': p}

        try:
            parsed_v = filter_active_we_names(json.loads(v or '[]'), active_roster_set)
            if parsed_v and len(parsed_v) > 0 and cat not in we_data["locks"]:
                we_data["locks"][cat] = {"vanguards": parsed_v}
        except Exception:
            pass

    return db_we_state


def build_db_mvp_state(mvp_rows):
    db_mvp_state = {}
    if mvp_rows:
        for r in mvp_rows:
            cat = r.get('category') if isinstance(r, dict) else r[0]
            champ = r.get('champion') if isinstance(r, dict) else r[1]
            score = r.get('score') if isinstance(r, dict) else r[2]
            db_mvp_state[cat] = {'champion': champ, 'score': score}
    return db_mvp_state


def collect_xp_progress(dashboard_feed, last_reset_iso, active_roster_set):
    xp_events = [
        e for e in dashboard_feed
        if e.get('type') == 'level_up'
        and str(e.get('timestamp', '')).replace('T', ' ') >= last_reset_iso
        and str(e.get('character_name', '')).lower() in active_roster_set
    ]
    xp_counts = {}
    for e in xp_events:
        c_name = e.get('character_name')
        if c_name:
            clean_name = c_name.lower()
            if clean_name in active_roster_set:
                xp_counts[clean_name] = xp_counts.get(clean_name, 0) + 1

    ranked_xp_names = [k for k, _ in sorted(xp_counts.items(), key=lambda item: item[1], reverse=True)]
    return xp_counts, ranked_xp_names, len(xp_events) >= 750


def collect_hk_progress(roster_data, active_roster_set):
    hk_counts = {}
    total_hks = 0
    for r in roster_data:
        if not r or not r.get("profile"):
            continue
        prof = r["profile"]
        trend = prof.get("trend_pvp") or prof.get("trend_hks") or 0
        if trend > 0:
            clean_name = prof.get("name", "Unknown").lower()
            if clean_name in active_roster_set:
                total_hks += trend
                hk_counts[clean_name] = trend

    ranked_hk_names = [k for k, _ in sorted(hk_counts.items(), key=lambda item: item[1], reverse=True)]
    return hk_counts, total_hks, ranked_hk_names, total_hks >= 1000


def collect_loot_progress(dashboard_feed, last_reset_iso, active_roster_set):
    loot_events = [
        e for e in dashboard_feed
        if e.get('type') == 'item'
        and e.get('item_quality') in ('EPIC', 'LEGENDARY')
        and str(e.get('timestamp', '')).replace('T', ' ') >= last_reset_iso
        and str(e.get('character_name', '')).lower() in active_roster_set
    ]
    loot_counts = {}
    for e in loot_events:
        c_name = e.get('character_name')
        if c_name:
            clean_name = c_name.lower()
            if clean_name in active_roster_set:
                loot_counts[clean_name] = loot_counts.get(clean_name, 0) + 1

    ranked_loot_names = [k for k, _ in sorted(loot_counts.items(), key=lambda item: item[1], reverse=True)]
    return loot_counts, ranked_loot_names, len(loot_events) >= 60


def collect_zenith_progress(dashboard_feed, last_reset_iso, active_roster_set):
    zenith_events = [
        e for e in dashboard_feed
        if e.get('type') == 'level_up'
        and e.get('level') == 70
        and str(e.get('timestamp', '')).replace('T', ' ') >= last_reset_iso
        and str(e.get('character_name', '')).lower() in active_roster_set
    ]
    zenith_events_sorted = sorted(zenith_events, key=lambda x: str(x.get('timestamp', '')))
    unique_70s = []
    for e in zenith_events_sorted:
        c_name = e.get('character_name')
        if c_name:
            clean_name = c_name.lower()
            if clean_name in active_roster_set and clean_name not in unique_70s:
                unique_70s.append(clean_name)

    ranked_zenith_names = list(unique_70s)
    return unique_70s, ranked_zenith_names, len(unique_70s) >= 10


def update_xp_lock(we_data, ranked_xp_names, xp_threshold_met, active_roster_set, now_iso):
    current_vanguards = []
    if xp_threshold_met:
        if "xp" not in we_data["locks"]:
            top3 = ranked_xp_names[:3]
            mvp = top3[0].title() if top3 else "Unknown"
            we_data["locks"]["xp"] = {
                "vanguards": top3,
                "monument": {
                    "title": "🛡️ Hero's Journey",
                    "desc": f"<span style='color:#ffd100; font-weight:bold;'>{mvp}</span> hit the 750th level!",
                    "timestamp": now_iso,
                },
            }
            current_vanguards = top3
        else:
            current_vanguards = rebuild_locked_vanguards(we_data["locks"]["xp"]["vanguards"], ranked_xp_names, active_roster_set)
            we_data["locks"]["xp"]["vanguards"] = current_vanguards
    else:
        we_data["locks"].pop("xp", None)
    return current_vanguards


def update_hk_lock(we_data, ranked_hk_names, hk_threshold_met, active_roster_set, now_iso):
    current_vanguards = []
    if hk_threshold_met:
        if "hk" not in we_data["locks"]:
            top3 = ranked_hk_names[:3]
            mvp = top3[0].title() if top3 else "Unknown"
            we_data["locks"]["hk"] = {
                "vanguards": top3,
                "monument": {
                    "title": "🩸 Blood of the Enemy",
                    "desc": f"<span style='color:#ff4400; font-weight:bold;'>{mvp}</span> led the 1000 HK charge!",
                    "timestamp": now_iso,
                },
            }
            current_vanguards = top3
        else:
            current_vanguards = rebuild_locked_vanguards(we_data["locks"]["hk"]["vanguards"], ranked_hk_names, active_roster_set)
            we_data["locks"]["hk"]["vanguards"] = current_vanguards
    else:
        we_data["locks"].pop("hk", None)
    return current_vanguards


def update_loot_lock(we_data, ranked_loot_names, loot_threshold_met, active_roster_set, now_iso):
    current_vanguards = []
    if loot_threshold_met:
        if "loot" not in we_data["locks"]:
            top3 = ranked_loot_names[:3]
            mvp = top3[0].title() if top3 else "Unknown"
            we_data["locks"]["loot"] = {
                "vanguards": top3,
                "monument": {
                    "title": "🐉 Dragon's Hoard",
                    "desc": f"<span style='color:#a335ee; font-weight:bold;'>{mvp}</span> looted the 60th Epic!",
                    "timestamp": now_iso,
                },
            }
            current_vanguards = top3
        else:
            current_vanguards = rebuild_locked_vanguards(we_data["locks"]["loot"]["vanguards"], ranked_loot_names, active_roster_set)
            we_data["locks"]["loot"]["vanguards"] = current_vanguards
    else:
        we_data["locks"].pop("loot", None)
    return current_vanguards


def update_zenith_lock(we_data, ranked_zenith_names, unique_70s, zenith_threshold_met, active_roster_set, now_iso):
    current_vanguards = []
    if zenith_threshold_met:
        if "zenith" not in we_data["locks"]:
            top3 = ranked_zenith_names[:3]
            tenth_man = unique_70s[9].title() if len(unique_70s) > 9 else "Unknown"
            we_data["locks"]["zenith"] = {
                "vanguards": top3,
                "monument": {
                    "title": "⚡ The Zenith Cohort",
                    "desc": f"<span style='color:#3FC7EB; font-weight:bold;'>{tenth_man}</span> was the 10th Level 70!",
                    "timestamp": now_iso,
                },
            }
            current_vanguards = top3
        else:
            current_vanguards = rebuild_locked_vanguards(we_data["locks"]["zenith"]["vanguards"], ranked_zenith_names, active_roster_set)
            we_data["locks"]["zenith"]["vanguards"] = current_vanguards
    else:
        we_data["locks"].pop("zenith", None)
    return current_vanguards


def build_locked_prev_mvp_map(locked_mvp_rows):
    locked_prev_mvp_map = {}
    if locked_mvp_rows:
        for r in locked_mvp_rows:
            cat = r.get('category') if isinstance(r, dict) else r[0]
            champ = r.get('champion') if isinstance(r, dict) else r[1]
            score = r.get('score') if isinstance(r, dict) else r[2]
            locked_prev_mvp_map[cat] = {"name": champ, "score": score}
    return locked_prev_mvp_map


def apply_locked_prev_mvps(prev_mvps, locked_prev_mvp_map):
    for cat, winner in locked_prev_mvp_map.items():
        if cat in prev_mvps:
            prev_mvps[cat] = winner


def rank_ladder_snapshot_rows(snapshot_rows):
    if not snapshot_rows:
        return [], []

    pve_sorted = sorted(snapshot_rows, key=lambda x: x.get('ilvl', 0), reverse=True)[:3]
    pvp_sorted = sorted(snapshot_rows, key=lambda x: x.get('hks', 0), reverse=True)[:3]
    return pve_sorted, pvp_sorted
