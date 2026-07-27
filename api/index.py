import re
import io
import csv
from typing import List, Dict, Any, Optional, Tuple
from concurrent.futures import ThreadPoolExecutor, as_completed
import os

try:
    from curl_cffi import requests
    HAS_CURL_CFFI = True
except ImportError:
    import requests
    HAS_CURL_CFFI = False

from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI(title="TCG Card Pricing API", version="1.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

TCGPLAYER_SEARCH_API = "https://mp-search-api.tcgplayer.com/v1/search/request"

def fetch_usd_to_aud_rate() -> float:
    try:
        res = requests.get("https://open.er-api.com/v6/latest/USD", timeout=3)
        if res.status_code == 200:
            data = res.json()
            rate = data.get("rates", {}).get("AUD")
            if rate:
                return round(float(rate), 4)
    except Exception:
        pass
    return 1.52

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

    try:
        extra_args = {"impersonate": "chrome124"} if HAS_CURL_CFFI else {}
        res = requests.post(url, json=payload, headers=headers, timeout=2.5, **extra_args)
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
        "size": 20,
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
        extra_args = {"impersonate": "chrome124"} if HAS_CURL_CFFI else {}
        res = requests.post(TCGPLAYER_SEARCH_API, json=payload_term, headers=search_headers, timeout=4, **extra_args)
        if res.status_code == 200:
            raw_results = res.json().get("results", [{}])[0].get("results", [])

        if not raw_results:
            filters_fb = {"term": category_filter}
            payload_extracted = {
                "algorithm": "free_text_search",
                "from": 0,
                "size": 20,
                "filters": filters_fb,
                "query": target_num,
                "context": {"shippingCountry": "US", "cart": {}}
            }
            res_ex = requests.post(TCGPLAYER_SEARCH_API, json=payload_extracted, headers=search_headers, timeout=4, **extra_args)
            if res_ex.status_code == 200:
                raw_results = res_ex.json().get("results", [{}])[0].get("results", [])

        if not raw_results and one_piece_only:
            return search_card_by_number(card_input, one_piece_only=False)

    except Exception as e:
        print(f"Error fetching TCGPlayer data for '{card_input}': {e}")
        return []

    parsed_variants = []
    seen_ids = set()

    items_to_process = raw_results[:12]

    def process_item(item):
        product_id = item.get("productId")
        if not product_id:
            return None

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

        recent_3_sales, avg_3_sales = fetch_recent_sales(product_id)

        market_val = float(market_price) if market_price is not None else None
        if avg_3_sales is None and market_val is not None:
            avg_3_sales = round(market_val, 2)

        return {
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
        }

    with ThreadPoolExecutor(max_workers=6) as executor:
        futures = [executor.submit(process_item, item) for item in items_to_process]
        for future in as_completed(futures):
            try:
                res = future.result()
                if res and res["productId"] not in seen_ids:
                    seen_ids.add(res["productId"])
                    parsed_variants.append(res)
            except Exception:
                pass

    parsed_variants.sort(key=lambda x: (not x["isExactMatch"], x["marketPriceUSD"] is None))
    return parsed_variants

class CardSearchRequest(BaseModel):
    cardNumber: str
    onePieceOnly: Optional[bool] = True

@app.get("/api/health")
@app.get("/health")
def health_check():
    return {"status": "ok", "message": "TCG Card Pricing Service is running on Vercel"}

@app.get("/api/exchange-rate")
@app.get("/exchange-rate")
def get_exchange_rate():
    rate = fetch_usd_to_aud_rate()
    return {"rate": rate, "base": "USD", "target": "AUD"}

@app.post("/api/search")
@app.post("/search")
def search_card(req: CardSearchRequest):
    variants = search_card_by_number(req.cardNumber, one_piece_only=req.onePieceOnly if req.onePieceOnly is not None else True)
    return {"cardNumber": req.cardNumber, "total": len(variants), "variants": variants}

@app.post("/api/parse-csv")
@app.post("/parse-csv")
async def parse_csv(file: UploadFile = File(...)):
    if not file.filename.endswith(('.csv', '.txt')):
        raise HTTPException(status_code=400, detail="File must be a CSV file.")
    
    contents = await file.read()
    decoded = contents.decode("utf-8-sig", errors="ignore")
    reader = csv.reader(io.StringIO(decoded))
    
    rows = [row for row in reader if row]
    if not rows:
        return {"cardNumbers": []}

    first_row = [c.strip() for c in rows[0]]
    card_col_idx = 0
    
    for idx, col in enumerate(first_row):
        col_lower = col.lower()
        if any(k in col_lower for k in ["card", "number", "code", "id", "uid", "sku"]):
            card_col_idx = idx
            break

    card_numbers = []
    start_row = 1 if any(k in first_row[card_col_idx].lower() for k in ["card", "number", "code", "id", "uid"]) else 0
    
    for row in rows[start_row:]:
        if len(row) > card_col_idx:
            val = row[card_col_idx].strip()
            if val and val not in card_numbers:
                card_numbers.append(val)

    return {"cardNumbers": card_numbers, "totalFound": len(card_numbers)}

# Mount static files at the very end so API routes take precedence
frontend_dist = os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend", "dist")
if os.path.exists(frontend_dist):
    app.mount("/", StaticFiles(directory=frontend_dist, html=True), name="frontend")
