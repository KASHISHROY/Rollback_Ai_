const express = require("express");
const httpProxy = require("http-proxy");
const fs = require("fs");
const cors = require("cors");
require("dotenv").config();

const EnhancedLogger = require("./enhanced-logger");
const ErrorTracker = require("./error-tracker");
const AutoRollback = require("./auto-rollback");

const { ingestLogs } = require("./rag/ingest");
const { retrieveRelevantLogs } = require("./rag/retriever");

const app = express();
const proxy = httpProxy.createProxyServer({});

const logger = new EnhancedLogger();
const errorTracker = new ErrorTracker(100);
const autoRollback = new AutoRollback(20);

app.use(express.json());
app.use(cors());

app.use((req, res, next) => {
  req.startTime = Date.now();
  next();
});

// ===== CONFIG =====
const getConfig = () => {
  try {
    return JSON.parse(fs.readFileSync("./config.json", "utf8"));
  } catch {
    return {
      mode: "stable",
      stable_url: "http://127.0.0.1:5001",
      test_url: "http://127.0.0.1:5002",
      canary_percent: 10,
    };
  }
};

const saveConfig = (config) => {
  fs.writeFileSync("./config.json", JSON.stringify(config, null, 2));
};

// ===== ROUTES =====
app.get("/api/stats", (req, res) => {
  res.json(errorTracker.getStats());
});

app.get("/api/logs", (req, res) => {
  const logs = logger.getTodayLogs();
  res.json({ logs, count: logs?.length || 0 });
});

app.get("/api/config", (req, res) => {
  res.json(getConfig());
});

app.get("/api/rollback-history", (req, res) => {
  res.json({ history: autoRollback.getRollbackHistory() });
});

app.post("/api/config", (req, res) => {
  const { mode } = req.body;
  if (!["stable", "test", "canary"].includes(mode)) {
    return res.status(400).json({ error: "Invalid mode" });
  }

  const config = getConfig();
  config.mode = mode;
  saveConfig(config);

  res.json({ success: true });
});

app.post("/api/analyze-logs", async (req, res) => {
  try {
    const { logs } = req.body;

    if (!logs || logs.length === 0) {
      return res.status(400).json({ error: "No logs provided" });
    }

    // Build error summary for the prompt
    const errorLogs = logs.filter(l => l.statusCode >= 400);
    const errorCounts = {};
    errorLogs.forEach(l => {
      errorCounts[l.statusCode] = (errorCounts[l.statusCode] || 0) + 1;
    });
    const errorRate = logs.length > 0
      ? ((errorLogs.length / logs.length) * 100).toFixed(1)
      : 0;

    const prompt = `You are a senior SRE assistant analyzing HTTP logs.
Respond ONLY in this exact format — no extra text, no explanations.

TOTAL_REQUESTS: ${logs.length}
TOTAL_ERRORS: ${errorLogs.length}
ERROR_RATE: ${errorRate}%

LOG SAMPLE (last 30 errors):
${logs
  .filter(l => l.statusCode >= 400)
  .slice(-30)
  .map(l =>
    `Status:${l.statusCode} Path:${l.path} Backend:${
      l.target?.includes("5001") ? "stable" : "canary"
    } Msg:${
      typeof l.responseBody === "string"
        ? l.responseBody.substring(0, 80)
        : JSON.stringify(l.responseBody).substring(0, 80)
    }`
  )
  .join("\n")}

Return EXACTLY this structure (fill every field):
ERROR_1_CODE: <HTTP status code>
ERROR_1_BACKEND: <stable or canary>
ERROR_1_FREQUENCY: <N occurrences>
ERROR_1_PERCENTAGE: <X% of all requests>
ERROR_1_SEVERITY: <CRITICAL or HIGH or MEDIUM or LOW>
ERROR_1_CAUSE: <1 sentence root cause>
ERROR_1_FIX: <1 sentence fix>
ERROR_2_CODE: <HTTP status code>
ERROR_2_BACKEND: <stable or canary>
ERROR_2_FREQUENCY: <N occurrences>
ERROR_2_PERCENTAGE: <X% of all requests>
ERROR_2_SEVERITY: <CRITICAL or HIGH or MEDIUM or LOW>
ERROR_2_CAUSE: <1 sentence root cause>
ERROR_2_FIX: <1 sentence fix>
ERROR_3_CODE: <HTTP status code>
ERROR_3_BACKEND: <stable or canary>
ERROR_3_FREQUENCY: <N occurrences>
ERROR_3_PERCENTAGE: <X% of all requests>
ERROR_3_SEVERITY: <CRITICAL or HIGH or MEDIUM or LOW>
ERROR_3_CAUSE: <1 sentence root cause>
ERROR_3_FIX: <1 sentence fix>
OVERALL_HEALTH: <good or fair or poor or critical>
RECOMMENDATION: <1 sentence action to take>
RISK_LEVEL: <low or medium or high or critical>`;

    const response = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model: "llama-3.1-8b-instant",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.2,
        }),
      }
    );

    const data = await response.json();

    if (!data.choices?.length) {
      return res.status(500).json({ error: "Groq failed" });
    }

    res.json({ result: data.choices[0].message.content });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Analysis failed" });
  }
});


// ✅ DEBUG: force ingest all logs
app.post("/api/debug/ingest", async (req, res) => {
  const logs = logger.getTodayLogs();

  const normalized = (logs || []).map((l) => ({
    statusCode: l.statusCode || l.status || 200,
    path: l.path || l.url || "unknown",
    responseBody: l.responseBody || l.body || null,
  }));

  await ingestLogs(normalized);
  res.json({ success: true, ingested: normalized.length });
});

// ===== 🤖 AI ANALYZE =====
app.post("/api/analyze", async (req, res) => {
  try {
    const stats = errorTracker.getStats();
    const errorRate = parseFloat(
      stats.errorRatePercent || stats.errorRate || 0
    );

    let relevantLogs = [];

    try {
      relevantLogs = await retrieveRelevantLogs(
        "errors failures crashes 500 502 503 504 timeout"
      );
      console.log("🔍 Retrieved logs:", relevantLogs.length);
    } catch (err) {
      console.error("[RAG ERROR]", err.message);
    }

    // ✅ FALLBACK if Pinecone empty
    if (!relevantLogs || relevantLogs.length === 0) {
      console.warn("⚠️ Using fallback logs");
      relevantLogs = (logger.getTodayLogs() || []).slice(-5);
    }

    if (!relevantLogs.length) {
      return res.json({ result: "No logs available" });
    }

    const prompt = `
Analyze backend logs:

${relevantLogs
  .map(
    (l) =>
      `Status:${l.statusCode} Path:${l.path} Msg:${
        l.responseBody?.message || l.responseBody || "Unknown"
      }`
  )
  .join("\n")}

Error Rate: ${errorRate}%

Give STRICT output:

ERROR_1_CODE:
ERROR_1_BACKEND:
ERROR_1_FREQUENCY:
ERROR_1_PERCENTAGE:
ERROR_1_SEVERITY:
ERROR_1_CAUSE:
ERROR_1_FIX:

ERROR_2_CODE:
ERROR_2_BACKEND:
ERROR_2_FREQUENCY:
ERROR_2_PERCENTAGE:
ERROR_2_SEVERITY:
ERROR_2_CAUSE:
ERROR_2_FIX:

ERROR_3_CODE:
ERROR_3_BACKEND:
ERROR_3_FREQUENCY:
ERROR_3_PERCENTAGE:
ERROR_3_SEVERITY:
ERROR_3_CAUSE:
ERROR_3_FIX:

OVERALL_HEALTH:
RECOMMENDATION:
RISK_LEVEL:
`;

    const response = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model: "llama-3.1-8b-instant",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.3,
        }),
      }
    );

    const data = await response.json();

    if (!data.choices) {
      console.error("❌ GROQ ERROR:", data);
      return res.json({ result: "AI failed" });
    }

    res.json({
      result: data.choices[0].message.content,
    });
  } catch (err) {
    console.error("[ANALYZE ERROR]", err.message);
    res.status(500).json({ error: "Analysis failed" });
  }
});

// ===== PROXY RESPONSE CAPTURE =====
proxy.on("proxyRes", (proxyRes, req) => {
  let body = [];

  proxyRes.on("data", (chunk) => body.push(chunk));

  proxyRes.on("end", () => {
    body = Buffer.concat(body).toString();
    try {
      req.responseBody = JSON.parse(body);
    } catch {
      req.responseBody = body;
    }
  });
});

// ===== PROXY =====
app.use((req, res) => {
  const config = getConfig();

  let target =
    config.mode === "test"
      ? config.test_url
      : config.mode === "canary"
      ? Math.random() * 100 < config.canary_percent
        ? config.test_url
        : config.stable_url
      : config.stable_url;

  proxy.web(req, res, { target });

  res.on("finish", () => {
    const duration = Date.now() - req.startTime;

    logger.logRequest(
      req,
      res,
      duration,
      target,
      res.statusCode,
      req.responseBody
    );

    errorTracker.addRequest(res.statusCode);

    const stats = errorTracker.getStats();
    const errorRate = parseFloat(
      stats.errorRatePercent || stats.errorRate || 0
    );

    console.log("📊 Error Rate:", errorRate);

    // ✅ SAFE INGEST (non-blocking)
    if (res.statusCode >= 400) {
      const logEntry = {
        statusCode: res.statusCode,
        path: req.path || "unknown",
        responseBody: req.responseBody || null,
      };

      Promise.resolve()
        .then(() => ingestLogs([logEntry]))
        .catch((e) => console.error("[INGEST ERROR]", e.message));
    }

    // ✅ AUTO ROLLBACK
    if (stats.totalRequests > 20 && errorRate > 20) {
      console.log("⚠️ Rolling back...");
      autoRollback.checkAndRollback(errorRate);
    }
  });
});

// ===== ERROR =====
proxy.on("error", (err, req, res) => {
  console.error("[PROXY ERROR]", err.message);
  if (!res.headersSent) {
    res.status(502).json({ error: "Bad Gateway" });
  }
});

// ===== START =====
app.listen(4000, () => {
  console.log("🚀 Server running on http://localhost:4000");
  console.log("✅ RAG + Pinecone + Groq READY");
});