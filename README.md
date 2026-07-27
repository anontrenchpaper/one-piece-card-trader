# 🃏 TCG Card Pricing Automation App

A modern, interactive web application built with **React** and **FastAPI** to automate TCG card pricing from **TCGPlayer** (including USD to AUD currency conversion, visual variant selection, and CSV batch processing).

---

## 🌟 Core Features

- **Card Number UID Lookup**: Search cards using the exact physical card code printed on cards (e.g. `ST30-001`, `OP01-025`, `OP05-119`).
- **Interactive Visual Variant Selector**: When a single card code has multiple prints (e.g., Base vs. Parallel / Alt-Art / Foil), present visual card thumbnails with set names and prices so you can pick the exact card print.
- **Live USD ➡️ AUD Currency Conversion**: Automatically fetches live exchange rates from Open Exchange Rates and converts TCGPlayer Market Prices into Australian Dollars (AUD), with an editable conversion control.
- **CSV Batch Import & Export**: Upload a CSV file containing card codes, process pricing in batch, and export a clean CSV with card names, sets, market prices (USD & AUD), and TCGPlayer product links.
- **Modern Dark-Mode UI**: Glassmorphic, responsive interface built with modern React.

---

## 🛠️ Tech Stack & Architecture

- **Frontend**: React + Vite + Lucide Icons + Custom Glassmorphic CSS Design System
- **Backend**: Python 3 (FastAPI) managed via Astral's `uv` tool
- **Data Integration**: TCGPlayer Search API (`mp-search-api.tcgplayer.com`)
- **Currency Engine**: Open Exchange Rate API (`open.er-api.com`)

---

## 🚀 Setup & Installation

### 1. Backend Setup (FastAPI)

```bash
# Navigate to project root
cd /Users/punjayawickramasinghe/dev/dash-card-trading

# Create virtual environment and install dependencies using uv
uv venv
uv pip install fastapi uvicorn httpx python-multipart pydantic

# Run FastAPI server
uv run uvicorn backend.app:app --reload --port 8000
```

### 2. Frontend Setup (React UI)

```bash
# In another terminal tab, navigate to frontend/
cd frontend

# Install node dependencies
npm install

# Start Vite development server
npm run dev
```

Open your browser at `http://localhost:5173` to launch the application.
