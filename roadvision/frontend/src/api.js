import { loadSettings } from "./settings.js";

const base = () => loadSettings().apiBase.replace(/\/$/, "");

async function json(path, opts) {
  const res = await fetch(base() + path, opts);
  if (!res.ok) {
    let msg = res.statusText;
    try {
      msg = (await res.json()).detail || msg;
    } catch {
      /* not json */
    }
    throw new Error(msg);
  }
  return res.json();
}

export const assetUrl = (p) => (p ? base() + p : "");

export const getHealth = () => json("/api/health");
export const getModelInfo = () => json("/api/model-info");
export const getStats = () => json("/api/stats");
export const getPerformance = () => json("/api/performance");

export function getHistory({ kind, cls, q } = {}) {
  const p = new URLSearchParams();
  if (kind) p.set("kind", kind);
  if (cls) p.set("cls", cls);
  if (q) p.set("q", q);
  return json("/api/history?" + p.toString());
}
export const deleteHistoryItem = (id) => json("/api/history/" + id, { method: "DELETE" });
export const clearHistory = () => json("/api/history", { method: "DELETE" });

function form(file, s) {
  const f = new FormData();
  f.append("file", file);
  f.append("conf", s.conf);
  f.append("iou", s.iou);
  f.append("imgsz", s.imgsz);
  f.append("max_det", s.maxDet);
  f.append("classes", s.classes.join(","));
  f.append("show_labels", s.showLabels);
  f.append("show_conf", s.showConf);
  f.append("save", s.saveHistory);
  return f;
}

export const detectImage = (file, s) => json("/api/detect/image", { method: "POST", body: form(file, s) });

export async function detectVideo(file, s, onProgress) {
  const f = form(file, s);
  f.append("frame_stride", s.frameStride);
  const { job_id } = await json("/api/detect/video", { method: "POST", body: f });
  for (;;) {
    await new Promise((r) => setTimeout(r, 1000));
    const job = await json("/api/jobs/" + job_id);
    onProgress?.(job.progress || 0);
    if (job.status === "done") return job.result;
    if (job.status === "error") throw new Error(job.error);
  }
}
