"""Pure helpers for compact officer-facing change summaries."""

from __future__ import annotations

from collections import Counter
from typing import Any

CHANGE_SUMMARY_TITLE = "Latest Changes"
CHANGE_SUMMARY_EMPTY_TEXT = "No notable changes recorded yet."
CHANGE_SUMMARY_BOOTSTRAP_EMPTY_TEXT = "Activity and trend changes will appear after comparison scans detect movement beyond the baseline."

TIMELINE_EVENT_ORDER = ("level_up", "item", "badge")
TIMELINE_EVENT_LABELS = {
    "level_up": ("level-up recorded", "level-ups recorded"),
    "item": ("gear upgrade recorded", "gear upgrades recorded"),
    "badge": ("award recorded", "awards recorded"),
}


def _clean_int(value: Any, default: int = 0) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def _format_count(count: int, singular: str, plural: str | None = None) -> str:
    suffix = singular if count == 1 else (plural or f"{singular}s")
    return f"{count} {suffix}"


def _extract_membership_movement_item(membership_movement: Any) -> list[dict[str, Any]]:
    if not isinstance(membership_movement, dict):
        return []

    total = _clean_int(membership_movement.get("total"), 0)
    if total <= 0:
        return []

    if membership_movement.get("bootstrap"):
        return []

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

    return [
        {
            "type": "movement",
            "label": ", ".join(parts),
            "tone": "neutral",
        }
    ]


def _extract_raw_roster_delta_item(trend_data: Any, membership_movement: Any, movement_items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    if movement_items:
        return []

    if isinstance(membership_movement, dict) and membership_movement.get("bootstrap"):
        return []

    source = _extract_trend_source(trend_data)
    if not source:
        return []

    raw_delta = _clean_int(source.get("trend_total"), 0)
    if raw_delta == 0:
        return []

    direction = "increased" if raw_delta > 0 else "decreased"
    return [
        {
            "type": "movement",
            "label": f"Guild roster {direction} by {abs(raw_delta)} since the previous scan.",
            "tone": "neutral",
        }
    ]


def _extract_timeline_items(timeline_events: Any) -> list[dict[str, Any]]:
    counts = Counter()

    for row in timeline_events or []:
        if not isinstance(row, dict):
            continue

        event_type = str(row.get("type") or row.get("event_type") or "").strip().lower()
        if not event_type:
            continue

        if event_type in TIMELINE_EVENT_ORDER:
            counts[event_type] += 1
        else:
            counts["other"] += 1

    items = []
    for event_type in TIMELINE_EVENT_ORDER:
        count = counts.get(event_type, 0)
        if count > 0:
            singular_label, plural_label = TIMELINE_EVENT_LABELS[event_type]
            items.append(
                {
                    "type": event_type,
                    "label": _format_count(count, singular_label, plural_label),
                    "tone": "positive" if event_type in {"level_up", "item"} else "neutral",
                }
            )

    other_count = counts.get("other", 0)
    if other_count > 0:
        items.append(
            {
                "type": "other",
                "label": _format_count(other_count, "other update"),
                "tone": "neutral",
            }
        )

    return items


def _extract_trend_source(trend_data: Any) -> dict[str, Any]:
    if isinstance(trend_data, dict):
        nested = trend_data.get("global_trends")
        if isinstance(nested, dict) and nested:
            return nested
        return trend_data

    return {}


def _extract_trend_item(trend_data: Any, *, allow_total_trend: bool = True) -> list[dict[str, Any]]:
    source = _extract_trend_source(trend_data)
    if not source:
        return []

    preferred_groups = [
        (
            ("trend_active_mains", "active mains"),
            ("trend_ready_mains", "raid-ready mains"),
            ("trend_total_mains", "roster mains"),
        ),
    ]

    if allow_total_trend:
        preferred_groups.append(
            (
                ("trend_active", "active"),
                ("trend_ready", "raid-ready"),
                ("trend_total", "roster"),
            )
        )
    else:
        preferred_groups.append(
            (
                ("trend_active", "active"),
                ("trend_ready", "raid-ready"),
            )
        )

    for group in preferred_groups:
        parts = []
        for key, label in group:
            value = _clean_int(source.get(key), 0)
            if value != 0:
                sign = "+" if value > 0 else ""
                parts.append(f"{sign}{value} {label}")

        if parts:
            return [
                {
                    "type": "trend",
                    "label": f"Daily trend vs previous snapshot: {', '.join(parts[:3])}",
                    "tone": "trend",
                }
            ]

    return []


def build_change_summary(*, membership_movement=None, timeline_events=None, trend_data=None, limit=5, title=CHANGE_SUMMARY_TITLE):
    """Build a compact, deterministic summary of the latest meaningful changes.

    The helper is intentionally conservative:
    - movement is summarized first
    - timeline events are grouped by event type
    - trend deltas are labeled as daily snapshot deltas so they do not overstate
      exact scan-to-scan precision
    """
    items = []
    movement_items = _extract_membership_movement_item(membership_movement)
    items.extend(movement_items)
    raw_roster_delta_items = _extract_raw_roster_delta_item(trend_data, membership_movement, movement_items)
    items.extend(raw_roster_delta_items)
    items.extend(_extract_timeline_items(timeline_events))
    items.extend(_extract_trend_item(trend_data, allow_total_trend=not raw_roster_delta_items))

    try:
        safe_limit = int(limit)
    except (TypeError, ValueError):
        safe_limit = 0
    safe_limit = max(0, safe_limit)

    trimmed_items = items[:safe_limit] if safe_limit else []

    bootstrap_only = (
        isinstance(membership_movement, dict)
        and bool(membership_movement.get("bootstrap"))
        and not trimmed_items
    )

    return {
        "title": title or CHANGE_SUMMARY_TITLE,
        "items": trimmed_items,
        "empty": not trimmed_items,
        "empty_text": CHANGE_SUMMARY_BOOTSTRAP_EMPTY_TEXT if bootstrap_only else CHANGE_SUMMARY_EMPTY_TEXT,
    }
