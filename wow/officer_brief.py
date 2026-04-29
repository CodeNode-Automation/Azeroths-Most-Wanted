"""Pure helpers for compact officer-facing roster health summaries."""

from __future__ import annotations

from typing import Any

OFFICER_BRIEF_TITLE = "Officer Brief"
OFFICER_BRIEF_EMPTY_TEXT = "No roster health signals are available yet."
OFFICER_BRIEF_LIMIT = 5

ACTIVITY_STEADY_RATIO = 0.35
ACTIVITY_BUILDING_RATIO = 0.2
READY_STEADY_RATIO = 0.08
READY_BUILDING_RATIO = 0.04
RAID_READY_TARGET_ILVL = 110
RAID_READY_BUILDING_ILVL = 100


def _clean_int(value: Any, default: int = 0) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def _extract_source(roster_summary: Any) -> dict[str, Any]:
    if not isinstance(roster_summary, dict):
        return {}

    global_metrics = roster_summary.get("global_metrics")
    if isinstance(global_metrics, dict) and global_metrics:
        return global_metrics

    return roster_summary


def _extract_roster_metrics(roster_summary: Any) -> dict[str, int]:
    source = _extract_source(roster_summary)

    return {
        "total_members": _clean_int(source.get("total_members") or source.get("total"), 0),
        "active_14_days": _clean_int(source.get("active_14_days") or source.get("active"), 0),
        "raid_ready_count": _clean_int(source.get("raid_ready_count") or source.get("raid_ready"), 0),
        "avg_ilvl_70": _clean_int(source.get("avg_ilvl_70") or source.get("avg_ilvl"), 0),
        "total_members_mains": _clean_int(source.get("total_members_mains"), 0),
        "active_14_days_mains": _clean_int(source.get("active_14_days_mains"), 0),
        "raid_ready_count_mains": _clean_int(source.get("raid_ready_count_mains"), 0),
        "avg_ilvl_70_mains": _clean_int(source.get("avg_ilvl_70_mains"), 0),
    }


def _format_count(count: int, singular: str, plural: str | None = None) -> str:
    suffix = singular if count == 1 else (plural or f"{singular}s")
    return f"{count} {suffix}"


def _extract_membership_item(membership_movement: Any) -> list[dict[str, Any]]:
    if not isinstance(membership_movement, dict):
        return []

    total = _clean_int(membership_movement.get("total"), 0)
    if total <= 0:
        return []

    if membership_movement.get("bootstrap"):
        return [
            {
                "type": "movement",
                "label": f"Roster baseline captured from {total} members",
                "tone": "neutral",
            }
        ]

    joined = _clean_int(membership_movement.get("joined"), 0)
    departed = _clean_int(membership_movement.get("departed"), 0)
    rejoined = _clean_int(membership_movement.get("rejoined"), 0)

    parts = []
    if joined > 0:
        parts.append(_format_count(joined, "joined", "joined"))
    if departed > 0:
        parts.append(_format_count(departed, "departed", "departed"))
    if rejoined > 0:
        parts.append(_format_count(rejoined, "rejoined", "rejoined"))

    if not parts:
        return []

    tone = "watch" if departed > 0 else "positive"
    if departed == 0 and not (joined or rejoined):
        tone = "neutral"

    label = "Latest movement scan recorded " + ", ".join(parts)
    return [
        {
            "type": "movement",
            "label": label,
            "tone": tone,
        }
    ]


def _extract_activity_item(roster_metrics: dict[str, int]) -> list[dict[str, Any]]:
    total = roster_metrics["total_members"]
    active = roster_metrics["active_14_days"]

    if total <= 0 and active <= 0:
        return []

    if total <= 0:
        return [
            {
                "type": "activity",
                "label": "Activity is still being established",
                "tone": "neutral",
            }
        ]

    active_ratio = active / total if total > 0 else 0

    if active > 0 and active_ratio >= ACTIVITY_STEADY_RATIO:
        return [
            {
                "type": "activity",
                "label": f"Activity steady: {_format_count(active, 'recently active member', 'recently active members')}",
                "tone": "positive",
            }
        ]

    if active > 0 and active_ratio >= ACTIVITY_BUILDING_RATIO:
        return [
            {
                "type": "activity",
                "label": f"Activity building: {_format_count(active, 'recently active member', 'recently active members')}",
                "tone": "neutral",
            }
        ]

    if active > 0:
        return [
            {
                "type": "activity",
                "label": f"Activity light: {_format_count(active, 'recently active member', 'recently active members')}",
                "tone": "watch",
            }
        ]

    return [
        {
            "type": "activity",
            "label": "Activity is light in the latest snapshot",
            "tone": "watch",
        }
    ]


def _extract_readiness_item(roster_metrics: dict[str, int]) -> list[dict[str, Any]]:
    total = roster_metrics["total_members"]
    ready = roster_metrics["raid_ready_count"]
    avg_ilvl = roster_metrics["avg_ilvl_70"]

    if total <= 0 and ready <= 0 and avg_ilvl <= 0:
        return []

    if ready <= 0:
        if total <= 0:
            return []
        return [
            {
                "type": "readiness",
                "label": "Raid readiness is still building",
                "tone": "neutral",
            }
        ]

    ready_ratio = ready / total if total > 0 else 1
    if ready > 0 and (ready_ratio >= READY_STEADY_RATIO or avg_ilvl >= RAID_READY_TARGET_ILVL):
        label = f"Readiness holding: {_format_count(ready, 'raid-ready member tracked', 'raid-ready members tracked')}"
        tone = "positive"
    elif ready > 0 and (ready_ratio >= READY_BUILDING_RATIO or avg_ilvl >= RAID_READY_BUILDING_ILVL):
        label = f"Readiness building: {_format_count(ready, 'raid-ready member tracked', 'raid-ready members tracked')}"
        tone = "neutral"
    elif ready > 0:
        label = f"Readiness still building: {_format_count(ready, 'raid-ready member tracked', 'raid-ready members tracked')}"
        tone = "neutral"
    else:
        label = "Raid readiness is still building"
        tone = "neutral"

    return [
        {
            "type": "readiness",
            "label": label,
            "tone": tone,
        }
    ]


def _latest_changes_has_supporting_items(latest_changes: Any) -> bool:
    if not isinstance(latest_changes, dict):
        return False

    change_items = latest_changes.get("items")
    if not isinstance(change_items, list):
        return False

    for item in change_items:
        if not isinstance(item, dict):
            continue

        item_type = str(item.get("type") or "").strip().lower()
        if item_type and item_type != "movement":
            return True

    return False


def _latest_changes_has_movement_item(latest_changes: Any) -> bool:
    if not isinstance(latest_changes, dict):
        return False

    change_items = latest_changes.get("items")
    if not isinstance(change_items, list):
        return False

    for item in change_items:
        if not isinstance(item, dict):
            continue

        item_type = str(item.get("type") or "").strip().lower()
        if item_type == "movement":
            return True

    return False


def _latest_changes_has_watch_signal(latest_changes: Any) -> bool:
    if not isinstance(latest_changes, dict):
        return False

    change_items = latest_changes.get("items")
    if not isinstance(change_items, list):
        return False

    for item in change_items:
        if not isinstance(item, dict):
            continue

        item_type = str(item.get("type") or "").strip().lower()
        if item_type == "movement":
            continue

        if str(item.get("tone") or "").strip().lower() == "watch":
            return True

    return False


def _extract_trend_item(trend_data: Any) -> list[dict[str, Any]]:
    if not isinstance(trend_data, dict):
        return []

    source = trend_data.get("global_trends") if isinstance(trend_data.get("global_trends"), dict) else trend_data
    if not isinstance(source, dict) or not source:
        return []

    trend_groups = (
        ("trend_active_mains", "trend_ready_mains", "trend_total_mains"),
        ("trend_active", "trend_ready", "trend_total"),
    )

    for keys in trend_groups:
        values = [_clean_int(source.get(key), 0) for key in keys]
        if not any(values):
            continue

        positive = sum(value for value in values if value > 0)
        negative = sum(value for value in values if value < 0)

        if positive > 0 and negative < 0:
            label = "Recent trend is mixed but still manageable"
            tone = "neutral"
        elif positive > 0:
            label = "Recent trend is slightly positive"
            tone = "positive"
        elif negative < 0:
            label = "Recent trend needs a watch"
            tone = "watch"
        else:
            label = "Recent trend is flat"
            tone = "neutral"

        return [
            {
                "type": "trend",
                "label": label,
                "tone": tone,
            }
        ]

    return []


def _extract_war_effort_item(war_effort: Any) -> list[dict[str, Any]]:
    if not isinstance(war_effort, dict):
        return []

    progress = []
    for key, label in (
        ("xp", "Hero's Journey"),
        ("hk", "Blood of the Enemy"),
        ("loot", "Dragon's Hoard"),
        ("zenith", "The Zenith Cohort"),
    ):
        raw_value = war_effort.get(key)
        if isinstance(raw_value, dict):
            current = _clean_int(raw_value.get("current") or raw_value.get("value"), 0)
            target = _clean_int(raw_value.get("target") or raw_value.get("threshold"), 0)
            if current <= 0 or target <= 0:
                continue
            progress.append((current, target, label))

    if not progress:
        return []

    current, target, label = max(progress, key=lambda item: (item[0] / item[1]) if item[1] else 0)
    ratio = current / target if target else 0
    if ratio >= 1:
        return [
            {
                "type": "war_effort",
                "label": f"{label} has already been completed this cycle",
                "tone": "positive",
            }
        ]

    if ratio >= 0.75:
        tone = "positive"
        prefix = "War effort is strong"
    elif ratio >= 0.4:
        tone = "neutral"
        prefix = "War effort is building"
    else:
        tone = "neutral"
        prefix = "War effort is still gathering pace"

    return [
        {
            "type": "war_effort",
            "label": f"{prefix} on {label}",
            "tone": tone,
        }
    ]


def _pick_summary_and_status(items: list[dict[str, Any]], roster_metrics: dict[str, int], membership_movement: Any, latest_changes: Any) -> tuple[str, str, str]:
    if not items:
        return ("No roster health signals are available yet.", "Unknown", "neutral")

    movement = membership_movement if isinstance(membership_movement, dict) else {}
    bootstrap = bool(movement.get("bootstrap"))
    departed = _clean_int(movement.get("departed"), 0)

    total = roster_metrics["total_members"]
    active = roster_metrics["active_14_days"]
    ready = roster_metrics["raid_ready_count"]
    active_ratio = active / total if total > 0 else 0

    watch_signals = departed > 0 or any(item["tone"] == "watch" for item in items) or _latest_changes_has_watch_signal(latest_changes)
    positive_signals = ready > 0 and active_ratio >= ACTIVITY_BUILDING_RATIO and departed == 0

    if bootstrap and not watch_signals:
        return (
            "Roster baseline captured; health will sharpen on the next scan.",
            "Building",
            "neutral",
        )

    if watch_signals:
        return (
            "Roster health needs a watch, but the guild remains active.",
            "Watch",
            "watch",
        )

    if positive_signals:
        return (
            "Roster activity is steady with raid readiness holding.",
            "Stable",
            "positive",
        )

    return (
        "Roster health is building, with activity present but still maturing.",
        "Building",
        "neutral",
    )


def build_officer_brief(*, roster_summary=None, membership_movement=None, latest_changes=None, trend_data=None, war_effort=None, limit=OFFICER_BRIEF_LIMIT, title=OFFICER_BRIEF_TITLE):
    """Build a compact, conservative officer brief from existing summary inputs.

    The helper stays intentionally small:
    - it prefers current roster snapshot counts
    - it treats membership movement as the primary churn signal
    - it uses latest changes and trend data only as supporting context
    - it never invents signals that are not present in the supplied data
    """
    roster_metrics = _extract_roster_metrics(roster_summary)

    items: list[dict[str, Any]] = []
    movement_items = _extract_membership_item(membership_movement)
    movement = membership_movement if isinstance(membership_movement, dict) else {}
    bootstrap = bool(movement.get("bootstrap"))
    if not (bootstrap and _latest_changes_has_movement_item(latest_changes)):
        items.extend(movement_items)
    items.extend(_extract_activity_item(roster_metrics))
    items.extend(_extract_readiness_item(roster_metrics))
    trend_items = _extract_trend_item(trend_data)
    if trend_items:
        trend_item = trend_items[0]
        should_include_trend = (
            trend_item.get("tone") == "watch"
            or not _latest_changes_has_supporting_items(latest_changes)
            or len(items) < 3
        )
        if should_include_trend:
            items.extend(trend_items)
    items.extend(_extract_war_effort_item(war_effort))

    try:
        safe_limit = int(limit)
    except (TypeError, ValueError):
        safe_limit = OFFICER_BRIEF_LIMIT
    safe_limit = max(0, safe_limit)

    trimmed_items = items[:safe_limit] if safe_limit else []
    summary, status, tone = _pick_summary_and_status(trimmed_items, roster_metrics, membership_movement, latest_changes)

    if not trimmed_items:
        return {
            "title": title or OFFICER_BRIEF_TITLE,
            "status": "Unknown",
            "tone": "neutral",
            "summary": summary,
            "items": [],
            "empty": True,
            "empty_text": OFFICER_BRIEF_EMPTY_TEXT,
        }

    return {
        "title": title or OFFICER_BRIEF_TITLE,
        "status": status,
        "tone": tone,
        "summary": summary,
        "items": trimmed_items,
        "empty": False,
        "empty_text": OFFICER_BRIEF_EMPTY_TEXT,
    }
