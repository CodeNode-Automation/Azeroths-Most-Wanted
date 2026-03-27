import json
import os
from datetime import datetime, timezone, timedelta
from zoneinfo import ZoneInfo
from jinja2 import Environment, FileSystemLoader

def generate_html_dashboard(roster_data, realm_data=None, timeline_data=None, raw_guild_roster=None, roster_history=None, prev_mvps=None):
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

    berlin_tz = ZoneInfo("Europe/Berlin")

    activity_counts = {}
    for event in timeline_data:
        ts = event.get("timestamp", "")
        e_type = event.get("type", "item")
        try:
            # Convert UTC timestamp to Berlin timezone
            dt_utc = datetime.fromisoformat(ts.replace('Z', '+00:00'))
            dt_berlin = dt_utc.astimezone(berlin_tz)
            date_key = dt_berlin.strftime("%Y-%m-%d")
            
            if date_key not in activity_counts:
                activity_counts[date_key] = {"total": 0, "loot": 0, "levels": 0}
                
            activity_counts[date_key]["total"] += 1
            if e_type == "level_up":
                activity_counts[date_key]["levels"] += 1
            else:
                activity_counts[date_key]["loot"] += 1
        except Exception:
            pass

    today_berlin = datetime.now(berlin_tz)
    heatmap_data = []
    for i in range(6, -1, -1):
        day = today_berlin - timedelta(days=i)
        d_str = day.strftime("%Y-%m-%d")
        day_name = day.strftime("%a")
        day_data = activity_counts.get(d_str, {"total": 0, "loot": 0, "levels": 0})
        
        # --- Grab historical stats if they exist in the DB for this date ---
        hist_data = roster_history.get(d_str, {})
        
        # Ensure 'today' always has the live exact count
        if i == 0:
            hist_total = display_total_members
            hist_active = active_14_days
        else:
            hist_total = hist_data.get('total_roster')
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
            <button class="mobile-menu-toggle" aria-label="Toggle Menu">
                <span></span><span></span><span></span>
            </button>
            
            <div class="nav-links-container">
                <a href="#" class="nav-btn nav-btn-home"><span class="home-text">🏰 Home Dashboard</span></a>
                
                <div style="color: #888; font-size: 11px; font-family: 'Cinzel'; font-weight: bold; padding: 15px 15px 5px 15px; border-bottom: 1px solid #333; width: 85%; margin-bottom: 5px;">WAR EFFORT</div>
                <a href="#war-effort-xp" class="nav-btn">🛡️ Hero's Journey</a>
                <a href="#war-effort-hk" class="nav-btn">🩸 Blood of the Enemy</a>
                <a href="#war-effort-loot" class="nav-btn">🐉 Dragon's Hoard</a>
                <a href="#war-effort-zenith" class="nav-btn">⚡ The Zenith Cohort</a>
                
                <div style="color: #888; font-size: 11px; font-family: 'Cinzel'; font-weight: bold; padding: 15px 15px 5px 15px; border-bottom: 1px solid #333; width: 85%; margin-bottom: 5px;">GUILD DATA</div>
                <a href="#ladder-pve" class="nav-btn">👑 PvE Leaderboard</a>
                <a href="#ladder-pvp" class="nav-btn">⚔️ PvP Leaderboard</a>
                <a href="#analytics" class="nav-btn">📊 Advanced Analytics</a>
                
                <div style="color: #888; font-size: 11px; font-family: 'Cinzel'; font-weight: bold; padding: 15px 15px 5px 15px; border-bottom: 1px solid #333; width: 85%; margin-bottom: 5px;">COMMUNITY & INFO</div>
                <a href="#architecture" class="nav-btn">⚙️ Architecture</a>
                <a href="https://discord.gg/t6mufeWRNK" target="_blank" class="nav-btn" style="color: #5865F2;">💬 Join Discord</a>
            </div>

            <div class="custom-select-wrapper" role="combobox" aria-expanded="false" aria-haspopup="listbox" aria-controls="customCharOptions">
                <div class="custom-select" id="customCharSelect" tabindex="0">
                    <span class="selected-value">Select View...</span>
                    <span style="font-size: 12px; color: #aaa;">▼</span>
                </div>
                <div class="custom-select-options" id="customCharOptions" role="listbox">
                    <div class="custom-option" data-value="total" role="option">
                        <span style="font-size:16px;">🌍</span> View Entire Guild
                    </div>
                    <div class="custom-option" data-value="active" role="option">
                        <span style="font-size:16px;">🔥</span> Active Roster (14 Days)
                    </div>
                    <div class="custom-option" data-value="raidready" role="option">
                        <span style="font-size:16px;">⚔️</span> Raid Ready (Lvl 70)
                    </div>
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
        # We only generate the shell and the filters here.
        # The actual events are loaded from timeline.json via JavaScript to keep index.html tiny.
        timeline_html += f"""
        <div id="timeline" class="timeline-container">
            <h2 id="timeline-title" class="timeline-title">📜 Guild Recent Activity</h2>
            <div class="timeline-filters">
                <div class="filter-group">
                    <button class="tl-btn" data-type="all">All</button>
                    <button class="tl-btn active" style="color: #0070dd; border-color: rgba(0, 112, 221, 0.5);" data-type="rare_plus">Rare+</button>
                    <button class="tl-btn" style="color: #a335ee; border-color: rgba(163, 53, 238, 0.5);" data-type="epic">Epics+</button>
                    <button class="tl-btn" data-type="level_up">Levels</button>
                </div>
                <div class="filter-group">
                    <select id="tl-date-filter" class="tl-select">
                        <option value="12">Last 12 Hours</option>
                        <option value="24">Last 24 Hours</option>
                        <option value="48">Last 48 Hours</option>
                        <option value="all" selected>All Available</option>
                    </select>
                </div>
            </div>
            
            <div class="timeline-feed" id="timeline-feed-container">
                </div>

            <div style="text-align: center; margin-top: 20px; margin-bottom: 40px;">
                <button id="load-more-btn" style="padding: 10px 20px; cursor: pointer; display: none; background: rgba(0,0,0,0.8); color: #ffd100; border: 1px solid #ffd100; border-radius: 4px; font-family: 'Cinzel', serif; transition: all 0.3s ease;">Load More Activity</button>
            </div>
        </div>
        """
        
    # [The rest of your script continues here with base_dir = os.path.dirname...]

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
        "raid_ready_count": raid_ready_count,
        "prev_mvps": prev_mvps
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