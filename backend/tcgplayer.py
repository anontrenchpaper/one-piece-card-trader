try:
    from curl_cffi import requests
    HAS_CURL_CFFI = True
except ImportError:
    import requests
    HAS_CURL_CFFI = False


def extract_card_number(raw_input: str) -> Dict[str, Any]:
    text = raw_input.strip()
    pattern = r'([A-Za-z0-9]+[-/][0-9A-Za-z]+|\b\d{1,3}/\d{1,3}\b)'
    match = re.search(pattern, text)
    card_number = match.group(1) if match else text

    rarity_keywords = ["SEC", "SAR", "SR", "SP", "L", "R", "UC", "C", "PARALLEL", "ALT", "HOLO", "FOIL", "PROMO"]
    tokens = text.upper().split()
    detected_rarities = [t for t in tokens if t in rarity_keywords]

    return {
        "raw": text,
        "extracted_number": card_number,
        "rarities": detected_rarities
    }

def fetch_recent_sales(product_id: int) -> Tuple[List[float], Optional[float]]:
    url = f"https://mp-search-api.tcgplayer.com/v1/product/{product_id}/latestsales"
    payload = {"limit": 10}
    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": "en-US,en;q=0.9",
        "Content-Type": "application/json",
        "Origin": "https://www.tcgplayer.com",
        "Referer": f"https://www.tcgplayer.com/product/{product_id}",
        "Sec-Ch-Ua": '"Chromium";v="124", "Google Chrome";v="124"',
        "Sec-Ch-Ua-Mobile": "?0",
        "Sec-Ch-Ua-Platform": '"macOS"',
        "Sec-Fetch-Dest": "empty",
        "Sec-Fetch-Mode": "cors",
        "Sec-Fetch-Site": "same-site"
    }

    extra_args = {"impersonate": "chrome124"} if HAS_CURL_CFFI else {}

    try:
        res = requests.post(url, json=payload, headers=headers, timeout=4, **extra_args)
        if res.status_code == 200:
            sales = res.json().get("data", [])
            prices = []
            for s in sales:
                p = s.get("purchasePrice")
                if p is not None:
                    try:
                        prices.append(float(p))
                    except (ValueError, TypeError):
                        pass
            
            recent_3 = prices[:3]
            avg_3 = round(sum(recent_3) / len(recent_3), 2) if recent_3 else None
            return recent_3, avg_3
    except Exception:
        pass

    return [], None

def search_card_by_number(card_input: str, one_piece_only: bool = True) -> List[Dict[str, Any]]:
    clean_input = card_input.strip()
    if not clean_input:
        return []

    parsed = extract_card_number(clean_input)
    target_num = parsed["extracted_number"]

    category_filter = {}
    if one_piece_only:
        category_filter["productCategoryName"] = ["One Piece Card Game"]

    filters_term = {"term": {"number": [target_num], **category_filter}}
    payload_term = {
        "algorithm": "free_text_search",
        "from": 0,
        "size": 30,
        "filters": filters_term,
        "query": "",
        "context": {"shippingCountry": "US", "cart": {}}
    }

    raw_results = []
    search_headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": "en-US,en;q=0.9",
        "Content-Type": "application/json",
        "Origin": "https://www.tcgplayer.com",
        "Referer": "https://www.tcgplayer.com/",
        "Sec-Ch-Ua": '"Chromium";v="124", "Google Chrome";v="124"',
        "Sec-Ch-Ua-Mobile": "?0",
        "Sec-Ch-Ua-Platform": '"macOS"',
        "Sec-Fetch-Dest": "empty",
        "Sec-Fetch-Mode": "cors",
        "Sec-Fetch-Site": "same-site"
    }

    try:
        res = requests.post(TCGPLAYER_SEARCH_API, json=payload_term, headers=search_headers, timeout=10, **extra_args)
        if res.status_code == 200:
            raw_results = res.json().get("results", [{}])[0].get("results", [])

        if not raw_results:
            filters_fb = {"term": category_filter}
            payload_extracted = {
                "algorithm": "free_text_search",
                "from": 0,
                "size": 30,
                "filters": filters_fb,
                "query": target_num,
                "context": {"shippingCountry": "US", "cart": {}}
            }
            res_ex = requests.post(TCGPLAYER_SEARCH_API, json=payload_extracted, headers=search_headers, timeout=10, **extra_args)
            if res_ex.status_code == 200:
                raw_results = res_ex.json().get("results", [{}])[0].get("results", [])

        if not raw_results and one_piece_only:
            return search_card_by_number(card_input, one_piece_only=False)

    except Exception as e:
        print(f"Error fetching TCGPlayer data for '{card_input}': {e}")
        return []

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

        num_clean = str(number).strip().upper()
        target_clean = target_num.strip().upper()
        is_exact_num_match = (num_clean == target_clean or target_clean in num_clean)

        image_url = f"https://tcgplayer-cdn.tcgplayer.com/product/{product_id}_200w.jpg"
        product_url = f"https://www.tcgplayer.com/product/{product_id}"

        # Fetch recent sales or fallback gracefully to market price
        recent_3_sales, avg_3_sales = fetch_recent_sales(product_id)

        market_val = float(market_price) if market_price is not None else None
        if avg_3_sales is None and market_val is not None:
            avg_3_sales = round(market_val, 2)

        seen_ids.add(product_id)
        parsed_variants.append({
            "productId": product_id,
            "productName": product_name,
            "setName": set_name,
            "number": number,
            "rarity": rarity,
            "marketPriceUSD": market_val,
            "recentSalesUSD": recent_3_sales,
            "averageRecentSalesUSD": avg_3_sales,
            "imageUrl": image_url,
            "productUrl": product_url,
            "isExactMatch": is_exact_num_match
        })

    parsed_variants.sort(key=lambda x: (not x["isExactMatch"], x["marketPriceUSD"] is None))

    return parsed_variants
