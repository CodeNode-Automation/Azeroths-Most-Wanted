CLASSIC_STATIC_NAMESPACES = (
    "static-classicann-eu",
    "static-classic1x-eu",
    "static-classic-eu",
    "static-eu",
)

WOWHEAD_QUALITY_MAP = {
    0: "POOR",
    1: "COMMON",
    2: "UNCOMMON",
    3: "RARE",
    4: "EPIC",
    5: "LEGENDARY",
}


async def fetch_item_quality(session, token, item_href, item_id):
    """Resolve an item quality string from Blizzard first, then Wowhead as a last fallback."""
    blizzard_headers = {"Authorization": f"Bearer {token}"}

    # Prefer the direct Blizzard item link when the equipment payload already includes it.
    if item_href:
        try:
            async with session.get(item_href, headers=blizzard_headers, timeout=5) as response:
                if response.status == 200:
                    data = await response.json()
                    return data.get('quality', {}).get('type')
        except Exception:
            pass
            
    # Retry against the known Classic namespaces when the direct link is unavailable.
    for ns in CLASSIC_STATIC_NAMESPACES:
        url = f"https://eu.api.blizzard.com/data/wow/item/{item_id}"
        params = {"namespace": ns, "locale": "en_US"}
        try:
            async with session.get(url, headers=blizzard_headers, params=params, timeout=5) as response:
                if response.status == 200:
                    data = await response.json()
                    return data.get('quality', {}).get('type')
        except Exception:
            continue
            
    # Fall back to Wowhead's tooltip API only when Blizzard does not return a quality.
    try:
        url = f"https://www.wowhead.com/tooltip/item/{item_id}"
        headers = {"User-Agent": "Mozilla/5.0", "Accept": "application/json"}
        async with session.get(url, headers=headers, timeout=5) as response:
            if response.status == 200:
                data = await response.json()
                q_int = data.get("quality")
                return WOWHEAD_QUALITY_MAP.get(q_int, "COMMON")
    except Exception:
        pass
        
    # Keep the pipeline stable even when neither upstream returns a quality value.
    return "COMMON"
