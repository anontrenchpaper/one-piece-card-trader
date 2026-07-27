import httpx
from config.settings import DEFAULT_USD_TO_AUD_RATE, EXCHANGE_RATE_API

def fetch_usd_to_aud_rate() -> float:
    try:
        with httpx.Client(timeout=5.0) as client:
            res = client.get(EXCHANGE_RATE_API)
            if res.status_code == 200:
                data = res.json()
                aud_rate = data.get("rates", {}).get("AUD")
                if aud_rate and isinstance(aud_rate, (int, float)):
                    return round(float(aud_rate), 4)
    except Exception as e:
        print(f"Warning: Failed to fetch live exchange rate ({e}), fallback to default: {DEFAULT_USD_TO_AUD_RATE}")
    return DEFAULT_USD_TO_AUD_RATE
