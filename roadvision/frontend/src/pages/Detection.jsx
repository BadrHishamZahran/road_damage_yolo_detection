import { useRef, useState } from "react";
import { assetUrl, detectImage, detectVideo } from "../api.js";
import { CLASS_COLORS, CLASS_NAMES } from "../classes.js";
import { useSettings } from "../settings.js";

const isVideo = (f) => f.type.startsWith("video/") || /\.(mp4|avi|mov|mkv|webm)$/i.test(f.name);
const isImage = (f) => f.type.startsWith("image/") || /\.(jpe?g|png|webp|bmp)$/i.test(f.name);

export default function Detection() {
  const settings = useSettings();
  const [run, setRun] = useState({ conf: null, iou: null });
  const [jobs, setJobs] = useState([]); // {key, name, kind, status, progress, result, error}
  const [selected, setSelected] = useState(null);
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [queue, setQueue] = useState([]);
  const input = useRef(null);

  const conf = run.conf ?? settings.conf;
  const iou = run.iou ?? settings.iou;

  const addFiles = (list) => {
    const ok = [...list].filter((f) => isImage(f) || isVideo(f));
    setQueue((q) => [...q, ...ok]);
  };

  const patch = (key, p) => setJobs((j) => j.map((x) => (x.key === key ? { ...x, ...p } : x)));

  const start = async () => {
    if (!queue.length || busy) return;
    setBusy(true);
    const s = { ...settings, conf, iou };
    const files = queue;
    setQueue([]);
    for (const file of files) {
      const key = crypto.randomUUID();
      const kind = isVideo(file) ? "video" : "image";
      setJobs((j) => [{ key, name: file.name, kind, status: "running", progress: 0 }, ...j]);
      try {
        const result = kind === "video"
          ? await detectVideo(file, s, (p) => patch(key, { progress: p }))
          : await detectImage(file, s);
        patch(key, { status: "done", progress: 1, result });
        setSelected(key);
      } catch (e) {
        patch(key, { status: "error", error: e.message });
      }
    }
    setBusy(false);
  };

  const current = jobs.find((j) => j.key === selected);
  const result = current?.result;

  return (
    <>
      <div>
        <h1>Detection</h1>
        <p className="subtitle">Drag &amp; drop road images or videos and analyse them with the deployed model.</p>
      </div>

      <div className="row">
        <div className="stack" style={{ flex: "2 1 480px", minWidth: 0 }}>
          <section
            className={"dropzone" + (over ? " over" : "")}
            onDragOver={(e) => { e.preventDefault(); setOver(true); }}
            onDragLeave={() => setOver(false)}
            onDrop={(e) => { e.preventDefault(); setOver(false); addFiles(e.dataTransfer.files); }}
          >
            <div className="title">Drag &amp; drop images or videos here</div>
            <div style={{ fontSize: 14, color: "#4A5A7F" }}>JPG, PNG, WEBP · MP4, AVI, MOV</div>
            <input ref={input} type="file" multiple accept="image/*,video/*" hidden onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
            <button className="btn" onClick={() => input.current.click()}>Browse files</button>
            {queue.length > 0 && (
              <div className="chips" style={{ justifyContent: "center", marginTop: 8 }}>
                {queue.map((f, i) => <span className="chip" key={i}>{f.name}</span>)}
              </div>
            )}
          </section>

          <section className="card">
            <h2>Result preview</h2>
            {!current && <div className="empty">Results of the selected file appear here.</div>}
            {current?.status === "running" && (
              <div className="stack">
                <div style={{ fontSize: 14 }}>Analysing {current.name}…</div>
                <div className="progress"><div style={{ width: `${(current.progress || 0.05) * 100}%` }} /></div>
              </div>
            )}
            {current?.status === "error" && <div className="banner error">{current.error}</div>}
            {result && (
              <div className="stack">
                {result.kind === "image"
                  ? <img className="media" src={assetUrl(result.output_url)} alt={`Detections on ${result.filename}`} />
                  : <video className="media" src={assetUrl(result.output_url)} controls />}
                <div className="chips">
                  <span className="chip"><strong>{result.total}</strong> damages</span>
                  <span className="chip"><strong>{result.inference_ms}</strong> ms / frame</span>
                  {Object.entries(result.counts).map(([c, n]) => (
                    <span className="chip" key={c}><span className="dot" style={{ background: CLASS_COLORS[c] || "#A3A3A3", borderRadius: "50%", width: 10, height: 10 }} />{c}: {n}</span>
                  ))}
                </div>
              </div>
            )}
          </section>
        </div>

        <aside className="stack" style={{ flex: "1 1 280px" }}>
          <section className="card stack">
            <h2 style={{ margin: 0 }}>Run settings</h2>
            <label className="field">
              <span style={{ display: "flex", justifyContent: "space-between" }}>Confidence threshold <strong style={{ color: "#0B1F4B" }}>{Number(conf).toFixed(2)}</strong></span>
              <input type="range" min="0" max="1" step="0.05" value={conf} onChange={(e) => setRun({ ...run, conf: +e.target.value })} />
            </label>
            <label className="field">
              <span style={{ display: "flex", justifyContent: "space-between" }}>IoU threshold <strong style={{ color: "#0B1F4B" }}>{Number(iou).toFixed(2)}</strong></span>
              <input type="range" min="0" max="1" step="0.05" value={iou} onChange={(e) => setRun({ ...run, iou: +e.target.value })} />
            </label>
            <button className="btn go" disabled={!queue.length || busy} onClick={start}>
              {busy ? "Running…" : `Run detection${queue.length ? ` (${queue.length})` : ""}`}
            </button>
          </section>

          <section className="card">
            <h2>Damage classes</h2>
            <div className="chips">
              {CLASS_NAMES.map((c) => (
                <span className="chip" key={c}><span className="dot" style={{ background: CLASS_COLORS[c], borderRadius: "50%", width: 10, height: 10 }} />{c}</span>
              ))}
            </div>
          </section>

          {jobs.length > 0 && (
            <section className="card">
              <h2>This session</h2>
              <div className="stack" style={{ gap: 8 }}>
                {jobs.map((j) => (
                  <button key={j.key} className="btn secondary" style={{ textAlign: "left", fontSize: 13, padding: "10px 12px", borderColor: j.key === selected ? "#023EFF" : undefined }} onClick={() => setSelected(j.key)}>
                    {j.name} · {j.status}
                  </button>
                ))}
              </div>
            </section>
          )}
        </aside>
      </div>
    </>
  );
}
