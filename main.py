"""
Main entry point for the WoW Classic API Dashboard pipeline.
Database logic upgraded to use Turso's direct REST API, eliminating driver bottlenecks.
"""

import asyncio
import aiohttp
import sys
import json
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

from wow.auth import get_access_token
from wow.api import fetch_realm_data, fetch_static_maps
from wow.badges import (
    aggregate_ladder_badges,
    aggregate_reigning_champ_badges,
    aggregate_war_effort_badges,
    apply_badges_to_roster,
)
from wow.character import fetch_character_data, update_character_state
from wow.character_persistence import build_character_row_lookup, build_character_write_batch
from wow.membership_movement import persist_membership_movement
from wow.history_queries import (
    build_ladder_snapshot_query,
    build_preload_window_context,
    build_prev_mvp_query,
    build_trend_query,
)
from wow.output import finalize_dashboard_output, write_api_status_output
from wow.pipeline_state import build_historical_state, build_prev_mvps
from wow.roster import GuildRosterFetchError, fetch_guild_roster
from wow.turso import ensure_current_gear_cache, fetch_turso, push_turso_batch, setup_database
from wow.trends import process_character_trends, process_global_trends
from wow.war_effort import (
    apply_locked_prev_mvps,
    build_db_mvp_state,
    build_db_we_state,
    build_locked_prev_mvp_map,
    build_war_effort_history_state,
    build_weekly_reset_context,
    collect_hk_progress,
    collect_loot_progress,
    collect_zenith_progress,
    build_readiness_week_state,
    collect_xp_progress,
    filter_active_we_names,
    load_war_effort_lock_data,
    prepare_war_effort_history_purge,
    rank_ladder_snapshot_rows,
    rebuild_locked_vanguards,
    update_hk_lock,
    update_loot_lock,
    update_readiness_lock,
    update_xp_lock,
    update_zenith_lock,
)
from config import REALM, GUILD_NAME

# Fallback labels used when the roster API returns only integer guild rank ids.
RANK_MAP = {
    0: "Guild Master", 1: "MOST WANTED", 2: "Veteran",
    3: "Member", 4: "Alt", 5: "Wanted"
}

async def fetch_with_semaphore(sem, session, token, char, history_data):
    """Throttle per-character fetches and retry transient failures."""
    max_retries = 3
    for attempt in range(max_retries):
        try:
            async with sem:
                # Stagger requests slightly to avoid bursty rate-limit spikes.
                await asyncio.sleep(0.1)
                return await fetch_character_data(session, token, char, history_data) # type: ignore
        except Exception as e:
            print(f"⚠️ Failed to fetch {char} (Attempt {attempt + 1}/{max_retries}): {e}")
            if attempt < max_retries - 1:
                await asyncio.sleep(5)
            else:
                return None
            
async def main_async():
    print("\n🔑 Authenticating with Blizzard API...")
    token = await get_access_token()
    if not token:
        print("❌ Failed to authenticate with Blizzard.")
        return
    print("✅ Authentication successful!\n")

    print("🚀 Opening Async HTTP Session...\n")
    # Increase TCP connection pool to prevent local queuing bottlenecks
    connector = aiohttp.TCPConnector(limit=200)
    async with aiohttp.ClientSession(connector=connector) as session:
        
        await setup_database(session)
        await ensure_current_gear_cache(session)

        print("📂 Fetching historical state into memory concurrently...")
        
        berlin_tz = ZoneInfo("Europe/Berlin")
        preload_windows = build_preload_window_context(berlin_tz)
        today_str = preload_windows["today_str"]
        anchor_monday_str = preload_windows["anchor_monday_str"]
        prev_anchor_monday_str = preload_windows["prev_anchor_monday_str"]
        
        trend_query = build_trend_query(anchor_monday_str, today_str)
        prev_mvp_query = build_prev_mvp_query(prev_anchor_monday_str, anchor_monday_str)

        # Load the existing Turso state concurrently before processing the fresh roster.
        char_task = fetch_turso(session, "SELECT * FROM characters")
        gear_task = fetch_turso(session, "SELECT character_name, slot, item_id, name, quality, icon_data, tooltip_params FROM gear_current")
        trend_task = fetch_turso(session, trend_query)
        gt_task = fetch_turso(
            session,
            "SELECT last_total, last_active, last_ready, last_total_mains, last_active_mains, last_ready_mains FROM global_trends WHERE id='__GLOBAL__'"
        )
        timeline_task = fetch_turso(session, "SELECT * FROM timeline WHERE timestamp >= strftime('%Y-%m-%dT%H:%M:%S', 'now', '-7 days') ORDER BY timestamp DESC LIMIT 15000")
        prev_mvp_task = fetch_turso(session, prev_mvp_query)

        char_rows, gear_rows, trend_rows, gt_rows, timeline_rows, prev_mvp_rows = await asyncio.gather(
            char_task, gear_task, trend_task, gt_task, timeline_task, prev_mvp_task
        )

        prev_mvps = build_prev_mvps(prev_mvp_rows)

        history_data, past_char_records, global_trend_record, known_timeline = build_historical_state(
            char_rows,
            gear_rows,
            trend_rows,
            gt_rows,
            timeline_rows,
        )

        dashboard_feed = list(timeline_rows or [])[:15000]
        timeline_data_new = []
        roster_data = []

        class_map, race_map = await fetch_static_maps(session, token)
        realm_data = await fetch_realm_data(session, token, REALM)

        print(f"📜 Fetching guild roster for <{GUILD_NAME}>...")
        try:
            roster_names, raw_guild_roster, char_ranks = await fetch_guild_roster(
                session,
                token,
                REALM,
                GUILD_NAME,
                class_map,
                race_map,
                RANK_MAP,
            )
        except GuildRosterFetchError as e:
            print(f"❌ Aborting pipeline before live writes: {e}")
            write_api_status_output(
                ok=False,
                code=e.status_code,
                message=str(e),
                source="guild_roster",
            )
            return

        if not raw_guild_roster:
            outage_message = (
                f"Roster fetch returned an empty guild roster for <{GUILD_NAME}>. "
                "Skipping live writes to avoid accidental purge."
            )
            print(f"❌ {outage_message}")
            write_api_status_output(
                ok=False,
                code=200,
                message=outage_message,
                source="guild_roster",
            )
            return

        print(f"👥 Guild: {len(raw_guild_roster)} Total Members. Processing {len(roster_names)} valid characters.")

        movement_scan_id = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
        try:
            movement_events = await persist_membership_movement(
                session,
                roster_names,
                scan_id=movement_scan_id,
                detected_at=movement_scan_id,
            )
            if movement_events:
                joined_count = sum(1 for event in movement_events if event.get("event_type") == "joined")
                departed_count = sum(1 for event in movement_events if event.get("event_type") == "departed")
                rejoined_count = sum(1 for event in movement_events if event.get("event_type") == "rejoined")
                print(
                    f"👣 Guild movement detected: +{joined_count} joined / -{departed_count} departed / ↻ {rejoined_count} rejoined"
                )
        except Exception as e:
            print(f"⚠️ Failed to persist guild movement events: {e}")

        sem = asyncio.Semaphore(5)
        tasks = [fetch_with_semaphore(sem, session, token, char, history_data) for char in roster_names]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        char_history_inserts = []
        for result in results:
            if not isinstance(result, dict) or not result:
                continue

            try:
                past_record = past_char_records.get(result['char'].lower())
                result, new_hist_row = process_character_trends(result, char_ranks, past_record)
                if new_hist_row:
                    char_history_inserts.append(new_hist_row)

                history_data, timeline_data_new = update_character_state(result, history_data, timeline_data_new)
                roster_data.append(result)
            except Exception:
                continue

        realm_data, new_gt_row, new_daily_stats_row = process_global_trends(roster_data, raw_guild_roster, realm_data, global_trend_record)

        print("\n===========================================")
        print("💾 Phase 1: Pushing Gear, Timeline, and History to Turso...")
        batch_stmts_initial = []

        # Only write gear if it is explicitly marked as new or changed
        for char_name, data in history_data.items():
            for slot, item in data.items():
                if isinstance(item, dict) and 'item_id' in item and item.get('is_new'):
                    batch_stmts_initial.append({
                        "q": "INSERT OR REPLACE INTO gear (character_name, slot, item_id, name, quality, icon_data, tooltip_params) VALUES (?, ?, ?, ?, ?, ?, ?)",
                        "params": [char_name, slot, item.get('item_id'), item.get('name'), item.get('quality'), item.get('icon_data'), item.get('tooltip_params')]
                    })
                    batch_stmts_initial.append({
                        "q": "INSERT OR REPLACE INTO gear_current (character_name, slot, item_id, name, quality, icon_data, tooltip_params) VALUES (?, ?, ?, ?, ?, ?, ?)",
                        "params": [char_name, slot, item.get('item_id'), item.get('name'), item.get('quality'), item.get('icon_data'), item.get('tooltip_params')]
                    })

        for ev in timeline_data_new:
            char_name = ev.get('character')
            char_key = str(char_name).lower()
            if ev.get('type') == 'level_up':
                level = ev.get('level')
                if f"{char_key}_level_{level}" not in known_timeline:
                    batch_stmts_initial.append({
                        "q": "INSERT INTO timeline (timestamp, character_name, class, type, level) VALUES (?, ?, ?, ?, ?)",
                        "params": [ev.get('timestamp'), char_name, ev.get('class'), 'level_up', level]
                    })
                    known_timeline.add(f"{char_key}_level_{level}")
            else:
                it = ev.get('item', {})
                item_id = it.get('item_id')
                if f"{char_key}_item_{item_id}" not in known_timeline:
                    batch_stmts_initial.append({
                        "q": "INSERT INTO timeline (timestamp, character_name, class, type, item_id, item_name, item_quality, item_icon) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                        "params": [ev.get('timestamp'), char_name, ev.get('class'), 'item', item_id, it.get('name'), it.get('quality'), it.get('icon_data')]
                    })
                    known_timeline.add(f"{char_key}_item_{item_id}")

        for row in char_history_inserts:
            batch_stmts_initial.append({
                "q": """
                    INSERT INTO char_history (char_name, record_date, ilvl, hks) 
                    VALUES (?, ?, ?, ?) 
                    ON CONFLICT(char_name, record_date) 
                    DO UPDATE SET ilvl=excluded.ilvl, hks=excluded.hks 
                    WHERE char_history.ilvl != excluded.ilvl OR char_history.hks != excluded.hks
                """,
                "params": list(row)
            })

        batch_stmts_initial.append({
            "q": "INSERT OR REPLACE INTO global_trends (id, last_total, trend_total, last_active, trend_active, last_ready, trend_ready, last_total_mains, trend_total_mains, last_active_mains, trend_active_mains, last_ready_mains, trend_ready_mains) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            "params": list(new_gt_row)
        })

        batch_stmts_initial.append({
            "q": "INSERT OR REPLACE INTO daily_roster_stats (date, total_roster, active_roster, avg_ilvl_70, total_hks, total_roster_mains, active_roster_mains, avg_ilvl_70_mains) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            "params": list(new_daily_stats_row)
        })

        # Drop departed guild members from the live Turso tables.
        departed_chars = []
        if roster_names:
            departed_chars = sorted({str(char).lower() for char in history_data.keys() if str(char).lower() not in roster_names})
            if departed_chars:
                formatted_names = [name.title() for name in departed_chars]
                print(f"🧹 Purging {len(departed_chars)} departed guild member(s): {', '.join(formatted_names)}")

                for departed in departed_chars:
                    history_data.pop(departed, None)

            if departed_chars:
                placeholders = ",".join(["?"] * len(departed_chars))
                batch_stmts_initial.append({
                    "q": f"DELETE FROM characters WHERE lower(name) IN ({placeholders})",
                    "params": departed_chars,
                })
                batch_stmts_initial.append({
                    "q": f"DELETE FROM gear WHERE lower(character_name) IN ({placeholders})",
                    "params": departed_chars,
                })
                batch_stmts_initial.append({
                    "q": f"DELETE FROM gear_current WHERE lower(character_name) IN ({placeholders})",
                    "params": departed_chars,
                })
                batch_stmts_initial.append({
                    "q": f"DELETE FROM timeline WHERE lower(character_name) IN ({placeholders})",
                    "params": departed_chars,
                })
                batch_stmts_initial.append({
                    "q": f"DELETE FROM char_history WHERE lower(char_name) IN ({placeholders})",
                    "params": departed_chars,
                })

        if batch_stmts_initial:
            await push_turso_batch(session, batch_stmts_initial)

        active_roster_set = set(roster_names)
        
        if timeline_data_new:
            def _timeline_event_to_feed_row(event):
                item = event.get("item") if isinstance(event.get("item"), dict) else {}
                return {
                    "timestamp": event.get("timestamp"),
                    "character_name": event.get("character"),
                    "class": event.get("class"),
                    "type": event.get("type"),
                    "item_id": item.get("item_id"),
                    "item_name": item.get("name"),
                    "item_quality": item.get("quality"),
                    "item_icon": item.get("icon_data"),
                    "level": event.get("level"),
                }

            dashboard_feed.extend(_timeline_event_to_feed_row(event) for event in timeline_data_new)
            dashboard_feed.sort(key=lambda x: x.get('timestamp', ''), reverse=True)

        # Keep the current week's war-effort lock state in sync with Turso history.
        we_file = "asset/war_effort.json"
        
        weekly_reset = build_weekly_reset_context(berlin_tz)
        now_berlin = weekly_reset["now_berlin"]
        last_reset_berlin = weekly_reset["last_reset_berlin"]
        last_reset_iso = weekly_reset["last_reset_iso"]
        week_anchor = weekly_reset["week_anchor"]
        prev_week_anchor = weekly_reset["prev_week_anchor"]

        we_data = load_war_effort_lock_data(we_file, week_anchor, active_roster_set)

        # Ensure the history tables exist in Turso
        try:
            await fetch_turso(session, "CREATE TABLE IF NOT EXISTS war_effort_history (week_anchor TEXT, category TEXT, vanguards TEXT, participants TEXT, PRIMARY KEY(week_anchor, category))")
            await fetch_turso(session, "CREATE TABLE IF NOT EXISTS reigning_champs_history (week_anchor TEXT, category TEXT, champion TEXT, score INTEGER, PRIMARY KEY(week_anchor, category))")
        except Exception: pass

        war_effort_history_rows = await fetch_turso(session, "SELECT week_anchor, category, vanguards, participants FROM war_effort_history")
        war_effort_history_state = build_war_effort_history_state(war_effort_history_rows)

        # Prune departed members from the historical Turso records.
        try:
            purge_stmts = prepare_war_effort_history_purge(departed_chars, active_roster_set, war_effort_history_state)
            if purge_stmts:
                await push_turso_batch(session, purge_stmts)
        except Exception as e:
            print(f"⚠️ Failed to purge departed historical records: {e}")

        # Snapshot the current persisted state so weekly updates only write real changes.
        db_we_state, db_mvp_state = {}, {}
        try:
            db_we_state = build_db_we_state(week_anchor, war_effort_history_state, we_data, active_roster_set)
            mvp_rows = await fetch_turso(session, f"SELECT category, champion, score FROM reigning_champs_history WHERE week_anchor='{week_anchor}'")
            db_mvp_state = build_db_mvp_state(mvp_rows)
        except Exception:
            pass

        async def smart_update_we(category, vanguards_list, participants_list, preserve_existing_vanguards=True):
            old = db_we_state.get(category, {})

            final_vanguards = filter_active_we_names(vanguards_list, active_roster_set)
            final_participants = filter_active_we_names(participants_list, active_roster_set)

            try: old_v = filter_active_we_names(json.loads(old.get('vanguards') or '[]'), active_roster_set)
            except: old_v = []
            try: old_p = filter_active_we_names(json.loads(old.get('participants') or '[]'), active_roster_set)
            except: old_p = []

            if preserve_existing_vanguards:
                for v in old_v:
                    if v not in final_vanguards:
                        final_vanguards.append(v)

            for p in old_p:
                if p not in final_participants:
                    final_participants.append(p)

            if not final_vanguards and not final_participants:
                if old:
                    try:
                        await fetch_turso(session, f"DELETE FROM war_effort_history WHERE week_anchor='{week_anchor}' AND category='{category}'")
                        war_effort_history_state.pop((week_anchor, category), None)
                        db_we_state.pop(category, None)
                    except Exception: pass
                return

            v_json = json.dumps(final_vanguards)
            p_json = json.dumps(final_participants)

            if old.get('vanguards') != v_json or old.get('participants') != p_json:
                safe_v, safe_p = v_json.replace("'", "''"), p_json.replace("'", "''")
                try:
                    await fetch_turso(session, f"INSERT OR REPLACE INTO war_effort_history (week_anchor, category, vanguards, participants) VALUES ('{week_anchor}', '{category}', '{safe_v}', '{safe_p}')")
                    war_effort_history_state[(week_anchor, category)] = {
                        'week_anchor': week_anchor,
                        'category': category,
                        'vanguards': v_json,
                        'participants': p_json,
                    }
                    db_we_state[category] = {'vanguards': v_json, 'participants': p_json}
                except Exception: pass

        # 1. XP Logic
        xp_counts, ranked_xp_names, xp_threshold_met = collect_xp_progress(
            dashboard_feed,
            last_reset_iso,
            active_roster_set,
        )
        current_vanguards = update_xp_lock(
            we_data,
            ranked_xp_names,
            xp_threshold_met,
            active_roster_set,
            now_berlin.isoformat(),
        )

        await smart_update_we('xp', current_vanguards, list(xp_counts.keys()), preserve_existing_vanguards=xp_threshold_met)

        # 2. HK Logic
        hk_counts, _, ranked_hk_names, hk_threshold_met = collect_hk_progress(
            roster_data,
            active_roster_set,
        )
        current_vanguards = update_hk_lock(
            we_data,
            ranked_hk_names,
            hk_threshold_met,
            active_roster_set,
            now_berlin.isoformat(),
        )

        await smart_update_we('hk', current_vanguards, list(hk_counts.keys()), preserve_existing_vanguards=hk_threshold_met)

        # 3. Loot Logic
        loot_counts, ranked_loot_names, loot_threshold_met = collect_loot_progress(
            dashboard_feed,
            last_reset_iso,
            active_roster_set,
        )
        current_vanguards = update_loot_lock(
            we_data,
            ranked_loot_names,
            loot_threshold_met,
            active_roster_set,
            now_berlin.isoformat(),
        )

        await smart_update_we('loot', current_vanguards, list(loot_counts.keys()), preserve_existing_vanguards=loot_threshold_met)

        # 4. Zenith Logic
        unique_70s, ranked_zenith_names, zenith_threshold_met = collect_zenith_progress(
            dashboard_feed,
            last_reset_iso,
            active_roster_set,
        )
        current_vanguards = update_zenith_lock(
            we_data,
            ranked_zenith_names,
            unique_70s,
            zenith_threshold_met,
            active_roster_set,
            now_berlin.isoformat(),
        )

        await smart_update_we('zenith', current_vanguards, unique_70s, preserve_existing_vanguards=zenith_threshold_met)

        # 5. Readiness / Warden's Standard Logic
        readiness_state = build_readiness_week_state(
            roster_data,
            active_roster_set,
            now_ms=int(now_berlin.astimezone(timezone.utc).timestamp() * 1000),
            readiness_lock=we_data["locks"].get("readiness"),
        )
        update_readiness_lock(we_data, readiness_state)
        await smart_update_we(
            'readiness',
            readiness_state["vanguards"],
            readiness_state["participants"],
            preserve_existing_vanguards=False,
        )

        # 6. MVP Reigning Champs Logic (Save CONFIRMED winners from last week)
        # We must NOT save the current week's leader until the week is actually over!

        try:
            # Clean up the database by deleting any premature entries for the ongoing week
            await fetch_turso(session, f"DELETE FROM reigning_champs_history WHERE week_anchor = '{week_anchor}'")
        except Exception:
            pass

        locked_mvp_rows = await fetch_turso(
            session,
            f"SELECT category, champion, score FROM reigning_champs_history WHERE week_anchor = '{prev_week_anchor}'",
        )
        locked_prev_mvp_map = build_locked_prev_mvp_map(locked_mvp_rows)

        async def smart_update_prev_mvp(category, champ, score):
            # Only insert last week's locked winner once.
            if category not in locked_prev_mvp_map:
                try: 
                    await fetch_turso(session, f"INSERT INTO reigning_champs_history (week_anchor, category, champion, score) VALUES ('{prev_week_anchor}', '{category}', '{champ}', {score})")
                    locked_prev_mvp_map[category] = {"name": champ, "score": score}
                except Exception: 
                    pass

        # Extract to variables first to satisfy Pylance type-checking
        pve_winner = prev_mvps.get("pve")
        pvp_winner = prev_mvps.get("pvp")

        if pve_winner: 
            await smart_update_prev_mvp('pve', pve_winner["name"], pve_winner["score"])
            
        if pvp_winner: 
            await smart_update_prev_mvp('pvp', pvp_winner["name"], pvp_winner["score"])

        # Feed the generator the locked prior-week winners so Tuesday refreshes do not reshuffle them.
        apply_locked_prev_mvps(prev_mvps, locked_prev_mvp_map)
        
        # 6. LADDER CHAMPS LOGIC (Gold, Silver, Bronze snapshots from previous week)
        try:
            await fetch_turso(session, f"DELETE FROM ladder_history WHERE week_anchor = '{week_anchor}'")
        except Exception: pass

        async def smart_update_ladder_history(category, rank, champ, score):
            try:
                await fetch_turso(session, f"INSERT OR REPLACE INTO ladder_history (week_anchor, category, rank, champion, score) VALUES ('{prev_week_anchor}', '{category}', {rank}, '{champ}', {score})")
            except Exception: pass

        ladder_snapshot_query = build_ladder_snapshot_query(anchor_monday_str)
        snapshot_rows = await fetch_turso(session, ladder_snapshot_query)
        if snapshot_rows:
            pve_sorted, pvp_sorted = rank_ladder_snapshot_rows(snapshot_rows)
            for i, row in enumerate(pve_sorted):
                await smart_update_ladder_history('pve', i+1, row['char_name'], row['ilvl'])
                
            for i, row in enumerate(pvp_sorted):
                await smart_update_ladder_history('pvp', i+1, row['char_name'], row['hks'])

        # Persist the current war-effort lock snapshot for the frontend build.
        with open(we_file, "w", encoding="utf-8") as f:
            json.dump(we_data, f, ensure_ascii=False)


        # Aggregate historical badges and title counts from Turso.
        print("🏅 Calculating Cumulative War Effort, MVP, and Ladder Badges...")
        try:
            historical_data = list(war_effort_history_state.values())
            vanguard_tallies, campaign_tallies, badge_events = aggregate_war_effort_badges(historical_data)

            mvp_data = await fetch_turso(session, "SELECT week_anchor, champion, category FROM reigning_champs_history")
            pve_champs, pvp_champs, mvp_badge_events = aggregate_reigning_champ_badges(mvp_data)
            badge_events.extend(mvp_badge_events)

            # Ladder medals come from historical podium snapshots, not the live roster view.
            ladder_data = await fetch_turso(session, "SELECT week_anchor, category, rank, champion FROM ladder_history")
            ladder_medals, ladder_badge_events = aggregate_ladder_badges(ladder_data)
            badge_events.extend(ladder_badge_events)

            apply_badges_to_roster(
                roster_data,
                history_data,
                vanguard_tallies,
                campaign_tallies,
                pve_champs,
                pvp_champs,
                ladder_medals,
            )
                
        except Exception as e:
            print(f"⚠️ Failed to aggregate badges from Turso: {e}")

        print("\n===========================================")
        print("💾 Phase 2: Pushing Character Profiles (with Badges) to Turso...")
        orig_chars = build_character_row_lookup(char_rows)
        batch_stmts_chars = build_character_write_batch(
            history_data,
            orig_chars,
            vanguard_tallies,
            campaign_tallies,
            pve_champs,
            pvp_champs,
        )

        if batch_stmts_chars:
            await push_turso_batch(session, batch_stmts_chars)
        print("✅ Final push to Turso complete!")

        # Add aggregated badge events to the same feed used by the timeline renderer.
        orig_chars = {r['name'].lower(): r for r in char_rows}
        for ev in badge_events:
            c_name_lower = ev["character_name"].lower()
            ev["class"] = orig_chars.get(c_name_lower, {}).get("class", "Unknown")
        
        dashboard_feed.extend(badge_events)
        dashboard_feed.sort(key=lambda x: x.get('timestamp', ''), reverse=True)

        await finalize_dashboard_output(
            session,
            roster_data,
            realm_data,
            dashboard_feed,
            raw_guild_roster,
            prev_mvps,
        )
        write_api_status_output(
            ok=True,
            code=200,
            message="Live guild roster refresh completed successfully.",
            source="guild_roster",
        )

        print("🎉 ALL DONE! The pipeline ran successfully.")

def main():
    if sys.platform == 'win32':
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(main_async())

if __name__ == "__main__":
    main()
