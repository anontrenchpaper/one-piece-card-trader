import json
import httpx

def search_card_by_number(card_number: str):
    url = "https://mp-search-api.tcgplayer.com/v1/search/request"
    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "application/json",
        "Content-Type": "application/json",
        "Origin": "https://www.tcgplayer.com",
        "Referer": "https://www.tcgplayer.com/"
    }

    card_number_clean = card_number.strip()

    # Attempt 1: Search by exact "number" term filter
    payload_number = {
        "algorithm": "free_text_search",
        "from": 0,
        "size": 20,
        "filters": {
            "term": {
                "number": [card_number_clean]
            }
        },
        "query": "",
        "context": {"shippingCountry": "US", "cart": {}}
    }

    results = []
    with httpx.Client(timeout=15.0) as client:
        res = client.post(url, json=payload_number, headers=headers)
        if res.status_code == 200:
            results = res.json().get("results", [{}])[0].get("results", [])

        # Attempt 2: Fallback to free_text query if exact number filter returned no results
        if not results:
            payload_fallback = {
                "algorithm": "free_text_search",
                "from": 0,
                "size": 20,
                "filters": {"term": {}},
                "query": card_number_clean,
                "context": {"shippingCountry": "US", "cart": {}}
            }
            res_fb = client.post(url, json=payload_fallback, headers=headers)
            if res_fb.status_code == 200:
                results = res_fb.json().get("results", [{}])[0].get("results", [])

    print(f"\n=========================================")
    print(f"SEARCH RESULTS FOR CARD #: '{card_number}'")
    print(f"Total Matches Found: {len(results)}")
    print(f"=========================================")

    parsed_cards = []
    for idx, item in enumerate(results, 1):
        product_id = int(item.get("productId", 0))
        product_name = item.get("productName", "Unknown")
        set_name = item.get("setName", "Unknown Set")
        market_price = item.get("marketPrice")
        custom = item.get("customAttributes", {})
        number = custom.get("number", "")
        rarity = custom.get("rarity", "")
        image_url = f"https://tcgplayer-cdn.tcgplayer.com/product/{product_id}_200w.jpg"
        product_url = f"https://www.tcgplayer.com/product/{product_id}"

        card_info = {
            "productId": product_id,
            "productName": product_name,
            "setName": set_name,
            "number": number,
            "rarity": rarity,
            "marketPriceUSD": market_price,
            "imageUrl": image_url,
            "productUrl": product_url
        }
        parsed_cards.append(card_info)

        print(f"Variant [{idx}]: {product_name}")
        print(f"  - Set: {set_name} | Card #: {number} | Rarity: {rarity}")
        print(f"  - TCGPlayer Product ID: {product_id}")
        print(f"  - Market Price (USD): ${market_price:.2f}" if market_price else "  - Market Price (USD): N/A")
        print(f"  - Image URL: {image_url}")
        print(f"  - Link: {product_url}")
        print("-" * 50)

    return parsed_cards

if __name__ == "__main__":
    # Test card numbers
    test_uids = ["ST30-001", "OP01-025", "OP05-119"]
    for uid in test_uids:
        search_card_by_number(uid)
