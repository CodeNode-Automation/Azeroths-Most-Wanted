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
        "CREATE TABLE IF NOT EXISTS characters (name TEXT PRIMARY KEY, class TEXT, race TEXT, faction TEXT, guild TEXT, level INTEGER, equipped_item_level INTEGER, xp INTEGER, xp_max INTEGER, health INTEGER, power INTEGER, last_login_ms INTEGER, portrait_url TEXT)",
        "CREATE TABLE IF NOT EXISTS gear (character_name TEXT, slot TEXT, item_id INTEGER, name TEXT, quality TEXT, icon_data TEXT, tooltip_params TEXT, last_detected TIMESTAMP DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (character_name, slot, item_id))",
        "CREATE TABLE IF NOT EXISTS timeline (timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP, character_name TEXT, class TEXT, type TEXT, item_id INTEGER, item_name TEXT, item_quality TEXT, item_icon TEXT, level INTEGER)",
        "CREATE INDEX IF NOT EXISTS idx_timeline_timestamp ON timeline (timestamp DESC)",
        "CREATE TABLE IF NOT EXISTS daily_snapshot (id TEXT PRIMARY KEY, snapshot_date TEXT, val1 INTEGER, val2 INTEGER, val3 INTEGER)",
        "CREATE TABLE IF NOT EXISTS character_trends (char_name TEXT PRIMARY KEY, last_ilvl INTEGER, trend_ilvl INTEGER, last_hks INTEGER, trend_hks INTEGER)",
        "CREATE TABLE IF NOT EXISTS global_trends (id TEXT PRIMARY KEY, last_total INTEGER, trend_total INTEGER, last_active INTEGER, trend_active INTEGER, last_ready INTEGER, trend_ready INTEGER)",
        "CREATE TABLE IF NOT EXISTS daily_roster_stats (date TEXT PRIMARY KEY, total_roster INTEGER DEFAULT 0, active_roster INTEGER DEFAULT 0)",
        "CREATE TABLE IF NOT EXISTS char_history (char_name TEXT, record_date TEXT, ilvl INTEGER, hks INTEGER, PRIMARY KEY (char_name, record_date))"
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
        
        today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        seven_days_ago_str = (datetime.now(timezone.utc) - timedelta(days=7)).strftime("%Y-%m-%d")
        
        trend_query = f"""
            SELECT char_name, ilvl, hks 
            FROM (
                SELECT char_name, ilvl, hks, 
                       ROW_NUMBER() OVER(PARTITION BY char_name ORDER BY record_date ASC) as rn
                FROM char_history
                WHERE record_date >= '{seven_days_ago_str}' AND record_date < '{today_str}'
            ) WHERE rn = 1
        """

        # Fire all 5 Turso queries simultaneously
        char_task = fetch_turso(session, "SELECT * FROM characters")
        gear_task = fetch_turso(session, "SELECT character_name, slot, item_id, name, quality, icon_data, tooltip_params FROM gear")
        trend_task = fetch_turso(session, trend_query)
        gt_task = fetch_turso(session, "SELECT * FROM global_trends WHERE id='__GLOBAL__'")
        timeline_task = fetch_turso(session, "SELECT character_name, type, level, item_id FROM timeline")

        char_rows, gear_rows, trend_rows, gt_rows, timeline_rows = await asyncio.gather(
            char_task, gear_task, trend_task, gt_task, timeline_task
        )

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
            if row['type'] == 'level_up': known_timeline.add(f"{row['character_name']}_level_{row['level']}")
            else: known_timeline.add(f"{row['character_name']}_item_{row['item_id']}")

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
        print("💾 Compiling Batch Payload for Turso...")
        batch_stmts = []
        
        for char_name, data in history_data.items():
            batch_stmts.append({
                "q": """
                    INSERT OR REPLACE INTO characters 
                    (name, level, class, race, faction, equipped_item_level, last_login_ms, portrait_url) 
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                "params": [
                    char_name, 
                    data.get('level', 0),
                    data.get('class'),
                    data.get('race'),
                    data.get('faction'),
                    data.get('equipped_item_level'),
                    data.get('last_login_ms'),
                    data.get('portrait_url')
                ]
            })
            for slot, item in data.items():
                if isinstance(item, dict) and 'item_id' in item:
                    batch_stmts.append({
                        "q": "INSERT OR REPLACE INTO gear (character_name, slot, item_id, name, quality, icon_data, tooltip_params) VALUES (?, ?, ?, ?, ?, ?, ?)",
                        "params": [char_name, slot, item.get('item_id'), item.get('name'), item.get('quality'), item.get('icon_data'), item.get('tooltip_params')]
                    })
                    
        for ev in timeline_data_new:
            char_name = ev.get('character')
            if ev.get('type') == 'level_up':
                level = ev.get('level')
                if f"{char_name}_level_{level}" not in known_timeline:
                    batch_stmts.append({
                        "q": "INSERT INTO timeline (timestamp, character_name, class, type, level) VALUES (?, ?, ?, ?, ?)",
                        "params": [ev.get('timestamp'), char_name, ev.get('class'), 'level_up', level]
                    })
                    known_timeline.add(f"{char_name}_level_{level}")
            else:
                it = ev.get('item', {})
                item_id = it.get('item_id')
                if f"{char_name}_item_{item_id}" not in known_timeline:
                    batch_stmts.append({
                        "q": "INSERT INTO timeline (timestamp, character_name, class, type, item_id, item_name, item_quality, item_icon) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                        "params": [ev.get('timestamp'), char_name, ev.get('class'), 'item', item_id, it.get('name'), it.get('quality'), it.get('icon_data')]
                    })
                    known_timeline.add(f"{char_name}_item_{item_id}")

        for row in char_history_inserts:
            batch_stmts.append({
                "q": "INSERT OR REPLACE INTO char_history (char_name, record_date, ilvl, hks) VALUES (?, ?, ?, ?)",
                "params": list(row)
            })
            
        batch_stmts.append({
            "q": "INSERT OR REPLACE INTO global_trends (id, last_total, trend_total, last_active, trend_active, last_ready, trend_ready) VALUES (?, ?, ?, ?, ?, ?, ?)",
            "params": list(new_gt_row)
        })
        
        batch_stmts.append({
            "q": "INSERT OR REPLACE INTO daily_roster_stats (date, total_roster, active_roster) VALUES (?, ?, ?)",
            "params": list(new_daily_stats_row)
        })

        print(f"☁️ Pushing {len(batch_stmts)} statements to Turso via HTTP API...")
        await push_turso_batch(session, batch_stmts)
        print("✅ Final push to Turso complete!")

        print("🩹 Healing corrupted timeline icons...")
        heal_stmt = {
            "q": """
                UPDATE timeline 
                SET item_icon = (
                    SELECT icon_data 
                    FROM gear 
                    WHERE gear.item_id = timeline.item_id AND gear.character_name = timeline.character_name 
                    LIMIT 1
                ) 
                WHERE type = 'item' AND (item_icon IS NULL OR item_icon LIKE '%amw%')
            """
        }
        await push_turso_batch(session, [heal_stmt])

        print("🌐 Generating final HTML Dashboard...")
        dashboard_feed = await fetch_turso(session, "SELECT * FROM timeline ORDER BY timestamp DESC LIMIT 5000")
        
        # Dump the heavy timeline payload to an external JSON file
        with open("asset/timeline.json", "w", encoding="utf-8") as f:
            json.dump(dashboard_feed, f, ensure_ascii=False)
            
        roster_history = {row['date']: row for row in await fetch_turso(session, "SELECT * FROM daily_roster_stats ORDER BY date DESC LIMIT 7")}

        # Pass the full dashboard_feed back in so the heatmap math can run!
        generate_html_dashboard(roster_data, realm_data, dashboard_feed, raw_guild_roster, roster_history)
        print("🎉 ALL DONE! The pipeline ran successfully.")

def main():
    if sys.platform == 'win32':
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(main_async())

if __name__ == "__main__":
    main()