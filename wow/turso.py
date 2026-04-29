import os
from urllib.parse import urlparse


def _resolve_turso_config():
    """Resolve and validate the Turso endpoint and auth token."""
    raw_url = os.environ.get("TURSO_DATABASE_URL", "").strip()
    token = os.environ.get("TURSO_AUTH_TOKEN", "").strip()

    if not raw_url:
        raise RuntimeError("TURSO_DATABASE_URL is required")
    if not token:
        raise RuntimeError("TURSO_AUTH_TOKEN is required")

    parsed = urlparse(raw_url)

    if parsed.scheme == "libsql":
        normalized_url = raw_url.replace("libsql://", "https://", 1)
        return normalized_url, token

    if parsed.scheme == "https":
        return raw_url, token

    raise RuntimeError("Turso database URL must use libsql:// or https://")


async def fetch_turso(session, query):
    """Fetches data directly from Turso's HTTP API using an async session."""
    url, token = _resolve_turso_config()

    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    payload = {"statements": [query]}

    try:
        async with session.post(url, json=payload, headers=headers) as resp:
            data = await resp.json()

            # Safely check if the response is a list before accessing index 0
            if isinstance(data, list) and len(data) > 0:
                results = data[0].get("results", {})
            else:
                print(f"Unexpected Turso Response: {data}")
                return []

            if not results:
                return []
            cols = results.get("columns", [])
            rows = results.get("rows", [])
            return [dict(zip(cols, row)) for row in rows]
    except Exception as e:
        print(f"Turso Fetch Error: {e}")
        return []


async def push_turso_batch(session, statements):
    """Pushes an array of dicts to Turso in chunked transactions."""
    url, token = _resolve_turso_config()
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    chunk_size = 1500

    for i in range(0, len(statements), chunk_size):
        chunk = statements[i:i + chunk_size]
        payload = {"statements": [{"q": "BEGIN"}] + chunk + [{"q": "COMMIT"}]}

        try:
            async with session.post(url, json=payload, headers=headers) as resp:
                if resp.status >= 400:
                    err_msg = await resp.text()
                    print(f"Turso Batch Push Error ({resp.status}): {err_msg}")
        except Exception as e:
            print(f"Turso Batch Network Error: {e}")


async def setup_database(session):
    """Ensures database schema exists via HTTP API."""
    _resolve_turso_config()
    print("Ensuring Turso schema exists...")
    schema_queries = [
        "CREATE TABLE IF NOT EXISTS characters (name TEXT PRIMARY KEY, class TEXT, race TEXT, faction TEXT, guild TEXT, level INTEGER, equipped_item_level INTEGER, xp INTEGER, xp_max INTEGER, health INTEGER, power INTEGER, last_login_ms INTEGER, portrait_url TEXT, active_spec TEXT, honorable_kills INTEGER, power_type TEXT, strength_base INTEGER, strength_effective INTEGER, agility_base INTEGER, agility_effective INTEGER, intellect_base INTEGER, intellect_effective INTEGER, stamina_base INTEGER, stamina_effective INTEGER, melee_crit_value REAL, melee_haste_value REAL, attack_power INTEGER, main_hand_min REAL, main_hand_max REAL, main_hand_speed REAL, main_hand_dps REAL, off_hand_min REAL, off_hand_max REAL, off_hand_speed REAL, off_hand_dps REAL, spell_power INTEGER, spell_penetration INTEGER, spell_crit_value REAL, mana_regen REAL, mana_regen_combat REAL, armor_base INTEGER, armor_effective INTEGER, dodge REAL, parry REAL, block REAL, ranged_crit REAL, ranged_haste REAL, spell_haste REAL, spirit_base INTEGER, spirit_effective INTEGER, defense_base INTEGER, defense_effective INTEGER, vanguard_badges TEXT, campaign_badges TEXT, pve_champ_count INTEGER, pvp_champ_count INTEGER)",
        "CREATE TABLE IF NOT EXISTS gear (character_name TEXT, slot TEXT, item_id INTEGER, name TEXT, quality TEXT, icon_data TEXT, tooltip_params TEXT, last_detected TIMESTAMP DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (character_name, slot, item_id))",
        "CREATE TABLE IF NOT EXISTS timeline (timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP, character_name TEXT, class TEXT, type TEXT, item_id INTEGER, item_name TEXT, item_quality TEXT, item_icon TEXT, level INTEGER)",
        "CREATE INDEX IF NOT EXISTS idx_timeline_timestamp ON timeline (timestamp DESC)",
        "CREATE TABLE IF NOT EXISTS guild_membership_events (id INTEGER PRIMARY KEY AUTOINCREMENT, scan_id TEXT NOT NULL, character_name TEXT NOT NULL, event_type TEXT NOT NULL, detected_at TEXT NOT NULL, previous_status TEXT, current_status TEXT)",
        "CREATE INDEX IF NOT EXISTS idx_guild_membership_events_detected_at ON guild_membership_events (detected_at DESC)",
        "CREATE INDEX IF NOT EXISTS idx_guild_membership_events_character_name ON guild_membership_events (character_name)",
        "CREATE INDEX IF NOT EXISTS idx_guild_membership_events_event_type ON guild_membership_events (event_type)",
        "CREATE TABLE IF NOT EXISTS global_trends (id TEXT PRIMARY KEY, last_total INTEGER, trend_total INTEGER, last_active INTEGER, trend_active INTEGER, last_ready INTEGER, trend_ready INTEGER, last_total_mains INTEGER, trend_total_mains INTEGER, last_active_mains INTEGER, trend_active_mains INTEGER, last_ready_mains INTEGER, trend_ready_mains INTEGER)",
        "CREATE TABLE IF NOT EXISTS daily_roster_stats (date TEXT PRIMARY KEY, total_roster INTEGER DEFAULT 0, active_roster INTEGER DEFAULT 0, avg_ilvl_70 INTEGER DEFAULT 0, total_hks INTEGER DEFAULT 0, total_roster_mains INTEGER, active_roster_mains INTEGER, avg_ilvl_70_mains INTEGER)",
        "CREATE TABLE IF NOT EXISTS char_history (char_name TEXT, record_date TEXT, ilvl INTEGER, hks INTEGER, PRIMARY KEY (char_name, record_date))",
        "CREATE TABLE IF NOT EXISTS ladder_history (week_anchor TEXT, category TEXT, rank INTEGER, champion TEXT, score INTEGER, PRIMARY KEY (week_anchor, category, rank))",
    ]
    await push_turso_batch(session, [{"q": q} for q in schema_queries])

    migration_columns = {
        "global_trends": {
            "last_total_mains": "INTEGER",
            "trend_total_mains": "INTEGER",
            "last_active_mains": "INTEGER",
            "trend_active_mains": "INTEGER",
            "last_ready_mains": "INTEGER",
            "trend_ready_mains": "INTEGER",
        },
        "daily_roster_stats": {
            "total_roster_mains": "INTEGER",
            "active_roster_mains": "INTEGER",
            "avg_ilvl_70_mains": "INTEGER",
        },
    }

    for table_name, columns in migration_columns.items():
        table_info = await fetch_turso(session, f"PRAGMA table_info({table_name})")
        existing_columns = {row.get("name") for row in table_info}
        missing_queries = [
            {"q": f"ALTER TABLE {table_name} ADD COLUMN {column_name} {column_type}"}
            for column_name, column_type in columns.items()
            if column_name not in existing_columns
        ]

        if missing_queries:
            await push_turso_batch(session, missing_queries)
