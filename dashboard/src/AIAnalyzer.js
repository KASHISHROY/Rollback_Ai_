import React, { useState, useEffect, useRef } from 'react';
import './AIAnalyzer.css';

const AIAnalyzer = ({ logs, stats }) => {
  const [analysis,          setAnalysis]          = useState(null);
  const [loading,           setLoading]           = useState(false);
  const [error,             setError]             = useState(null);
  const [lastAnalyzedCount, setLastAnalyzedCount] = useState(0);
  const [lastAnalyzedTime,  setLastAnalyzedTime]  = useState(null);
  const timerRef = useRef(null);
  const runningRef = useRef(false);

  const analyzeLogs = async () => {
    if (runningRef.current) return;          // already running
    if (!logs || logs.length === 0) return;  // no logs yet

    runningRef.current = true;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('http://127.0.0.1:4000/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      const data = await res.json();
      setAnalysis(data.result);
      setLastAnalyzedCount(logs.length);
      setLastAnalyzedTime(new Date().toLocaleTimeString());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      runningRef.current = false;
    }
  };

  // Trigger on first load when logs arrive
  useEffect(() => {
    if (logs && logs.length > 0 && !analysis && !runningRef.current) {
      analyzeLogs();
    }
  }, [logs?.length > 0]);

  // Re-analyze every 30 seconds
  useEffect(() => {
    timerRef.current = setInterval(() => {
      if (logs && logs.length > 0 && !runningRef.current) {
        analyzeLogs();
      }
    }, 30000);
    return () => clearInterval(timerRef.current);
  }, [logs]);

  // Re-analyze when 10+ new logs arrive
  useEffect(() => {
    if (logs && logs.length - lastAnalyzedCount >= 10 && !runningRef.current) {
      analyzeLogs();
    }
  }, [logs?.length]);

  // ── Parse ──────────────────────────────────────────────────────────────
  const parseAnalysis = (text) => {
    if (!text) return null;
    const errors = [];
    for (let i = 1; i <= 3; i++) {
      const obj = {};
      ['CODE','BACKEND','FREQUENCY','PERCENTAGE','SEVERITY','CAUSE','FIX'].forEach(key => {
        const m = text.match(new RegExp(`ERROR_${i}_${key}:\\s*(.+?)(?=ERROR_|OVERALL_|$)`, 's'));
        obj[key.toLowerCase()] = m ? m[1].trim() : null;
      });
      if (obj.code && obj.code !== 'null' && obj.code !== '') errors.push(obj);
    }
    const overall   = text.match(/OVERALL_HEALTH:\s*(.+?)(?=RECOMMENDATION:|$)/s);
    const recommend = text.match(/RECOMMENDATION:\s*(.+?)(?=RISK_LEVEL:|$)/s);
    const risk      = text.match(/RISK_LEVEL:\s*(.+?)$/m);
    return {
      errors,
      overallHealth:  overall   ? overall[1].trim()   : 'Unknown',
      recommendation: recommend ? recommend[1].trim()  : '',
      riskLevel:      risk      ? risk[1].trim()       : 'Unknown',
    };
  };

  const sevColor = (sev) => {
    const s = (sev || '').toUpperCase();
    if (s === 'CRITICAL') return '#ff3355';
    if (s === 'HIGH')     return '#f59e0b';
    if (s === 'MEDIUM')   return '#22d3ee';
    return '#00ff88';
  };

  const analyzed = parseAnalysis(analysis);

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <section className="ai-analyzer-section">

      {/* Header */}
      <div className="ai-header">
        <h2>// Live AI Diagnostics</h2>

        <div className="ai-status-row">
          {loading && (
            <span className="ai-status-pill ai-pill-analyzing">
              <span className="ai-blink-dot" /> ANALYZING...
            </span>
          )}
          {!loading && analyzed && (
            <span className="ai-status-pill ai-pill-live">
              <span className="ai-blink-dot ai-dot-green" /> LIVE · {lastAnalyzedTime}
            </span>
          )}
          {!loading && !analyzed && (
            <span className="ai-status-pill ai-pill-wait">
              ◈ AWAITING LOGS
            </span>
          )}
          <span className="section-tag">GROQ AI</span>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="error-message">⚠ {error}</div>
      )}

      {/* Skeleton while first load */}
      {loading && !analyzed && (
        <div className="ai-skeleton">
          <div className="ai-skel-card" />
          <div className="ai-skel-card" />
          <div className="ai-skel-card" />
        </div>
      )}

      {/* Results */}
      {analyzed && analyzed.errors.length > 0 && (
        <div className="analysis-result">

          <div className="top-3-errors">
            {analyzed.errors.map((err, idx) => (
              <div
                key={idx}
                className="error-card"
                style={{ borderLeftColor: sevColor(err.severity) }}
              >
                <div className="error-header">
                  <div className="error-number">0{idx + 1}</div>
                  <div className="error-code-section">
                    <h3>ERROR {err.code}</h3>
                    <span className="error-backend">{err.backend}</span>
                  </div>
                  <div className="error-severity" style={{ color: sevColor(err.severity) }}>
                    {err.severity?.toUpperCase() || 'UNKNOWN'}
                  </div>
                </div>

                <div className="error-metrics">
                  <div className="metric">
                    <strong>Frequency</strong>
                    {err.frequency || '—'}
                  </div>
                  <div className="metric">
                    <strong>Impact</strong>
                    {err.percentage || '—'}
                  </div>
                </div>

                <div className="error-explanation">
                  <strong>What's Wrong</strong>
                  <p>{err.cause || 'Unknown error'}</p>
                </div>

                <div className="error-fix">
                  <strong>→ How to Fix</strong>
                  <p>{err.fix || 'Review error logs'}</p>
                </div>
              </div>
            ))}
          </div>

          {analyzed.recommendation && (
            <div className="ai-assessment">
              <h3>// Overall Assessment</h3>

              <div className="assessment-item">
                <strong>System Health</strong>
                <span className={`health-status ${analyzed.overallHealth.toLowerCase()}`}>
                  {analyzed.overallHealth}
                </span>
              </div>

              <div className="assessment-item">
                <strong>Recommendation</strong>
                <p>{analyzed.recommendation}</p>
              </div>

              <div className="assessment-item">
                <strong>Risk Level</strong>
                <span className={`risk-level ${analyzed.riskLevel.toLowerCase()}`}>
                  {analyzed.riskLevel}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Placeholder before any logs */}
      {!analysis && !loading && (
        <div className="analysis-placeholder">
          ◈ &nbsp; AI analysis starts automatically when logs arrive
        </div>
      )}
    </section>
  );
};

export default AIAnalyzer;