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
                
            if e_type == "badge":
                continue # Skip meta-achievements from the activity graph
                
            activity_counts[date_key]["total"] += 1
            if e_type == "level_up":
                activity_counts[date_key]["levels"] += 1
            elif e_type == "item":
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
        display_total_members=display_total_members,
        active_14_days=active_14_days,
        raid_ready_count=raid_ready_count,
        avg_level=avg_level,
        safe_config=safe_config,
        safe_heatmap_data=safe_heatmap_data,
        js_content=js_content
    )
    
    with open("index.html", "w", encoding="utf-8") as f:
        f.write(html)