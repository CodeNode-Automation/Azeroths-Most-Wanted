import json


WAR_EFFORT_CATEGORY_ORDER = ("xp", "hk", "loot", "zenith", "readiness")
WAR_EFFORT_CATEGORY_LABELS = {
    "xp": "Hero's Journey",
    "hk": "Blood of the Enemy",
    "loot": "Dragon's Hoard",
    "zenith": "The Zenith Cohort",
    "readiness": "Warden's Standard",
}

LADDER_CATEGORY_ORDER = ("pve", "pvp")
LADDER_CATEGORY_LABELS = {
    "pve": "PvE",
    "pvp": "PvP",
}


def parse_archive_name_list(raw_value):
    try:
        parsed = json.loads(raw_value or "[]")
    except Exception:
        parsed = []

    if not isinstance(parsed, list):
        return []

    names = []
    for name in parsed:
        clean_name = str(name or "").strip()
        if clean_name:
            names.append(clean_name)

    return names


def build_campaign_archive_payload(war_effort_rows=None, ladder_rows=None, reigning_rows=None):
    archive_by_week = {}
    war_effort_rows = war_effort_rows or []
    ladder_rows = ladder_rows or []
    reigning_rows = reigning_rows or []

    def get_week_bucket(week_anchor):
        return archive_by_week.setdefault(
            week_anchor,
            {
                "week_anchor": week_anchor,
                "war_effort": {},
                "ladder": {category: [] for category in LADDER_CATEGORY_ORDER},
                "reigning_titles": {},
            },
        )

    for row in war_effort_rows:
        week_anchor = str(row.get("week_anchor") or "").strip()
        category = str(row.get("category") or "").strip().lower()
        if not week_anchor or not category:
            continue

        vanguards = parse_archive_name_list(row.get("vanguards"))
        participants = parse_archive_name_list(row.get("participants"))

        week_bucket = get_week_bucket(week_anchor)
        week_bucket["war_effort"][category] = {
            "category": category,
            "label": WAR_EFFORT_CATEGORY_LABELS.get(category, category.upper()),
            "vanguards": vanguards,
            "participants": participants,
            "participant_count": len(participants),
        }

    for row in reigning_rows:
        week_anchor = str(row.get("week_anchor") or "").strip()
        category = str(row.get("category") or "").strip().lower()
        champion = str(row.get("champion") or "").strip()
        if not week_anchor or not category or not champion:
            continue

        raw_score = row.get("score")
        try:
            score = int(raw_score or 0)
        except Exception:
            score = 0

        week_bucket = get_week_bucket(week_anchor)
        week_bucket["reigning_titles"][category] = {
            "category": category,
            "label": LADDER_CATEGORY_LABELS.get(category, category.upper()),
            "champion": champion,
            "score": score,
        }

    for row in ladder_rows:
        week_anchor = str(row.get("week_anchor") or "").strip()
        category = str(row.get("category") or "").strip().lower()
        champion = str(row.get("champion") or "").strip()
        if not week_anchor or not category or not champion:
            continue

        raw_rank = row.get("rank")
        raw_score = row.get("score")
        try:
            rank = int(raw_rank or 0)
        except Exception:
            rank = 0
        try:
            score = int(raw_score or 0)
        except Exception:
            score = 0

        week_bucket = get_week_bucket(week_anchor)
        week_bucket["ladder"].setdefault(category, []).append(
            {
                "rank": rank,
                "champion": champion,
                "score": score,
            }
        )

    week_anchors = sorted(archive_by_week.keys(), reverse=True)
    weeks = []

    for week_anchor in week_anchors:
        week_bucket = archive_by_week[week_anchor]
        war_effort_entries = [
            week_bucket["war_effort"][category]
            for category in WAR_EFFORT_CATEGORY_ORDER
            if category in week_bucket["war_effort"]
        ]
        reigning_entries = [
            week_bucket["reigning_titles"][category]
            for category in LADDER_CATEGORY_ORDER
            if category in week_bucket["reigning_titles"]
        ]
        ladder_entries = {
            category: sorted(
                week_bucket["ladder"].get(category, []),
                key=lambda entry: (entry.get("rank", 0), entry.get("champion", "")),
            )
            for category in LADDER_CATEGORY_ORDER
        }

        weeks.append(
            {
                "week_anchor": week_anchor,
                "war_effort": war_effort_entries,
                "reigning_titles": reigning_entries,
                "ladder": ladder_entries,
                "war_effort_entry_count": len(war_effort_entries),
                "ladder_entry_count": sum(len(entries) for entries in ladder_entries.values()),
                "reigning_entry_count": len(reigning_entries),
            }
        )

    return {
        "weeks": weeks,
        "latest_week": week_anchors[0] if week_anchors else "",
        "archived_weeks": len(week_anchors),
        "total_campaign_entries": len(war_effort_rows) + len(ladder_rows),
        "reigning_titles_logged": len(reigning_rows),
    }
