### 📋 Technical Specification: Alpha Shield VIX Optimizer (Hybrid Next.js + Flask)

Role: Expert Quant Developer & Full-stack Engineer.
Task: Build a hybrid financial dashboard using Next.js (Frontend) and Flask (Backend Optimization Engine) that performs hyper-parameter optimization for a multi-asset portfolio strategy based on VIX and MDD triggers.

---

### 1. Data Source & Asset Universe
* **API (Backend - Flask)**: Python backend fetches 15 years of daily historical data.
    * Endpoint: `https://yahoo-finance-api-seven.vercel.app/history?symbols=^VIX,SPY,QQQ,SCHD,QLD,TQQQ&period=15y`
* **Core Portfolio**: QQQ, SCHD, SPY, and CASH.
* **Tactical Leverage**: QLD (2x QQQ) and TQQQ (3x QQQ).

---

### 2. Hyper-Parameters for Optimization (8 Variables)
The Flask-based optimizer finds the best combination of:
1.  **Initial Weights**: QQQ, SCHD, SPY, and Initial Cash (Sum = 100%).
2.  **QLD Entry Threshold**: VIX ≥ N (Range: 15 ~ 55).
3.  **TQQQ Entry Threshold**: Strategy MDD ≥ M% (Range: 5% ~ 45%).
4.  **Daily Purchase Amount**: Fixed amount (e.g., $1,000,000) to buy leverage daily from Cash reserves.
5.  **Exit Threshold**: VIX < X (Range: 10 ~ 25). When triggered, sell ALL QLD/TQQQ to Cash.

---

### 3. Core Logic (Python/Flask Backend)
* **High-Performance Backtesting**: Implement the core simulation logic in Python for speed.
* **Sequential Optimization**: Next.js triggers a Flask endpoint `/api/optimize` which runs 500+ randomized iterations.
* **Safety First Constraint**: If Strategy MDD > SPY MDD, Score = 0.
* **Fitness Score**: ROI / (Abs Max MDD + 1). Focus: Maximize ROI while staying safer than SPY.
* **Streaming Updates**: Use Server-Sent Events (SSE) or WebSockets from Flask to Next.js to update the "System Log" in real-time.

---

### 4. UI/UX & Visualization (Next.js Frontend)
* **Framework**: React/Next.js (Tailwind CSS).
* **Charts**: `lightweight-charts`. Strategy Equity (Cyan, Bold) vs. SPY (White, Dashed).
* **Design**: Modern Fintech Dark Mode (Background: `#0b141d`, Card: `#1c2631`).
* **Components**:
    * **Sidebar**: Sliders for manual overrides + Real-time Stat Cards.
    * **Main**: Interactive Chart + Alpha/Beta metrics.
    * **Bottom**: Real-time "Optimization Log" (Streamed from Flask) and "Trade History".

---

### 5. Implementation Requirements (Next.js + Flask Starter)
1.  **Bridge**: Frontend sends parameters to `/api/python/` via `experimentalServices` routing.
2.  **Concurrency**: Use Python `asyncio` or threading to ensure the Flask API remains responsive during long optimization tasks.
3.  **Real-time Hydration**: When a "New Best" is found by the Python engine, the Next.js UI updates sliders and re-renders the chart immediately.
