# Profit Scout AI — PRD (v1.0 MVP)

## Vision
Production-ready reseller intelligence platform for iOS / Android / Web that helps
resellers decide whether an item is profitable before buying and manage their entire
resale business from one app.

## Stack
- **Frontend:** Expo (React Native) + Expo Router — iOS, Android, Web.
- **Backend:** FastAPI + Motor (MongoDB), JWT auth (PyJWT + bcrypt).
- **AI:** Gemini 3.1 Pro Preview via Emergent LLM key.
- **Storage:** MongoDB. Local secure storage for JWT + prefs via `@/src/utils/storage`.

## Phase 1 features — SHIPPED
### Home Dashboard
- Hero card: Total Profit, Revenue, ROI %, Inventory Value
- KPI cards: Active listings, Items sold, In stock, Best category, Best source, Scan history
- Scan barcode CTA + tiles: Camera AI, Manual search, Profit calc, FB Marketplace

### Item Scanner
- Barcode/UPC scan via expo-camera
- Camera AI via expo-camera + Gemini 3.1 Pro Preview vision
- Manual search
- AI identifies: product name, brand, model, category, suggested search terms

### eBay Research (MOCK layer, ready for real API)
- Active listings count, sold count, sell-through rate
- Average / lowest / highest sold prices, recent sold list

### Profit Calculator
- Inputs: buy cost, sell price, eBay fee %, shipping, tax, packaging, misc
- Outputs: net profit, ROI, profit margin, total cost, verdict

### AI Buy Advisor + Profit Scout Score
- Verdict colors: 🟢 BUY / 🟡 MAYBE / 🔴 DO NOT BUY
- AI reasoning text (Gemini)
- Profit Scout Score (0–100) from demand, competition, profit, velocity, seasonality
  with sub-score bars per dimension

### Inventory Management
- CRUD with full fields: title, sku, category, source, platform, status, dates, costs
- Status: in_stock, listed, sold, returned (auto date_sold when marked sold)
- Live profit math: net, ROI, margin, days-to-sell

### Sale Platforms
- eBay, Whatnot, Facebook Marketplace, Mercari, Local Sale

### Sourcing Tags (9)
- Whatnot, Pallet, Facebook, Garage Sale, Flea Market, Auction, Thrift Store,
  Retail Arbitrage, Other

### Sourcing Analytics
- Revenue / profit / ROI by source, items, sold count, avg days to sell
- Best vs worst source pills

### Pallet Mode
- Pallet CRUD with auto Total Investment
- Manifest import (xlsx/csv/pdf) → Gemini extracts up to 60 items
- Pallet dashboard: invested, revenue recovered, profit, break-even %, remaining
  inventory value, estimated final profit, status counts
- AI Pallet Analyzer: top-value, fast movers, slow movers, risk items, recommended
  listing order, conservative/expected/best-case forecast
- Item status tracking: available / listed / sold / damaged / returned / missing

### Scan to Inventory
- After product results screen: one-tap "Add to inventory" prefills title

### History
- Stores searches, scans, profit checks. Pull-to-refresh, long-press delete.

### Reports
- Daily / Weekly / Monthly / Yearly profit bars + totals
- Sourcing analytics inline

### Settings
- Light / Dark theme (persisted both locally and on server)
- Currency: USD / EUR / GBP / CAD / AUD (symbol used across app)
- Notifications toggle
- Export inventory CSV (Share or copy)
- Sign out

### UX
- Dark + Light themes, color-coded verdicts, large touch targets (≥44pt),
  bottom tabs (Home/Inventory/Pallets/Reports/Settings), modal scan flows.

## Not in scope (deferred)
- Real eBay Browse API (mock layer in place; swap `mock_ebay_data()` once user
  provides eBay App ID + Cert ID).
- Push notifications.
- Per-screen dark-mode polish on scan/pallet/product/history (these screens use
  the light palette — fully functional, just not dark-tinted yet).

## Test status
- Backend: **39/39 pytest tests pass** (auth, search, profit, history, FB comps,
  pallet lifecycle + manifest, inventory CRUD + filters + metrics math, stats/home,
  stats/sourcing, stats/reports across periods, score, settings, export).
- Frontend: manually validated on web preview (login, KPI dashboard, inventory
  list, reports, settings + dark mode toggle).
