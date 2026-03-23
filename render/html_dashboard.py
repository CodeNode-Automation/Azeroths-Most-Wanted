import json
import os
from datetime import datetime, timezone, timedelta
from jinja2 import Environment, FileSystemLoader

def generate_html_dashboard(roster_data, realm_data=None, timeline_data=None, raw_guild_roster=None, roster_history=None):
    """
    Generates the interactive, high-performance HTML dashboard utilizing Jinja2 templates.
    """
    if not timeline_data:
        timeline_data = []
    if not raw_guild_roster:
        raw_guild_roster = []
    if not roster_history:
        roster_history = {}

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
    sorted_roster = sorted(roster_data, key=lambda x: x.get("profile", {}).get("name", "").lower())
    sorted_stats_roster = sorted(roster_data, key=lambda x: (
        x.get("profile", {}).get("level", 0),
        x.get("profile", {}).get("equipped_item_level", 0)
    ), reverse=True)

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
            
    # Calculate accurate class counts using the entire raw guild roster
    for char in raw_guild_roster:
        c_class = char.get('class', 'Unknown')
        if c_class != 'Unknown':
            class_counts[c_class] = class_counts.get(c_class, 0) + 1

    avg_level = (total_level // total_processed) if total_processed > 0 else 0
    display_total_members = len(raw_guild_roster)

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

    activity_counts = {}
    for event in timeline_data:
        ts = event.get("timestamp", "")
        e_type = event.get("type", "item")
        try:
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
    for i in range(6, -1, -1):
        day = today - timedelta(days=i)
        d_str = day.strftime("%Y-%m-%d")
        day_name = day.strftime("%a")
        day_data = activity_counts.get(d_str, {"total": 0, "loot": 0, "levels": 0})
        
        # --- NEW: Grab historical stats if they exist in the DB for this date ---
        hist_data = roster_history.get(d_str, {})
        
        # Ensure 'today' always has the live exact count, even if the DB hasn't committed yet
        if i == 0:
            hist_total = display_total_members
            hist_active = active_14_days
        else:
            hist_total = hist_data.get('total_roster')  # Will be None if you don't have data for this past day yet
            hist_active = hist_data.get('active_roster')

        heatmap_data.append({
            "date": d_str, 
            "day_name": day_name, 
            "count": day_data["total"],
            "loot": day_data["loot"],
            "levels": day_data["levels"],
            "total_roster": hist_total,
            "active_roster": hist_active
        })
    
    safe_heatmap_data = json.dumps(heatmap_data)
    
    class_badges_html = ""
    for cls, count in sorted(class_counts.items(), key=lambda item: item[1], reverse=True):
        if count > 0:
            color = CLASS_COLORS.get(cls, "#fff")
            class_badges_html += f'<div id="stats-{cls.lower()}" class="stat-badge clickable-class" style="border-color: {color};" title="Click to view all {cls}s">\n'
            class_badges_html += f'  <span class="stat-badge-cls" style="color: {color};">{cls}</span>\n'
            class_badges_html += f'  <span class="stat-badge-count">{count}</span>\n'
            class_badges_html += '</div>'

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

    timeline_html = ""
    if timeline_data:
        timeline_html += f"""
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
                timeline_html += f"""
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
                timeline_html += f"""
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
        timeline_html += """
            </div>
        </div>
"""

    base_dir = os.path.dirname(__file__)
    try:
        with open(os.path.join(base_dir, "style.css"), "r", encoding="utf-8") as f:
            css_content = f.read()
    except FileNotFoundError: css_content = ""
        
    try:
        with open(os.path.join(base_dir, "script.js"), "r", encoding="utf-8") as f:
            js_content = f.read()
    except FileNotFoundError: js_content = ""

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

    # Render Template
    env = Environment(loader=FileSystemLoader(base_dir))
    template = env.get_template("dashboard_template.html")
    
    html = template.render(
        css_content=css_content,
        nav_controls=nav_controls,
        display_total_members=display_total_members,
        trend_total_html=trend_total_html,
        active_14_days=active_14_days,
        trend_active_html=trend_active_html,
        raid_ready_count=raid_ready_count,
        trend_ready_html=trend_ready_html,
        avg_level=avg_level,
        class_badges_html=class_badges_html,
        timeline_html=timeline_html,
        safe_config=safe_config,
        safe_heatmap_data=safe_heatmap_data,
        js_content=js_content
    )
    
    with open("index.html", "w", encoding="utf-8") as f:
        f.write(html)