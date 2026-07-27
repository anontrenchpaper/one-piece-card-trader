# 🃏 TCG Card Pricing Automation App

A modern, interactive web application built with **React** and **FastAPI** to automate TCG card pricing from **TCGPlayer** (including USD to AUD currency conversion, 3-sale history averages, passcode authentication, and GitHub Pages static hosting).

---

## 🌟 Core Features

- **Card Number UID Lookup**: Search cards using physical card codes (e.g. `OP13-120 SEC`, `ST30-001`, `OP01-025`, `OP05-119`).
- **Interactive Visual Variant Selector**: Displays high-res artwork, set names, rarities, market prices, and 3-sale averages for multi-print cards.
- **3 Most Recent Purchase Sales & Average**: Automatically retrieves the 3 most recent transaction prices from TCGPlayer and calculates their 3-sale average.
- **Live USD ➡️ AUD Currency Engine**: Live currency conversion from Open Exchange Rates into Australian Dollars (AUD).
- **Passcode Authentication**: Lock screen (`AuthGuard`) protecting the app workspace with SHA-256 hashed passcode verification (default: `card-trading-2026`).
- **GitHub Pages Ready**: Runs 100% serverlessly on GitHub Pages out-of-the-box using direct browser fetching, with a toggle for local Python backend proxy testing.
- **CSV Import & Export**: Upload a CSV with card numbers, process prices, and export a clean CSV with market prices, recent sales, averages, and TCGPlayer links.

---

## 📁 Project Structure

```text
dash-card-trading/
├── docs/
│   ├── architecture.md        # Architectural decisions, data flow & search rationale
│   ├── deployment_gh_pages.md  # Step-by-step GitHub Pages deployment guide
│   └── authentication.md      # Passcode authentication model & hashing setup
├── tests/
│   ├── README.md              # Test suite guide
│   └── test_fetch.py          # Search API test
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   └── AuthGuard.jsx  # Access protection screen
│   │   ├── config/
│   │   │   └── auth.js        # SHA-256 auth configuration
│   │   └── services/
│   │       └── tcgplayer.js   # Client-side TCGPlayer & sales engine
│   └── package.json           # React dependencies & gh-pages scripts
├── backend/
│   ├── app.py                 # FastAPI backend server
│   ├── tcgplayer.py           # Python TCGPlayer scraper module
│   └── currency.py            # Currency conversion service
├── example_card_inputs.csv    # Sample CSV reference file
├── pyrightconfig.json         # Pyright LSP config
├── gemini.md                  # Project context log
└── README.md                  # Main documentation
```

---

## 🚀 Quick Start & Deployment

### 1. Standalone Web App / GitHub Pages (Zero-Setup for Users)

To deploy to GitHub Pages:
```bash
cd frontend
npm run deploy
```
Your live site will be available at `https://<your-username>.github.io/dash-card-trading/`!

### 2. Local Development & Testing

```bash
# Terminal 1: Backend Server
uv venv
uv run uvicorn backend.app:app --reload --port 8000

# Terminal 2: Frontend App
cd frontend
npm run dev
```

Passcode for first login: **`card-trading-2026`**
