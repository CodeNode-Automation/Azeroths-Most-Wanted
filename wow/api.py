import asyncio
from config import PROFILE_NAMESPACE


async def fetch_wow_endpoint(session, token, realm, character_name, endpoint="", retries=4):
    """
    Fetches character-specific data from the Blizzard WoW API.
    Includes an automatic retry mechanism with exponential backoff for 429 rate limits and 50x server errors.
    """
    url_suffix = f"/{endpoint}" if endpoint else ""

    # Enforce en_US localization to reduce payload size and normalize data structures.
    url = f"https://eu.api.blizzard.com/profile/wow/character/{realm}/{character_name}{url_suffix}?locale=en_US"
    headers = {"Authorization": f"Bearer {token}", "Battlenet-Namespace": PROFILE_NAMESPACE}

    for attempt in range(retries):
        try:
            async with session.get(url, headers=headers, timeout=10) as response:
                # Silently ignore 404s for missing PvP data or low-level alts.
                if response.status == 404:
                    return None

                if response.status in [429, 500, 502, 503, 504]:
                    wait_time = 2 ** attempt
                    print(f"   ⏳ [HTTP {response.status}] Pausing {wait_time}s for {character_name} ({endpoint or 'profile'})...")
                    await asyncio.sleep(wait_time)
                    continue

                response.raise_for_status()
                return await response.json()
        except Exception as e:
            if attempt == retries - 1:
                if "404" not in str(e):
                    print(f"❌ Error fetching {endpoint or 'profile'} for {character_name}: {e}")
            else:
                wait_time = 2 ** attempt
                await asyncio.sleep(wait_time)

    return None


async def fetch_realm_data(session, token, realm):
    """
    Retrieves current server status, population, and rule type for a specific realm.
    """
    print(f"\n🌍 Fetching Realm Status for {realm.title()}...")

    # Try multiple namespaces to account for different Classic era clients.
    namespaces = ["dynamic-classicann-eu", "dynamic-classic1x-eu", "dynamic-classic-eu", "dynamic-eu"]
    realm_info = {"status": "Unknown", "population": "Unknown", "type": "Unknown"}

    for ns in namespaces:
        url = f"https://eu.api.blizzard.com/data/wow/realm/{realm}?locale=en_US"
        headers = {"Authorization": f"Bearer {token}", "Battlenet-Namespace": ns}

        try:
            async with session.get(url, headers=headers, timeout=5) as response:
                if response.status != 200:
                    continue

                data = await response.json()
                realm_type = data.get("type", {}).get("name")
                realm_info["type"] = realm_type.get("en_US", "Unknown") if isinstance(realm_type, dict) else (realm_type or "Unknown")

                cr_href = data.get("connected_realm", {}).get("href")
                if not cr_href:
                    continue

                cr_href = f"{cr_href}&locale=en_US" if "?" in cr_href else f"{cr_href}?locale=en_US"
                async with session.get(cr_href, headers=headers, timeout=5) as cr_resp:
                    if cr_resp.status != 200:
                        continue

                    cr_data = await cr_resp.json()
                    status_name = cr_data.get("status", {}).get("name")
                    population_name = cr_data.get("population", {}).get("name")
                    realm_info["status"] = status_name if isinstance(status_name, str) else status_name.get("en_US", "Unknown")
                    realm_info["population"] = population_name if isinstance(population_name, str) else population_name.get("en_US", "Unknown")

                    print(
                        f"   ┣ 🟢 Status: {realm_info['status']} | 👥 Pop: {realm_info['population']} | ⚔️ Type: {realm_info['type']}"
                    )
                    return realm_info
        except Exception:
            continue

    print("   ┣ ⚠️ Could not determine complete realm status.")
    return realm_info


async def fetch_static_maps(session, token):
    """
    Retrieves class and race mappings from the Blizzard Game Data API.
    Falls back to hardcoded values when the API is unavailable.
    """
    print("📚 Fetching dynamic Class and Race maps...")

    namespaces = ["static-classicann-eu", "static-classic1x-eu", "static-classic-eu", "static-eu"]
    async def fetch_index_map(url, collection_key):
        for ns in namespaces:
            headers = {"Authorization": f"Bearer {token}", "Battlenet-Namespace": ns}
            try:
                async with session.get(url, headers=headers, timeout=5) as resp:
                    if resp.status != 200:
                        continue

                    data = await resp.json()
                    return {
                        entry["id"]: entry.get("name", "Unknown")
                        for entry in data.get(collection_key, [])
                    }
            except Exception:
                continue
        return {}

    class_map = await fetch_index_map(
        "https://eu.api.blizzard.com/data/wow/playable-class/index?locale=en_US",
        "classes"
    )
    race_map = await fetch_index_map(
        "https://eu.api.blizzard.com/data/wow/playable-race/index?locale=en_US",
        "races"
    )

    if not class_map:
        class_map = {1: "Warrior", 2: "Paladin", 3: "Hunter", 4: "Rogue", 5: "Priest", 6: "Death Knight", 7: "Shaman", 8: "Mage", 9: "Warlock", 11: "Druid"}
    if not race_map:
        race_map = {1: "Human", 2: "Orc", 3: "Dwarf", 4: "Night Elf", 5: "Undead", 6: "Tauren", 7: "Gnome", 8: "Troll", 10: "Blood Elf", 11: "Draenei"}

    return class_map, race_map
