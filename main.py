"""
Main entry point for the WoW Classic API Dashboard pipeline.
Database logic upgraded to SQLite to remove historical limits and improve concurrency performance.
"""

import sqlite3
import os
import asyncio
import aiohttp
import sys
import json
from datetime import datetime, timezone

from wow.auth import get_access_token
from wow.api import fetch_realm_data
from wow.character import fetch_character_data, update_character_state
from render.html_dashboard import generate_html_dashboard
from config import REALM, GUILD_NAME

# Permanent database file
DB_FILE = "asset/guild.db"

# Map Blizzard's raw integer IDs to strings for the base roster view
CLASS_MAP = {
    1: "Warrior", 2: "Paladin", 3: "Hunter", 4: "Rogue", 5: "Priest", 
    6: "Death Knight", 7: "Shaman", 8: "Mage", 9: "Warlock", 11: "Druid"
}

RACE_MAP = {
    1: "Human", 2: "Orc", 3: "Dwarf", 4: "Night Elf", 5: "Undead", 
    6: "Tauren", 7: "Gnome", 8: "Troll", 10: "Blood Elf", 11: "Draenei"
}

# NEW: Map the exact in-game rank names to their numerical IDs (0 is always Guild Master)
RANK_MAP = {
    0: "Guild Master",
    1: "MOST WANTED",
    2: "Veteran",
    3: "Member",
    4: "Alt",
    5: "Wanted"
}

def get_db_connection():
    """Establishes a connection to the persistent SQLite database."""
    os.makedirs(os.path.dirname(DB_FILE), exist_ok=True)
    return sqlite3.connect(DB_FILE)

def setup_database():
    """Ensures database schema exists. Migration handles initial data population."""
    conn = get_db_connection()
    c = conn.cursor()
    
    # Store character summary data, stats, and metadata like faction/class
    c.execute("""
        CREATE TABLE IF NOT EXISTS characters (
            name TEXT PRIMARY KEY, class TEXT, race TEXT, faction TEXT, guild TEXT,
            level INTEGER, equipped_item_level INTEGER, xp INTEGER, xp_max INTEGER,
            health INTEGER, power INTEGER, last_login_ms INTEGER, portrait_url TEXT
        )
    """)

    # Store loot/gear historical state.
    c.execute("""
        CREATE TABLE IF NOT EXISTS gear (
            character_name TEXT, slot TEXT, item_id INTEGER, name TEXT, quality TEXT,
            icon_data TEXT, tooltip_params TEXT,
            last_detected TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (character_name, slot, item_id)
        )
    """)

    # Store timeline events (loot drops and level ups). No longer capped.
    c.execute("""
        CREATE TABLE IF NOT EXISTS timeline (
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP, character_name TEXT,
            class TEXT, type TEXT, item_id INTEGER, item_name TEXT,
            item_quality TEXT, item_icon TEXT, level INTEGER
        )
    """)

    # NEW: Store midnight snapshots to calculate daily stat trends for the dashboard arrows
    c.execute("""
        CREATE TABLE IF NOT EXISTS daily_snapshot (
            id TEXT PRIMARY KEY,
            snapshot_date TEXT,
            val1 INTEGER,
            val2 INTEGER,
            val3 INTEGER
        )
    """)

    # NEWER: Persistent trend tracker for characters (replaces daily reset for leaderboards)
    c.execute("""
        CREATE TABLE IF NOT EXISTS character_trends (
            char_name TEXT PRIMARY KEY,
            last_ilvl INTEGER,
            trend_ilvl INTEGER,
            last_hks INTEGER,
            trend_hks INTEGER
        )
    """)

    conn.commit()
    conn.close()

async def fetch_guild_metadata(session, token, realm, slug):
    """Fetches guild-level metadata to resolve rank names."""
    url = f"https://eu.api.blizzard.com/data/wow/guild/{realm}/{slug}?namespace=profile-classicann-eu&locale=en_US"
    headers = {"Authorization": f"Bearer {token}"}
    
    max_retries = 3
    for attempt in range(max_retries):
        try:
            async with session.get(url, headers=headers) as response:
                if response.status == 200:
                    data = await response.json()
                    return {r['id']: r['name'] for r in data.get('ranks', [])}
                else:
                    response.raise_for_status() # Force an error if Blizzard returns a 500/404
        except Exception as e:
            print(f"⚠️ Guild Metadata fetch failed (Attempt {attempt + 1}/{max_retries}): {e}")
            if attempt < max_retries - 1:
                await asyncio.sleep(5)
            else:
                return {}
    return {}

async def fetch_with_semaphore(sem, session, token, char, history_data):
    """Bouncer function throttling dynamic API requests to respect rate limits."""
    max_retries = 3
    for attempt in range(max_retries):
        try:
            async with sem:
                await asyncio.sleep(0.3)
                return await fetch_character_data(session, token, char, history_data)
        except Exception as e:
            print(f"⚠️ Failed to fetch {char} (Attempt {attempt + 1}/{max_retries}): {e}")
            if attempt < max_retries - 1:
                await asyncio.sleep(5)
            else:
                print(f"❌ Skipping {char} after {max_retries} failed attempts.")
                return None

async def main_async():
    """Core asynchronous orchestrator."""
    print("\n🔑 Authenticating with Blizzard API...")
    token = get_access_token()
    if not token:
        print("❌ Failed to authenticate with Blizzard.")
        return
    print("✅ Authentication successful!\n")

    print("📂 Synchronizing Local SQLite Database...")
    setup_database()
    db_conn = get_db_connection()
    db_conn.row_factory = sqlite3.Row # Allows access by column name
    db_c = db_conn.cursor()

    # Load known gear state into memory format required by update_character_state
    history_data = {}
    known_chars = db_c.execute("SELECT name, level FROM characters").fetchall()
    for row in known_chars:
        history_data[row['name']] = {'level': row['level']}
        
    known_gear = db_c.execute("""
        SELECT character_name, slot, item_id, name, quality, icon_data, tooltip_params
        FROM gear
    """).fetchall()
    for row in known_gear:
        char_n = row['character_name']
        if char_n not in history_data:
            history_data[char_n] = {}
        history_data[char_n][row['slot']] = {
            'item_id': row['item_id'], 'name': row['name'], 
            'quality': row['quality'], 'icon': row['icon_data'], 'params': row['tooltip_params']
        }
    
    print(f"✅ Database synchronized: {len(known_chars)} known characters, {len(known_gear)} known gear rows.")
    
    # We pass a temporary list for timeline events so update_character_state can append new ones
    timeline_data_new = [] 
    roster_data = []

    print("🚀 Opening Async HTTP Session...\n")
    async with aiohttp.ClientSession() as session:
        realm_data = await fetch_realm_data(session, token, REALM)

        slug = GUILD_NAME.lower().replace(" ", "-").replace("'", "")
        rank_map = await fetch_guild_metadata(session, token, REALM, slug)

        print(f"📜 Fetching guild roster for <{GUILD_NAME}>...")
        url = f"https://eu.api.blizzard.com/data/wow/guild/{REALM}/{slug}/roster?namespace=profile-classicann-eu&locale=en_US"
        headers = {"Authorization": f"Bearer {token}"}
        
        roster_names = []
        raw_guild_roster = [] # Captures EVERYONE, even level 1s, for the total roster view
        char_ranks = {} # Temporary mapping to inject ranks into the deep character profiles
        
        max_retries = 3
        for attempt in range(max_retries):
            try:
                async with session.get(url, headers=headers) as resp:
                    if resp.status == 200:
                        raw_data = await resp.json()
                        all_m = raw_data.get('members', [])
                        
                        for m in all_m:
                            c = m.get('character', {})
                            c_name = c.get('name', 'Unknown')
                            c_level = c.get('level', 0)
                            
                            # Convert raw IDs to Strings for the fallback view
                            c_class_id = c.get('playable_class', {}).get('id')
                            c_class = CLASS_MAP.get(c_class_id, "Unknown")
                            
                            c_race_id = c.get('playable_race', {}).get('id')
                            c_race = RACE_MAP.get(c_race_id, "Unknown")
                            
                            # Map the explicit Guild Rank using our manual RANK_MAP
                            rank_id = m.get('rank', 5) # Default to 5 if missing
                            rank_name = RANK_MAP.get(rank_id, f"Rank {rank_id}")
                            char_ranks[c_name.lower()] = rank_name
                            
                            raw_guild_roster.append({
                                "name": c_name.title(),
                                "level": c_level,
                                "class": c_class,
                                "race": c_race,
                                "rank": rank_name
                            })
                            
                            # Only process full API deep-scans for chars > level 10
                            if c_level > 10:
                                roster_names.append(c_name.lower())
                        break # Successfully fetched and parsed, break out of the retry loop
                    else:
                        resp.raise_for_status()
            except Exception as e:
                print(f"⚠️ Roster fetch failed (Attempt {attempt + 1}/{max_retries}): {e}")
                if attempt < max_retries - 1:
                    await asyncio.sleep(5)
                else:
                    print("❌ Fatal Error: Could not fetch guild roster.")
                    # Let the rest of the script continue with an empty roster to prevent a hard crash

        print(f"👥 Guild: {len(raw_guild_roster)} Total Members. Processing {len(roster_names)} valid characters (> Lvl 10).")

        sem = asyncio.Semaphore(5)
        tasks = [fetch_with_semaphore(sem, session, token, char, history_data) for char in roster_names]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # --- NEW TREND LOGIC: Load Persistent Trends & Daily Snapshots ---
        today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        
        # Load Global Snapshots
        snapshots = {}
        for row in db_c.execute("SELECT * FROM daily_snapshot").fetchall():
            snapshots[row['id']] = dict(row)
            
        # Load Character Trends
        char_trends = {}
        for row in db_c.execute("SELECT * FROM character_trends").fetchall():
            char_trends[row['char_name']] = dict(row)

        for result in results:
            if isinstance(result, dict) and result:
                char_name_lower = result['char'].lower()
                
                # DATA SANITIZATION: Only assign the guild rank if the API successfully returned a profile payload
                if isinstance(result.get('profile'), dict):
                    result['profile']['guild_rank'] = char_ranks.get(char_name_lower, "Member")
                    
                    # --- PERSISTENT TREND CALCULATIONS: PVE & PVP ---
                    cur_ilvl = result['profile'].get('equipped_item_level', 0)
                    cur_hks = result['profile'].get('honorable_kills', 0)
                    
                    ct = char_trends.get(char_name_lower)
                    
                    if ct:
                        last_ilvl = ct['last_ilvl']
                        trend_ilvl = ct['trend_ilvl']
                        last_hks = ct['last_hks']
                        trend_hks = ct['trend_hks']
                        
                        # Check for iLvl changes
                        if cur_ilvl != last_ilvl:
                            trend_ilvl = cur_ilvl - last_ilvl
                            last_ilvl = cur_ilvl
                            
                        # Check for HK changes
                        if cur_hks != last_hks:
                            trend_hks = cur_hks - last_hks
                            last_hks = cur_hks
                            
                        # Save the updated persistent trend back to the DB
                        db_c.execute("""
                            INSERT OR REPLACE INTO character_trends 
                            (char_name, last_ilvl, trend_ilvl, last_hks, trend_hks) 
                            VALUES (?, ?, ?, ?, ?)
                        """, (char_name_lower, last_ilvl, trend_ilvl, last_hks, trend_hks))
                        
                    else:
                        # First time seeing this character: set baseline, trend is 0
                        trend_ilvl, trend_hks = 0, 0
                        db_c.execute("""
                            INSERT INTO character_trends 
                            (char_name, last_ilvl, trend_ilvl, last_hks, trend_hks) 
                            VALUES (?, ?, 0, ?, 0)
                        """, (char_name_lower, cur_ilvl, cur_hks))
                        
                    # Inject the persistent math directly into the profile so JS can read it!
                    result['profile']['trend_pve'] = trend_ilvl
                    result['profile']['trend_pvp'] = trend_hks
                
                history_data, timeline_data_new = update_character_state(result, history_data, timeline_data_new)
                roster_data.append(result)

        # --- TREND CALCULATIONS: Global Guild Stats ---
        total_members = len(raw_guild_roster)
        active_14_days = 0 
        raid_ready_count = 0
        current_time_ms = int(datetime.now(timezone.utc).timestamp() * 1000)
        fourteen_days_ms = 14 * 24 * 60 * 60 * 1000 
        
        for char in roster_data:
            # THE FIX: 'or {}' forces it to be a dictionary even if Blizzard returns None!
            p = char.get("profile") or {} 
            
            lvl = p.get('level', 0)
            ilvl = p.get('equipped_item_level', 0)
            
            if lvl == 70 and ilvl >= 110: raid_ready_count += 1
            if current_time_ms - p.get('last_login_timestamp', 0) <= fourteen_days_ms: active_14_days += 1
                
        global_snap = snapshots.get('__GLOBAL__')
        base_total, base_active, base_ready = total_members, active_14_days, raid_ready_count
        
        if global_snap:
            if global_snap['snapshot_date'] == today_str:
                base_total, base_active, base_ready = global_snap['val1'], global_snap['val2'], global_snap['val3']
            else:
                db_c.execute("INSERT OR REPLACE INTO daily_snapshot (id, snapshot_date, val1, val2, val3) VALUES (?, ?, ?, ?, ?)", 
                             ('__GLOBAL__', today_str, total_members, active_14_days, raid_ready_count))
        else:
            db_c.execute("INSERT INTO daily_snapshot (id, snapshot_date, val1, val2, val3) VALUES (?, ?, ?, ?, ?)", 
                         ('__GLOBAL__', today_str, total_members, active_14_days, raid_ready_count))
                         
        # Inject the global math directly into realm_data so html_dashboard.py can use it
        if realm_data is None: realm_data = {}
        realm_data['global_trends'] = {
            'trend_total': total_members - base_total,
            'trend_active': active_14_days - base_active,
            'trend_ready': raid_ready_count - base_ready
        }

    print("\n===========================================")
    print("💾 Commit today's updates to SQLite database...")
    
    # Save character level updates and gear state back to SQLite
    for char_name, data in history_data.items():
        level = data.get('level', 0)
        db_c.execute("INSERT OR REPLACE INTO characters (name, level) VALUES (?, ?)", (char_name, level))
        for slot, item in data.items():
            if isinstance(item, dict) and 'item_id' in item:
                db_c.execute("""
                    INSERT OR REPLACE INTO gear 
                    (character_name, slot, item_id, name, quality, icon_data, tooltip_params)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                """, (char_name, slot, item.get('item_id'), item.get('name'), item.get('quality'), item.get('icon'), item.get('params')))

    # Commit dynamic timeline events (level ups/loot drops)
    for ev in timeline_data_new:
        char_name = ev.get('character')
        
        if ev.get('type') == 'level_up':
            level = ev.get('level')
            # Check if this exact level up was already recorded to prevent duplicates
            if not db_c.execute("SELECT 1 FROM timeline WHERE character_name = ? AND type = 'level_up' AND level = ?", (char_name, level)).fetchone():
                db_c.execute("""
                    INSERT INTO timeline 
                    (timestamp, character_name, class, type, level)
                    VALUES (?, ?, ?, 'level_up', ?)
                """, (ev.get('timestamp'), char_name, ev.get('class'), level))
        else:
            it = ev.get('item', {})
            item_id = it.get('item_id')
            # Check if this character has EVER received this item ID before
            if not db_c.execute("SELECT 1 FROM timeline WHERE character_name = ? AND type = 'item' AND item_id = ?", (char_name, item_id)).fetchone():
                db_c.execute("""
                    INSERT INTO timeline 
                    (timestamp, character_name, class, type, item_id, item_name, item_quality, item_icon)
                    VALUES (?, ?, ?, 'item', ?, ?, ?, ?)
                """, (ev.get('timestamp'), char_name, ev.get('class'), item_id, it.get('name'), it.get('quality'), it.get('icon_data')))

    db_conn.commit()
    db_conn.close()

    print("🌐 Generating final HTML Dashboard...")
    
    # Re-open database read-only to query history for the frontend
    render_conn = get_db_connection()
    render_conn.row_factory = sqlite3.Row
    render_c = render_conn.cursor()
    
    # Query latest 2000 events for the HTML feed so the page doesn't bloat endlessly
    dashboard_feed = [dict(row) for row in render_c.execute("SELECT * FROM timeline ORDER BY timestamp DESC LIMIT 2000").fetchall()]
    render_conn.close()

    # Pass historical data and the FULL raw roster into generator
    generate_html_dashboard(roster_data, realm_data, dashboard_feed, raw_guild_roster)
    print("🎉 ALL DONE! The SQLite-powered pipeline ran successfully.")

def main():
    if sys.platform == 'win32':
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(main_async())

if __name__ == "__main__":
    main()