import sys
import os

# Add root directory to sys.path to allow config import
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import io
import csv
from typing import List, Dict, Any, Optional
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from backend.currency import fetch_usd_to_aud_rate
from backend.tcgplayer import search_card_by_number

app = FastAPI(title="TCG Card Pricing API", version="1.0.0")

# Enable CORS for React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class CardSearchRequest(BaseModel):
    cardNumber: str

class BatchSearchRequest(BaseModel):
    cardNumbers: List[str]

class SelectedVariant(BaseModel):
    cardNumber: str
    productId: int
    productName: str
    setName: str
    number: str
    rarity: Optional[str] = ""
    marketPriceUSD: Optional[float] = None
    imageUrl: str
    productUrl: str

@app.get("/api/health")
def health_check():
    return {"status": "ok", "message": "TCG Card Pricing Service is running"}

@app.get("/api/exchange-rate")
def get_exchange_rate():
    rate = fetch_usd_to_aud_rate()
    return {"rate": rate, "base": "USD", "target": "AUD"}

@app.post("/api/search")
def search_card(req: CardSearchRequest):
    variants = search_card_by_number(req.cardNumber)
    return {"cardNumber": req.cardNumber, "total": len(variants), "variants": variants}

@app.post("/api/parse-csv")
async def parse_csv(file: UploadFile = File(...)):
    if not file.filename.endswith(('.csv', '.txt')):
        raise HTTPException(status_code=400, detail="File must be a CSV file.")
    
    contents = await file.read()
    decoded = contents.decode("utf-8-sig", errors="ignore")
    reader = csv.reader(io.StringIO(decoded))
    
    rows = [row for row in reader if row]
    if not rows:
        return {"cardNumbers": []}

    # Detect header row vs raw data
    first_row = [c.strip() for c in rows[0]]
    card_col_idx = 0
    
    # Check if header contains keywords like "card", "id", "number", "code", "identifier"
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
