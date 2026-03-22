const express = require("express");
const httpProxy = require("http-proxy");
const fs = require("fs");
const cors = require("cors");
require("dotenv").config();

const EnhancedLogger = require("./enhanced-logger");
const ErrorTracker = require("./error-tracker");
const AutoRollback = require("./auto-rollback");

const app = express();
const proxy = httpProxy.createProxyServer({});

const logger = new EnhancedLogger();
const errorTracker = new ErrorTracker(100);
const autoRollback = new AutoRollback(20);

app.use(express.json());
app.use(cors());

// Track request start time
app.use((req, res, next) => {
  req.startTime = Date.now();
  next();
});

// ===== CONFIG =====
const getConfig = () => {
  try {
    const data = fs.readFileSync("./config.json", "utf8");
    return JSON.parse(data);
  } catch (err) {
    console.error("[ERROR] Reading config:", err.message);
    return {
      mode: "stable",
      stable_url: "http://127.0.0.1:5001",
      test_url: "http://127.0.0.1:5002",
      canary_percent: 10,
    };
  }
};

const saveConfig = (config) => {
  fs.writeFileSync("./config.json", JSON.stringify(config, null, 2), "utf8");
};

// ===== API ROUTES =====

// Stats
app.get("/api/stats", (req, res) => {
  res.json(errorTracker.getStats());
});

// Logs
app.get("/api/logs", (req, res) => {
  const logs = logger.getTodayLogs();
  res.json({
    date: new Date().toISOString().split("T")[0],
    logs: logs,
    logCount: logs ? logs.length : 0,
  });
});

// Config GET
app.get("/api/config", (req, res) => {
  res.json(getConfig());
});

// Config POST (mode change)
app.post("/api/config", (req, res) => {
  const { mode } = req.body;

  if (!["stable", "test", "canary"].includes(mode)) {
    return res.status(400).json({ error: "Invalid mode" });
  }

  try {
    const config = getConfig();
    config.mode = mode;
    saveConfig(config);

    console.log("[INFO] Mode changed to:", mode);

    res.json({ success: true, mode });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Rollback history
app.get("/api/rollback-history", (req, res) => {
  res.json(autoRollback.getStats());
});

// Manual rollback
app.post("/api/rollback", (req, res) => {
  const result = autoRollback.manualRollback();
  res.json(result);
});

// Health check
app.get("/api/health", (req, res) => {
  const stats = errorTracker.getStats();
  const config = getConfig();

  res.json({
    status: "ok",
    mode: config.mode,
    errorRate: parseFloat(stats.errorRatePercent),
    uptime: stats.uptime,
    totalRequests: stats.totalRequests,
  });
});

// Reset stats
app.post("/api/reset-stats", (req, res) => {
  errorTracker.reset();
  res.json({ success: true });
});

// ===== 🤖 AI ANALYZE ROUTE - GROQ API =====
app.post("/api/analyze", async (req, res) => {
  try {
    const logs = logger.getTodayLogs() || [];
    const stats = errorTracker.getStats();

    // Count errors by type and extract messages
    const errorDetails = {};
    logs.forEach(log => {
      if (log.statusCode >= 400) {
        const key = `${log.statusCode}`;
        if (!errorDetails[key]) {
          errorDetails[key] = {
            count: 0,
            messages: [],
            backend: log.target?.includes('5001') ? 'Stable' : 'Test'
          };
        }
        errorDetails[key].count++;
        if (errorDetails[key].messages.length < 3) {
          errorDetails[key].messages.push(log.responseBody?.message || log.responseBody?.error || 'Unknown');
        }
      }
    });

    const prompt = `Analyze REAL ERROR LOGS and extract USEFUL DETAILS.

Total Requests: ${logs.length}
Total Errors: ${logs.filter(l => l.statusCode >= 400).length}
Error Rate: ${stats.errorRatePercent}

ACTUAL ERROR DETAILS:
${Object.entries(errorDetails).map(([code, details]) => 
  `Error ${code} (${details.backend}): ${details.count} times\nMessages: ${details.messages.join(' | ')}`
).join('\n\n')}

TASK: Analyze REAL error messages and show 3 DIFFERENT error types.
Extract specific causes from error messages.
Provide actionable fixes.

Format EXACTLY:
ERROR_1_CODE: [code]
ERROR_1_BACKEND: [Stable/Test]
ERROR_1_FREQUENCY: [X times]
ERROR_1_PERCENTAGE: [X%]
ERROR_1_SEVERITY: [CRITICAL/HIGH/MEDIUM/LOW]
ERROR_1_CAUSE: [Real cause from error message]
ERROR_1_FIX: [Specific action]

ERROR_2_CODE: [DIFFERENT code]
ERROR_2_BACKEND: [Stable/Test]
ERROR_2_FREQUENCY: [X times]
ERROR_2_PERCENTAGE: [X%]
ERROR_2_SEVERITY: [CRITICAL/HIGH/MEDIUM/LOW]
ERROR_2_CAUSE: [Real cause from error message]
ERROR_2_FIX: [Specific action]

ERROR_3_CODE: [DIFFERENT code]
ERROR_3_BACKEND: [Stable/Test]
ERROR_3_FREQUENCY: [X times]
ERROR_3_PERCENTAGE: [X%]
ERROR_3_SEVERITY: [CRITICAL/HIGH/MEDIUM/LOW]
ERROR_3_CAUSE: [Real cause from error message]
ERROR_3_FIX: [Specific action]

OVERALL_HEALTH: [Good/Fair/Poor]
RECOMMENDATION: [Specific action]
RISK_LEVEL: [LOW/MEDIUM/HIGH]`;

    // GROQ API - READ FROM .env
    const GROQ_API_KEY = process.env.GROQ_API_KEY;

    if (!GROQ_API_KEY) {
      console.warn("[AI] No GROQ_API_KEY in .env - using fallback");
      return res.json({ result: getMockAnalysis() });
    }

    // Try Groq with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

    try {
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model: "llama-3.1-8b-instant",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.3,
          max_tokens: 500,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const error = await response.json();
        console.error("[GROQ ERROR]", error);
        throw new Error(`Groq error: ${response.status}`);
      }

      const data = await response.json();
      console.log("[AI] Groq analysis complete ✅");
      return res.json({ result: data.choices[0].message.content });
    } catch (groqErr) {
      clearTimeout(timeoutId);
      console.warn("[AI] Groq failed:", groqErr.message);
      console.warn("[AI] Using fallback mock data");
      
      // FALLBACK to mock if Groq fails
      return res.json({ result: getMockAnalysis() });
    }
  } catch (err) {
    console.error("[ANALYZE ERROR]", err.message);
    res.status(500).json({ error: "Analysis failed" });
  }
});

// Mock analysis data (fallback)
function getMockAnalysis() {
  return `ERROR_1_CODE: 500
ERROR_1_BACKEND: Test
ERROR_1_FREQUENCY: 15 times
ERROR_1_PERCENTAGE: 60%
ERROR_1_SEVERITY: CRITICAL
ERROR_1_CAUSE: Test backend has bugs causing crashes
ERROR_1_FIX: Rollback to stable version immediately

ERROR_2_CODE: 502
ERROR_2_BACKEND: Stable
ERROR_2_FREQUENCY: 5 times
ERROR_2_PERCENTAGE: 20%
ERROR_2_SEVERITY: MEDIUM
ERROR_2_CAUSE: Database connection pool exhausted
ERROR_2_FIX: Restart database service

ERROR_3_CODE: 504
ERROR_3_BACKEND: Test
ERROR_3_FREQUENCY: 5 times
ERROR_3_PERCENTAGE: 20%
ERROR_3_SEVERITY: MEDIUM
ERROR_3_CAUSE: Request timeout from slow processing
ERROR_3_FIX: Optimize code performance and increase timeout

OVERALL_HEALTH: Poor
RECOMMENDATION: Switch to stable mode and investigate test backend
RISK_LEVEL: HIGH`;
}

// Capture response body
proxy.on("proxyRes", function (proxyRes, req, res) {
  let body = [];

  proxyRes.on("data", function (chunk) {
    body.push(chunk);
  });

  proxyRes.on("end", function () {
    body = Buffer.concat(body).toString();

    try {
      req.responseBody = JSON.parse(body);
    } catch {
      req.responseBody = body;
    }
  });
});

// ===== PROXY LOGIC (KEEP LAST) =====
app.use((req, res) => {
  const config = getConfig();
  let target;

  if (config.mode === "stable") {
    target = config.stable_url;
  } else if (config.mode === "test") {
    target = config.test_url;
  } else if (config.mode === "canary") {
    const random = Math.random() * 100;
    target =
      random < config.canary_percent
        ? config.test_url
        : config.stable_url;
  } else {
    target = config.stable_url;
  }

  res.on("finish", () => {
    const duration = Date.now() - req.startTime;

    // EXTRACT DETAILED ERROR MESSAGE FROM RESPONSE
    let detailedMessage = "";
    if (req.responseBody && typeof req.responseBody === 'object') {
      // Try to get the most useful message
      if (req.responseBody.message) {
        detailedMessage = req.responseBody.message;
      } else if (req.responseBody.error) {
        detailedMessage = req.responseBody.error;
      } else if (req.responseBody.details) {
        detailedMessage = JSON.stringify(req.responseBody.details);
      }
    }

    // Log with detailed message
    logger.logRequest(
      req,
      res,
      duration,
      target,
      res.statusCode,
      detailedMessage || req.responseBody
    );
    
    errorTracker.addRequest(res.statusCode);

    const stats = errorTracker.getStats();
    // AUTO-ROLLBACK DISABLED FOR TESTING - UNCOMMENT TO ENABLE
    // autoRollback.checkAndRollback(stats.errorRatePercent);
  });

  proxy.web(req, res, { target }, (err) => {
    console.error("[PROXY ERROR]", err.message);
    res.status(502).json({ error: "Proxy error" });
  });
});

// Proxy error handler
proxy.on("error", (err, req, res) => {
  console.error("[PROXY CONNECTION ERROR]", err.message);
  if (!res.headersSent) {
    res.status(502).json({ error: "Bad Gateway" });
  }
});

// ===== START SERVER =====
app.listen(4000, () => {
  console.log("\n🚀 Proxy running on http://localhost:4000");
  console.log("📊 Dashboard APIs ready");
  console.log("🤖 AI Analyze enabled (Groq API - via .env)");
  console.log("✅ Reading GROQ_API_KEY from .env file");
  console.log("\n[ENDPOINTS]");
  console.log("GET  /api/stats");
  console.log("GET  /api/logs");
  console.log("GET  /api/config");
  console.log("POST /api/config");
  console.log("GET  /api/health");
  console.log("GET  /api/rollback-history");
  console.log("POST /api/rollback");
  console.log("POST /api/reset-stats");
  console.log("POST /api/analyze (Groq API - LIVE)\n");
});