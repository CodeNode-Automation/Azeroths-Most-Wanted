import json
import os
from datetime import datetime, timezone

from render.html_dashboard import generate_html_dashboard
from wow.campaign_archive import build_campaign_archive_payload
from wow.turso import fetch_turso


def write_timeline_output(dashboard_feed):
    os.makedirs("asset", exist_ok=True)
    with open("asset/timeline.json", "w", encoding="utf-8") as f:
        json.dump(dashboard_feed, f, ensure_ascii=False)


def write_api_status_output(ok, code=None, message="", source="guild_roster"):
    os.makedirs("asset", exist_ok=True)
    payload = {
        "ok": bool(ok),
        "code": code,
        "source": source,
        "message": message,
        "updated_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
    }
    with open("asset/api_status.json", "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False)


async def finalize_dashboard_output(session, roster_data, realm_data, dashboard_feed, raw_guild_roster, prev_mvps):
    write_timeline_output(dashboard_feed)
    roster_history_rows = await fetch_turso(session, "SELECT * FROM daily_roster_stats ORDER BY date DESC LIMIT 7")
    roster_history = {row["date"]: row for row in roster_history_rows}
    war_effort_history_rows = await fetch_turso(
        session,
        "SELECT week_anchor, category, vanguards, participants FROM war_effort_history ORDER BY week_anchor DESC, category ASC",
    )
    ladder_history_rows = await fetch_turso(
        session,
        "SELECT week_anchor, category, rank, champion, score FROM ladder_history ORDER BY week_anchor DESC, category ASC, rank ASC",
    )
    reigning_champs_history_rows = await fetch_turso(
        session,
        "SELECT week_anchor, category, champion, score FROM reigning_champs_history ORDER BY week_anchor DESC, category ASC",
    )
    campaign_archive = build_campaign_archive_payload(
        war_effort_history_rows,
        ladder_history_rows,
        reigning_champs_history_rows,
    )

    generate_html_dashboard(
        roster_data,
        realm_data,
        dashboard_feed,
        raw_guild_roster,
        roster_history,
        prev_mvps,
        campaign_archive,
    )