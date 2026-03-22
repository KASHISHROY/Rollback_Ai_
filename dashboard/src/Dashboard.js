import React, { useState, useEffect } from 'react';
import './Dashboard.css';
import Analytics from './Analytics';
import AIAnalyzer from './AIAnalyzer';

const Dashboard = () => {
  const [stats, setStats] = useState(null);
  const [logs, setLogs] = useState([]);
  const [config, setConfig] = useState(null);
  const [rollbackHistory, setRollbackHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const statsRes = await fetch('http://127.0.0.1:4000/api/stats');
        const statsData = await statsRes.json();
        setStats(statsData);

        const logsRes = await fetch('http://127.0.0.1:4000/api/logs');
        const logsData = await logsRes.json();
        setLogs(logsData.logs || []);

        const configRes = await fetch('http://127.0.0.1:4000/api/config');
        const configData = await configRes.json();
        setConfig(configData);

        const rollbackRes = await fetch('http://127.0.0.1:4000/api/rollback-history');
        const rollbackData = await rollbackRes.json();
        setRollbackHistory(rollbackData.history || []);

        setLoading(false);
      } catch (err) {
        console.error('Fetch error:', err);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 2000);
    return () => clearInterval(interval);
  }, []);

  const changeMode = async (mode) => {
    try {
      await fetch('http://127.0.0.1:4000/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode })
      });
      setConfig({ ...config, mode });
    } catch (err) {
      console.error('Mode change error:', err);
    }
  };

  const manualRollback = async () => {
    try {
      await fetch('http://127.0.0.1:4000/api/rollback', { method: 'POST' });
      alert('Manual rollback triggered');
    } catch (err) {
      console.error('Rollback error:', err);
    }
  };

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <div className="dashboard">
      {/* Header */}
      <div className="dashboard-header">
        <h1>🚀 Canary Deployment Dashboard</h1>
        <p>Real-time monitoring & auto-rollback system</p>
      </div>

      {/* Metrics Cards */}
      {stats && (
        <div className="metrics-section">
          <div className="metric-card">
            <div className="metric-label">Total Requests</div>
            <div className="metric-value">{stats.totalRequests}</div>
          </div>
          <div className="metric-card">
            <div className="metric-label">Total Errors</div>
            <div className="metric-value" style={{ color: '#dc2626' }}>
              {stats.totalErrors}
            </div>
          </div>
          <div className="metric-card">
            <div className="metric-label">Error Rate</div>
            <div className="metric-value" style={{ color: '#ea580c' }}>
              {stats.errorRatePercent}
            </div>
          </div>
          <div className="metric-card">
            <div className="metric-label">Uptime</div>
            <div className="metric-value">{stats.uptime}m</div>
          </div>
        </div>
      )}

      {/* Analytics & Charts Section */}
      {logs.length > 0 && <Analytics logs={logs} stats={stats} />}

      {/* AI Analyzer Section */}
      {logs.length > 0 && <AIAnalyzer logs={logs} stats={stats} />}

      {/* Traffic Control */}
      {config && (
        <div className="traffic-control-section">
          <h2>🔄 Traffic Mode Control</h2>
          <div className="mode-buttons">
            <button
              className={`mode-btn ${config.mode === 'stable' ? 'active' : ''}`}
              onClick={() => changeMode('stable')}
            >
              ✅ Stable (0% errors)
            </button>
            <button
              className={`mode-btn ${config.mode === 'test' ? 'active' : ''}`}
              onClick={() => changeMode('test')}
            >
              🧪 Test (40% errors)
            </button>
            <button
              className={`mode-btn ${config.mode === 'canary' ? 'active' : ''}`}
              onClick={() => changeMode('canary')}
            >
              🐤 Canary (10% test)
            </button>
          </div>
          <p className="mode-info">Current mode: <strong>{config.mode}</strong></p>
        </div>
      )}

      {/* Rollback Control */}
      <div className="rollback-control-section">
        <h2>🚨 Manual Rollback</h2>
        <button className="rollback-btn" onClick={manualRollback}>
          ⏮️ ROLLBACK TO STABLE
        </button>
        <p className="rollback-info">
          Auto-rollback triggers when error rate exceeds 20%
        </p>
      </div>

      {/* Rollback History */}
      {rollbackHistory.length > 0 && (
        <div className="rollback-history-section">
          <h2>📋 Rollback History</h2>
          <table className="history-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>From</th>
                <th>To</th>
                <th>Error Rate</th>
                <th>Reason</th>
              </tr>
            </thead>
            <tbody>
              {rollbackHistory.slice(-10).reverse().map((event, idx) => (
                <tr key={idx}>
                  <td>{new Date(event.timestamp).toLocaleTimeString()}</td>
                  <td>{event.previousMode}</td>
                  <td><strong>{event.newMode}</strong></td>
                  <td>{event.errorRate}%</td>
                  <td>Auto-rollback</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Recent Requests */}
      {logs.length > 0 && (
        <div className="recent-requests-section">
          <h2>📊 Recent Requests (Last 10)</h2>
          <table className="requests-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Method</th>
                <th>Path</th>
                <th>Status</th>
                <th>Backend</th>
                <th>Duration</th>
              </tr>
            </thead>
            <tbody>
              {logs.slice(-10).reverse().map((log, idx) => (
                <tr key={idx} className={log.statusCode >= 400 ? 'error-row' : ''}>
                  <td>{new Date(log.timestamp).toLocaleTimeString()}</td>
                  <td>{log.method}</td>
                  <td>{log.path}</td>
                  <td>
                    <span className={`status-badge status-${log.statusCode}`}>
                      {log.statusCode}
                    </span>
                  </td>
                  <td>{log.target?.includes('5001') ? 'Stable' : 'Test'}</td>
                  <td>{log.duration}ms</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Full Logs */}
      {logs.length > 0 && (
        <div className="full-logs-section">
          <h2>📝 Full Log Details (Today)</h2>
          <div className="logs-container">
            <table className="logs-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Method</th>
                  <th>Path</th>
                  <th>Status</th>
                  <th>Backend</th>
                  <th>Duration</th>
                  <th>IP</th>
                  <th>Response</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log, idx) => (
                  <tr key={idx} className={log.statusCode >= 400 ? 'error-row' : ''}>
                    <td>{new Date(log.timestamp).toLocaleTimeString()}</td>
                    <td>{log.method}</td>
                    <td>{log.path}</td>
                    <td>
                      <span className={`status-badge status-${log.statusCode}`}>
                        {log.statusCode}
                      </span>
                    </td>
                    <td>{log.target?.includes('5001') ? 'Stable' : 'Test'}</td>
                    <td>{log.duration}ms</td>
                    <td>{log.ip}</td>
                    <td className="response-cell">
                      {typeof log.responseBody === 'string'
                        ? log.responseBody.substring(0, 50)
                        : 'success'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;