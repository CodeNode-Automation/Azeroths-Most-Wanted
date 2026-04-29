"""Pure helpers for guild membership movement detection."""

from __future__ import annotations

from typing import Any, Iterable

from wow.turso import fetch_turso, push_turso_batch

EVENT_TYPE_PRIORITY = {
    "joined": 0,
    "rejoined": 1,
    "departed": 2,
}

KNOWN_STATUSES = {"active", "departed"}
MEMBERSHIP_EVENT_INSERT_QUERY = """
    INSERT INTO guild_membership_events
    (scan_id, character_name, event_type, detected_at, previous_status, current_status)
    VALUES (?, ?, ?, ?, ?, ?)
"""


def _normalize_name(value: Any) -> str | None:
    clean = str(value or "").strip()
    return clean.lower() or None


def _format_display_name(candidate: Any, normalized_name: str) -> str:
    clean = str(candidate or "").strip()
    if clean and clean != clean.lower() and clean != clean.upper():
        return clean
    return normalized_name.title()


def _extract_name_fields(row: Any) -> tuple[str | None, str | None]:
    if isinstance(row, dict):
        candidate = row.get("character_name") or row.get("name") or row.get("display_name")
        display_name = row.get("display_name") or row.get("character_name") or row.get("name")
        return _normalize_name(candidate), display_name

    return _normalize_name(row), row


def _normalize_status(value: Any) -> str | None:
    clean = str(value or "").strip().lower()
    return clean if clean in KNOWN_STATUSES else None


def _coerce_current_names(current_names: Iterable[Any]) -> dict[str, str]:
    current_map: dict[str, str] = {}

    for row in current_names or []:
        normalized_name, display_name = _extract_name_fields(row)
        if not normalized_name or normalized_name in current_map:
            continue

        current_map[normalized_name] = _format_display_name(display_name, normalized_name)

    return current_map


def _coerce_previous_status_rows(previous_status_rows: Iterable[Any]) -> dict[str, dict[str, Any]]:
    previous_map: dict[str, dict[str, Any]] = {}

    for row in previous_status_rows or []:
        if not isinstance(row, dict):
            continue

        normalized_name, display_name = _extract_name_fields(row)
        if not normalized_name or normalized_name in previous_map:
            continue

        status = _normalize_status(row.get("status") or row.get("current_status") or row.get("previous_status"))
        previous_map[normalized_name] = {
            "display_name": _format_display_name(display_name, normalized_name),
            "status": status,
        }

    return previous_map


def build_membership_movement_events(current_names, previous_status_rows, *, scan_id, detected_at):
    """Build deterministic join/leave movement events from plain roster/status rows.

    Current names may be strings or dict-like rows containing `character_name`,
    `name`, or `display_name`. Previous rows may additionally carry a `status`
    field with values of `active` or `departed`.

    The returned events are sorted by event type priority, then by character name.
    """
    current_map = _coerce_current_names(current_names or [])
    previous_map = _coerce_previous_status_rows(previous_status_rows or [])

    events = []

    for normalized_name, display_name in current_map.items():
        previous_row = previous_map.get(normalized_name)
        previous_status = previous_row["status"] if previous_row else None

        if previous_status == "departed":
            events.append({
                "scan_id": scan_id,
                "character_name": display_name,
                "event_type": "rejoined",
                "detected_at": detected_at,
                "previous_status": previous_status,
                "current_status": "active",
            })
        elif previous_status == "active":
            continue
        else:
            events.append({
                "scan_id": scan_id,
                "character_name": display_name,
                "event_type": "joined",
                "detected_at": detected_at,
                "previous_status": previous_status,
                "current_status": "active",
            })

    current_names_set = set(current_map)
    for normalized_name, previous_row in previous_map.items():
        if normalized_name in current_names_set:
            continue

        if previous_row["status"] != "active":
            continue

        events.append({
            "scan_id": scan_id,
            "character_name": previous_row["display_name"],
            "event_type": "departed",
            "detected_at": detected_at,
            "previous_status": "active",
            "current_status": "departed",
        })

    events.sort(key=lambda event: (
        EVENT_TYPE_PRIORITY.get(event["event_type"], 99),
        event["character_name"].lower(),
    ))

    return events


def build_membership_event_insert_statements(events):
    """Build Turso batch statements for membership movement events."""
    normalized_events = []

    for event in events or []:
        if not isinstance(event, dict):
            continue

        scan_id = str(event.get("scan_id") or "").strip()
        character_name = str(event.get("character_name") or "").strip()
        event_type = str(event.get("event_type") or "").strip().lower()
        detected_at = str(event.get("detected_at") or "").strip()
        previous_status = event.get("previous_status")
        current_status = event.get("current_status")

        if not scan_id or not character_name or not event_type or not detected_at:
            continue

        normalized_events.append(
            {
                "scan_id": scan_id,
                "character_name": character_name,
                "event_type": event_type,
                "detected_at": detected_at,
                "previous_status": previous_status,
                "current_status": current_status,
            }
        )

    normalized_events.sort(key=lambda event: (
        EVENT_TYPE_PRIORITY.get(event["event_type"], 99),
        event["character_name"].lower(),
        event["detected_at"],
        event["scan_id"],
    ))

    return [
        {
            "q": MEMBERSHIP_EVENT_INSERT_QUERY,
            "params": [
                event["scan_id"],
                event["character_name"],
                event["event_type"],
                event["detected_at"],
                event["previous_status"],
                event["current_status"],
            ],
        }
        for event in normalized_events
    ]


def build_latest_membership_status_query():
    return """
        SELECT character_name, event_type, detected_at, previous_status, current_status
        FROM (
            SELECT
                character_name,
                event_type,
                detected_at,
                previous_status,
                current_status,
                ROW_NUMBER() OVER(
                    PARTITION BY lower(character_name)
                    ORDER BY detected_at DESC, id DESC
                ) AS rn
            FROM guild_membership_events
        )
        WHERE rn = 1
    """


def build_recent_membership_movement_query(limit=200):
    try:
        safe_limit = int(limit)
    except (TypeError, ValueError):
        safe_limit = 200

    safe_limit = max(1, safe_limit)

    return f"""
        SELECT scan_id, character_name, event_type, detected_at, previous_status, current_status
        FROM guild_membership_events
        ORDER BY detected_at DESC, id DESC
        LIMIT {safe_limit}
    """


def _coerce_summary_event_row(row: Any) -> dict[str, Any] | None:
    if not isinstance(row, dict):
        return None

    character_name = str(row.get("character_name") or "").strip()
    event_type = str(row.get("event_type") or "").strip().lower()
    detected_at = str(row.get("detected_at") or "").strip()
    scan_id = str(row.get("scan_id") or "").strip()

    if not character_name or not event_type or event_type not in EVENT_TYPE_PRIORITY or not detected_at:
        return None

    return {
        "scan_id": scan_id,
        "character_name": character_name,
        "event_type": event_type,
        "detected_at": detected_at,
        "previous_status": _normalize_status(row.get("previous_status")),
        "current_status": _normalize_status(row.get("current_status")),
    }


def summarize_membership_events(events, limit=5):
    """Summarize the most recent membership scan into compact counts and rows.

    The summary is anchored to the most recent scan id / detected_at pair so the
    rendered card reflects one coherent movement snapshot instead of mixing
    multiple scans together.
    """
    normalized_events = []
    for event in events or []:
        normalized = _coerce_summary_event_row(event)
        if normalized:
            normalized_events.append(normalized)

    if not normalized_events:
        return {
            "joined": 0,
            "departed": 0,
            "rejoined": 0,
            "total": 0,
            "recent": [],
            "bootstrap": False,
            "scan_id": None,
            "detected_at": None,
        }

    latest_event = max(
        normalized_events,
        key=lambda event: (
            event["detected_at"],
            event["scan_id"] or event["detected_at"],
            event["character_name"].lower(),
        ),
    )
    latest_scan_key = latest_event["scan_id"] or latest_event["detected_at"]

    latest_events = [
        event
        for event in normalized_events
        if (event["scan_id"] or event["detected_at"]) == latest_scan_key
    ]

    latest_events.sort(key=lambda event: (
        EVENT_TYPE_PRIORITY.get(event["event_type"], 99),
        event["character_name"].lower(),
    ))

    counts = {
        "joined": sum(1 for event in latest_events if event["event_type"] == "joined"),
        "departed": sum(1 for event in latest_events if event["event_type"] == "departed"),
        "rejoined": sum(1 for event in latest_events if event["event_type"] == "rejoined"),
    }
    total = len(latest_events)
    try:
        safe_limit = int(limit)
    except (TypeError, ValueError):
        safe_limit = 0
    safe_limit = max(0, safe_limit)
    bootstrap = total > 0 and counts["joined"] == total and all(
        event["previous_status"] is None for event in latest_events
    )

    return {
        "joined": counts["joined"],
        "departed": counts["departed"],
        "rejoined": counts["rejoined"],
        "total": total,
        "recent": latest_events[:safe_limit],
        "bootstrap": bootstrap,
        "scan_id": latest_event["scan_id"] or None,
        "detected_at": latest_event["detected_at"],
    }


async def persist_membership_movement(
    session,
    current_names,
    *,
    scan_id,
    detected_at,
    fetch_fn=fetch_turso,
    push_fn=push_turso_batch,
):
    """Fetch the latest membership state, build events, and persist them if needed."""
    previous_status_rows = await fetch_fn(session, build_latest_membership_status_query())
    events = build_membership_movement_events(
        current_names,
        previous_status_rows,
        scan_id=scan_id,
        detected_at=detected_at,
    )
    statements = build_membership_event_insert_statements(events)

    if statements:
        await push_fn(session, statements)

    return events
