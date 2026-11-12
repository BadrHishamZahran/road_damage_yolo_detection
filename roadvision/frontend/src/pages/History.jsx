import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { assetUrl, clearHistory, deleteHistoryItem, getHistory } from "../api.js";
import { CLASS_NAMES } from "../classes.js";

export default function History() {
  const [items, setItems] = useState([]);
  const [q, setQ] = useState("");
  const [kind, setKind] = useState("");
  const [cls, setCls] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(() => {
    getHistory({ q, kind, cls }).then(setItems).catch((e) => setError(e.message));
  }, [q, kind, cls]);

  useEffect(load, [load]);

  const remove = async (id) => { await deleteHistoryItem(id); load(); };
  const clear = async () => {
    if (window.confirm("Delete all saved results?")) { await clearHistory(); load(); }
  };

  return (
    <>
      <div className="head">
        <div>
          <h1>Results History</h1>
          <p className="subtitle">Every image and video analysed in this app, with its detections.</p>
        </div>
        <button className="btn danger" onClick={clear}>Clear history</button>
      </div>

      {error && <div className="banner error">Could not reach the API: {error}</div>}

      <div className="filters">
        <input type="text" placeholder="Search by file name" aria-label="Search by file name" value={q} onChange={(e) => setQ(e.target.value)} />
        <select aria-label="Type" value={kind} onChange={(e) => setKind(e.target.value)}>
          <option value="">Type: All</option>
          <option value="image">Images</option>
          <option value="video">Videos</option>
        </select>
        <select aria-label="Class" value={cls} onChange={(e) => setCls(e.target.value)}>
          <option value="">Class: All 7</option>
          {CLASS_NAMES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Preview</th><th>File</th><th>Type</th><th>Model</th><th>Damages</th><th>Date</th><th></th></tr>
          </thead>
          <tbody>
            {items.map((r) => (
              <tr key={r.id}>
                <td>{r.kind === "image" ? <img className="thumb" src={assetUrl(r.output_url)} alt="" /> : <video className="thumb" src={assetUrl(r.output_url)} muted />}</td>
                <td style={{ fontWeight: 600 }}>{r.filename}</td>
                <td>{r.kind}</td>
                <td>{r.model}</td>
                <td title={Object.entries(r.counts).map(([c, n]) => `${c}: ${n}`).join(", ")}>{r.total}</td>
                <td>{r.created_at.replace("T", " ").slice(0, 16)}</td>
                <td><button className="btn secondary" style={{ padding: "6px 12px", fontSize: 13 }} onClick={() => remove(r.id)}>Delete</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        {!items.length && (
          <div style={{ padding: "56px 24px", textAlign: "center" }}>
            <div style={{ fontSize: 17, fontWeight: 600, marginBottom: 8 }}>No results saved yet</div>
            <p className="subtitle" style={{ marginBottom: 16 }}>Detections you run will be listed here with the class counts found in each file.</p>
            <Link to="/detection" className="btn">Go to Detection</Link>
          </div>
        )}
      </div>
    </>
  );
}
