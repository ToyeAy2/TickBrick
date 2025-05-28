// ✅ server.mjs

import express from "express";
import fetch from "node-fetch";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;
const API_KEY = process.env.ALPHAVANTAGE_API_KEY;

app.use(cors());
app.use(express.static("public"));

// ✅ Quote endpoint
app.get("/api/quote", async (req, res) => {
  const { ticker } = req.query;
  const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${ticker}&entitlement=delayed&apikey=${API_KEY}`;

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error("Failed to fetch quote");
    const data = await response.json();

    const quoteKey = Object.keys(data).find(key => key.startsWith("Global Quote"));
    const quote = data[quoteKey];

    if (!quote || Object.keys(quote).length === 0) {
      console.error("No quote data found. Full response:", data);
      throw new Error("No quote data found");
    }

    res.json({
      code: quote["01. symbol"],
      latestPrice: parseFloat(quote["05. price"]),
      previousClose: parseFloat(quote["08. previous close"])
    });
    
  } catch (err) {
    console.error("Quote fetch error:", err);
    res.status(500).json({ error: "Quote fetch failed" });
  }
});

// ✅ Chart endpoint with updated month logic
app.get("/api/chart", async (req, res) => {
  const { ticker, range } = req.query;

  try {
    let url, parser;

    if (range === "1d") {
      url = `https://www.alphavantage.co/query?function=TIME_SERIES_INTRADAY&symbol=${ticker}&interval=5min&outputsize=compact&entitlement=delayed&apikey=${API_KEY}`;
      parser = "Time Series (5min)";
    } else if (range === "1w") {
      url = `https://www.alphavantage.co/query?function=TIME_SERIES_INTRADAY&symbol=${ticker}&interval=30min&outputsize=full&entitlement=delayed&apikey=${API_KEY}`;
      parser = "Time Series (30min)";
    } else if (range === "1m") {
      url = `https://www.alphavantage.co/query?function=TIME_SERIES_INTRADAY&symbol=${ticker}&interval=60min&outputsize=full&entitlement=delayed&apikey=${API_KEY}`;
      parser = "Time Series (60min)";
    }

    const response = await fetch(url);
    if (!response.ok) throw new Error("Failed to fetch chart data");
    const data = await response.json();

    const series = data[parser];
    if (!series) throw new Error("No chart data found");

    const sorted = Object.keys(series).sort();
    const chartData = sorted.map(date => ({
      date,
      close: parseFloat(series[date]["4. close"])
    }));

    res.json(chartData);
  } catch (err) {
    console.error("Chart fetch error:", err);
    res.status(500).json({ error: "Chart fetch failed" });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Tick Brick backend running with Alpha Vantage Premium at http://localhost:${PORT}`);
});