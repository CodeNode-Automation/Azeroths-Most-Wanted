import asyncio
from wow.images import (
    fetch_blizzard_media_href,
    fetch_item_icon_url,
    fetch_wowhead_icon_url,
    get_standardized_image_url
)
from wow.quality import fetch_item_quality
from config import FALLBACK_ICON

async def process_single_item(session, token, item, past_gear, fallback_url):
    """Process one equipped item and reuse cached icon and tooltip data when it is still valid."""
    slot_type = item.get('slot', {}).get('type', '')
    item_id = item.get('item', {}).get('id')
    item_level = item.get('level', {}).get('value', 0)
    
    name_data = item.get('name', 'Empty')
    item_name = name_data if isinstance(name_data, str) else name_data.get('en_US', 'Empty')
    
    past_item = past_gear.get(slot_type, {})
    cached_icon = past_item.get('icon_data')
    cached_tooltip = past_item.get('tooltip_params')
    
    # Ignore cache entries that only captured the fallback icon or incomplete tooltip data.
    is_invalid_cache = (
        not cached_icon or 
        not cached_tooltip or 
        (cached_icon == fallback_url) or 
        ("amw" in str(cached_icon).lower()) or
        ("undefined" in str(cached_tooltip).lower())
    )
    
    if past_item and past_item.get('item_id') == item_id and not is_invalid_cache:
        return slot_type, {
            "name": item_name,
            "icon_data": cached_icon,
            "quality": past_item.get('quality', 'COMMON'),
            "is_fallback": False,
            "item_id": item_id,
            "item_level": item_level,
            "tooltip_params": cached_tooltip
        }
        
    item_href = item.get('item', {}).get('key', {}).get('href')
    media_href = item.get('media', {}).get('key', {}).get('href')
    payload_quality = item.get('quality', {}).get('type')

    async def resolve_icon():
        icon_url = None
        if media_href:
            icon_url = await fetch_blizzard_media_href(session, token, media_href)
        if not icon_url and item_id:
            icon_url = await fetch_item_icon_url(session, token, item_id) 
        if not icon_url and item_id:
            icon_url = await fetch_wowhead_icon_url(session, item_id)
        return icon_url

    async def resolve_quality():
        if payload_quality:
            return payload_quality
        return await fetch_item_quality(session, token, item_href, item_id)

    quality_type, icon_url = await asyncio.gather(
        resolve_quality(),
        resolve_icon()
    )
    
    quality_type = quality_type.upper() if quality_type else "COMMON"
    final_url = get_standardized_image_url(icon_url) if icon_url else None
    
    is_fallback = False 
    if not final_url:
        final_url = fallback_url
        is_fallback = True

    enchants = item.get('enchantments', [])
    ench_str = "&ench=" + ":".join(str(e.get('enchantment_id')) for e in enchants) if enchants else ""
    
    sockets = item.get('sockets', [])
    gems_str = "&gems=" + ":".join(str(s.get('item', {}).get('id')) for s in sockets if s.get('item')) if sockets else ""
    
    tooltip_params = f"item={item_id}{ench_str}{gems_str}"

    return slot_type, {
        "name": item_name,
        "icon_data": final_url, 
        "quality": quality_type,
        "is_fallback": is_fallback,
        "item_id": item_id,
        "item_level": item_level,
        "tooltip_params": tooltip_params
    }

async def process_equipment(session, token, equipment, past_gear=None):
    """Parses the character equipment payload sequentially to prevent media rate limits."""
    if past_gear is None:
        past_gear = {}
    equipped_dict = {}
    fallback_url = get_standardized_image_url(FALLBACK_ICON)

    if equipment and 'equipped_items' in equipment:
        items = equipment['equipped_items']
        
        # Walk the items sequentially so media retries do not pile up against Blizzard.
        for item in items:
            try:
                slot_type, item_data = await process_single_item(session, token, item, past_gear, fallback_url)
                equipped_dict[slot_type] = item_data
            except Exception as e:
                print(f"⚠️ Minor item fetch warning: {e}")

    return equipped_dict
