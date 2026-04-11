def is_alt_rank(rank_name):
    """Return True only for the explicit guild Alt rank."""
    return rank_name == "Alt"


def is_alt_record(record):
    """Detect alt status from the roster record shapes used in the pipeline."""
    if not isinstance(record, dict):
        return False

    profile = record.get("profile")
    if isinstance(profile, dict):
        return is_alt_rank(profile.get("guild_rank"))

    if "rank" in record:
        return is_alt_rank(record.get("rank"))

    return is_alt_rank(record.get("guild_rank"))
