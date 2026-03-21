import json
import random
import os
from datetime import datetime, timezone, timedelta

def generate_html_dashboard(roster_data, realm_data=None, timeline_data=None, raw_guild_roster=None):
    """
    Generates the interactive, high-performance HTML dashboard by combining 
    the Python data with the external style.css and script.js files.
    """
    if not timeline_data:
        timeline_data = []
    if not raw_guild_roster:
        raw_guild_roster = []

    # Safely filter out any characters whose profile failed to load from the API
    roster_data = [char for char in roster_data if char and isinstance(char.get("profile"), dict)]

    CLASS_COLORS = {
        "Druid": "#FF7C0A", "Hunter": "#ABD473", "Mage": "#3FC7EB", 
        "Paladin": "#F48CBA", "Priest": "#FFFFFF", "Rogue": "#FFF468",
        "Shaman": "#0070DE", "Warlock": "#8788EE", "Warrior": "#C69B6D",
        "Death Knight": "#C41E3A"
    }
    QUALITY_COLORS = {
        "POOR": "#9d9d9d", "COMMON": "#ffffff", "UNCOMMON": "#1eff00",
        "RARE": "#0070dd", "EPIC": "#a335ee", "LEGENDARY": "#ff8000"
    }

    last_updated_iso = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")

    # Sort roster alphabetically for the dropdown list
    sorted_roster = sorted(roster_data, key=lambda x: x.get("profile", {}).get("name", "").lower())

    # Pre-sort roster by level then iLvl for the statistics navigation feature
    sorted_stats_roster = sorted(roster_data, key=lambda x: (
        x.get("profile", {}).get("level", 0),
        x.get("profile", {}).get("equipped_item_level", 0)
    ), reverse=True)

    # --- Pre-compute Guild Statistics for the Front Page ---
    total_processed = len(roster_data)
    total_level = 0
    active_14_days = 0 
    raid_ready_count = 0
    class_counts = {}
    
    current_time_ms = int(datetime.now(timezone.utc).timestamp() * 1000)
    fourteen_days_ms = 14 * 24 * 60 * 60 * 1000 
    
    for char in roster_data:
        p = char.get("profile", {})
        lvl = p.get('level', 0)
        ilvl = p.get('equipped_item_level', 0)
        
        if isinstance(lvl, int): 
            total_level += lvl
            
        if lvl == 70 and ilvl >= 110:
            raid_ready_count += 1
            
        last_login = p.get('last_login_timestamp', 0)
        if current_time_ms - last_login <= fourteen_days_ms:
            active_14_days += 1
            
        class_data = p.get('character_class', {}).get('name', 'Unknown')
        c_class = class_data if isinstance(class_data, str) else class_data.get('en_US', 'Unknown')
        class_counts[c_class] = class_counts.get(c_class, 0) + 1

    avg_level = (total_level // total_processed) if total_processed > 0 else 0
    display_total_members = len(raw_guild_roster)

    avg_level = (total_level // total_processed) if total_processed > 0 else 0
    display_total_members = len(raw_guild_roster)

    # --- NEW: Process Daily Trends for Global Stats ---
    global_trends = realm_data.get('global_trends', {}) if isinstance(realm_data, dict) else {}
    
    def get_trend_html(trend_val):
        if trend_val > 0:
            return f'<span style="color: #2ecc71; font-size: 16px; text-shadow: none; margin-left: 6px;">▲ {trend_val}</span>'
        elif trend_val < 0:
            return f'<span style="color: #e74c3c; font-size: 16px; text-shadow: none; margin-left: 6px;">▼ {abs(trend_val)}</span>'
        else:
            return f'<span style="color: #555; font-size: 16px; text-shadow: none; margin-left: 6px;">-</span>'

    trend_total_html = get_trend_html(global_trends.get('trend_total', 0))
    trend_active_html = get_trend_html(global_trends.get('trend_active', 0))
    trend_ready_html = get_trend_html(global_trends.get('trend_ready', 0))

    # --- Process Timeline for Heatmap & Chart (Last 7 Days) ---
    activity_counts = {}
    for event in timeline_data:
        ts = event.get("timestamp", "")
        e_type = event.get("type", "item") # Defaults to item if missing
        try:
            # Parse ISO 8601 string safely into a Date
            dt = datetime.fromisoformat(ts.replace('Z', '+00:00'))
            date_key = dt.strftime("%Y-%m-%d")
            
            if date_key not in activity_counts:
                activity_counts[date_key] = {"total": 0, "loot": 0, "levels": 0}
                
            activity_counts[date_key]["total"] += 1
            if e_type == "level_up":
                activity_counts[date_key]["levels"] += 1
            else:
                activity_counts[date_key]["loot"] += 1
        except Exception:
            pass

    today = datetime.now(timezone.utc)
    heatmap_data = []
    # Create a dense array of the last 7 days
    for i in range(6, -1, -1):
        day = today - timedelta(days=i)
        d_str = day.strftime("%Y-%m-%d")
        day_name = day.strftime("%a") # Mon, Tue, Wed, etc.
        
        day_data = activity_counts.get(d_str, {"total": 0, "loot": 0, "levels": 0})
        heatmap_data.append({
            "date": d_str, 
            "day_name": day_name, 
            "count": day_data["total"],
            "loot": day_data["loot"],
            "levels": day_data["levels"]
        })
    
    safe_heatmap_data = json.dumps(heatmap_data)
    
    # Generate the Class Badge HTML
    class_badges_html = ""
    for cls, count in sorted(class_counts.items(), key=lambda item: item[1], reverse=True):
        if count > 0:
            color = CLASS_COLORS.get(cls, "#fff")
            class_badges_html += f'<div id="stats-{cls.lower()}" class="stat-badge clickable-class" style="border-color: {color};" title="Click to view all {cls}s">\n'
            class_badges_html += f'  <span class="stat-badge-cls" style="color: {color};">{cls}</span>\n'
            class_badges_html += f'  <span class="stat-badge-count">{count}</span>\n'
            class_badges_html += '</div>'

    # --- Advanced Navbar HTML Generation ---
    nav_controls = f"""
        <div class="controls-wrapper">
            <a href="javascript:void(0)" onclick="returnToHome()" class="nav-btn nav-btn-home" title="Return to guild stats page">
              🛡️<span class="home-text"> Armory Home</span>
            </a>
            
            <div class="custom-select-wrapper">
                <div class="custom-select" id="customCharSelect">
                    <span class="selected-value">View Entire Guild</span>
                    <span style="font-size: 12px; color: #888;">▼</span>
                </div>
                <div class="custom-select-options" id="customCharOptions">
                    <div class="custom-option" data-value="all">
                        <span style="font-size:16px;">🌍</span> View Entire Guild
                    </div>
    """
    
    for char in sorted_roster:
        c_name = char.get("profile", {}).get("name", "Unknown")
        c_class_obj = char.get("profile", {}).get("character_class", {})
        
        c_class = "Unknown"
        if isinstance(c_class_obj, str):
            c_class = c_class_obj
        elif isinstance(c_class_obj, dict):
            name_val = c_class_obj.get("name", "Unknown")
            if isinstance(name_val, str):
                c_class = name_val
            elif isinstance(name_val, dict):
                c_class = name_val.get("en_US", "Unknown")
        
        clean_class = c_class.lower().replace(' ', '')
        icon_url = f"https://wow.zamimg.com/images/wow/icons/large/class_{clean_class}.jpg"
        
        nav_controls += f"""
                    <div class="custom-option" data-value="{c_name.lower()}">
                        <img src="{icon_url}" class="opt-icon">
                        {c_name}
                    </div>\n"""
        
    nav_controls += """
                </div>
            </div>
            
            <div class="search-container">
                <div class="search-box">
                    <span class="search-icon">🔍</span>
                    <input type="text" id="charSearch" autocomplete="off" placeholder="Search armory..." />
                </div>
                <div id="search-autocomplete" class="search-autocomplete"></div>
            </div>
        </div>
    """

    # Load CSS and JS from external files safely
    base_dir = os.path.dirname(__file__)
    
    try:
        with open(os.path.join(base_dir, "style.css"), "r", encoding="utf-8") as f:
            css_content = f.read()
    except FileNotFoundError:
        css_content = "/* style.css not found */"
        
    try:
        with open(os.path.join(base_dir, "script.js"), "r", encoding="utf-8") as f:
            js_content = f.read()
    except FileNotFoundError:
        js_content = "console.error('script.js not found');"

    os.makedirs("asset", exist_ok=True)
    with open("asset/roster.json", "w", encoding="utf-8") as f:
        json.dump(sorted_stats_roster, f)
    with open("asset/raw_roster.json", "w", encoding="utf-8") as f:
        json.dump(raw_guild_roster, f)
        
    dashboard_config = {
        "last_updated": last_updated_iso,
        "active_14_days": active_14_days,
        "raid_ready_count": raid_ready_count
    }
    safe_config = json.dumps(dashboard_config)

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>&lt;Azeroths Most Wanted&gt; Guild Armory</title>
    <script>const whTooltips = {{colorLinks: false, iconizeLinks: false, renameLinks: false}};</script>
    <script src="https://wow.zamimg.com/widgets/power.js" defer></script>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>
        {css_content}
    </style>
</head>
<body>
    <div class="embers-container">
"""

    for _ in range(120):
        left = random.uniform(0, 100)
        size = random.uniform(2, 6)
        color = f"rgb(255, {random.randint(100, 220)}, 0)"
        blur = random.uniform(0, 3) if size > 3.5 else random.uniform(0, 0.5)
        html += f'<div class="ember" style="left: {left:.2f}%; width: {size:.1f}px; height: {size:.1f}px; background: {color}; box-shadow: 0 0 {size*2:.1f}px {color}, 0 0 {size*4:.1f}px #ff4400; filter: blur({blur:.1f}px); animation-duration: {random.uniform(5, 18):.1f}s; animation-delay: {random.uniform(0, 10):.1f}s;"></div>\n'
        
    html += f"""
    </div>

    <div class="navbar">
        {nav_controls}
    </div>
    
    <div id="custom-tooltip" class="custom-tooltip"></div>
    
    <div class="dashboard-layout">
        <div class="main-content">
            <div id="empty-state">
                
                <img src="asset/amw.png" alt="Azeroths Most Wanted Logo" style="max-width: 320px; width: 100%; display: block; margin: 0 auto 5px auto; filter: drop-shadow(0 10px 20px rgba(0,0,0,0.8)); animation: fadeIn 0.8s ease-out;">
                
                <h2 style="color: #ffd100; font-family: 'Cinzel', serif; font-size: 28px; letter-spacing: 1.5px; text-shadow: 0 2px 4px #000; margin-top: 0;">Azeroths Most Wanted Armory</h2>
                <p style="font-family: 'Marcellus', serif; max-width: 600px; margin: 0 auto 30px auto; color: #bbb; font-size: 16px;">
                    Inspect dynamic equipment, stats, and loot history. Select a member from the dropdown or search above, or click a stat box below to filter.
                </p>
                
                <div class="stat-box-container">
                    <div id="stat-total" class="stat-box clickable" title="Click to view all {display_total_members} members">
                        <span class="stat-value" style="display: flex; align-items: center; justify-content: center;">
                            {display_total_members} 
                            {trend_total_html}
                        </span>
                        <span class="stat-label">Total Roster</span>
                    </div>
                    <div id="stat-active" class="stat-box clickable" title="Click to view characters active within 14 days">
                        <span class="stat-value" style="color: #2ecc71; display: flex; align-items: center; justify-content: center;">
                            {active_14_days}
                            {trend_active_html}
                        </span>
                        <span class="stat-label">Active (14 Days)</span>
                    </div>
                    <div id="stat-raidready" class="stat-box clickable" title="Click to view characters Level 70 with 110+ iLvl">
                        <span class="stat-value" style="color: #ff8000; display: flex; align-items: center; justify-content: center;">
                            {raid_ready_count}
                            {trend_ready_html}
                        </span>
                        <span class="stat-label">Raid Ready</span>
                    </div>
                    <div class="stat-box" title="Average level of scanned characters">
                        <span class="stat-value">{avg_level}</span>
                        <span class="stat-label">Average Level</span>
                    </div>
                </div>

                <div class="heatmap-wrapper" style="max-width: 650px;">
                    <h3 class="heatmap-title">🔥 Guild Activity (Last 7 Days) <span style="color:#aaa; font-size: 11px;">Updates Daily</span></h3>
                    <div style="position: relative; height: 180px; width: 100%; margin-bottom: 20px;">
                        <canvas id="activityChart"></canvas>
                    </div>
                    <div id="heatmap-grid" class="heatmap-grid"></div>
                </div>
                
                <div class="class-stat-container">
                    {class_badges_html}
                </div>

                <div id="home-spec-container" style="display:none; text-align:center; padding-top: 10px; margin-bottom: 40px; animation: fadeInUp 0.3s forwards;">
                </div>

                <div id="leaderboards-wrapper" style="display:flex; flex-wrap: wrap; gap: 20px; width: 100%; max-width: 1000px; margin: 40px auto 20px auto; justify-content: center;">
                    <div id="pve-leaderboard-container" style="display:none; flex: 1; min-width: 320px; background: rgba(0,0,0,0.5); padding: 20px; border-radius: 8px; border: 1px solid #333; box-shadow: inset 0 0 10px rgba(0,0,0,0.8);">
                        <h3 style="font-family: 'Cinzel'; color: #ff8000; text-align: center; margin-top: 0; margin-bottom: 20px; border-bottom: 1px solid #333; padding-bottom: 15px; text-shadow: 0 2px 4px #000;">🛡️ Top 10 Item Level 🛡️</h3>
                        <div id="pve-leaderboard" style="display: flex; flex-direction: column; gap: 8px;"></div>
                    </div>
                    <div id="pvp-leaderboard-container" style="display:none; flex: 1; min-width: 320px; background: rgba(0,0,0,0.5); padding: 20px; border-radius: 8px; border: 1px solid #333; box-shadow: inset 0 0 10px rgba(0,0,0,0.8);">
                        <h3 style="font-family: 'Cinzel'; color: #ff4400; text-align: center; margin-top: 0; margin-bottom: 20px; border-bottom: 1px solid #333; padding-bottom: 15px; text-shadow: 0 2px 4px #000;">⚔️ Top 10 Honorable Kills ⚔️</h3>
                        <div id="pvp-leaderboard" style="display: flex; flex-direction: column; gap: 8px;"></div>
                    </div>
                </div>
            </div>

            <div id="concise-view">
                <h2 id="concise-view-title">Guild Overview</h2>
                <div id="concise-class-badges" class="class-stat-container" style="display:none; margin-bottom: 20px;"></div>
                <div id="concise-char-list"></div>
            </div>

            <div id="full-card-container" class="full-card-container"></div>
        </div> 
"""

    if timeline_data:
        html += f"""
        <div id="timeline" class="timeline-container">
            <h2 id="timeline-title" class="timeline-title">📜 Guild Recent Activity</h2>
            
            <div class="timeline-filters">
                <div class="filter-group">
                    <button class="tl-btn active" data-type="all">All</button>
                    <button class="tl-btn" data-type="item">All Loot</button>
                    <button class="tl-btn" style="color: #a335ee; border-color: rgba(163, 53, 238, 0.5);" data-type="epic">Epics+</button>
                    <button class="tl-btn" style="color: #ff8000; border-color: rgba(255, 128, 0, 0.5);" data-type="legendary">Legendaries</button>
                    <button class="tl-btn" data-type="level_up">Levels</button>
                </div>
                <div class="filter-group">
                    <select id="tl-date-filter" class="tl-select">
                        <option value="7">Last 7 Days</option>
                        <option value="2">Last 48 Hours</option>
                        <option value="1">Last 24 Hours</option>
                        <option value="all">All Available</option>
                    </select>
                </div>
            </div>

            <div class="timeline-feed">
"""
        for event in timeline_data:
            c_name = event.get("character_name", "Unknown").title()
            c_cls = event.get("class", "Unknown")
            c_hex = CLASS_COLORS.get(c_cls, "#ffd100")
            ts = event.get("timestamp", "")
            
            try:
                dt = datetime.fromisoformat(ts.replace('Z', '+00:00'))
                date_str = dt.strftime("%b %d")
            except Exception: date_str = ts[:10]
            
            if event.get("type") == "level_up":
                html += f"""
                <div onclick="selectCharacter('{c_name.lower()}')" class="concise-item tt-char" data-char="{c_name.lower()}" data-event-type="level_up" data-timestamp="{ts}" style="border-left-color: {c_hex}; cursor: pointer;">
                    <div class="timeline-node" style="background: #ffd100; box-shadow: 0 0 8px #ffd100;"></div>
                    <div style="display:flex; justify-content:space-between; width:100%; align-items:center;">
                        <span style="color: {c_hex}; font-family:'Cinzel'; font-weight:bold; font-size:15px; text-shadow:1px 1px 2px #000;">{c_name}</span>
                        <span style="color:#888; font-size:11px;">{date_str}</span>
                    </div>
                    <div class="event-box" style="border-left-color: #ffd100;">
                        <span style="font-size: 14px;">⭐</span>
                        <span style="color: #ffd100; font-weight: bold; text-shadow: 1px 1px 2px #000;">Reached Level {event.get('level')}</span>
                    </div>
                </div>"""
            else:
                q = event.get('item_quality', 'COMMON')
                q_hex = QUALITY_COLORS.get(q, "#ffffff")
                html += f"""
                <div onclick="selectCharacter('{c_name.lower()}')" class="concise-item tt-char" data-char="{c_name.lower()}" data-event-type="item" data-quality="{q}" data-timestamp="{ts}" style="border-left-color: {q_hex}; cursor: pointer;">
                    <div class="timeline-node" style="background: {q_hex}; box-shadow: 0 0 8px {q_hex};"></div>
                    <div style="display:flex; justify-content:space-between; width:100%; align-items:center;">
                        <span style="color: {c_hex}; font-family:'Cinzel'; font-weight:bold; font-size:15px; text-shadow:1px 1px 2px #000;">{c_name}</span>
                        <span style="color:#888; font-size:11px;">{date_str}</span>
                    </div>
                    <div class="event-box" style="border-left-color: {q_hex};">
                        <img src="{event.get('item_icon')}" alt="icon">
                        <a href="https://www.wowhead.com/wotlk/item={event.get('item_id')}" target="_blank" onclick="event.stopPropagation();" style="color: {q_hex}; font-weight:bold; text-decoration: none;">{event.get('item_name')}</a>
                    </div>
                </div>"""
        html += """
            </div>
        </div>
"""

    html += f"""
    </div> 
    
    <div class="dashboard-footer">
        Automatically generated via GitHub Actions &bull; Database powered by SQLite &bull; Unlimited history stored &bull; Last updated: <span id="update-time" style="color: #ffd100;"></span>
        <div style="margin-top: 20px; opacity: 0.5; transition: opacity 0.3s ease; display: flex; justify-content: center;" onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.5'">
            <img src="https://api.visitorbadge.io/api/visitors?path=AzerothsMostWantedArmory_2&label=VIEWS&labelColor=111111&countColor=ffd100&style=flat-square" alt="Visitor Count" style="border-radius: 4px; box-shadow: 0 2px 5px rgba(0,0,0,0.5);">
        </div>
    </div>

    <script id="dashboard-config" type="application/json">
        {safe_config}
    </script>
    <script id="heatmap-data" type="application/json">
        {safe_heatmap_data}
    </script>

    <script>
        {js_content}
    </script>
</body>
</html>
"""
    
    with open("index.html", "w", encoding="utf-8") as f:
        f.write(html)