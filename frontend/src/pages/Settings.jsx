import { useState } from "react";
import { CLASS_COLORS, CLASS_NAMES } from "../classes.js";
import { DEFAULT_SETTINGS, loadSettings, saveSettings } from "../settings.js";

export default function Settings() {
  const [s, setS] = useState(loadSettings);
  const [saved, setSaved] = useState(false);

  const set = (k, v) => { setS((p) => ({ ...p, [k]: v })); setSaved(false); };
  const num = (k) => (e) => set(k, e.target.value === "" ? "" : Number(e.target.value));
  const toggleClass = (c) =>
    set("classes", s.classes.includes(c) ? s.classes.filter((x) => x !== c) : [...s.classes, c]);

  const save = () => { saveSettings(s); setSaved(true); };
  const reset = () => { setS({ ...DEFAULT_SETTINGS }); saveSettings({ ...DEFAULT_SETTINGS }); setSaved(true); };

  return (
    <>
      <div className="head">
        <div>
          <h1>Settings</h1>
          <p className="subtitle">Default values used by every new detection. You can still override them per run.</p>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {saved && <span style={{ fontSize: 14, fontWeight: 600 }}>Saved</span>}
          <button className="btn secondary" onClick={reset}>Reset to defaults</button>
          <button className="btn" onClick={save}>Save changes</button>
        </div>
      </div>

      <div className="row">
        <section className="card stack" style={{ flex: "1 1 380px" }}>
          <h2 style={{ margin: 0 }}>Detection defaults</h2>
          <label className="field">Confidence threshold (0 – 1)
            <input type="number" min="0" max="1" step="0.05" value={s.conf} onChange={num("conf")} />
          </label>
          <label className="field">IoU threshold for NMS (0 – 1)
            <input type="number" min="0" max="1" step="0.05" value={s.iou} onChange={num("iou")} />
          </label>
          <label className="field">Image size (px)
            <input type="number" step="32" value={s.imgsz} onChange={num("imgsz")} />
          </label>
          <label className="field">Max detections per image
            <input type="number" value={s.maxDet} onChange={num("maxDet")} />
          </label>
        </section>

        <div className="stack" style={{ flex: "1 1 380px" }}>
          <section className="card stack">
            <h2 style={{ margin: 0 }}>Video</h2>
            <label className="field">Process every N-th frame
              <input type="number" min="1" value={s.frameStride} onChange={num("frameStride")} />
            </label>
          </section>

          <section className="card stack">
            <h2 style={{ margin: 0 }}>Display &amp; classes</h2>
            <label className="check"><input type="checkbox" checked={s.showLabels} onChange={(e) => set("showLabels", e.target.checked)} /> Show class labels</label>
            <label className="check"><input type="checkbox" checked={s.showConf} onChange={(e) => set("showConf", e.target.checked)} /> Show confidence score</label>
            <label className="check"><input type="checkbox" checked={s.saveHistory} onChange={(e) => set("saveHistory", e.target.checked)} /> Save every result to history</label>
            <div style={{ fontSize: 13, color: "#4A5A7F" }}>Classes to detect</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10, fontSize: 14 }}>
              {CLASS_NAMES.map((c) => (
                <label key={c} className="check" style={{ gap: 8 }}>
                  <input type="checkbox" style={{ width: 18, height: 18, accentColor: CLASS_COLORS[c] }} checked={s.classes.includes(c)} onChange={() => toggleClass(c)} />
                  {c}
                </label>
              ))}
            </div>
          </section>

          <section className="card stack">
            <h2 style={{ margin: 0 }}>API</h2>
            <label className="field">FastAPI base URL
              <input type="text" value={s.apiBase} onChange={(e) => set("apiBase", e.target.value)} />
            </label>
          </section>
        </div>
      </div>
    </>
  );
}
