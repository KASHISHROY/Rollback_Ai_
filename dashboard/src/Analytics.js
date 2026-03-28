import React, { useState, useEffect } from 'react';
import {
  PieChart, Pie, Cell,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  AreaChart, Area, ResponsiveContainer
} from 'recharts';
import './Analytics.css';

const Analytics = ({ logs }) => {
  const [errorDistribution, setErrorDistribution] = useState([]);
  const [timeline, setTimeline] = useState([]);
  const [comparison, setComparison] = useState([]);
  const [severity, setSeverity] = useState([]);

  useEffect(() => {
    if (!logs || logs.length === 0) return;

    // 1. Error Distribution
    const errorCounts = {};
    logs.forEach(log => {
      if (log.statusCode >= 400) {
        errorCounts[log.statusCode] = (errorCounts[log.statusCode] || 0) + 1;
      }
    });

    setErrorDistribution(
      Object.entries(errorCounts)
        .map(([code, count]) => ({ name: `${code}`, value: count }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 5)
    );

    // 2. Timeline
    const now = new Date();
    const timelineData = [];

    for (let i = 9; i >= 0; i--) {
      const time = new Date(now.getTime() - i * 60000);

      const bucket = logs.filter(l => {
        const t = new Date(l.timestamp).getTime();
        return t > time.getTime() - 60000 && t <= time.getTime();
      });

      const errors = bucket.filter(l => l.statusCode >= 400).length;

      timelineData.push({
        time: time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        errorRate: bucket.length ? Math.round((errors / bucket.length) * 100) : 0,
        requests: bucket.length,
      });
    }

    setTimeline(timelineData);

    // 3. Stable vs Canary
    const stableErr = logs.filter(l => l.statusCode >= 400 && l.target?.includes('5001')).length;
    const stableTotal = logs.filter(l => l.target?.includes('5001')).length;

    const canaryErr = logs.filter(l => l.statusCode >= 400 && l.target?.includes('5002')).length;
    const canaryTotal = logs.filter(l => l.target?.includes('5002')).length;

    setComparison([
      {
        name: 'Stable',
        errorRate: stableTotal ? Math.round((stableErr / stableTotal) * 100) : 0,
        requests: stableTotal
      },
      {
        name: 'Canary',
        errorRate: canaryTotal ? Math.round((canaryErr / canaryTotal) * 100) : 0,
        requests: canaryTotal
      }
    ]);

    // 4. Severity
    const sv = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };

    logs.forEach(l => {
      if (l.statusCode >= 500) sv.CRITICAL++;
      else if ([429, 408].includes(l.statusCode)) sv.HIGH++;
      else if (l.statusCode >= 400) sv.MEDIUM++;
      else sv.LOW++;
    });

    setSeverity([
      { name: 'Critical', value: sv.CRITICAL, color: '#ff4444' },
      { name: 'High', value: sv.HIGH, color: '#f59e0b' },
      { name: 'Medium', value: sv.MEDIUM, color: '#22d3ee' },
      { name: 'Low', value: sv.LOW, color: '#00ff88' },
    ].filter(i => i.value > 0));

  }, [logs]);

  const COLORS = ['#ff4444', '#f59e0b', '#22d3ee', '#a78bfa', '#00ff88'];

  const TooltipBox = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;

    return (
      <div className="tooltip-box">
        <div className="tooltip-title">{label}</div>
        {payload.map((p, i) => (
          <div key={i} style={{ color: p.color }}>
            {p.name}: <b>{p.value}</b>
          </div>
        ))}
      </div>
    );
  };

  return (
    <section className="analytics-section">

      <div className="analytics-header">
        <h2>// Analytics & Insights</h2>
        <span className="section-tag">LIVE</span>
      </div>

      <div className="charts-grid">

        {/* ERROR PIE */}
        <div className="chart-card" data-depth="1">
          <h3>Error Distribution</h3>

          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={errorDistribution} dataKey="value" cx="50%" cy="50%" outerRadius={80}>
                {errorDistribution.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip content={<TooltipBox />} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* TIMELINE */}
        <div className="chart-card" data-depth="1">
          <h3>Error Timeline</h3>

          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={timeline}>
              <defs>
                <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#00ff88" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#00ff88" stopOpacity={0} />
                </linearGradient>
              </defs>

              <XAxis dataKey="time" tick={{ fill: '#2a5a38', fontSize: 10 }} />
              <YAxis tick={{ fill: '#2a5a38' }} />
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,255,136,0.1)" />
              <Tooltip content={<TooltipBox />} />

              <Area type="monotone" dataKey="errorRate" stroke="#00ff88" fill="url(#g1)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* STABLE VS CANARY */}
        <div className="chart-card" data-depth="1">
          <h3>Stable vs Canary</h3>

          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={comparison}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,255,136,0.1)" />
              <XAxis dataKey="name" tick={{ fill: '#2a5a38' }} />
              <YAxis tick={{ fill: '#2a5a38' }} />
              <Tooltip content={<TooltipBox />} />

              <Bar dataKey="errorRate">
                {comparison.map((_, i) => (
                  <Cell key={i} fill={i === 0 ? '#00ff88' : '#f59e0b'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* SEVERITY */}
        <div className="chart-card" data-depth="1">
          <h3>Severity Breakdown</h3>

          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={severity} dataKey="value" cx="50%" cy="50%" innerRadius={45} outerRadius={75}>
                {severity.map((s, i) => (
                  <Cell key={i} fill={s.color} />
                ))}
              </Pie>
              <Tooltip content={<TooltipBox />} />
            </PieChart>
          </ResponsiveContainer>
        </div>

      </div>
    </section>
  );
};

export default Analytics;