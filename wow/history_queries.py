from datetime import datetime, timedelta


def build_preload_window_context(berlin_tz):
    today = datetime.now(berlin_tz)
    today_str = today.strftime("%Y-%m-%d")

    # Calculate the baseline: the Monday immediately preceding the most recent Tuesday
    days_since_tuesday = (today.weekday() - 1) % 7
    last_tuesday = today - timedelta(days=days_since_tuesday)

    return {
        "today_str": today_str,
        "anchor_monday_str": (last_tuesday - timedelta(days=1)).strftime("%Y-%m-%d"),
        "prev_anchor_monday_str": (last_tuesday - timedelta(days=8)).strftime("%Y-%m-%d"),
    }


def build_trend_query(anchor_monday_str, today_str):
    return f"""
            SELECT char_name, ilvl, hks 
            FROM (
                SELECT char_name, ilvl, hks, 
                       ROW_NUMBER() OVER(PARTITION BY char_name ORDER BY record_date ASC) as rn
                FROM char_history
                WHERE record_date >= '{anchor_monday_str}' AND record_date < '{today_str}'
            ) WHERE rn = 1
        """


def build_prev_mvp_query(prev_anchor_monday_str, anchor_monday_str):
    return f"""
            SELECT s.char_name, 
                   (e.ilvl - s.ilvl) as prev_trend_ilvl, 
                   (e.hks - s.hks) as prev_trend_hks
            FROM (
                SELECT char_name, ilvl, hks 
                FROM (
                    SELECT char_name, ilvl, hks, 
                           ROW_NUMBER() OVER(PARTITION BY char_name ORDER BY record_date ASC) as rn
                    FROM char_history
                    WHERE record_date >= '{prev_anchor_monday_str}' AND record_date <= '{anchor_monday_str}'
                ) WHERE rn = 1
            ) s
            JOIN (
                SELECT char_name, ilvl, hks 
                FROM (
                    SELECT char_name, ilvl, hks, 
                           ROW_NUMBER() OVER(PARTITION BY char_name ORDER BY record_date DESC) as rn
                    FROM char_history
                    WHERE record_date <= '{anchor_monday_str}'
                ) WHERE rn = 1
            ) e ON s.char_name = e.char_name
        """


def build_ladder_snapshot_query(anchor_monday_str):
    return f"""
            SELECT char_name, ilvl, hks 
            FROM (
                SELECT char_name, ilvl, hks, 
                       ROW_NUMBER() OVER(PARTITION BY char_name ORDER BY record_date DESC) as rn
                FROM char_history
                WHERE record_date <= '{anchor_monday_str}'
            ) WHERE rn = 1
        """
