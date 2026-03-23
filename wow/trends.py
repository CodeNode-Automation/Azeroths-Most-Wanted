from datetime import datetime, timezone

def process_character_trends(db_c, result, char_ranks, char_trends):
    """Calculates and persists item level and HK trends for an individual character."""
    char_name_lower = result['char'].lower()
    
    # DATA SANITIZATION: Only assign the guild rank if the API successfully returned a profile payload
    if isinstance(result.get('profile'), dict):
        result['profile']['guild_rank'] = char_ranks.get(char_name_lower, "Member")
        
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
            
        # Inject the persistent math directly into the profile so JS can read it
        result['profile']['trend_pve'] = trend_ilvl
        result['profile']['trend_pvp'] = trend_hks

    return result

def process_global_trends(db_c, roster_data, raw_guild_roster, realm_data):
    """Calculates and persists trends for the top global guild stat boxes."""
    total_members = len(raw_guild_roster)
    active_14_days = 0 
    raid_ready_count = 0
    current_time_ms = int(datetime.now(timezone.utc).timestamp() * 1000)
    fourteen_days_ms = 14 * 24 * 60 * 60 * 1000 
    
    for char in roster_data:
        p = char.get("profile") or {} 
        lvl = p.get('level', 0)
        ilvl = p.get('equipped_item_level', 0)
        
        if lvl == 70 and ilvl >= 110: raid_ready_count += 1
        if current_time_ms - p.get('last_login_timestamp', 0) <= fourteen_days_ms: active_14_days += 1
            
    gt_row = db_c.execute("SELECT * FROM global_trends WHERE id='__GLOBAL__'").fetchone()
    trend_total, trend_active, trend_ready = 0, 0, 0
    
    if gt_row:
        gt = dict(gt_row)
        last_total, last_active, last_ready = gt['last_total'], gt['last_active'], gt['last_ready']
        trend_total, trend_active, trend_ready = gt['trend_total'], gt['trend_active'], gt['trend_ready']
        
        if total_members != last_total:
            trend_total = total_members - last_total
            last_total = total_members
            
        if active_14_days != last_active:
            trend_active = active_14_days - last_active
            last_active = active_14_days
            
        if raid_ready_count != last_ready:
            trend_ready = raid_ready_count - last_ready
            last_ready = raid_ready_count
            
        db_c.execute("""
            INSERT OR REPLACE INTO global_trends 
            (id, last_total, trend_total, last_active, trend_active, last_ready, trend_ready) 
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, ('__GLOBAL__', last_total, trend_total, last_active, trend_active, last_ready, trend_ready))
    else:
        db_c.execute("""
            INSERT INTO global_trends 
            (id, last_total, trend_total, last_active, trend_active, last_ready, trend_ready) 
            VALUES (?, ?, 0, ?, 0, ?, 0)
        """, ('__GLOBAL__', total_members, active_14_days, raid_ready_count))

    # --- Save today's exact roster size for the historical line chart ---
    today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    # Using INSERT OR REPLACE ensures we only keep the latest snapshot for any given day
    db_c.execute("""
        INSERT OR REPLACE INTO daily_roster_stats 
        (date, total_roster, active_roster) 
        VALUES (?, ?, ?)
    """, (today_str, total_members, active_14_days))

    if realm_data is None: realm_data = {}
    realm_data['global_trends'] = {
        'trend_total': trend_total,
        'trend_active': trend_active,
        'trend_ready': trend_ready
    }
    return realm_data