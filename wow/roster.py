import asyncio

class GuildRosterFetchError(RuntimeError):
    def __init__(self, status_code=None, message="", url=""):
        self.status_code = status_code
        self.url = url
        super().__init__(message or f"Guild roster fetch failed ({status_code or 'unknown'})")


async def fetch_guild_roster(session, token, realm, guild_name, class_map, race_map, rank_map, max_retries=3):
    slug = guild_name.lower().replace(" ", "-").replace("'", "")
    url = f"https://eu.api.blizzard.com/data/wow/guild/{realm}/{slug}/roster?namespace=profile-classicann-eu&locale=en_US"
    headers = {"Authorization": f"Bearer {token}"}

    roster_names = []
    raw_guild_roster = []
    char_ranks = {}
    last_error = None

    for attempt in range(max_retries):
        try:
            async with session.get(url, headers=headers) as resp:
                if resp.status == 200:
                    all_members = (await resp.json()).get("members", [])
                    for member in all_members:
                        char_data = member.get("character", {})
                        char_name = char_data.get("name", "Unknown")
                        char_level = char_data.get("level", 0)

                        char_class = class_map.get(char_data.get("playable_class", {}).get("id"), "Unknown")
                        char_race = race_map.get(char_data.get("playable_race", {}).get("id"), "Unknown")

                        rank_name = rank_map.get(member.get("rank", 5), f"Rank {member.get('rank', 5)}")
                        char_ranks[char_name.lower()] = rank_name

                        raw_guild_roster.append(
                            {
                                "name": char_name.title(),
                                "level": char_level,
                                "class": char_class,
                                "race": char_race,
                                "rank": rank_name,
                            }
                        )
                        if char_level > 10:
                            roster_names.append(char_name.lower())
                    return roster_names, raw_guild_roster, char_ranks

                body = await resp.text()
                last_error = GuildRosterFetchError(
                    status_code=resp.status,
                    message=f"Roster fetch failed: {resp.status}, message={body[:500]!r}, url={url}",
                    url=url,
                )
                print(f"⚠️ {last_error}")
        except Exception as e:
            last_error = e
            print(f"⚠️ Roster fetch failed: {e}")

        if attempt < max_retries - 1:
            await asyncio.sleep(5)

    if isinstance(last_error, GuildRosterFetchError):
        raise last_error

    raise GuildRosterFetchError(
        message=str(last_error) if last_error else "Roster fetch failed with an unknown error.",
        url=url,
    )