
# 🧱 Tick Brick — Raspberry Pi Dashboard

This is a self-contained stock dashboard web app built with Node.js and Express, designed to run fullscreen on a Raspberry Pi Zero 2 W. The frontend uses Chart.js and fetches live data via a backend proxy to the Alpha Vantage API.

---

## ✅ Project Structure

```
tickbrick/
├── package.json
├── package-lock.json
├── server.mjs         ← Express server entry point
├── public/            ← Static files served by Express
│   ├── index.html     ← Dashboard layout
│   ├── style.css      ← Dashboard styles
│   ├── script.js      ← Dashboard logic
│   └── assets/logos/  ← Company logos e.g. _AAPL.png, _TSLA.png
└── .env               ← API key (not included in repo)
```

---

## 🛠️ How to Run Locally

> Tested with Node.js 18+

1. **Clone or extract the project.**

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Create a `.env` file in the root folder:**
   ```env
   ALPHAVANTAGE_API_KEY=your_actual_api_key
   ```

4. **Start the server:**
   ```bash
   npm start
   ```

5. **Open in your browser:**
   ```
   http://localhost:3000
   ```

You should see a fully working stock dashboard cycling through tickers.

---

## 📦 Dependencies

- express
- cors
- dotenv
- node-fetch
- date-fns / date-fns-tz

All are declared in `package.json`.

---

## 🧪 Expected Behavior

- The app launches a backend server on port 3000
- The frontend at `public/` is served statically
- `/api/chart` and `/api/quote` proxy Alpha Vantage and format the data
- No build step is required — it’s pure HTML/CSS/JS + Node

---

## ✅ Notes for Packaging on Raspberry Pi

- Auto-login and launch the app with `npm start`
- Open Chromium in kiosk mode: `chromium-browser --kiosk http://localhost:3000`
- Disable screen blanking
- Wi-Fi config via editable file (optional)
- Support for `.env` and Alpha Vantage API key required
