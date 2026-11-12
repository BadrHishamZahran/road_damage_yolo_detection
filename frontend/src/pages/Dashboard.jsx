import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { assetUrl, getStats } from "../api.js";
import { CLASS_COLORS, CLASS_NAMES } from "../classes.js";

const ACCENTS = ["#023EFF", "#FF7C00", "#1AC938", "#8B2BE2"];

function Line({ points }) {
  const w = 560, h = 200, pad = 28;
  const max = Math.max(1, ...points.map((p) => p.damages));
  const x = (i) => pad + (points.length === 1 ? (w - 2 * pad) / 2 : (i * (w - 2 * pad)) / (points.length - 1));
  const y = (v) => h - pad - (v / max) * (h - 2 * pad);
  const d = points.map((p, i) => `${i ? "L" : "M"}${x(i)},${y(p.damages)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" role="img" aria-label="Detections per day">
      <line x1={pad} y1={h - pad} x2={w - pad} y2={h - pad} stroke="#D5DBEA" strokeWidth="2" />
      <line x1={pad} y1={pad} x2={pad} y2={h - pad} stroke="#D5DBEA" strokeWidth="2" />
      <path d={d} fill="none" stroke="#023EFF" strokeWidth="3" />
      {points.map((p, i) => (
        <g key={p.date}>
          <circle cx={x(i)} cy={y(p.damages)} r="5" fill="#023EFF" />
          <text x={x(i)} y={h - 8} fontSize="11" textAnchor="middle" fill="#4A5A7F">{p.date.slice(5)}</text>
        </g>
      ))}
      <text x={pad - 6} y={pad + 4} fontSize="11" textAnchor="end" fill="#4A5A7F">{max}</text>
    </svg>
  );
}

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    getStats().then(setStats).catch((e) => setError(e.message));
  }, []);

  const s = stats || { images: 0, videos: 0, damages: 0, avg_inference_ms: null, by_class: {}, per_day: [], recent: [] };
  const maxClass = Math.max(1, ...Object.values(s.by_class));
  const cards = [
    ["Images analysed", s.images],
    ["Videos analysed", s.videos],
    ["Damages detected", s.damages],
    ["Avg. inference time", s.avg_inference_ms == null ? "—" : `${s.avg_inference_ms} ms`],
  ];

  return (
    <>
      <div className="head">
        <div>
          <h1>Dashboard</h1>
          <p className="subtitle">Statistics of detections run inside this app. Dataset statistics are not shown here.</p>
        </div>
        <Link to="/detection" className="btn">+ New detection</Link>
      </div>

      {error && <div className="banner error">Could not reach the API: {error}</div>}

      <div className="metrics">
        {cards.map(([label, value], i) => (
          <div className="metric" key={label} style={{ borderTopColor: ACCENTS[i] }}>
            <div className="label">{label}</div>
            <div className="value">{value}</div>
          </div>
        ))}
      </div>

      <div className="row">
        <section className="card" style={{ flex: "1 1 380px" }}>
          <h2>Detections by class</h2>
          {CLASS_NAMES.map((c) => (
            <div className="bar-row" key={c}>
              <span className="bar-label"><span className="dot" style={{ background: CLASS_COLORS[c] }} />{c}</span>
              <span className="bar-track"><span className="bar-fill" style={{ display: "block", width: `${((s.by_class[c] || 0) / maxClass) * 100}%`, background: CLASS_COLORS[c] }} /></span>
              <span className="bar-num">{s.by_class[c] || 0}</span>
            </div>
          ))}
        </section>
        <section className="card" style={{ flex: "1 1 380px" }}>
          <h2>Detections over time</h2>
          {s.per_day.length ? <Line points={s.per_day} /> : <div className="chart-empty">Run your first detection and the daily activity chart will appear here.</div>}
        </section>
      </div>

      <section className="card">
        <div className="head" style={{ marginBottom: 16 }}>
          <h2 style={{ margin: 0 }}>Recent detections</h2>
          <Link to="/history" style={{ color: "#023EFF", fontWeight: 600, fontSize: 14 }}>View all</Link>
        </div>
        {s.recent.length ? (
          <div className="stack">
            {s.recent.map((r) => (
              <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 14 }}>
                {r.kind === "image" ? <img className="thumb" src={assetUrl(r.output_url)} alt="" /> : <span className="thumb" style={{ display: "inline-block" }} />}
                <span style={{ flex: 1, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis" }}>{r.filename}</span>
                <span>{r.total} damages</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty">No detections yet. Drop an image or a video in the Detection page to get started.</div>
        )}
      </section>
    </>
  );
}
