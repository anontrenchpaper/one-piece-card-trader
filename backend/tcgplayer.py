import re
import httpx
from typing import List, Dict, Any, Optional
from config.settings import TCGPLAYER_SEARCH_API, HEADERS

def extract_card_number(raw_input: str) -> Dict[str, str]:
    """
    Extracts the core card number identifier (e.g. 'OP13-120' from 'OP13-120 SEC')
    and any specified rarity / variant keywords.
    """
    text = raw_input.strip()
    
    # 1. Match card numbers like OP13-120, ST30-001, CORI-EN062, 081/088, 4/102
    pattern = r'([A-Za-z0-9]+[-/][0-9A-Za-z]+|\b\d{1,3}/\d{1,3}\b)'
    match = re.search(pattern, text)
    
    card_number = match.group(1) if match else text

    # Remove common rarity keywords if appended
    rarity_keywords = ["SEC", "SAR", "SR", "SP", "L", "R", "UC", "C", "PARALLEL", "ALT", "HOLO", "FOIL", "PROMO"]
    tokens = text.upper().split()
    detected_rarities = [t for t in tokens if t in rarity_keywords]

    return {
        "raw": text,
        "extracted_number": card_number,
        "rarities": detected_rarities
    }

def search_card_by_number(card_input: str) -> List[Dict[str, Any]]:
    clean_input = card_input.strip()
    if not clean_input:
        return []

    parsed = extract_card_number(clean_input)
    target_num = parsed["extracted_number"]

    # Strategy 1: Exact Number term filter (e.g. number: ["OP13-120"])
    payload_term = {
        "algorithm": "free_text_search",
        "from": 0,
        "size": 30,
        "filters": {
            "term": {
                "number": [target_num]
            }
        },
        "query": "",
        "context": {"shippingCountry": "US", "cart": {}}
    }

    raw_results = []
    try:
        with httpx.Client(timeout=15.0) as client:
            res = client.post(TCGPLAYER_SEARCH_API, json=payload_term, headers=HEADERS)
            if res.status_code == 200:
                raw_results = res.json().get("results", [{}])[0].get("results", [])

            # Strategy 2: Free text search using extracted number if term filter returned empty
            if not raw_results:
                payload_extracted_query = {
                    "algorithm": "free_text_search",
                    "from": 0,
                    "size": 30,
                    "filters": {"term": {}},
                    "query": target_num,
                    "context": {"shippingCountry": "US", "cart": {}}
                }
                res_q = client.post(TCGPLAYER_SEARCH_API, json=payload_extracted_query, headers=HEADERS)
                if res_q.status_code == 200:
                    raw_results = res_q.json().get("results", [{}])[0].get("results", [])

            # Strategy 3: Free text search using raw input
            if not raw_results:
                payload_raw_query = {
                    "algorithm": "free_text_search",
                    "from": 0,
                    "size": 30,
                    "filters": {"term": {}},
                    "query": clean_input,
                    "context": {"shippingCountry": "US", "cart": {}}
                }
                res_raw = client.post(TCGPLAYER_SEARCH_API, json=payload_raw_query, headers=HEADERS)
                if res_raw.status_code == 200:
                    raw_results = res_raw.json().get("results", [{}])[0].get("results", [])
    except Exception as e:
        print(f"Error fetching TCGPlayer data for '{card_input}': {e}")
        return []

    # Filter and parse results
    parsed_variants = []
    seen_ids = set()

    for item in raw_results:
        product_id = item.get("productId")
        if not product_id or product_id in seen_ids:
            continue

        product_id = int(product_id)
        product_name = item.get("productName", "Unknown Card")
        set_name = item.get("setName", "Unknown Set")
        market_price = item.get("marketPrice")
        custom = item.get("customAttributes", {})
        number = custom.get("number", target_num)
        rarity = custom.get("rarity", "")

        # Check if this result matches our target card number (exact or partial match)
        num_clean = str(number).strip().upper()
        target_clean = target_num.strip().upper()

        is_exact_num_match = (num_clean == target_clean or target_clean in num_clean)

        image_url = f"https://tcgplayer-cdn.tcgplayer.com/product/{product_id}_200w.jpg"
        product_url = f"https://www.tcgplayer.com/product/{product_id}"

        seen_ids.add(product_id)
        parsed_variants.append({
            "productId": product_id,
            "productName": product_name,
            "setName": set_name,
            "number": number,
            "rarity": rarity,
            "marketPriceUSD": float(market_price) if market_price is not None else None,
            "imageUrl": image_url,
            "productUrl": product_url,
            "isExactMatch": is_exact_num_match
        })

    # Sort results: exact card number matches first, then by market price
    parsed_variants.sort(key=lambda x: (not x["isExactMatch"], x["marketPriceUSD"] is None))

    return parsed_variants
