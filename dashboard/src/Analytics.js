import React, { useState, useEffect } from 'react';
import {
  PieChart, Pie, Cell,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, Area, AreaChart
} from 'recharts';
import './Analytics.css';

const Analytics = ({ logs, stats }) => {
  const [errorDistribution, setErrorDistribution] = useState([]);
  const [timeline, setTimeline] = useState([]);
  const [comparison, setComparison] = useState([]);
  const [severity, setSeverity] = useState([]);

  useEffect(() => {
    if (!logs || logs.length === 0) return;

    // 1. Error Distribution (Pie)
    const errorCounts = {};
    logs.forEach(log => {
      if (log.statusCode >= 400) {
        const code = log.statusCode;
        errorCounts[code] = (errorCounts[code] || 0) + 1;
      }
    });

    const distributionData = Object.entries(errorCounts)
      .map(([code, count]) => ({
        name: `${code}`,
        value: count
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);

    setErrorDistribution(distributionData);

    // 2. Error Rate Timeline (Line)
    const timelineData = [];
    const now = new Date();
    for (let i = 9; i >= 0; i--) {
      const time = new Date(now.getTime() - i * 60000);
      const timeStr = time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      
      const logsInMinute = logs.filter(l => {
        const logTime = new Date(l.timestamp);
        return logTime.getTime() > time.getTime() - 60000 && logTime.getTime() <= time.getTime();
      });
      
      const errors = logsInMinute.filter(l => l.statusCode >= 400).length;
      const errorRate = logsInMinute.length > 0 ? Math.round((errors / logsInMinute.length) * 100) : 0;
      
      timelineData.push({
        time: timeStr,
        errorRate: errorRate,
        requests: logsInMinute.length
      });
    }
    setTimeline(timelineData);

    // 3. Stable vs Test Comparison (Bar)
    const stableErrors = logs.filter(l => l.statusCode >= 400 && l.target?.includes('5001')).length;
    const stableTotal = logs.filter(l => l.target?.includes('5001')).length;
    const testErrors = logs.filter(l => l.statusCode >= 400 && l.target?.includes('5002')).length;
    const testTotal = logs.filter(l => l.target?.includes('5002')).length;

    const stableRate = stableTotal > 0 ? Math.round((stableErrors / stableTotal) * 100) : 0;
    const testRate = testTotal > 0 ? Math.round((testErrors / testTotal) * 100) : 0;

    setComparison([
      { name: 'Stable', errorRate: stableRate, requests: stableTotal },
      { name: 'Test', errorRate: testRate, requests: testTotal }
    ]);

    // 4. Severity Breakdown (Donut)
    const severityData = {
      CRITICAL: 0,
      HIGH: 0,
      MEDIUM: 0,
      LOW: 0
    };

    logs.forEach(log => {
      if (log.statusCode >= 500) {
        severityData.CRITICAL++;
      } else if (log.statusCode >= 400 && log.statusCode < 500) {
        if ([429, 408].includes(log.statusCode)) {
          severityData.HIGH++;
        } else {
          severityData.MEDIUM++;
        }
      } else {
        severityData.LOW++;
      }
    });

    const severityChartData = [
      { name: 'Critical', value: severityData.CRITICAL, color: '#dc2626' },
      { name: 'High', value: severityData.HIGH, color: '#ea580c' },
      { name: 'Medium', value: severityData.MEDIUM, color: '#f59e0b' },
      { name: 'Low', value: severityData.LOW, color: '#10b981' }
    ].filter(item => item.value > 0);

    setSeverity(severityChartData);
  }, [logs]);

  const COLORS = ['#dc2626', '#ea580c', '#f59e0b', '#0891b2', '#10b981'];

  return (
    <section className="analytics-section">
      <div className="analytics-header">
        <h2>📊 Analytics & Insights</h2>
      </div>

      <div className="charts-grid">
        {/* Chart 1: Error Distribution Pie */}
        <div className="chart-card">
          <h3>Error Distribution</h3>
          {errorDistribution.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={errorDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {errorDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="no-data">No errors</div>
          )}
          <div className="chart-legend">
            {errorDistribution.map((item, idx) => (
              <div key={idx} className="legend-item">
                <span className="legend-color" style={{ backgroundColor: COLORS[idx % COLORS.length] }}></span>
                <span>{item.name}: {item.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Chart 2: Error Rate Timeline */}
        <div className="chart-card">
          <h3>Error Rate Timeline</h3>
          {timeline.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={timeline}>
                <defs>
                  <linearGradient id="colorErrorRate" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0891b2" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#0891b2" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="time" />
                <YAxis />
                <Tooltip />
                <Area
                  type="monotone"
                  dataKey="errorRate"
                  stroke="#0891b2"
                  fillOpacity={1}
                  fill="url(#colorErrorRate)"
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="no-data">No data</div>
          )}
        </div>

        {/* Chart 3: Stable vs Test */}
        <div className="chart-card">
          <h3>Stable vs Test Comparison</h3>
          {comparison.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={comparison}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="errorRate" fill="#dc2626" name="Error Rate %" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="no-data">No data</div>
          )}
          <div className="comparison-stats">
            {comparison.map((item, idx) => (
              <div key={idx} className="stat">
                <span className="stat-label">{item.name}</span>
                <span className="stat-value">{item.errorRate}%</span>
                <span className="stat-requests">{item.requests} requests</span>
              </div>
            ))}
          </div>
        </div>

        {/* Chart 4: Severity Breakdown */}
        <div className="chart-card">
          <h3>Severity Breakdown</h3>
          {severity.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={severity}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={75}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {severity.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="no-data">No data</div>
          )}
          <div className="severity-legend">
            {severity.map((item, idx) => (
              <div key={idx} className="severity-item">
                <span className="severity-color" style={{ backgroundColor: item.color }}></span>
                <span className="severity-name">{item.name}</span>
                <span className="severity-count">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default Analytics;