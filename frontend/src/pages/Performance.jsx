import { useEffect, useState } from "react";
import { getPerformance } from "../api.js";
import { CLASS_COLORS, CLASS_NAMES, MODEL_COLORS } from "../classes.js";

const COLUMNS = [
  ["map50", "mAP@50"],
  ["map50_95", "mAP@50-95"],
  ["precision", "Precision"],
  ["recall", "Recall"],
  ["mean_iou", "IoU"],
  ["fps", "FPS"],
  ["size_mb", "Size (MB)"],
];
const fmt = (v, key) => (v == null ? "—" : key === "fps" || key === "size_mb" ? Number(v).toFixed(1) : Number(v).toFixed(3));

function Grouped({ models }) {
  const keys = [["map50", "mAP@50"], ["map50_95", "mAP@50-95"], ["precision", "Precision"], ["recall", "Recall"]];
  return (
    <div>
      <div className="chips" style={{ marginBottom: 12 }}>
        {models.map((m, i) => <span className="chip" key={m.name}><span className="dot" style={{ background: MODEL_COLORS[i] }} />{m.name}</span>)}
      </div>
      <div style={{ display: "flex", gap: 24, alignItems: "flex-end", height: 200, borderBottom: "2px solid #D5DBEA", paddingLeft: 8 }}>
        {keys.map(([k, label]) => (
          <div key={k} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div style={{ display: "flex", gap: 4, alignItems: "flex-end", height: 180 }}>
              {models.map((m, i) => (
                <div key={m.name} title={`${m.name} ${label}: ${fmt(m[k])}`} style={{ width: 18, height: `${Math.max(2, (m[k] || 0) * 100)}%`, background: MODEL_COLORS[i], borderRadius: "4px 4px 0 0" }} />
              ))}
            </div>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 24, fontSize: 12, color: "#4A5A7F", paddingTop: 6 }}>
        {keys.map(([k, label]) => <span key={k} style={{ flex: 1, textAlign: "center" }}>{label}</span>)}
      </div>
    </div>
  );
}

export default function Performance() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => { getPerformance().then(setData).catch((e) => setError(e.message)); }, []);

  const ready = data?.ready && data.models?.length;
  const models = ready ? data.models : [];
  const rows = ready ? models : ["YOLOv8", "YOLO11", "YOLO26"].map((name) => ({ name }));

  return (
    <>
      <div>
        <h1>Model Performance</h1>
        <p className="subtitle">Comparison of the three YOLO models on the test split of the Roboflow dataset.</p>
      </div>

      {error && <div className="banner error">Could not reach the API: {error}</div>}
      {!ready && !error && (
        <div className="banner">
          <strong>Training and evaluation not finished yet.</strong> Metrics are loaded from <code>models/results.json</code>, exported by the Kaggle notebook. Nothing is shown until real numbers exist.
        </div>
      )}
      {ready && data.best && (
        <div className="banner" style={{ background: "#eafbee", borderLeftColor: "#1AC938" }}>
          Best model: <strong>{data.best}</strong> (selected by mAP@50-95, FPS as tie-breaker). It is the model served by the API.
        </div>
      )}

      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Model</th>{COLUMNS.map(([, l]) => <th key={l}>{l}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((m, i) => (
              <tr key={m.name} className={ready && m.name === data.best ? "best-row" : ""}>
                <td style={{ fontWeight: 600 }}><span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}><span className="dot" style={{ background: MODEL_COLORS[i] }} />{m.name}</span></td>
                {COLUMNS.map(([k]) => <td key={k}>{fmt(m[k], k)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="row">
        <section className="card" style={{ flex: "1 1 380px" }}>
          <h2>Metrics by model</h2>
          {ready ? <Grouped models={models} /> : <div className="chart-empty">Grouped bars for mAP, precision and recall appear after evaluation.</div>}
        </section>
        <section className="card" style={{ flex: "1 1 380px" }}>
          <h2>AP per class (mAP@50-95)</h2>
          {ready ? (
            CLASS_NAMES.map((c) => (
              <div className="bar-row" key={c} style={{ marginBottom: 8 }}>
                <span className="bar-label"><span className="dot" style={{ background: CLASS_COLORS[c] }} />{c}</span>
                <span style={{ flex: 1, display: "flex", flexDirection: "column", gap: 3 }}>
                  {models.map((m, i) => (
                    <span className="bar-track" key={m.name} title={`${m.name}: ${fmt(m.per_class_ap?.[c])}`} style={{ height: 6 }}>
                      <span className="bar-fill" style={{ display: "block", width: `${(m.per_class_ap?.[c] || 0) * 100}%`, background: MODEL_COLORS[i] }} />
                    </span>
                  ))}
                </span>
              </div>
            ))
          ) : (
            <div className="chart-empty">Per-class results for the 7 real classes appear here.</div>
          )}
        </section>
      </div>
    </>
  );
}
