"""
Main entry point for the WoW Classic API Dashboard pipeline.
Database logic upgraded to use Turso's direct REST API, eliminating driver bottlenecks.
"""

import os
import asyncio
import aiohttp
import sys
import json
import urllib.request
import urllib.error
from datetime import datetime, timezone, timedelta
from zoneinfo import ZoneInfo

from wow.auth import get_access_token
from wow.api import fetch_realm_data, fetch_guild_metadata, fetch_static_maps
from wow.character import fetch_character_data, update_character_state
from render.html_dashboard import generate_html_dashboard
from wow.trends import process_character_trends, process_global_trends
from config import REALM, GUILD_NAME

# Map Blizzard's raw integer IDs to strings for the base roster view
CLASS_MAP = {
    1: "Warrior", 2: "Paladin", 3: "Hunter", 4: "Rogue", 5: "Priest", 
    6: "Death Knight", 7: "Shaman", 8: "Mage", 9: "Warlock", 11: "Druid"
}

RACE_MAP = {
    1: "Human", 2: "Orc", 3: "Dwarf", 4: "Night Elf", 5: "Undead", 
    6: "Tauren", 7: "Gnome", 8: "Troll", 10: "Blood Elf", 11: "Draenei"
}

RANK_MAP = {
    0: "Guild Master", 1: "MOST WANTED", 2: "Veteran",
    3: "Member", 4: "Alt", 5: "Wanted"
}

async def fetch_turso(session, query):
    """Fetches data directly from Turso's HTTP API using an async session."""
    url = os.environ.get("TURSO_DATABASE_URL", "").replace("libsql://", "https://")
    token = os.environ.get("TURSO_AUTH_TOKEN", "")
    if not url or not token:
        return []
        
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    payload = {"statements": [query]}
    
    try:
        async with session.post(url, json=payload, headers=headers) as resp:
            data = await resp.json()
            
            # Safely check if the response is a list before accessing index 0
            if isinstance(data, list) and len(data) > 0:
                results = data[0].get("results", {})
            else:
                print(f"⚠️ Unexpected Turso Response: {data}")
                return []
                
            if not results: return []
            cols = results.get("columns", [])
            rows = results.get("rows", [])
            return [dict(zip(cols, row)) for row in rows]
    except Exception as e:
        print(f"❌ Turso Fetch Error: {e}")
        return []

async def push_turso_batch(session, statements):
    """Pushes an array of dicts to Turso in chunked transactions."""
    url = os.environ.get("TURSO_DATABASE_URL", "").replace("libsql://", "https://")
    token = os.environ.get("TURSO_AUTH_TOKEN", "")
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    chunk_size = 1500

    for i in range(0, len(statements), chunk_size):
        chunk = statements[i:i+chunk_size]
        payload = {"statements": [{"q": "BEGIN"}] + chunk + [{"q": "COMMIT"}]}
        
        try:
            async with session.post(url, json=payload, headers=headers) as resp:
                if resp.status >= 400:
                    err_msg = await resp.text()
                    print(f"❌ Turso Batch Push Error ({resp.status}): {err_msg}")
        except Exception as e:
            print(f"❌ Turso Batch Network Error: {e}")
            
async def setup_database(session):
    """Ensures database schema exists via HTTP API."""
    print("📂 Ensuring Turso schema exists...")
    schema_queries = [
        "CREATE TABLE IF NOT EXISTS characters (name TEXT PRIMARY KEY, class TEXT, race TEXT, faction TEXT, guild TEXT, level INTEGER, equipped_item_level INTEGER, xp INTEGER, xp_max INTEGER, health INTEGER, power INTEGER, last_login_ms INTEGER, portrait_url TEXT, active_spec TEXT, honorable_kills INTEGER, power_type TEXT, strength_base INTEGER, strength_effective INTEGER, agility_base INTEGER, agility_effective INTEGER, intellect_base INTEGER, intellect_effective INTEGER, stamina_base INTEGER, stamina_effective INTEGER, melee_crit_value REAL, melee_haste_value REAL, attack_power INTEGER, main_hand_min REAL, main_hand_max REAL, main_hand_speed REAL, main_hand_dps REAL, off_hand_min REAL, off_hand_max REAL, off_hand_speed REAL, off_hand_dps REAL, spell_power INTEGER, spell_penetration INTEGER, spell_crit_value REAL, mana_regen REAL, mana_regen_combat REAL, armor_base INTEGER, armor_effective INTEGER, dodge REAL, parry REAL, block REAL, ranged_crit REAL, ranged_haste REAL, spell_haste REAL, spirit_base INTEGER, spirit_effective INTEGER, defense_base INTEGER, defense_effective INTEGER, vanguard_badges TEXT, campaign_badges TEXT, pve_champ_count INTEGER, pvp_champ_count INTEGER)",
        "CREATE TABLE IF NOT EXISTS gear (character_name TEXT, slot TEXT, item_id INTEGER, name TEXT, quality TEXT, icon_data TEXT, tooltip_params TEXT, last_detected TIMESTAMP DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (character_name, slot, item_id))",
        "CREATE TABLE IF NOT EXISTS timeline (timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP, character_name TEXT, class TEXT, type TEXT, item_id INTEGER, item_name TEXT, item_quality TEXT, item_icon TEXT, level INTEGER)",
        "CREATE INDEX IF NOT EXISTS idx_timeline_timestamp ON timeline (timestamp DESC)",
        "CREATE TABLE IF NOT EXISTS global_trends (id TEXT PRIMARY KEY, last_total INTEGER, trend_total INTEGER, last_active INTEGER, trend_active INTEGER, last_ready INTEGER, trend_ready INTEGER)",
        "CREATE TABLE IF NOT EXISTS daily_roster_stats (date TEXT PRIMARY KEY, total_roster INTEGER DEFAULT 0, active_roster INTEGER DEFAULT 0, avg_ilvl_70 INTEGER DEFAULT 0, total_hks INTEGER DEFAULT 0)",
        "CREATE TABLE IF NOT EXISTS char_history (char_name TEXT, record_date TEXT, ilvl INTEGER, hks INTEGER, PRIMARY KEY (char_name, record_date))",
        "CREATE TABLE IF NOT EXISTS ladder_history (week_anchor TEXT, category TEXT, rank INTEGER, champion TEXT, score INTEGER, PRIMARY KEY (week_anchor, category, rank))"
    ]
    await push_turso_batch(session, [{"q": q} for q in schema_queries])

async def fetch_with_semaphore(sem, session, token, char, history_data):
    """Bouncer function throttling dynamic API requests to respect rate limits."""
    max_retries = 3
    for attempt in range(max_retries):
        try:
            async with sem:
                await asyncio.sleep(0.1) # Micro-stagger to prevent millisecond spikes
                # Tell Pylance to ignore the missing async signature from the external file
                return await fetch_character_data(session, token, char, history_data) # type: ignore
        except Exception as e:
            print(f"⚠️ Failed to fetch {char} (Attempt {attempt + 1}/{max_retries}): {e}")
            if attempt < max_retries - 1:
                await asyncio.sleep(5)
            else:
                return None
            
async def main_async():
    print("\n🔑 Authenticating with Blizzard API...")
    token = await get_access_token()
    if not token:
        print("❌ Failed to authenticate with Blizzard.")
        return
    print("✅ Authentication successful!\n")

    print("🚀 Opening Async HTTP Session...\n")
    # Increase TCP connection pool to prevent local queuing bottlenecks
    connector = aiohttp.TCPConnector(limit=200)
    async with aiohttp.ClientSession(connector=connector) as session:
        
        await setup_database(session)

        print("📂 Fetching historical state into memory concurrently...")
        
        berlin_tz = ZoneInfo("Europe/Berlin")
        
        today = datetime.now(berlin_tz)
        today_str = today.strftime("%Y-%m-%d")
        
        # Calculate the baseline: the Monday immediately preceding the most recent Tuesday
        days_since_tuesday = (today.weekday() - 1) % 7
        last_tuesday = today - timedelta(days=days_since_tuesday)
        anchor_monday_str = (last_tuesday - timedelta(days=1)).strftime("%Y-%m-%d")
        prev_anchor_monday_str = (last_tuesday - timedelta(days=8)).strftime("%Y-%m-%d")
        
        trend_query = f"""
            SELECT char_name, ilvl, hks 
            FROM (
                SELECT char_name, ilvl, hks, 
                       ROW_NUMBER() OVER(PARTITION BY char_name ORDER BY record_date ASC) as rn
                FROM char_history
                WHERE record_date >= '{anchor_monday_str}' AND record_date < '{today_str}'
            ) WHERE rn = 1
        """

        prev_mvp_query = f"""
            SELECT s.char_name, 
                   (e.ilvl - s.ilvl) as prev_trend_ilvl, 
                   (e.hks - s.hks) as prev_trend_hks
            FROM (
                SELECT char_name, ilvl, hks 
                FROM (
                    SELECT char_name, ilvl, hks, 
                           ROW_NUMBER() OVER(PARTITION BY char_name ORDER BY record_date ASC) as rn
                    FROM char_history
                    WHERE record_date >= '{prev_anchor_monday_str}' AND record_date <= '{anchor_monday_str}'
                ) WHERE rn = 1
            ) s
            JOIN (
                SELECT char_name, ilvl, hks 
                FROM (
                    SELECT char_name, ilvl, hks, 
                           ROW_NUMBER() OVER(PARTITION BY char_name ORDER BY record_date DESC) as rn
                    FROM char_history
                    WHERE record_date <= '{anchor_monday_str}'
                ) WHERE rn = 1
            ) e ON s.char_name = e.char_name
        """

        # Fire all 6 Turso queries simultaneously
        char_task = fetch_turso(session, "SELECT * FROM characters")
        gear_task = fetch_turso(session, "SELECT character_name, slot, item_id, name, quality, icon_data, tooltip_params FROM gear")
        trend_task = fetch_turso(session, trend_query)
        gt_task = fetch_turso(session, "SELECT * FROM global_trends WHERE id='__GLOBAL__'")
        timeline_task = fetch_turso(session, "SELECT character_name, type, level, item_id FROM timeline")
        prev_mvp_task = fetch_turso(session, prev_mvp_query)

        char_rows, gear_rows, trend_rows, gt_rows, timeline_rows, prev_mvp_rows = await asyncio.gather(
            char_task, gear_task, trend_task, gt_task, timeline_task, prev_mvp_task
        )

        top_prev_pve = None
        top_prev_pvp = None
        max_prev_ilvl = 0
        max_prev_hks = 0
        
        for row in prev_mvp_rows:
            if row.get('prev_trend_ilvl', 0) > max_prev_ilvl:
                max_prev_ilvl = row['prev_trend_ilvl']
                top_prev_pve = row['char_name']
            if row.get('prev_trend_hks', 0) > max_prev_hks:
                max_prev_hks = row['prev_trend_hks']
                top_prev_pvp = row['char_name']
                
        prev_mvps = {
            "pve": {"name": top_prev_pve, "score": max_prev_ilvl} if top_prev_pve else None,
            "pvp": {"name": top_prev_pvp, "score": max_prev_hks} if top_prev_pvp else None
        }

        history_data = {}
        for row in char_rows:
            history_data[row['name']] = dict(row)
            
        for row in gear_rows:
            char_n = row['character_name']
            if char_n not in history_data: history_data[char_n] = {}
            history_data[char_n][row['slot']] = {
                'item_id': row['item_id'], 'name': row['name'], 'quality': row['quality'], 
                'icon_data': row['icon_data'], 'tooltip_params': row['tooltip_params']
            }

        past_char_records = {row['char_name']: row for row in trend_rows}
        global_trend_record = gt_rows[0] if gt_rows else None
        
        known_timeline = set()
        for row in timeline_rows:
            char_key = str(row.get('character_name', '')).lower()
            if row['type'] == 'level_up': known_timeline.add(f"{char_key}_level_{row['level']}")
            else: known_timeline.add(f"{char_key}_item_{row['item_id']}")

        timeline_data_new = []
        roster_data = []

        class_map, race_map = await fetch_static_maps(session, token)
        realm_data = await fetch_realm_data(session, token, REALM)

        slug = GUILD_NAME.lower().replace(" ", "-").replace("'", "")
        rank_map_api = await fetch_guild_metadata(session, token, REALM, slug)

        print(f"📜 Fetching guild roster for <{GUILD_NAME}>...")
        url = f"https://eu.api.blizzard.com/data/wow/guild/{REALM}/{slug}/roster?namespace=profile-classicann-eu&locale=en_US"
        headers = {"Authorization": f"Bearer {token}"}
        
        roster_names, raw_guild_roster, char_ranks = [], [], {}
        
        max_retries = 3
        for attempt in range(max_retries):
            try:
                async with session.get(url, headers=headers) as resp:
                    if resp.status == 200:
                        all_m = (await resp.json()).get('members', [])
                        for m in all_m:
                            c = m.get('character', {})
                            c_name, c_level = c.get('name', 'Unknown'), c.get('level', 0)
                            
                            c_class = class_map.get(c.get('playable_class', {}).get('id'), "Unknown")
                            c_race = race_map.get(c.get('playable_race', {}).get('id'), "Unknown")
                            
                            rank_name = RANK_MAP.get(m.get('rank', 5), f"Rank {m.get('rank', 5)}")
                            char_ranks[c_name.lower()] = rank_name
                            
                            raw_guild_roster.append({
                                "name": c_name.title(), "level": c_level,
                                "class": c_class, "race": c_race, "rank": rank_name
                            })
                            if c_level > 10: roster_names.append(c_name.lower())
                        break 
                    else: resp.raise_for_status()
            except Exception as e:
                print(f"⚠️ Roster fetch failed: {e}")
                if attempt < max_retries - 1: await asyncio.sleep(5)

        print(f"👥 Guild: {len(raw_guild_roster)} Total Members. Processing {len(roster_names)} valid characters.")

        sem = asyncio.Semaphore(5)
        tasks = [fetch_with_semaphore(sem, session, token, char, history_data) for char in roster_names]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        char_history_inserts = []
        for result in results:
            if isinstance(result, dict) and result:
                try:
                    past_record = past_char_records.get(result['char'].lower())
                    result, new_hist_row = process_character_trends(result, char_ranks, past_record)
                    if new_hist_row: char_history_inserts.append(new_hist_row)
                        
                    history_data, timeline_data_new = update_character_state(result, history_data, timeline_data_new)
                    roster_data.append(result)
                except Exception as e:
                    continue

        realm_data, new_gt_row, new_daily_stats_row = process_global_trends(roster_data, raw_guild_roster, realm_data, global_trend_record)

        print("\n===========================================")
        print("💾 Phase 1: Pushing Gear, Timeline, and History to Turso...")
        batch_stmts_initial = []

        # Only write gear if it is explicitly marked as new or changed
        for char_name, data in history_data.items():
            for slot, item in data.items():
                if isinstance(item, dict) and 'item_id' in item and item.get('is_new'):
                    batch_stmts_initial.append({
                        "q": "INSERT OR REPLACE INTO gear (character_name, slot, item_id, name, quality, icon_data, tooltip_params) VALUES (?, ?, ?, ?, ?, ?, ?)",
                        "params": [char_name, slot, item.get('item_id'), item.get('name'), item.get('quality'), item.get('icon_data'), item.get('tooltip_params')]
                    })

        for ev in timeline_data_new:
            char_name = ev.get('character')
            char_key = str(char_name).lower()
            if ev.get('type') == 'level_up':
                level = ev.get('level')
                if f"{char_key}_level_{level}" not in known_timeline:
                    batch_stmts_initial.append({
                        "q": "INSERT INTO timeline (timestamp, character_name, class, type, level) VALUES (?, ?, ?, ?, ?)",
                        "params": [ev.get('timestamp'), char_name, ev.get('class'), 'level_up', level]
                    })
                    known_timeline.add(f"{char_key}_level_{level}")
            else:
                it = ev.get('item', {})
                item_id = it.get('item_id')
                if f"{char_key}_item_{item_id}" not in known_timeline:
                    batch_stmts_initial.append({
                        "q": "INSERT INTO timeline (timestamp, character_name, class, type, item_id, item_name, item_quality, item_icon) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                        "params": [ev.get('timestamp'), char_name, ev.get('class'), 'item', item_id, it.get('name'), it.get('quality'), it.get('icon_data')]
                    })
                    known_timeline.add(f"{char_key}_item_{item_id}")

        for row in char_history_inserts:
            batch_stmts_initial.append({
                "q": """
                    INSERT INTO char_history (char_name, record_date, ilvl, hks) 
                    VALUES (?, ?, ?, ?) 
                    ON CONFLICT(char_name, record_date) 
                    DO UPDATE SET ilvl=excluded.ilvl, hks=excluded.hks 
                    WHERE char_history.ilvl != excluded.ilvl OR char_history.hks != excluded.hks
                """,
                "params": list(row)
            })

        batch_stmts_initial.append({
            "q": "INSERT OR REPLACE INTO global_trends (id, last_total, trend_total, last_active, trend_active, last_ready, trend_ready) VALUES (?, ?, ?, ?, ?, ?, ?)",
            "params": list(new_gt_row)
        })

        batch_stmts_initial.append({
            "q": "INSERT OR REPLACE INTO daily_roster_stats (date, total_roster, active_roster, avg_ilvl_70, total_hks) VALUES (?, ?, ?, ?, ?)",
            "params": list(new_daily_stats_row)
        })

        # Automatically delete characters and gear for players who left the guild
        if roster_names:
            departed_chars = [char for char in history_data.keys() if char not in roster_names]
            if departed_chars:
                formatted_names = [name.title() for name in departed_chars]
                print(f"🧹 Removing {len(departed_chars)} departed guild member(s): {', '.join(formatted_names)}")

            placeholders = ",".join(["?"] * len(roster_names))
            batch_stmts_initial.append({
                "q": f"DELETE FROM characters WHERE name NOT IN ({placeholders})",
                "params": roster_names
            })
            batch_stmts_initial.append({
                "q": f"DELETE FROM gear WHERE character_name NOT IN ({placeholders})",
                "params": roster_names
            })

        if batch_stmts_initial:
            await push_turso_batch(session, batch_stmts_initial)


        print("🌐 Fetching updated timeline for War Efforts...")
        dashboard_feed = await fetch_turso(session, "SELECT * FROM timeline ORDER BY timestamp DESC LIMIT 5000")

        # --- DECOUPLED WAR EFFORT TIME-LOCKING & TURSO HISTORY LOGIC ---
        we_file = "asset/war_effort.json"
        
        now_berlin = datetime.now(berlin_tz)
        days_since_tuesday = (now_berlin.weekday() - 1) % 7
        last_reset_berlin = now_berlin - timedelta(days=days_since_tuesday)
        last_reset_berlin = last_reset_berlin.replace(hour=0, minute=0, second=0, microsecond=0)
        last_reset_iso = last_reset_berlin.astimezone(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
        week_anchor = last_reset_berlin.strftime("%Y-%m-%d")
        
        we_data = {"week_anchor": week_anchor, "locks": {}}
        if os.path.exists(we_file):
            try:
                with open(we_file, "r", encoding="utf-8") as f:
                    old_we = json.load(f)
                    if old_we.get("week_anchor") == we_data["week_anchor"]:
                        we_data["locks"] = old_we.get("locks", {})
            except Exception:
                pass

        # Ensure the history tables exist in Turso
        try:
            await fetch_turso(session, "CREATE TABLE IF NOT EXISTS war_effort_history (week_anchor TEXT, category TEXT, vanguards TEXT, participants TEXT, PRIMARY KEY(week_anchor, category))")
            await fetch_turso(session, "CREATE TABLE IF NOT EXISTS reigning_champs_history (week_anchor TEXT, category TEXT, champion TEXT, score INTEGER, PRIMARY KEY(week_anchor, category))")
        except Exception: pass

        # THE "DIFF CHECKER" TO PREVENT WRITE BLEED
        db_we_state, db_mvp_state = {}, {}
        try:
            we_rows = await fetch_turso(session, f"SELECT category, vanguards, participants FROM war_effort_history WHERE week_anchor='{week_anchor}'")
            if we_rows:
                for r in we_rows:
                    cat = r.get('category') if isinstance(r, dict) else r[0]
                    v = r.get('vanguards') if isinstance(r, dict) else r[1]
                    p = r.get('participants') if isinstance(r, dict) else r[2]
                    db_we_state[cat] = {'vanguards': v, 'participants': p}
                    
            mvp_rows = await fetch_turso(session, f"SELECT category, champion, score FROM reigning_champs_history WHERE week_anchor='{week_anchor}'")
            if mvp_rows:
                for r in mvp_rows:
                    cat = r.get('category') if isinstance(r, dict) else r[0]
                    champ = r.get('champion') if isinstance(r, dict) else r[1]
                    score = r.get('score') if isinstance(r, dict) else r[2]
                    db_mvp_state[cat] = {'champion': champ, 'score': score}
        except Exception: pass

        async def smart_update_we(category, vanguards_list, participants_list):
            v_json, p_json = json.dumps(vanguards_list), json.dumps(participants_list)
            old = db_we_state.get(category, {})
            if old.get('vanguards') != v_json or old.get('participants') != p_json:
                safe_v, safe_p = v_json.replace("'", "''"), p_json.replace("'", "''")
                try: await fetch_turso(session, f"INSERT OR REPLACE INTO war_effort_history (week_anchor, category, vanguards, participants) VALUES ('{week_anchor}', '{category}', '{safe_v}', '{safe_p}')")
                except Exception: pass

        async def smart_update_mvp(category, champ, score):
            old = db_mvp_state.get(category, {})
            if old.get('champion') != champ or old.get('score') != score:
                try: await fetch_turso(session, f"INSERT OR REPLACE INTO reigning_champs_history (week_anchor, category, champion, score) VALUES ('{week_anchor}', '{category}', '{champ}', {score})")
                except Exception: pass

        # 1. XP Logic
        xp_events = [e for e in dashboard_feed if e.get('type') == 'level_up' and str(e.get('timestamp', '')).replace('T', ' ') >= last_reset_iso]
        xp_counts = {}
        for e in xp_events: 
            c_name = e.get('character_name')
            if c_name: xp_counts[c_name.lower()] = xp_counts.get(c_name.lower(), 0) + 1

        current_vanguards = []
        if "xp" not in we_data["locks"]:
            if len(xp_events) >= 750:
                top3 = [k for k, v in sorted(xp_counts.items(), key=lambda item: item[1], reverse=True)[:3]]
                mvp = top3[0].title() if top3 else "Unknown"
                we_data["locks"]["xp"] = {"vanguards": top3, "monument": {"title": "🛡️ Hero's Journey", "desc": f"<span style='color:#ffd100; font-weight:bold;'>{mvp}</span> hit the 750th level!", "timestamp": now_berlin.isoformat()}}
                current_vanguards = top3
        else:
            current_vanguards = we_data["locks"]["xp"]["vanguards"]

        if current_vanguards or len(xp_counts) > 0:
            await smart_update_we('xp', current_vanguards, list(xp_counts.keys()))

        # 2. HK Logic
        hk_counts = {}
        total_hks = 0
        for r in roster_data:
            if not r or not r.get("profile"): continue
            prof = r["profile"]
            trend = prof.get("trend_pvp") or prof.get("trend_hks") or 0
            if trend > 0:
                total_hks += trend
                hk_counts[prof.get("name", "Unknown").lower()] = trend

        current_vanguards = []
        if "hk" not in we_data["locks"]:
            if total_hks >= 500:
                top3 = [k for k, v in sorted(hk_counts.items(), key=lambda item: item[1], reverse=True)[:3]]
                mvp = top3[0].title() if top3 else "Unknown"
                we_data["locks"]["hk"] = {"vanguards": top3, "monument": {"title": "🩸 Blood of the Enemy", "desc": f"<span style='color:#ff4400; font-weight:bold;'>{mvp}</span> led the 500 HK charge!", "timestamp": now_berlin.isoformat()}}
                current_vanguards = top3
        else:
            current_vanguards = we_data["locks"]["hk"]["vanguards"]

        if current_vanguards or len(hk_counts) > 0:
            await smart_update_we('hk', current_vanguards, list(hk_counts.keys()))

        # 3. Loot Logic
        loot_events = [e for e in dashboard_feed if e.get('type') == 'item' and e.get('item_quality') in ('EPIC', 'LEGENDARY') and str(e.get('timestamp', '')).replace('T', ' ') >= last_reset_iso]
        loot_counts = {}
        for e in loot_events: 
            c_name = e.get('character_name')
            if c_name: loot_counts[c_name.lower()] = loot_counts.get(c_name.lower(), 0) + 1
            
        current_vanguards = []
        if "loot" not in we_data["locks"]:
            if len(loot_events) >= 100:
                top3 = [k for k, v in sorted(loot_counts.items(), key=lambda item: item[1], reverse=True)[:3]]
                mvp = top3[0].title() if top3 else "Unknown"
                we_data["locks"]["loot"] = {"vanguards": top3, "monument": {"title": "🐉 Dragon's Hoard", "desc": f"<span style='color:#a335ee; font-weight:bold;'>{mvp}</span> looted the 100th Epic!", "timestamp": now_berlin.isoformat()}}
                current_vanguards = top3
        else:
            current_vanguards = we_data["locks"]["loot"]["vanguards"]

        if current_vanguards or len(loot_counts) > 0:
            await smart_update_we('loot', current_vanguards, list(loot_counts.keys()))

        # 4. Zenith Logic
        zenith_events = [e for e in dashboard_feed if e.get('type') == 'level_up' and e.get('level') == 70 and str(e.get('timestamp', '')).replace('T', ' ') >= last_reset_iso]
        zenith_events_sorted = sorted(zenith_events, key=lambda x: str(x.get('timestamp', '')))
        unique_70s = []
        for e in zenith_events_sorted:
            c_name = e.get('character_name')
            if c_name and c_name.lower() not in unique_70s:
                unique_70s.append(c_name.lower())

        current_vanguards = []
        if "zenith" not in we_data["locks"]:
            if len(unique_70s) >= 10:
                top3 = unique_70s[:3]
                tenth_man = unique_70s[9].title() if len(unique_70s) > 9 else "Unknown"
                we_data["locks"]["zenith"] = {"vanguards": top3, "monument": {"title": "⚡ The Zenith Cohort", "desc": f"<span style='color:#3FC7EB; font-weight:bold;'>{tenth_man}</span> was the 10th Level 70!", "timestamp": now_berlin.isoformat()}}
                current_vanguards = top3
        else:
            current_vanguards = we_data["locks"]["zenith"]["vanguards"]

        if current_vanguards or len(unique_70s) > 0:
            await smart_update_we('zenith', current_vanguards, unique_70s)

        # 5. MVP Reigning Champs Logic (Save CONFIRMED winners from last week)
        # We must NOT save the current week's leader until the week is actually over!
        prev_week_anchor = (last_reset_berlin - timedelta(days=7)).strftime("%Y-%m-%d")

        try:
            # FIX: Clean up the database by deleting any premature entries for the ongoing week
            await fetch_turso(session, f"DELETE FROM reigning_champs_history WHERE week_anchor = '{week_anchor}'")
        except Exception:
            pass

        async def smart_update_prev_mvp(category, champ, score):
            try: 
                await fetch_turso(session, f"INSERT OR REPLACE INTO reigning_champs_history (week_anchor, category, champion, score) VALUES ('{prev_week_anchor}', '{category}', '{champ}', {score})")
            except Exception: 
                pass

        # Extract to variables first to satisfy Pylance type-checking
        pve_winner = prev_mvps.get("pve")
        pvp_winner = prev_mvps.get("pvp")

        if pve_winner: 
            await smart_update_prev_mvp('pve', pve_winner["name"], pve_winner["score"])
            
        if pvp_winner: 
            await smart_update_prev_mvp('pvp', pvp_winner["name"], pvp_winner["score"])
        
        # 6. LADDER CHAMPS LOGIC (Gold, Silver, Bronze snapshots from previous week)
        try:
            await fetch_turso(session, f"DELETE FROM ladder_history WHERE week_anchor = '{week_anchor}'")
        except Exception: pass

        async def smart_update_ladder_history(category, rank, champ, score):
            try:
                await fetch_turso(session, f"INSERT OR REPLACE INTO ladder_history (week_anchor, category, rank, champion, score) VALUES ('{prev_week_anchor}', '{category}', {rank}, '{champ}', {score})")
            except Exception: pass

        ladder_snapshot_query = f"""
            SELECT char_name, ilvl, hks 
            FROM (
                SELECT char_name, ilvl, hks, 
                       ROW_NUMBER() OVER(PARTITION BY char_name ORDER BY record_date DESC) as rn
                FROM char_history
                WHERE record_date <= '{anchor_monday_str}'
            ) WHERE rn = 1
        """
        snapshot_rows = await fetch_turso(session, ladder_snapshot_query)
        if snapshot_rows:
            pve_sorted = sorted(snapshot_rows, key=lambda x: x.get('ilvl', 0), reverse=True)
            for i, row in enumerate(pve_sorted[:3]):
                await smart_update_ladder_history('pve', i+1, row['char_name'], row['ilvl'])
                
            pvp_sorted = sorted(snapshot_rows, key=lambda x: x.get('hks', 0), reverse=True)
            for i, row in enumerate(pvp_sorted[:3]):
                await smart_update_ladder_history('pvp', i+1, row['char_name'], row['hks'])

        # Save JSON Lockfile
        with open(we_file, "w", encoding="utf-8") as f:
            json.dump(we_data, f, ensure_ascii=False)


        # --- AGGREGATE HISTORICAL BADGES FROM TURSO ---
        print("🏅 Calculating Cumulative War Effort, MVP, and Ladder Badges...")
        try:
            historical_data = await fetch_turso(session, "SELECT week_anchor, category, vanguards, participants FROM war_effort_history")
            vanguard_tallies, campaign_tallies = {}, {}
            badge_events = [] 
            cat_map = {"xp": "XP", "hk": "HKs", "loot": "Loot", "zenith": "Zenith"}

            if historical_data:
                for row in historical_data:
                    # Safely extract and cast to prevent NoneType crashes
                    week_anchor = str(row.get('week_anchor', '') if isinstance(row, dict) else row[0] or '')
                    cat = str(row.get('category', '') if isinstance(row, dict) else row[1] or '')
                    v_json = row.get('vanguards', '[]') if isinstance(row, dict) else row[2]
                    p_json = row.get('participants', '[]') if isinstance(row, dict) else row[3]
                    
                    if not week_anchor: continue
                    label = cat_map.get(cat.lower(), cat.title())
                    timestamp = f"{week_anchor}T12:00:00Z"

                    try:
                        for v in json.loads(v_json or '[]'):
                            v_lower = str(v).lower()
                            if v_lower not in vanguard_tallies: vanguard_tallies[v_lower] = []
                            vanguard_tallies[v_lower].append(label)
                            badge_events.append({"timestamp": timestamp, "character_name": str(v).title(), "type": "badge", "badge_type": "vanguard", "category": label})
                    except: pass
                    try:
                        for p in json.loads(p_json or '[]'):
                            p_lower = str(p).lower()
                            if p_lower not in campaign_tallies: campaign_tallies[p_lower] = []
                            campaign_tallies[p_lower].append(label)
                            badge_events.append({"timestamp": timestamp, "character_name": str(p).title(), "type": "badge", "badge_type": "campaign", "category": label})
                    except: pass

            mvp_data = await fetch_turso(session, "SELECT week_anchor, champion, category FROM reigning_champs_history")
            pve_champs, pvp_champs = {}, {}
            if mvp_data:
                for row in mvp_data:
                    week_anchor = str(row.get('week_anchor', '') if isinstance(row, dict) else row[0] or '')
                    champ = str(row.get('champion', '') if isinstance(row, dict) else row[1] or '').lower()
                    cat = str(row.get('category', '') if isinstance(row, dict) else row[2] or '').lower()
                    
                    if not champ or not week_anchor: continue
                    timestamp = f"{week_anchor}T12:00:00Z"

                    if cat == 'pve': 
                        pve_champs[champ] = pve_champs.get(champ, 0) + 1
                        badge_events.append({"timestamp": timestamp, "character_name": champ.title(), "type": "badge", "badge_type": "mvp_pve", "category": "PvE Weekly Trend"})
                    if cat == 'pvp': 
                        pvp_champs[champ] = pvp_champs.get(champ, 0) + 1
                        badge_events.append({"timestamp": timestamp, "character_name": champ.title(), "type": "badge", "badge_type": "mvp_pvp", "category": "PvP Weekly Trend"})

            # --- NEW: LADDER MEDALS ---
            ladder_data = await fetch_turso(session, "SELECT week_anchor, category, rank, champion FROM ladder_history")
            ladder_medals = {} 
            if ladder_data:
                for row in ladder_data:
                    w_anchor = str(row.get('week_anchor', '') if isinstance(row, dict) else row[0] or '')
                    cat = str(row.get('category', '') if isinstance(row, dict) else row[1] or '').lower()
                    
                    # Safely convert rank to integer
                    raw_rank = row.get('rank', 0) if isinstance(row, dict) else row[2]
                    try: rank = int(raw_rank)
                    except: rank = 0
                        
                    champ = str(row.get('champion', '') if isinstance(row, dict) else row[3] or '').lower()
                    
                    if not champ or not w_anchor: continue
                    timestamp = f"{w_anchor}T12:00:00Z"
                    
                    if champ not in ladder_medals:
                        ladder_medals[champ] = {'pve_gold': 0, 'pve_silver': 0, 'pve_bronze': 0, 'pvp_gold': 0, 'pvp_silver': 0, 'pvp_bronze': 0}
                    
                    medal_type = 'gold' if rank == 1 else 'silver' if rank == 2 else 'bronze'
                    if rank > 3 or rank < 1: continue
                        
                    medal_key = f"{cat}_{medal_type}"
                    if medal_key in ladder_medals[champ]:
                        ladder_medals[champ][medal_key] += 1
                    
                    cat_name = "PvE Leaderboard" if cat == 'pve' else "PvP Leaderboard"
                    badge_events.append({
                        "timestamp": timestamp, "character_name": champ.title(), "type": "badge", "badge_type": medal_key, "category": cat_name
                    })

            # ASSIGN EVERYTHING TO ROSTER
            for r in roster_data:
                if not r or not r.get("profile"): continue
                c_name = r["profile"].get("name", "").lower()
                
                v_badges = vanguard_tallies.get(c_name, [])
                c_badges = campaign_tallies.get(c_name, [])
                pve_count = pve_champs.get(c_name, 0)
                pvp_count = pvp_champs.get(c_name, 0)
                medals = ladder_medals.get(c_name, {'pve_gold': 0, 'pve_silver': 0, 'pve_bronze': 0, 'pvp_gold': 0, 'pvp_silver': 0, 'pvp_bronze': 0})

                r["profile"]["vanguard_badges"] = v_badges
                r["profile"]["campaign_badges"] = c_badges
                r["profile"]["pve_champ_count"] = pve_count
                r["profile"]["pvp_champ_count"] = pvp_count
                for k, v in medals.items():
                    r["profile"][k] = v
                    r[k] = v # Failsafe
                
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
                
        except Exception as e:
            print(f"⚠️ Failed to aggregate badges from Turso: {e}")

        print("\n===========================================")
        print("💾 Phase 2: Pushing Character Profiles (with Badges) to Turso...")
        batch_stmts_chars = []
        
        # Lowercase the lookup keys to prevent mismatch
        orig_chars = {r['name'].lower(): r for r in char_rows}

        for char_name, data in history_data.items():
            safe_name = char_name.lower()
            orig = orig_chars.get(safe_name, {})
            
            # 1. Grab badges DIRECTLY from the tallies (Bypass case sensitivity issues)
            v_badges = vanguard_tallies.get(safe_name, [])
            c_badges = campaign_tallies.get(safe_name, [])
            pve_count = pve_champs.get(safe_name, 0)
            pvp_count = pvp_champs.get(safe_name, 0)
            
            v_badges_json = json.dumps(v_badges)
            c_badges_json = json.dumps(c_badges)
            
            # Safely handle JSON strings from Turso
            orig_v_badges = str(orig.get('vanguard_badges') or '[]')
            orig_c_badges = str(orig.get('campaign_badges') or '[]')
            
            # Check for changes, forcing an update if the badges don't match exactly!
            if (orig.get('equipped_item_level') != data.get('equipped_item_level') or 
                orig.get('level') != data.get('level') or
                orig.get('last_login_ms') != data.get('last_login_ms') or 
                orig.get('honorable_kills') != data.get('honorable_kills') or
                orig.get('active_spec') != data.get('active_spec') or
                orig_v_badges != v_badges_json or
                orig_c_badges != c_badges_json or
                orig.get('pve_champ_count') != pve_count or
                orig.get('pvp_champ_count') != pvp_count or
                not orig):
                
                batch_stmts_chars.append({
                    "q": """
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
                    """,
                    "params": [
                        char_name, data.get('level', 0), data.get('class'), data.get('race'), data.get('faction'),
                        data.get('equipped_item_level'), data.get('last_login_ms'), data.get('portrait_url'),
                        data.get('active_spec'), data.get('honorable_kills'),
                        
                        data.get('health'), data.get('power'), data.get('power_type'),
                        data.get('strength_base'), data.get('strength_effective'),
                        data.get('agility_base'), data.get('agility_effective'),
                        data.get('intellect_base'), data.get('intellect_effective'),
                        data.get('stamina_base'), data.get('stamina_effective'),
                        data.get('melee_crit_value'), data.get('melee_haste_value'),
                        data.get('attack_power'),
                        data.get('main_hand_min'), data.get('main_hand_max'), data.get('main_hand_speed'), data.get('main_hand_dps'),
                        data.get('off_hand_min'), data.get('off_hand_max'), data.get('off_hand_speed'), data.get('off_hand_dps'),
                        data.get('spell_power'), data.get('spell_penetration'), data.get('spell_crit_value'),
                        data.get('mana_regen'), data.get('mana_regen_combat'),
                        data.get('armor_base'), data.get('armor_effective'),
                        data.get('dodge'), data.get('parry'), data.get('block'),
                        data.get('ranged_crit'), data.get('ranged_haste'), data.get('spell_haste'),
                        data.get('spirit_base'), data.get('spirit_effective'),
                        data.get('defense_base'), data.get('defense_effective'),
                        
                        v_badges_json, c_badges_json,
                        pve_count, pvp_count
                    ]
                })

        if batch_stmts_chars:
            await push_turso_batch(session, batch_stmts_chars)
        print("✅ Final push to Turso complete!")

        # --- NEW: INJECT BADGES INTO TIMELINE ---
        orig_chars = {r['name'].lower(): r for r in char_rows}
        for ev in badge_events:
            c_name_lower = ev["character_name"].lower()
            ev["class"] = orig_chars.get(c_name_lower, {}).get("class", "Unknown")
        
        dashboard_feed.extend(badge_events)
        dashboard_feed.sort(key=lambda x: x.get('timestamp', ''), reverse=True)

        with open("asset/timeline.json", "w", encoding="utf-8") as f:
            json.dump(dashboard_feed, f, ensure_ascii=False)
            
        roster_history = {row['date']: row for row in await fetch_turso(session, "SELECT * FROM daily_roster_stats ORDER BY date DESC LIMIT 7")}

        # Pass the full dashboard_feed back in so the heatmap math can run!
        generate_html_dashboard(roster_data, realm_data, dashboard_feed, raw_guild_roster, roster_history, prev_mvps)
        print("🎉 ALL DONE! The pipeline ran successfully.")

def main():
    if sys.platform == 'win32':
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(main_async())

if __name__ == "__main__":
    main()