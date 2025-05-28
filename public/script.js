const ctx = document.getElementById("stockChart").getContext("2d");
const tickers = ["AAPL", "AMZN", "TSLA"];
let currentTickerIndex = 0;
let currentTicker = tickers[currentTickerIndex];
let currentRange = "1d";
let chart = null;
let latestPrice = null;
let refreshInterval = null;
let lastUpdateTime = null;
let lastUpdatedTimer = null;
let isFetching = false;

// 🔵🟢🔴 Pulse dot at last point
const pulsePlugin = {
  id: "pulsePlugin",
  beforeDraw(chart) {
    const ctx = chart.ctx;
    const dataset = chart.data.datasets[0];
    const meta = chart.getDatasetMeta(0);

    if (!meta || !meta.data || meta.data.length < 2) return;

    const lastPoint = meta.data[meta.data.length - 1];
    const prevPoint = meta.data[meta.data.length - 2];
    if (!lastPoint || !prevPoint) return;

    const priceUp = dataset.data[dataset.data.length - 1] > dataset.data[dataset.data.length - 2];
    const color = priceUp ? "#00e676" : "#ff5252";

    const now = Date.now();
    const pulseFrequency = 0.35; // pulses per second
    const pulse = (Math.sin((now / 1000) * pulseFrequency * 2 * Math.PI) + 1) / 2;

    const outerRadius = 8; // constant size
    const outerAlpha = 0.05 + 0.25 * pulse; // fades between 0.15 – 0.4

    // ✨ Outer fading glow
    ctx.save();
    ctx.beginPath();
    ctx.arc(lastPoint.x, lastPoint.y, outerRadius, 0, 2 * Math.PI);
    ctx.fillStyle = color;
    ctx.globalAlpha = outerAlpha;
    ctx.fill();
    ctx.restore();

    // 🎯 Inner solid dot
    ctx.save();
    ctx.beginPath();
    ctx.arc(lastPoint.x, lastPoint.y, 3.5, 0, 2 * Math.PI);
    ctx.fillStyle = color;
    ctx.globalAlpha = 1;
    ctx.fill();
    ctx.restore();
  }
};

// ✨ Traveling glow sweep along the line
const glowSweepPlugin = {
  id: "glowSweepPlugin",
  beforeDatasetsDraw(chart) {
    const ctx = chart.ctx;
    const dataset = chart.data.datasets[0];
    const meta = chart.getDatasetMeta(0);
    if (!meta || !meta.data || meta.data.length < 2) return;

    const points = meta.data;
    const now = Date.now();
    const sweepDuration = 6000; // ← speed (ms per full sweep)
    const progress = ((now % sweepDuration) / sweepDuration);
    const sweepX = points[0].x + progress * (points[points.length - 1].x - points[0].x);

    const glowWidth = 45;  // horizontal width of glow
    const glowHeight = chart.height; // full height or set fixed height like 60
    const glowTop = (chart.height - glowHeight) / 2;

    ctx.save();
    ctx.beginPath();
    ctx.rect(sweepX - glowWidth / 2, glowTop, glowWidth, glowHeight);
    ctx.clip();

    ctx.beginPath();
    ctx.lineWidth = 4;

    // Create a horizontal gradient centered on sweepX
    const gradient = ctx.createLinearGradient(sweepX - glowWidth / 2, 0, sweepX + glowWidth / 2, 0);
    gradient.addColorStop(0, "rgba(33, 150, 243, 0)");   // fully transparent left edge
    gradient.addColorStop(0.5, "rgba(33, 150, 243, 0.8)"); // bright center
    gradient.addColorStop(1, "rgba(33, 150, 243, 0)");   // fully transparent right edge
    
    ctx.strokeStyle = gradient;
    ctx.shadowColor = "#2196f3";
    ctx.shadowBlur = 12;
    
    ctx.lineJoin = "round";

    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x, points[i].y);
    }

    ctx.stroke();
    ctx.restore();
  }
};

function getMarketTimeZoneAndFlag(ticker) {
  // You can expand this based on known stock exchanges
  const usStocks = ["AAPL", "MSFT", "GOOG", "TSLA"];
  const ukStocks = ["BARC.L", "HSBA.L"];
  const jpStocks = ["7203.T", "6758.T"]; // Tokyo: Toyota, Sony

  if (usStocks.includes(ticker.toUpperCase())) {
    return { timezone: "America/New_York", flag: "🇺🇸" };
  } else if (ukStocks.includes(ticker.toUpperCase())) {
    return { timezone: "Europe/London", flag: "🇬🇧" };
  } else if (jpStocks.includes(ticker.toUpperCase())) {
    return { timezone: "Asia/Tokyo", flag: "🇯🇵" };
  } else {
    return { timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, flag: "🏳️" }; // fallback
  }
}

async function fetchAndRender() {
  if (isFetching) return;
  isFetching = true;

  try {
    const quoteRes = await fetch(`/api/quote?ticker=${currentTicker}`);
    const quoteData = await quoteRes.json();
    const { code, previousClose, latestPrice } = quoteData;  
    const chartRes = await fetch(`/api/chart?ticker=${currentTicker}&range=${currentRange}`);
    let chartData = await chartRes.json();

    console.log("Raw chartData:", chartData);
    console.log("Selected range:", currentRange);
    const rangeLabelMap = {
      "1d": "Today",
      "1w": "Last 7 Days",
      "1m": "Last Month"
    };
    document.getElementById("chart-label").innerText = rangeLabelMap[currentRange] || "Price Chart";
    
    if (currentRange === "1w") {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      chartData = chartData.filter(d => new Date(d.date) >= sevenDaysAgo);
    } else if (currentRange === "1m") {
      const fourHourFiltered = chartData.filter((_, i) => i % 4 === 0);
      chartData = fourHourFiltered.slice(-120);
    }

    const close = chartData[chartData.length - 1]?.close ?? latestPrice;
    
    if (!chartData || chartData.length === 0) {
      console.warn("No chart data available.");
      throw new Error("Empty chart data");
    }    

    console.log("Filtered chartData:", chartData);
    const labels = chartData.map(d => {
      const date = new Date(d.date);
      if (currentRange === "1d") {
        return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      } else if (currentRange === "1w") {
        const day = date.toLocaleDateString([], { month: "short", day: "numeric" });
        const time = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        return `${day}, ${time}`;        
      } else {
        return date.toLocaleDateString([], { month: "short", day: "numeric" });
      }      
    });
    
    console.log("Chart labels:", labels);
    console.log("Chart values:", chartData.map(d => d.close));
    

    const companyNames = {
      AAPL: "Apple Inc.",
      AMZN: "Amazon.com, Inc.",
      TSLA: "Tesla, Inc."
    };
    document.getElementById("company-name-line").innerText = companyNames[currentTicker] ?? currentTicker;    
    document.getElementById("ticker-symbol").innerText = `(${code})`;
    document.getElementById("logo").src = `assets/logos/_${currentTicker}.png`;
    document.getElementById("price").innerText = close ? `$${close.toFixed(2)}` : "—";
    const first = chartData[0]?.close;
    const openPrice = chartData[0]?.close;
    const highPrice = Math.max(...chartData.map(d => d.close));
    const lowPrice = Math.min(...chartData.map(d => d.close));
    if (currentRange === "1d") {
      document.getElementById("open-price").innerText = `Open: $${openPrice?.toFixed(2) ?? "—"}`;
      document.getElementById("high-price").innerText = `High: $${highPrice?.toFixed(2) ?? "—"}`;
      document.getElementById("low-price").innerText = `Low: $${lowPrice?.toFixed(2) ?? "—"}`;
    }
     else {
      document.getElementById("open-price").innerText = "";
      document.getElementById("high-price").innerText = "";
      document.getElementById("low-price").innerText = "";
    }
    
    const change = close - first;
    const percent = (change / first) * 100;     
    const changeEl = document.getElementById("price-change");
    const triangle = change >= 0 ? "▲" : "▼";
    changeEl.innerText = `${triangle} ${change >= 0 ? "+" : ""}${change.toFixed(2)} (${percent.toFixed(2)}%)`;    
    changeEl.className = `change ${change >= 0 ? "up" : "down"}`;

    lastUpdateTime = new Date();
    updateLastUpdatedLabel();
    if (lastUpdatedTimer) clearInterval(lastUpdatedTimer);
    lastUpdatedTimer = setInterval(updateLastUpdatedLabel, 1000);

    const lastChartPoint = chartData[chartData.length - 1]?.close;
    const annotations = {
      currentPriceLine: {
        type: "line",
        mode: "horizontal",
        scaleID: "y",
        value: lastChartPoint, // ← synced to chart data
        borderColor: "#888",
        borderWidth: 1,
        borderDash: [6, 4]
      }
    };    

    if (currentRange === "1d") {
      const seenDays = new Set();
      chartData.forEach((point, i) => {
        const [dateOnly] = point.date.split(" ");
        if (!seenDays.has(dateOnly)) {
          seenDays.add(dateOnly);
          const noon = `${dateOnly} 12:00:00`;
          annotations[`dayline-${i}`] = {
            type: "line",
            mode: "vertical",
            scaleID: "x",
            value: noon,
            borderColor: "rgba(136, 136, 255, 0.15)",
            borderWidth: 1
          };
        }
      });
    }
 
    if (currentRange === "1d") {
      const marketOpenLabel = labels.find(label => label.startsWith("09:30"));
    
      if (marketOpenLabel) {
        annotations["marketOpenLine"] = {
          type: "line",
          mode: "vertical",
          scaleID: "x",
          value: marketOpenLabel,
          borderColor: "#aa00ff",  // Purple
          borderWidth: 2,
          borderDash: [4, 4], // Dashed line
          label: {
            content: "Open",
            enabled: true,
            position: "start",
            backgroundColor: "rgba(170, 0, 255, 0.1)",
            color: "#ffffff", // White text
            font: {
              weight: "bold"
            }
          }
        };
      }
    }    
    
    const isIntraday = currentRange === "1d";
    const isWeek = currentRange === "1w";
    const timeParser = (isIntraday || isWeek || currentRange === "1m") ? "yyyy-MM-dd HH:mm:ss" : "yyyy-MM-dd";
    const timeUnit = currentRange === "1m" ? "day" : isWeek ? "day" : isIntraday ? "hour" : "day";
    const timeDisplayFormats = {
      hour: isIntraday ? "HH:mm" : "MMM d, HH:mm",
      day: "MMM d"
    };

    const gridColor = "rgba(255,255,255,0.1)";
    const axisLineColor = "rgba(255,255,255,0.2)";

    if (chart) {
      chart.data.labels = labels;
      chart.data.datasets[0].data = chartData.map(d => d.close);
      chart.options.plugins.annotation.annotations = annotations;
      chart.update({ duration: 500, easing: 'easeOutCubic' });
    } else {
      chart = new Chart(ctx, {
        type: "line",
        data: {
          labels: labels,
          datasets: [{
            label: "Price",
            data: chartData.map(d => d.close),
            borderColor: "#2196f3",
            borderWidth: 2,
            pointRadius: 0,
            tension: 0.3,
            fill: false
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          layout: {
            padding: {
              top: 15,
              right: 15,
              bottom: 20,
              left: 15
            }
          },
          scales: {
            x: {
              type: "category",
              title: { display: false },
              ticks: {
                maxTicksLimit: 12,
                autoSkip: true,
                color: "#ffffff"
              },
              grid: {
                color: gridColor,
                lineWidth: 1
              },
              border: {
                color: axisLineColor
              }
            },
            y: {
              beginAtZero: false,
              title: {
                display: false,
                color: "#ffffff"
              },
              ticks: {
                color: "#ffffff"
              },
              grid: {
                color: gridColor,
                lineWidth: 1
              },
              border: {
                color: axisLineColor
              }
            }
          },
          plugins: {
            legend: { display: false },
            annotation: {
              annotations: annotations
            }
          }
        },
        plugins: [pulsePlugin, glowSweepPlugin]
      });
    }
  } catch (error) {
    console.error("Auto-refresh fetch error:", error);
  } finally {
    isFetching = false;
  }
}

function cycleTicker() {
  currentTickerIndex = (currentTickerIndex + 1) % tickers.length;
  currentTicker = tickers[currentTickerIndex];
  fetchAndRender();
  startAutoRefresh(); // reset refresh to avoid overlap
}

setInterval(cycleTicker, 30000);

function updateClock() {
  const now = new Date();

  // Your local time
  const localTime = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const localDate = now.toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' });

  document.getElementById("local-time").textContent = `🕒 ${localTime}`;
  document.getElementById("local-date").textContent = `${localDate} 🇬🇧`; // 🇬🇧 or whatever your local flag is

  // Market-specific time zone mapping
  const marketInfo = getMarketTimeZoneAndFlag(currentTicker);
  const marketNow = new Date().toLocaleString("en-US", { timeZone: marketInfo.timezone });
  const marketDateObj = new Date(marketNow);

  const marketTime = marketDateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const marketDate = marketDateObj.toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' });

  document.getElementById("market-time").textContent = `🏛️ ${marketTime}`;
  document.getElementById("market-date").textContent = `${marketDate} ${marketInfo.flag}`;
}


function updateLastUpdatedLabel() {
  if (!lastUpdateTime) return;
  const now = new Date();
  const secondsAgo = Math.floor((now - lastUpdateTime) / 1000);

  const label = secondsAgo < 1
    ? "just now"
    : secondsAgo === 1
    ? "1 second ago"
    : `${secondsAgo} seconds ago`;

  document.getElementById("last-updated").innerText = `Updated: ${label}`;
}

document.getElementById("refresh").addEventListener("click", fetchAndRender);

document.querySelectorAll("#time-filters button").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll("#time-filters button").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    currentRange = btn.dataset.range;
    fetchAndRender();
  });
});

function startAutoRefresh() {
  if (refreshInterval) clearInterval(refreshInterval);
  refreshInterval = setInterval(() => {
    fetchAndRender();
  }, 10000);
}

// ⏱ Auto refresh & clock
fetchAndRender();
startAutoRefresh();

updateClock();
setInterval(updateClock, 1000);

// 🔁 Continuous redraw for glow animation
function animateGlow() {
  if (chart) chart.draw();
  requestAnimationFrame(animateGlow);
}
requestAnimationFrame(animateGlow);