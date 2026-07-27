import httpx
from typing import List, Dict, Any, Optional
from config.settings import TCGPLAYER_SEARCH_API, HEADERS

def search_card_by_number(card_number: str) -> List[Dict[str, Any]]:
    clean_num = card_number.strip()
    if not clean_num:
        return []

    # Attempt 1: Search by exact "number" attribute filter
    payload_number = {
        "algorithm": "free_text_search",
        "from": 0,
        "size": 30,
        "filters": {
            "term": {
                "number": [clean_num]
            }
        },
        "query": "",
        "context": {"shippingCountry": "US", "cart": {}}
    }

    results = []
    try:
        with httpx.Client(timeout=15.0) as client:
            res = client.post(TCGPLAYER_SEARCH_API, json=payload_number, headers=HEADERS)
            if res.status_code == 200:
                results = res.json().get("results", [{}])[0].get("results", [])

            # Attempt 2: Fallback to broad query search if term filter returns no items
            if not results:
                payload_fallback = {
                    "algorithm": "free_text_search",
                    "from": 0,
                    "size": 20,
                    "filters": {"term": {}},
                    "query": clean_num,
                    "context": {"shippingCountry": "US", "cart": {}}
                }
                res_fb = client.post(TCGPLAYER_SEARCH_API, json=payload_fallback, headers=HEADERS)
                if res_fb.status_code == 200:
                    results = res_fb.json().get("results", [{}])[0].get("results", [])
    except Exception as e:
        print(f"Error fetching TCGPlayer data for '{card_number}': {e}")
        return []

    parsed_variants = []
    for item in results:
        product_id = item.get("productId")
        if not product_id:
            continue

        product_id = int(product_id)
        product_name = item.get("productName", "Unknown Card")
        set_name = item.get("setName", "Unknown Set")
        market_price = item.get("marketPrice")
        custom = item.get("customAttributes", {})
        number = custom.get("number", clean_num)
        rarity = custom.get("rarity", "")
        
        # High resolution TCGPlayer CDN image link
        image_url = f"https://tcgplayer-cdn.tcgplayer.com/product/{product_id}_200w.jpg"
        product_url = f"https://www.tcgplayer.com/product/{product_id}"

        parsed_variants.append({
            "productId": product_id,
            "productName": product_name,
            "setName": set_name,
            "number": number,
            "rarity": rarity,
            "marketPriceUSD": float(market_price) if market_price is not None else None,
            "imageUrl": image_url,
            "productUrl": product_url
        })

    return parsed_variants
