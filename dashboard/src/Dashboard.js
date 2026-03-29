import React, { useState, useEffect, useRef, useCallback } from 'react';
import Analytics from './Analytics';
import AIAnalyzer from './AIAnalyzer';
import LogScene from './components/three/LogScene';
import LogAnalysis from './LogAnalysis';

// ── Cursor-reactive 3D background ────────────────────────────────────────
function CursorBackground() {
  const canvasRef = useRef(null);
  const mouse = useRef({ x: 0.5, y: 0.5 });
  const targetMouse = useRef({ x: 0.5, y: 0.5 });
  const animRef = useRef(null);
  const nodesRef = useRef([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let W = window.innerWidth, H = window.innerHeight;

    const resize = () => {
      W = canvas.width = window.innerWidth;
      H = canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const onMove = (e) => {
      targetMouse.current = { x: e.clientX / W, y: e.clientY / H };
    };
    window.addEventListener('mousemove', onMove);

    const cols = 22, rows = 14;
    nodesRef.current = [];
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        nodesRef.current.push({
          bx: (i / (cols - 1)) * W,
          by: (j / (rows - 1)) * H,
          x: (i / (cols - 1)) * W,
          y: (j / (rows - 1)) * H,
          size: Math.random() * 1.5 + 0.5,
          pulse: Math.random() * Math.PI * 2,
        });
      }
    }

    let t = 0;
    const draw = () => {
      mouse.current.x += (targetMouse.current.x - mouse.current.x) * 0.05;
      mouse.current.y += (targetMouse.current.y - mouse.current.y) * 0.05;

      ctx.clearRect(0, 0, W, H);

      const grad = ctx.createRadialGradient(
        mouse.current.x * W, mouse.current.y * H, 0,
        W / 2, H / 2, Math.max(W, H)
      );
      grad.addColorStop(0, '#050d1a');
      grad.addColorStop(0.4, '#020810');
      grad.addColorStop(1, '#000305');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);

      const cg = ctx.createRadialGradient(
        mouse.current.x * W, mouse.current.y * H, 0,
        mouse.current.x * W, mouse.current.y * H, 320
      );
      cg.addColorStop(0, 'rgba(0,220,180,0.07)');
      cg.addColorStop(0.5, 'rgba(0,120,255,0.04)');
      cg.addColorStop(1, 'transparent');
      ctx.fillStyle = cg;
      ctx.fillRect(0, 0, W, H);

      for (let y = 0; y < H; y += 3) {
        ctx.fillStyle = 'rgba(0,0,0,0.05)';
        ctx.fillRect(0, y, W, 1);
      }

      const mx = mouse.current.x * W;
      const my = mouse.current.y * H;

      nodesRef.current.forEach((n) => {
        const dx = mx - n.bx, dy = my - n.by;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const pull = Math.max(0, 1 - dist / 350);
        n.pulse += 0.015;

        const tx = n.bx + dx * pull * 0.18 + Math.sin(t * 0.4 + n.pulse) * 6;
        const ty = n.by + dy * pull * 0.18 + Math.cos(t * 0.3 + n.pulse) * 6;
        n.x += (tx - n.x) * 0.08;
        n.y += (ty - n.y) * 0.08;

        const alpha = 0.2 + pull * 0.8 + Math.sin(n.pulse) * 0.1;
        const size = n.size + pull * 2.5;

        ctx.beginPath();
        ctx.arc(n.x, n.y, size, 0, Math.PI * 2);
        ctx.fillStyle = pull > 0.3
          ? `rgba(0,220,180,${alpha})`
          : `rgba(0,100,200,${alpha * 0.6})`;
        ctx.fill();
      });

      const nodes = nodesRef.current;
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i], b = nodes[j];
          const dx = a.x - b.x, dy = a.y - b.y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < 90) {
            const alpha = (1 - d / 90) * 0.15;
            const adx = mx - a.x, ady = my - a.y;
            const near = Math.sqrt(adx * adx + ady * ady) < 250;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.strokeStyle = near
              ? `rgba(0,220,180,${alpha * 3})`
              : `rgba(0,100,200,${alpha})`;
            ctx.lineWidth = near ? 0.8 : 0.4;
            ctx.stroke();
          }
        }
      }

      const sweepY = ((t * 0.4) % H);
      const sg = ctx.createLinearGradient(0, sweepY - 40, 0, sweepY + 2);
      sg.addColorStop(0, 'transparent');
      sg.addColorStop(1, 'rgba(0,220,180,0.04)');
      ctx.fillStyle = sg;
      ctx.fillRect(0, sweepY - 40, W, 42);

      t++;
      animRef.current = requestAnimationFrame(draw);
    };

    draw();
    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', onMove);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
        zIndex: 0, pointerEvents: 'none',
      }}
    />
  );
}

// ── Tilt hook ─────────────────────────────────────────────────────────────
function useTilt(strength = 8) {
  const ref = useRef(null);
  const onMove = useCallback((e) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const dx = (e.clientX - r.left - r.width / 2) / (r.width / 2);
    const dy = (e.clientY - r.top - r.height / 2) / (r.height / 2);
    el.style.transform = `perspective(800px) rotateY(${dx * strength}deg) rotateX(${-dy * strength}deg) translateZ(8px)`;
  }, [strength]);
  const onLeave = useCallback(() => {
    if (ref.current) ref.current.style.transform = 'perspective(800px) rotateY(0deg) rotateX(0deg) translateZ(0px)';
  }, []);
  return { ref, onMouseMove: onMove, onMouseLeave: onLeave };
}

// ── Metric Card ───────────────────────────────────────────────────────────
function MetricCard({ label, value, accent, delay, icon }) {
  const tilt = useTilt(5);
  return (
    <div {...tilt} style={{
      ...styles.metricCard,
      animationDelay: delay,
      '--accent': accent,
      transition: 'transform 0.15s ease',
    }}>
      <div style={styles.metricCornerTL} />
      <div style={styles.metricCornerBR} />
      <div style={{ color: accent, fontSize: 22, marginBottom: 6 }}>{icon}</div>
      <div style={styles.metricLabel}>{label}</div>
      <div style={{ ...styles.metricValue, color: accent, textShadow: `0 0 30px ${accent}` }}>
        {value}
      </div>
      <div style={{ ...styles.metricBar, background: `linear-gradient(90deg, ${accent}33, transparent)` }} />
    </div>
  );
}

// ── Status Badge ──────────────────────────────────────────────────────────
function StatusBadge({ code }) {
  const color = code >= 500 ? '#ff3355' : code >= 400 ? '#ff8800' : code >= 300 ? '#f59e0b' : '#00dc9b';
  return (
    <span style={{
      ...styles.badge,
      color,
      border: `1px solid ${color}44`,
      background: `${color}0d`,
      textShadow: `0 0 8px ${color}`,
    }}>{code}</span>
  );
}

// ── Section Header ────────────────────────────────────────────────────────
function SectionHeader({ title, tag }) {
  return (
    <div style={styles.sectionHeader}>
      <span style={styles.sectionSlash}>//</span>
      <span style={styles.sectionTitle}>{title}</span>
      {tag && <span style={styles.sectionTag}>{tag}</span>}
      <div style={styles.sectionLine} />
    </div>
  );
}

// ── Main Dashboard ────────────────────────────────────────────────────────
const Dashboard = () => {
  const [stats, setStats] = useState(null);
  const [logs, setLogs] = useState([]);
  const [config, setConfig] = useState(null);
  const [rollbackHistory, setRollbackHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  // ✅ ALL hooks declared before any early return
  const [serverStart] = useState(() => Date.now());
  const [now, setNow] = useState(Date.now());

  // Uptime ticker
  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tick);
  }, []);

  // Data fetcher
  useEffect(() => {
    setTimeout(() => setMounted(true), 100);
    const fetchData = async () => {
      try {
        const [sR, lR, cR, rR] = await Promise.all([
          fetch('http://127.0.0.1:4000/api/stats'),
          fetch('http://127.0.0.1:4000/api/logs'),
          fetch('http://127.0.0.1:4000/api/config'),
          fetch('http://127.0.0.1:4000/api/rollback-history'),
        ]);
        setStats(await sR.json());
        setLogs((await lR.json()).logs || []);
        setConfig(await cR.json());
        setRollbackHistory((await rR.json()).history || []);
        setLoading(false);
      } catch (err) {
        console.error('Fetch error:', err);
      }
    };
    fetchData();
    const iv = setInterval(fetchData, 2000);
    return () => clearInterval(iv);
  }, []);

  const changeMode = async (mode) => {
    await fetch('http://127.0.0.1:4000/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode }),
    });
    setConfig(c => ({ ...c, mode }));
  };

  const manualRollback = async () => {
    await fetch('http://127.0.0.1:4000/api/rollback', { method: 'POST' });
    alert('Manual rollback triggered');
  };

  // ✅ Uptime computed from local timer — never NaN
  const uptimeMs  = now - serverStart;
  const uptimeMin = Math.floor(uptimeMs / 60000);
  const uptimeSec = Math.floor((uptimeMs % 60000) / 1000);

  // ✅ Early return AFTER all hooks
  if (loading) return (
    <>
      <CursorBackground />
      <div style={styles.loading}>
        <div style={styles.loadingInner}>
          <div style={styles.loadingSpinner} />
          <div style={styles.loadingText}>INITIALIZING SYSTEMS</div>
          <div style={styles.loadingBar}><div style={styles.loadingFill} /></div>
        </div>
      </div>
    </>
  );

  return (
    <>
      <style>{globalStyles}</style>
      <CursorBackground />
      <LogScene logs={logs} />

      <div style={{ ...styles.shell, opacity: mounted ? 1 : 0, transition: 'opacity 0.8s ease' }}>

        {/* 1. AI LOG ANALYSIS ENGINE */}
        {logs.length > 0 && (
          <div style={styles.section}>
            <SectionHeader title="AI Log Analysis Engine" tag="NEURAL" />
            <LogAnalysis logs={logs} stats={stats} />
          </div>
        )}

        {/* 2. AI ERROR ANALYZER */}
        {logs.length > 0 && <AIAnalyzer logs={logs} stats={stats} />}

        {/* 3. CANARY DEPLOYMENT MATRIX (Header + Metrics) */}
        <header style={styles.header}>
          <div style={styles.headerGlow} />
          <div style={styles.headerLeft}>
            <div style={styles.headerHex}>⬡</div>
            <div>
              <div style={styles.headerTitle}>CANARY DEPLOYMENT MATRIX</div>
              <div style={styles.headerSub}>Real-time infrastructure monitoring · v2.4.1</div>
            </div>
          </div>
          <div style={styles.headerRight}>
            <div style={styles.liveDot} />
            <span style={styles.liveText}>LIVE</span>
            <div style={styles.headerDivider} />
            <span style={styles.headerTime}>{new Date().toLocaleTimeString()}</span>
          </div>
          <div style={styles.headerBorderBottom} />
        </header>

        {stats && (
          <div style={styles.metricsGrid}>
            <MetricCard label="TOTAL REQUESTS" value={stats.totalRequests}  accent="#00dc9b" delay="0s"   icon="⬡" />
            <MetricCard label="TOTAL ERRORS"   value={stats.totalErrors}    accent="#ff3355" delay="0.1s" icon="⚠" />
            <MetricCard label="ERROR RATE"     value={stats.errorRatePercent} accent="#f59e0b" delay="0.2s" icon="%" />
            <MetricCard label="UPTIME"         value={`${uptimeMin}m ${uptimeSec}s`} accent="#00b4ff" delay="0.3s" icon="◈" />
          </div>
        )}

        {/* 4. ANALYTICS & INSIGHTS */}
        {logs.length > 0 && <Analytics logs={logs} stats={stats} />}

        {/* 5. TRAFFIC MODE CONTROL */}
        {config && (
          <div style={styles.section}>
            <SectionHeader title="Traffic Mode Control" tag="LIVE" />
            <div style={styles.modeGrid}>
              {[
                { key: 'stable', label: 'STABLE', sub: '90% canary',   icon: '✓',  color: '#00dc9b' },
                { key: 'test',   label: 'TEST',   sub: '10% canary', icon: '⚡', color: '#f59e0b' },
                { key: 'canary', label: 'CANARY', sub: '10% canary',  icon: '◈',  color: '#00b4ff' },
              ].map(m => (
                <button key={m.key} onClick={() => changeMode(m.key)} style={{
                  ...styles.modeBtn,
                  ...(config.mode === m.key ? {
                    background: `${m.color}10`,
                    border: `1px solid ${m.color}`,
                    color: m.color,
                    boxShadow: `0 0 24px ${m.color}33, inset 0 0 24px ${m.color}08`,
                  } : {}),
                }}>
                  <span style={{ fontSize: 20 }}>{m.icon}</span>
                  <span style={{ fontFamily: "'Orbitron', monospace", fontSize: 12, letterSpacing: 3 }}>{m.label}</span>
                  <span style={{ fontSize: 10, opacity: 0.6, fontFamily: 'monospace' }}>{m.sub}</span>
                </button>
              ))}
            </div>
            <div style={styles.modeStatus}>
              ACTIVE_MODE: <span style={{ color: '#00dc9b' }}>{config.mode.toUpperCase()}</span>
            </div>
          </div>
        )}

        {/* 6. EMERGENCY ROLLBACK */}
        <div style={styles.section}>
          <SectionHeader title="Emergency Rollback" />
          <button style={styles.rollbackBtn} onClick={manualRollback}
            onMouseEnter={e => e.currentTarget.style.boxShadow = '0 0 40px #ff335566, inset 0 0 40px #ff335511'}
            onMouseLeave={e => e.currentTarget.style.boxShadow = '0 0 20px #ff335522'}
          >
            <span style={{ fontSize: 18 }}>⏮</span>
            <span style={{ fontFamily: "'Orbitron', monospace", letterSpacing: 2 }}>EXECUTE ROLLBACK → STABLE</span>
          </button>
          <div style={styles.rollbackInfo}>AUTO-TRIGGER · threshold: error_rate &gt; 20%</div>
        </div>

        {/* ROLLBACK HISTORY */}
        {rollbackHistory.length > 0 && (
          <div style={styles.section}>
            <SectionHeader title="Rollback History" tag={`${rollbackHistory.length} EVENTS`} />
            <div style={styles.tableWrap}>
              <table style={styles.table}>
                <thead><tr>{['TIMESTAMP','FROM','TO','ERROR RATE','TRIGGER'].map(h => <th key={h} style={styles.th}>{h}</th>)}</tr></thead>
                <tbody>
                  {rollbackHistory.slice(-10).reverse().map((ev, i) => (
                    <tr key={i} style={styles.tr}>
                      <td style={styles.td}>{new Date(ev.timestamp).toLocaleTimeString()}</td>
                      <td style={{ ...styles.td, color: '#f59e0b' }}>{ev.previousMode}</td>
                      <td style={{ ...styles.td, color: '#00dc9b', fontWeight: 700 }}>{ev.newMode}</td>
                      <td style={{ ...styles.td, color: '#ff3355' }}>{ev.errorRate}%</td>
                      <td style={{ ...styles.td, color: '#a78bfa' }}>AUTO</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 7. RECENT REQUESTS */}
        {logs.length > 0 && (
          <div style={styles.section}>
            <SectionHeader title="Recent Requests" tag="LAST 10" />
            <div style={styles.tableWrap}>
              <table style={styles.table}>
                <thead><tr>{['TIME','METHOD','PATH','STATUS','BACKEND','DURATION'].map(h => <th key={h} style={styles.th}>{h}</th>)}</tr></thead>
                <tbody>
                  {logs.slice(-10).reverse().map((log, i) => (
                    <tr key={i} style={{ ...styles.tr, ...(log.statusCode >= 400 ? styles.trError : {}) }}>
                      <td style={styles.td}>{new Date(log.timestamp).toLocaleTimeString()}</td>
                      <td style={{ ...styles.td, color: '#a78bfa' }}>{log.method}</td>
                      <td style={{ ...styles.td, fontFamily: 'monospace', fontSize: 11 }}>{log.path}</td>
                      <td style={styles.td}><StatusBadge code={log.statusCode} /></td>
                      <td style={{ ...styles.td, color: log.target?.includes('5001') ? '#00dc9b' : '#f59e0b' }}>
                        {log.target?.includes('5001') ? 'stable' : 'canary'}
                      </td>
                      <td style={{ ...styles.td, color: '#00b4ff' }}>{log.duration}ms</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 8. FULL LOG STREAM */}
        {logs.length > 0 && (
          <div style={styles.section}>
            <SectionHeader title="Full Log Stream" tag={`${logs.length} ENTRIES`} />
            <div style={{ ...styles.tableWrap, maxHeight: 340, overflowY: 'auto' }}>
              <table style={styles.table}>
                <thead><tr>{['TIME','METHOD','PATH','STATUS','BACKEND','MS','IP','RESPONSE'].map(h => <th key={h} style={styles.th}>{h}</th>)}</tr></thead>
                <tbody>
                  {logs.map((log, i) => (
                    <tr key={i} style={{ ...styles.tr, ...(log.statusCode >= 400 ? styles.trError : {}) }}>
                      <td style={styles.td}>{new Date(log.timestamp).toLocaleTimeString()}</td>
                      <td style={{ ...styles.td, color: '#a78bfa' }}>{log.method}</td>
                      <td style={{ ...styles.td, fontFamily: 'monospace', fontSize: 10 }}>{log.path}</td>
                      <td style={styles.td}><StatusBadge code={log.statusCode} /></td>
                      <td style={{ ...styles.td, color: log.target?.includes('5001') ? '#00dc9b' : '#f59e0b' }}>
                        {log.target?.includes('5001') ? 'stable' : 'canary'}
                      </td>
                      <td style={{ ...styles.td, color: '#00b4ff' }}>{log.duration}</td>
                      <td style={{ ...styles.td, color: '#5aaa88', fontSize: 10 }}>{log.ip}</td>
                      <td style={{ ...styles.td, fontFamily: 'monospace', fontSize: 10, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {typeof log.responseBody === 'string' ? log.responseBody.substring(0, 50) : 'ok'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div style={styles.footer}>
          CANARY_MATRIX · RAG+PINECONE+GROQ · {new Date().getFullYear()}
        </div>
      </div>
    </>
  );
};

// ── Global CSS ────────────────────────────────────────────────────────────
const globalStyles = `
  @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Share+Tech+Mono&display=swap');
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { background: #000; overflow-x: hidden; cursor: crosshair; }
  ::-webkit-scrollbar { width: 4px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: #00dc9b33; border-radius: 2px; }
  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(20px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes pulse {
    0%, 100% { opacity: 1; } 50% { opacity: 0.3; }
  }
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes fillBar { from { width: 0%; } to { width: 70%; } }
  @keyframes glowPulse {
    0%, 100% { text-shadow: 0 0 30px #00dc9b, 0 0 60px #00dc9b55; }
    50%       { text-shadow: 0 0 50px #00dc9b, 0 0 100px #00dc9b88; }
  }
`;

// ── Styles ────────────────────────────────────────────────────────────────
const styles = {
  shell: {
    position: 'relative',
    zIndex: 1,
    maxWidth: 1400,
    margin: '0 auto',
    padding: '100px 24px 60px',
    fontFamily: "'Share Tech Mono', monospace",
    color: '#8ecfbf',
  },
  loading: {
    position: 'fixed', inset: 0, zIndex: 10,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  loadingInner: { textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 },
  loadingSpinner: {
    width: 48, height: 48, borderRadius: '50%',
    border: '2px solid #00dc9b22', borderTop: '2px solid #00dc9b',
    animation: 'spin 0.8s linear infinite',
  },
  loadingText: { fontFamily: "'Orbitron', monospace", fontSize: 13, letterSpacing: 6, color: '#00dc9b', textShadow: '0 0 20px #00dc9b' },
  loadingBar: { width: 200, height: 2, background: '#ffffff08', borderRadius: 1 },
  loadingFill: { height: '100%', background: '#00dc9b', borderRadius: 1, animation: 'fillBar 1.5s ease forwards' },

  header: {
    position: 'relative', display: 'flex', alignItems: 'center',
    justifyContent: 'space-between', padding: '32px 0 24px', marginBottom: 8,
  },
  headerGlow: {
    position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
    width: '60%', height: 1, background: 'linear-gradient(90deg, transparent, #00dc9b33, transparent)',
  },
  headerLeft: { display: 'flex', alignItems: 'center', gap: 16 },
  headerHex: { fontSize: 42, color: '#00dc9b', animation: 'glowPulse 3s ease infinite' },
  headerTitle: {
    fontFamily: "'Orbitron', monospace", fontSize: 22, fontWeight: 900,
    color: '#e8f8f4', letterSpacing: 4, textShadow: '0 0 40px rgba(0,220,155,0.3)',
  },
  headerSub: { fontSize: 11, color: '#6ab8a8', letterSpacing: 2, marginTop: 4 },
  headerRight: { display: 'flex', alignItems: 'center', gap: 12 },
  liveDot: {
    width: 8, height: 8, borderRadius: '50%',
    background: '#00dc9b', boxShadow: '0 0 12px #00dc9b',
    animation: 'pulse 1.5s ease infinite',
  },
  liveText: { fontFamily: "'Orbitron', monospace", fontSize: 11, color: '#00dc9b', letterSpacing: 3 },
  headerDivider: { width: 1, height: 20, background: '#ffffff10' },
  headerTime: { fontSize: 12, color: '#6ab8a8', fontFamily: 'monospace' },
  headerBorderBottom: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: 1,
    background: 'linear-gradient(90deg, transparent, #00dc9b15, #00b4ff15, transparent)',
  },

  metricsGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 32,
  },
  metricCard: {
    position: 'relative', padding: '24px 20px',
    background: 'rgba(0,8,16,0.4)',
    border: '1px solid rgba(0,220,155,0.15)',
    backdropFilter: 'blur(3px)',
    WebkitBackdropFilter: 'blur(3px)',
    display: 'flex', flexDirection: 'column', gap: 6,
    animation: 'fadeUp 0.5s ease backwards',
    overflow: 'hidden',
  },
  metricCornerTL: {
    position: 'absolute', top: 0, left: 0, width: 12, height: 12,
    borderTop: '2px solid var(--accent)', borderLeft: '2px solid var(--accent)',
  },
  metricCornerBR: {
    position: 'absolute', bottom: 0, right: 0, width: 12, height: 12,
    borderBottom: '2px solid var(--accent)', borderRight: '2px solid var(--accent)',
  },
  metricLabel: { fontSize: 10, letterSpacing: 3, color: '#6ab8a8', fontFamily: "'Orbitron', monospace" },
  metricValue: { fontSize: 36, fontFamily: "'Orbitron', monospace", fontWeight: 900, lineHeight: 1 },
  metricBar: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 2 },

  section: {
    marginBottom: 32, padding: 24,
    background: 'rgba(0,5,12,0.45)',
    border: '1px solid rgba(0,150,120,0.1)',
    backdropFilter: 'blur(3px)',
    WebkitBackdropFilter: 'blur(3px)',
    animation: 'fadeUp 0.5s ease backwards',
  },
  sectionHeader: {
    display: 'flex', alignItems: 'center', gap: 10,
    marginBottom: 20, paddingBottom: 12,
    borderBottom: '1px solid rgba(0,220,155,0.07)',
  },
  sectionSlash: { color: '#00dc9b', fontFamily: "'Orbitron', monospace", fontSize: 14 },
  sectionTitle: { fontFamily: "'Orbitron', monospace", fontSize: 13, color: '#b8e8d8', letterSpacing: 2 },
  sectionTag: {
    fontSize: 9, letterSpacing: 2, padding: '3px 8px',
    border: '1px solid #00dc9b33', color: '#00dc9b',
    fontFamily: "'Orbitron', monospace",
  },
  sectionLine: { flex: 1, height: 1, background: 'linear-gradient(90deg, #00dc9b10, transparent)' },

  modeGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 },
  modeBtn: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
    padding: '20px 16px',
    background: 'rgba(255,255,255,0.02)',
    border: '1px solid rgba(255,255,255,0.08)',
    color: '#7ecfbe', cursor: 'pointer',
    transition: 'all 0.2s ease', fontFamily: 'monospace',
  },
  modeStatus: { fontSize: 11, color: '#5aaa88', letterSpacing: 2, fontFamily: 'monospace' },

  rollbackBtn: {
    display: 'flex', alignItems: 'center', gap: 12,
    padding: '16px 32px', marginBottom: 12,
    background: 'rgba(255,51,85,0.05)',
    border: '1px solid #ff335544', color: '#ff3355',
    cursor: 'pointer', fontFamily: "'Share Tech Mono', monospace", fontSize: 14,
    letterSpacing: 1, boxShadow: '0 0 20px #ff335522',
    transition: 'box-shadow 0.2s ease',
  },
  rollbackInfo: { fontSize: 11, color: '#5a7888', letterSpacing: 2, fontFamily: 'monospace' },

  tableWrap: { overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 12 },
  th: {
    padding: '10px 12px', textAlign: 'left',
    fontFamily: "'Orbitron', monospace", fontSize: 9, letterSpacing: 2,
    color: '#4a9888', borderBottom: '1px solid rgba(0,220,155,0.08)',
    fontWeight: 400,
  },
  tr: { borderBottom: '1px solid rgba(255,255,255,0.03)', transition: 'background 0.15s' },
  trError: { background: 'rgba(255,51,85,0.04)' },
  td: { padding: '10px 12px', color: '#8ecfbf', verticalAlign: 'middle' },
  badge: { padding: '2px 8px', fontSize: 11, fontFamily: 'monospace', display: 'inline-block' },

  footer: {
    textAlign: 'center', padding: '24px 0',
    fontSize: 10, letterSpacing: 4, color: '#3a8878',
    fontFamily: "'Orbitron', monospace",
    borderTop: '1px solid rgba(0,220,155,0.05)',
  },
};

export default Dashboard;