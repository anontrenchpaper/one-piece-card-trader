# 🏗️ System Architecture & Design Rationale

This document details the architectural decisions, data flow, and search engines powering the **TCG Card Pricing Automation App**.

---

## 🌟 High-Level Design Overview

The application is designed to solve card pricing automation for trading card games (specifically **One Piece Card Game**, Pokémon, and Yu-Gi-Oh) using **TCGPlayer** market data and **Australian Dollar (AUD)** conversion.

```
+-------------------------------------------------------------------+
|                        React Frontend UI                          |
|  (Glassmorphism Dashboard, Passcode Auth, Interactive Variant     |
|   Picker, CSV Upload/Download, Mode Switch: Client-Side vs API)   |
+---------------------------------+---------------------------------+
                                  |
               +------------------+------------------+
               |                                     |
               v                                     v
+-----------------------------+       +-----------------------------+
|  Client-Side Engine (JS)    |       |    FastAPI Backend (Python) |
|  - Direct TCGPlayer Fetch   |       |  - TCGPlayer Search API     |
|  - Open Exchange Rate API   |       |  - 3-Sale History Engine    |
|  - (Default for GH Pages)   |       |  - (For Local Dev / Proxy)  |
+-----------------------------+       +-----------------------------+
```

---

## 🔑 Key Rationale for Design Decisions

### 1. Unique Identifier (UID) Extraction
- **Challenge**: Physical cards specify codes like `OP13-120`, `ST30-001`, or `OP01-025`, but users/spreadsheets often input strings containing rarity codes like `OP13-120 SEC` or `OP01-025 Parallel`.
- **Solution**: A regular expression parser (`r'([A-Za-z0-9]+[-/][0-9A-Za-z]+|\b\d{1,3}/\d{1,3}\b)'`) strips trailing rarity terms (`SEC`, `SAR`, `SP`, `Parallel`, etc.) and isolates the core card number (`OP13-120`) to query TCGPlayer's `"number"` term filter.

### 2. Interactive Variant Selector Modal
- **Challenge**: Multiple physical cards share the exact same card number code (e.g. Base print vs Parallel Alt-Art vs Wanted Poster print).
- **Solution**: Instead of picking an arbitrary variant, the app opens a visual modal displaying high-res card artwork, set names, rarities, market prices, and 3-sale averages so the user can interactively select their exact card print.

### 3. 3-Sale Average & Historical Transactions Engine
- **Challenge**: TCGPlayer Market Price can lag behind real-time market spikes.
- **Solution**: The app queries TCGPlayer's transaction sales history endpoint (`/latestsales`), extracts the 3 most recent purchase prices, calculates their average, and exports `Recent Sale 1`, `Recent Sale 2`, `Recent Sale 3`, and `3-Sale Average` into both the UI and CSV.

### 4. Dual-Engine Architecture (GitHub Pages + Local Dev Backend)
- **Client-Side Engine (Default)**: Executes search queries directly from the user's browser in JavaScript. This enables 100% serverless hosting on **GitHub Pages** with zero hosting costs or server maintenance.
- **Backend Proxy Engine**: Preserves the Python FastAPI server (`backend/app.py`) for local testing or proxy execution if browser CORS/Cloudflare restrictions ever arise.
