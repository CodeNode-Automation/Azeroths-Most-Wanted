import re
import asyncio

# Standard User-Agent string to bypass basic bot protection during external requests
REAL_BROWSER_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

async def fetch_blizzard_media_href(session, token, media_href):
    """
    Retrieves the item icon URL using the direct HATEOAS media link provided by the Blizzard API.
    
    Args:
        session (aiohttp.ClientSession): The active asynchronous HTTP session.
        token (str): The OAuth access token for Blizzard API authentication.
        media_href (str): The direct URL to the item's media assets.
        
    Returns:
        str | None: The URL of the icon image, or None if the request fails or is not found.
    """
    if not media_href:
        return None
        
    headers = {"Authorization": f"Bearer {token}"}
    try:
        async with session.get(media_href, headers=headers, timeout=5) as response:
            if response.status == 200:
                data = await response.json()
                for asset in data.get('assets', []):
                    if asset.get('key') == 'icon':
                        return asset.get('value')
    except Exception:
        pass
        
    return None

async def fetch_item_icon_url(session, token, item_id):
    """
    Retrieves the item icon URL by querying the Blizzard media endpoint using the item ID.
    Iterates through multiple namespace fallbacks to locate the asset.
    
    Args:
        session (aiohttp.ClientSession): The active asynchronous HTTP session.
        token (str): The OAuth access token for Blizzard API authentication.
        item_id (int | str): The unique identifier for the item.
        
    Returns:
        str | None: The URL of the icon image, or None if the item is not found across namespaces.
    """
    namespaces_to_try = [
        "static-classicann-eu", "static-classic1x-eu", 
        "static-classic-eu", "static-eu"
    ]
    
    for ns in namespaces_to_try:
        url = f"https://eu.api.blizzard.com/data/wow/media/item/{item_id}"
        headers = {"Authorization": f"Bearer {token}", "Battlenet-Namespace": ns}
        
        try:
            async with session.get(url, headers=headers, timeout=5) as response:
                if response.status == 200:
                    data = await response.json()
                    for asset in data.get('assets', []):
                        if asset.get('key') == 'icon':
                            return asset.get('value')
                elif response.status == 429:
                    # Implement backoff on rate limit
                    await asyncio.sleep(1)
        except Exception:
            continue 
            
    return None

async def fetch_wowhead_icon_url(session, item_id):
    """
    Retrieves the item icon URL as a final fallback by querying the Wowhead XML database.
    
    Args:
        session (aiohttp.ClientSession): The active asynchronous HTTP session.
        item_id (int | str): The unique identifier for the item.
        
    Returns:
        str | None: The formatted Wowhead image URL, or None if the parsing fails.
    """
    url = f"https://www.wowhead.com/item={item_id}&xml"
    headers = {"User-Agent": REAL_BROWSER_UA}
    
    try:
        async with session.get(url, headers=headers, timeout=5) as response:
            if response.status == 200:
                text = await response.text()
                # Parse the XML response for the icon node
                match = re.search(r'<icon>(.*?)</icon>', text)
                if match:
                    icon_name = match.group(1).lower()
                    return f"https://wow.zamimg.com/images/wow/icons/large/{icon_name}.jpg"
    except Exception:
        pass
        
    return None

def get_standardized_image_url(url):
    """
    Rewrites Blizzard render-hosted item icon URLs to the direct image host used by the site.
    """
    if not url:
        return None
        
    # Only rewrite Blizzard render-hosted item icons; leave portrait/media URLs untouched.
    if "render.worldofwarcraft.com" in url and "icons" in url:
        try:
            icon_name = url.split('/')[-1].split('.')[0]
            url = f"https://wow.zamimg.com/images/wow/icons/large/{icon_name}.jpg"
        except Exception:
            pass 
            
    return url
