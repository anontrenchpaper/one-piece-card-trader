import io
import csv
from typing import List, Dict, Any, Optional, Tuple
import requests
from fastapi import FastAPI, File, UploadFile, HTTPException
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

@app.get("/api/health")
@app.get("/health")
def health_check():
    return {"status": "ok", "message": "Minimal backend is working with basic endpoints"}

@app.get("/api/exchange-rate")
@app.get("/exchange-rate")
def get_exchange_rate():
    rate = fetch_usd_to_aud_rate()
    return {"rate": rate, "base": "USD", "target": "AUD"}

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

class CardSearchRequest(BaseModel):
    cardNumber: str
    onePieceOnly: Optional[bool] = True

@app.post("/api/search")
@app.post("/search")
def search_card_mock(req: CardSearchRequest):
    # This is a mock endpoint to test the end-to-end frontend integration
    # before we introduce the heavy TCGPlayer scraping logic.
    mock_variant = {
        "productId": 123456,
        "productName": f"Mock Card for {req.cardNumber}",
        "setName": "Mock Set",
        "number": req.cardNumber,
        "rarity": "SEC",
        "marketPriceUSD": 45.99,
        "recentSalesUSD": [45.00, 46.50, 44.99],
        "averageRecentSalesUSD": 45.50,
        "imageUrl": "https://tcgplayer-cdn.tcgplayer.com/product/123456_200w.jpg",
        "productUrl": "https://www.tcgplayer.com/",
        "isExactMatch": True
    }
    return {"cardNumber": req.cardNumber, "total": 1, "variants": [mock_variant]}
