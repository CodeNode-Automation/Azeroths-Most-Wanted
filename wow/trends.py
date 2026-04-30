from datetime import datetime, timezone

from wow.alts import is_alt_record

def process_character_trends(result, char_ranks, past_record):
    """Calculates item level and HK trends purely in memory."""
    char_name_lower = result['char'].lower()
    new_history_row = None
    
    if isinstance(result.get('profile'), dict):
        result['profile']['guild_rank'] = char_ranks.get(char_name_lower, "Member")
        
        cur_ilvl = result['profile'].get('equipped_item_level', 0)
        cur_hks = result['profile'].get('honorable_kills', 0)
        today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        
        # Prepare the row for bulk insertion later
        new_history_row = (char_name_lower, today_str, cur_ilvl, cur_hks)
        
        if past_record:
            trend_ilvl = cur_ilvl - past_record.get('ilvl', 0)
            trend_hks = cur_hks - past_record.get('hks', 0)
        else:
            trend_ilvl, trend_hks = 0, 0
            
        result['profile']['trend_pve'] = trend_ilvl
        result['profile']['trend_pvp'] = trend_hks

    return result, new_history_row

def process_global_trends(roster_data, raw_guild_roster, realm_data, gt_row):
    """Calculates global guild stat trends purely in memory."""
    total_members = len(raw_guild_roster)
    total_members_mains = sum(1 for record in raw_guild_roster if not is_alt_record(record))
    active_14_days = 0 
    active_14_days_mains = 0
    raid_ready_count = 0
    raid_ready_count_mains = 0
    last_total = total_members
    previous_total_members = total_members
    last_active = active_14_days
    last_ready = raid_ready_count
    last_total_mains = total_members_mains
    previous_total_members_mains = total_members_mains
    last_active_mains = active_14_days_mains
    last_ready_mains = raid_ready_count_mains
    current_time_ms = int(datetime.now(timezone.utc).timestamp() * 1000)
    fourteen_days_ms = 14 * 24 * 60 * 60 * 1000 
    
    # Aggregate metrics that feed the dashboard overview cards.
    total_hks = 0
    sum_ilvl_70 = 0
    count_ilvl_70 = 0
    sum_ilvl_70_mains = 0
    count_ilvl_70_mains = 0
    
    for char in roster_data:
        p = char.get("profile") or {} 
        lvl = p.get('level', 0)
        ilvl = p.get('equipped_item_level', 0)
        is_main = not is_alt_record(char)
        
        total_hks += p.get('honorable_kills', 0)
        
        if lvl == 70 and ilvl >= 110: raid_ready_count += 1
        if is_main and lvl == 70 and ilvl >= 110: raid_ready_count_mains += 1
        if lvl == 70 and ilvl > 0:
            sum_ilvl_70 += ilvl
            count_ilvl_70 += 1
        if is_main and lvl == 70 and ilvl > 0:
            sum_ilvl_70_mains += ilvl
            count_ilvl_70_mains += 1
            
        if current_time_ms - p.get('last_login_timestamp', 0) <= fourteen_days_ms:
            active_14_days += 1
            if is_main:
                active_14_days_mains += 1
        
    avg_ilvl_70 = round(sum_ilvl_70 / count_ilvl_70) if count_ilvl_70 > 0 else 0
    avg_ilvl_70_mains = round(sum_ilvl_70_mains / count_ilvl_70_mains) if count_ilvl_70_mains > 0 else 0
            
    trend_total, trend_active, trend_ready = 0, 0, 0
    trend_total_mains, trend_active_mains, trend_ready_mains = 0, 0, 0
    
    if gt_row:
        previous_total_members = gt_row.get('last_total')
        last_active = gt_row.get('last_active')
        last_ready = gt_row.get('last_ready')
        previous_total_members_mains = gt_row.get('last_total_mains')
        last_active_mains = gt_row.get('last_active_mains')
        last_ready_mains = gt_row.get('last_ready_mains')

        if previous_total_members is None:
            previous_total_members = total_members
        if last_active is None:
            last_active = active_14_days
        if last_ready is None:
            last_ready = raid_ready_count
        if previous_total_members_mains is None:
            previous_total_members_mains = total_members_mains
        if last_active_mains is None:
            last_active_mains = active_14_days_mains
        if last_ready_mains is None:
            last_ready_mains = raid_ready_count_mains
        
        if total_members != previous_total_members:
            trend_total = total_members - previous_total_members
            last_total = total_members
            
        if active_14_days != last_active:
            trend_active = active_14_days - last_active
            last_active = active_14_days
            
        if raid_ready_count != last_ready:
            trend_ready = raid_ready_count - last_ready
            last_ready = raid_ready_count

        if total_members_mains != previous_total_members_mains:
            trend_total_mains = total_members_mains - previous_total_members_mains
            last_total_mains = total_members_mains

        if active_14_days_mains != last_active_mains:
            trend_active_mains = active_14_days_mains - last_active_mains
            last_active_mains = active_14_days_mains

        if raid_ready_count_mains != last_ready_mains:
            trend_ready_mains = raid_ready_count_mains - last_ready_mains
            last_ready_mains = raid_ready_count_mains
            
        new_gt_row = (
            '__GLOBAL__',
            last_total,
            trend_total,
            last_active,
            trend_active,
            last_ready,
            trend_ready,
            last_total_mains,
            trend_total_mains,
            last_active_mains,
            trend_active_mains,
            last_ready_mains,
            trend_ready_mains,
        )
    else:
        new_gt_row = (
            '__GLOBAL__',
            total_members,
            0,
            active_14_days,
            0,
            raid_ready_count,
            0,
            total_members_mains,
            0,
            active_14_days_mains,
            0,
            raid_ready_count_mains,
            0,
        )

    today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    new_daily_stats_row = (
        today_str,
        total_members,
        active_14_days,
        avg_ilvl_70,
        total_hks,
        total_members_mains,
        active_14_days_mains,
        avg_ilvl_70_mains,
    )

    if realm_data is None: realm_data = {}
    realm_data['global_trends'] = {
        'trend_total': trend_total,
        'trend_active': trend_active,
        'trend_ready': trend_ready,
        'trend_total_mains': trend_total_mains,
        'trend_active_mains': trend_active_mains,
        'trend_ready_mains': trend_ready_mains,
        'total_members': total_members,
        'previous_total_members': previous_total_members,
    }
    realm_data['global_metrics'] = {
        'total_members': total_members,
        'total_members_mains': total_members_mains,
        'active_14_days': active_14_days,
        'active_14_days_mains': active_14_days_mains,
        'raid_ready_count': raid_ready_count,
        'raid_ready_count_mains': raid_ready_count_mains,
        'avg_ilvl_70': avg_ilvl_70,
        'avg_ilvl_70_mains': avg_ilvl_70_mains,
        'total_hks': total_hks,
    }
    return realm_data, new_gt_row, new_daily_stats_row
