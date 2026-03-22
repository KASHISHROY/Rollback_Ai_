import React, { useState } from 'react';
import './AIAnalyzer.css';

const AIAnalyzer = ({ logs, stats }) => {
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const analyzeLogs = async () => {
    setLoading(true);
    setError(null);
    setAnalysis(null);

    try {
      const response = await fetch('http://127.0.0.1:4000/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }

      const data = await response.json();
      setAnalysis(data.result);
    } catch (err) {
      setError('Error: ' + err.message);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const parseAnalysis = (text) => {
    if (!text) return null;

    const errors = [];
    
    // Parse all 3 errors
    for (let i = 1; i <= 3; i++) {
      const errorObj = {};
      const keys = ['CODE', 'BACKEND', 'FREQUENCY', 'PERCENTAGE', 'SEVERITY', 'CAUSE', 'FIX'];

      keys.forEach(key => {
        const pattern = new RegExp(`ERROR_${i}_${key}:\\s*(.+?)(?=ERROR_|OVERALL_|$)`, 's');
        const match = text.match(pattern);
        errorObj[key.toLowerCase()] = match ? match[1].trim() : null;
      });

      // Only add if has a code
      if (errorObj.code && errorObj.code !== 'null' && errorObj.code !== '') {
        errors.push(errorObj);
      }
    }

    // Parse overall info
    const overallPattern = /OVERALL_HEALTH:\s*(.+?)(?=RECOMMENDATION:|$)/s;
    const overallMatch = text.match(overallPattern);
    const overallHealth = overallMatch ? overallMatch[1].trim() : 'Unknown';

    const recommendationPattern = /RECOMMENDATION:\s*(.+?)(?=RISK_LEVEL:|$)/s;
    const recommendationMatch = text.match(recommendationPattern);
    const recommendation = recommendationMatch ? recommendationMatch[1].trim() : '';

    const riskPattern = /RISK_LEVEL:\s*(.+?)$/m;
    const riskMatch = text.match(riskPattern);
    const riskLevel = riskMatch ? riskMatch[1].trim() : 'Unknown';

    return { errors, overallHealth, recommendation, riskLevel };
  };

  const getSeverityColor = (severity) => {
    if (!severity) return '#gray';
    const sev = severity.toUpperCase();
    if (sev === 'CRITICAL') return '#dc2626';
    if (sev === 'HIGH') return '#ea580c';
    if (sev === 'MEDIUM') return '#f59e0b';
    return '#10b981';
  };

  const getSeverityEmoji = (severity) => {
    if (!severity) return '⚪';
    const sev = severity.toUpperCase();
    if (sev === 'CRITICAL') return '🔴';
    if (sev === 'HIGH') return '🟠';
    if (sev === 'MEDIUM') return '🟡';
    return '🟢';
  };

  const analyzed = parseAnalysis(analysis);

  return (
    <section className="ai-analyzer-section">
      <div className="ai-header">
        <h2>🤖 AI Error Analyzer</h2>
      </div>

      <button 
        className="analyze-btn" 
        onClick={analyzeLogs}
        disabled={loading}
      >
        {loading ? 'Analyzing errors...' : 'Analyze Errors with AI'}
      </button>

      {error && <div className="error-message">{error}</div>}

      {analyzed && analyzed.errors.length > 0 && (
        <div className="analysis-result">
          
          {/* Top 3 Errors */}
          <div className="top-3-errors">
            {analyzed.errors.map((err, idx) => (
              <div 
                key={idx} 
                className="error-card"
                style={{ borderLeftColor: getSeverityColor(err.severity) }}
              >
                {/* Error Number and Code */}
                <div className="error-header">
                  <div className="error-number">{idx + 1}</div>
                  <div className="error-code-section">
                    <h3>ERROR {err.code}</h3>
                    <span className="error-backend">{err.backend}</span>
                  </div>
                  <div className="error-severity">
                    {getSeverityEmoji(err.severity)}
                    <span>{err.severity}</span>
                  </div>
                </div>

                {/* Frequency and Impact */}
                <div className="error-metrics">
                  <div className="metric">
                    <strong>Frequency:</strong> {err.frequency}
                  </div>
                  <div className="metric">
                    <strong>Impact:</strong> {err.percentage}
                  </div>
                </div>

                {/* Explanation (1 line) */}
                <div className="error-explanation">
                  <strong>What's Wrong:</strong>
                  <p>{err.cause || 'Unknown error'}</p>
                </div>

                {/* Fix Recommendation (1 line) */}
                <div className="error-fix">
                  <strong>→ How to Fix:</strong>
                  <p>{err.fix || 'Review error logs'}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Overall Assessment */}
          {analyzed.recommendation && (
            <div className="ai-assessment">
              <h3>Overall Assessment</h3>
              
              <div className="assessment-item">
                <strong>System Health:</strong>
                <span className={`health-status ${analyzed.overallHealth.toLowerCase()}`}>
                  {analyzed.overallHealth}
                </span>
              </div>

              <div className="assessment-item">
                <strong>Recommendation:</strong>
                <p>{analyzed.recommendation}</p>
              </div>

              <div className="assessment-item">
                <strong>Risk Level:</strong>
                <span className={`risk-level ${analyzed.riskLevel.toLowerCase()}`}>
                  {analyzed.riskLevel}
                </span>
              </div>
            </div>
          )}

        </div>
      )}

      {!analysis && !loading && (
        <div className="analysis-placeholder">
          Click button to analyze errors with AI
        </div>
      )}
    </section>
  );
};

export default AIAnalyzer;