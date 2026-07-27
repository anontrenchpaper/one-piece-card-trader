import os

# Configuration parameters
DEFAULT_USD_TO_AUD_RATE = 1.52
EXCHANGE_RATE_API = "https://open.er-api.com/v6/latest/USD"

TCGPLAYER_SEARCH_API = "https://mp-search-api.tcgplayer.com/v1/search/request"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, meckeo, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "application/json",
    "Content-Type": "application/json",
    "Origin": "https://www.tcgplayer.com",
    "Referer": "https://www.tcgplayer.com/",
}
