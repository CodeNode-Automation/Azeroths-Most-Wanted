import json
import os
from datetime import datetime, timezone, timedelta
from zoneinfo import ZoneInfo
from jinja2 import Environment, FileSystemLoader

from wow.alts import is_alt_record

def generate_html_dashboard(roster_data, realm_data=None, timeline_data=None, raw_guild_roster=None, roster_history=None, prev_mvps=None, campaign_archive=None):
    """
    Generates the interactive, high-performance HTML dashboard utilizing Jinja2 templates.
    """
    if not timeline_data:
        timeline_data = []
    if not raw_guild_roster:
        raw_guild_roster = []
    if not roster_history:
        roster_history = {}
    if not campaign_archive:
        campaign_archive = {}

    # Safely filter out any characters whose profile failed to load from the API
    roster_data = [char for char in roster_data if char and isinstance(char.get("profile"), dict)]
    realm_data = realm_data or {}
    global_metrics = realm_data.get("global_metrics") or {}
    global_trends = realm_data.get("global_trends") or {}

    last_updated_iso = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    sorted_stats_roster = sorted(roster_data, key=lambda x: (
        x.get("profile", {}).get("level", 0),
        x.get("profile", {}).get("equipped_item_level", 0)
    ), reverse=True)

    total_processed = len(roster_data)
    total_level = 0
    active_14_days = 0 
    active_14_days_mains = 0
    raid_ready_count = 0
    raid_ready_count_mains = 0
    total_ilvl_70 = 0
    ilvl_70_count = 0
    main_total_ilvl_70 = 0
    main_ilvl_70_count = 0
    
    current_time_ms = int(datetime.now(timezone.utc).timestamp() * 1000)
    fourteen_days_ms = 14 * 24 * 60 * 60 * 1000 
    
    for char in roster_data:
        p = char.get("profile", {})
        lvl = p.get('level', 0)
        ilvl = p.get('equipped_item_level', 0)
        is_main = not is_alt_record(char)
        
        if isinstance(lvl, int): 
            total_level += lvl
            
        if lvl == 70 and ilvl >= 110:
            raid_ready_count += 1
            if is_main:
                raid_ready_count_mains += 1

        if lvl == 70 and ilvl > 0:
            total_ilvl_70 += ilvl
            ilvl_70_count += 1

        if is_main and lvl == 70 and ilvl > 0:
            main_total_ilvl_70 += ilvl
            main_ilvl_70_count += 1
            
        last_login = p.get('last_login_timestamp', 0)
        if current_time_ms - last_login <= fourteen_days_ms:
            active_14_days += 1
            if is_main:
                active_14_days_mains += 1
            
    avg_level = (total_level // total_processed) if total_processed > 0 else 0
    fallback_total_members = len(raw_guild_roster)
    fallback_total_members_mains = sum(1 for record in raw_guild_roster if not is_alt_record(record))
    fallback_avg_ilvl_70 = round(total_ilvl_70 / ilvl_70_count) if ilvl_70_count > 0 else 0
    fallback_avg_ilvl_70_mains = round(main_total_ilvl_70 / main_ilvl_70_count) if main_ilvl_70_count > 0 else 0

    display_total_members = global_metrics.get("total_members", fallback_total_members)
    total_members_mains = global_metrics.get("total_members_mains", fallback_total_members_mains)
    active_14_days = global_metrics.get("active_14_days", active_14_days)
    active_14_days_mains = global_metrics.get("active_14_days_mains", active_14_days_mains)
    raid_ready_count = global_metrics.get("raid_ready_count", raid_ready_count)
    raid_ready_count_mains = global_metrics.get("raid_ready_count_mains", raid_ready_count_mains)
    avg_ilvl_70 = global_metrics.get("avg_ilvl_70", fallback_avg_ilvl_70)
    avg_ilvl_70_mains = global_metrics.get("avg_ilvl_70_mains", fallback_avg_ilvl_70_mains)

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
            hist_total_mains = total_members_mains
            hist_active = active_14_days
            hist_active_mains = active_14_days_mains
        else:
            hist_total = hist_data.get('total_roster')
            hist_total_mains = hist_data.get('total_roster_mains')
            hist_active = hist_data.get('active_roster')
            hist_active_mains = hist_data.get('active_roster_mains')

        heatmap_data.append({
            "date": d_str, 
            "day_name": day_name, 
            "count": day_data["total"],
            "loot": day_data["loot"],
            "levels": day_data["levels"],
            "total_roster": hist_total,
            "total_roster_mains": hist_total_mains,
            "active_roster": hist_active,
            "active_roster_mains": hist_active_mains
        })

    safe_heatmap_data = json.dumps(heatmap_data)

    base_dir = os.path.dirname(__file__)

    try:
        css_sources = [
            os.path.join(base_dir, "src", "css", "base", "foundation.css"),
            os.path.join(base_dir, "src", "css", "features", "architecture", "pipelines.css"),
            os.path.join(base_dir, "src", "css", "layout", "footer.css"),
            os.path.join(base_dir, "src", "css", "features", "timeline", "activity.css"),
            os.path.join(base_dir, "src", "css", "base", "animations.css"),
            os.path.join(base_dir, "src", "css", "features", "campaign", "archive.css"),
            os.path.join(base_dir, "src", "css", "features", "character", "dossier.css"),
            os.path.join(base_dir, "style.css"),
        ]
        css_chunks = []
        for css_path in css_sources:
            with open(css_path, "r", encoding="utf-8") as f:
                css_chunks.append(f.read())
        css_content = "\n\n".join(css_chunks)
    except FileNotFoundError:
        css_content = ""

    try:
        js_sources = [
            os.path.join(base_dir, "src", "js", "core", "formatting.js"),
            os.path.join(base_dir, "src", "js", "core", "data.js"),
            os.path.join(base_dir, "src", "js", "core", "dom.js"),
            os.path.join(base_dir, "src", "js", "features", "command_hall", "command_shell.js"),
            os.path.join(base_dir, "src", "js", "features", "command_hall", "hall_renderers.js"),
            os.path.join(base_dir, "src", "js", "features", "character_dossier", "dossier_view.js"),
            os.path.join(base_dir, "src", "js", "features", "campaign_archive", "archive_view.js"),
            os.path.join(base_dir, "src", "js", "features", "ladder", "ladder_shell.js"),
            os.path.join(base_dir, "src", "js", "features", "home_analytics", "analytics_cards.js"),
            os.path.join(base_dir, "src", "js", "features", "home_analytics", "analytics_selectors.js"),
            os.path.join(base_dir, "src", "js", "features", "home_analytics", "home_overview.js"),
            os.path.join(base_dir, "src", "js", "features", "war_effort", "war_effort_shell.js"),
            os.path.join(base_dir, "script.js"),
        ]
        js_chunks = []
        for js_path in js_sources:
            with open(js_path, "r", encoding="utf-8") as f:
                js_chunks.append(f.read())
        js_content = "\n\n".join(js_chunks)
    except FileNotFoundError:
        js_content = ""

    os.makedirs("asset", exist_ok=True)
    with open("asset/roster.json", "w", encoding="utf-8") as f:
        json.dump(sorted_stats_roster, f)
    with open("asset/raw_roster.json", "w", encoding="utf-8") as f:
        json.dump(raw_guild_roster, f)

    dashboard_config = {
        "last_updated": last_updated_iso,
        "total_members": display_total_members,
        "total_members_mains": total_members_mains,
        "active_14_days": active_14_days,
        "active_14_days_mains": active_14_days_mains,
        "raid_ready_count": raid_ready_count,
        "raid_ready_count_mains": raid_ready_count_mains,
        "avg_ilvl_70": avg_ilvl_70,
        "avg_ilvl_70_mains": avg_ilvl_70_mains,
        "global_trends": global_trends,
        "prev_mvps": prev_mvps,
        "campaign_archive": campaign_archive,
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
