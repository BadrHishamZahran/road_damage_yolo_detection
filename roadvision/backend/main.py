"""RoadVision AI - FastAPI deployment of the best YOLO model.

Run:  uvicorn main:app --host 0.0.0.0 --port 8000
Model weights are read from models/best.pt (override with MODEL_PATH).
Evaluation numbers are read from models/results.json, written by the Kaggle notebook.
"""
import json
import os
import shutil
import sqlite3
import subprocess
import threading
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

import cv2
import numpy as np
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

BASE = Path(__file__).parent
MODEL_PATH = Path(os.getenv("MODEL_PATH", BASE / "models" / "best.pt"))
RESULTS_PATH = Path(os.getenv("RESULTS_PATH", BASE / "models" / "results.json"))
OUT = BASE / "outputs"
OUT.mkdir(exist_ok=True)
DB_PATH = BASE / "history.db"

IMAGE_EXT = {".jpg", ".jpeg", ".png", ".webp", ".bmp"}
VIDEO_EXT = {".mp4", ".avi", ".mov", ".mkv", ".webm"}

# Default values, mirrored by the Settings page of the dashboard.
DEFAULTS = {
    "model": "best",
    "conf": 0.25,
    "iou": 0.70,
    "imgsz": 640,
    "max_det": 300,
    "frame_stride": 1,
    "show_labels": True,
    "show_conf": True,
    "save_history": True,
}

app = FastAPI(title="RoadVision AI API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)
app.mount("/outputs", StaticFiles(directory=OUT), name="outputs")

# ----------------------------------------------------------------- model
_model = None
_model_lock = threading.Lock()


def get_model():
    global _model
    with _model_lock:
        if _model is None:
            if not MODEL_PATH.exists():
                raise HTTPException(
                    status_code=503,
                    detail=f"Model weights not found at {MODEL_PATH}. "
                    "Train in the Kaggle notebook and copy best.pt there.",
                )
            from ultralytics import YOLO

            _model = YOLO(str(MODEL_PATH))
        return _model


def class_ids_from_names(model, classes: Optional[str]):
    """'crack,pothole' -> [0, 1] using the model's own class names."""
    if not classes:
        return None
    wanted = {c.strip().lower() for c in classes.split(",") if c.strip()}
    ids = [i for i, n in model.names.items() if str(n).lower() in wanted]
    return ids or None


# -------------------------------------------------------------------- db
def db():
    con = sqlite3.connect(DB_PATH)
    con.row_factory = sqlite3.Row
    return con


def init_db():
    with db() as con:
        con.execute(
            """CREATE TABLE IF NOT EXISTS history (
                id TEXT PRIMARY KEY,
                created_at TEXT NOT NULL,
                filename TEXT NOT NULL,
                kind TEXT NOT NULL,
                model TEXT NOT NULL,
                total INTEGER NOT NULL,
                counts TEXT NOT NULL,
                inference_ms REAL NOT NULL,
                output_url TEXT NOT NULL,
                frames INTEGER NOT NULL DEFAULT 1
            )"""
        )


init_db()


def save_history(item: dict):
    with db() as con:
        con.execute(
            "INSERT INTO history VALUES (?,?,?,?,?,?,?,?,?,?)",
            (
                item["id"], item["created_at"], item["filename"], item["kind"],
                item["model"], item["total"], json.dumps(item["counts"]),
                item["inference_ms"], item["output_url"], item.get("frames", 1),
            ),
        )


def row_to_item(r):
    d = dict(r)
    d["counts"] = json.loads(d["counts"])
    return d


def now_iso():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def count_classes(res):
    counts = {}
    if res.boxes is not None and len(res.boxes):
        for c in res.boxes.cls.int().tolist():
            name = str(res.names[c])
            counts[name] = counts.get(name, 0) + 1
    return counts


# ------------------------------------------------------------- endpoints
@app.get("/api/health")
def health():
    return {"status": "ok", "model_loaded": _model is not None, "weights_found": MODEL_PATH.exists()}


@app.get("/api/settings/defaults")
def settings_defaults():
    return DEFAULTS


@app.get("/api/model-info")
def model_info():
    info = {"weights": MODEL_PATH.name, "weights_found": MODEL_PATH.exists(), "classes": [], "size_mb": None}
    if MODEL_PATH.exists():
        info["size_mb"] = round(MODEL_PATH.stat().st_size / 1e6, 2)
        model = get_model()
        info["classes"] = [str(model.names[i]) for i in sorted(model.names)]
    return info


@app.get("/api/performance")
def performance():
    """Real evaluation results exported by the notebook. Empty until training is done."""
    if not RESULTS_PATH.exists():
        return {"ready": False, "models": []}
    data = json.loads(RESULTS_PATH.read_text())
    data["ready"] = True
    return data


@app.post("/api/detect/image")
def detect_image(
    file: UploadFile = File(...),
    conf: float = Form(DEFAULTS["conf"]),
    iou: float = Form(DEFAULTS["iou"]),
    imgsz: int = Form(DEFAULTS["imgsz"]),
    max_det: int = Form(DEFAULTS["max_det"]),
    classes: Optional[str] = Form(None),
    show_labels: bool = Form(DEFAULTS["show_labels"]),
    show_conf: bool = Form(DEFAULTS["show_conf"]),
    save: bool = Form(DEFAULTS["save_history"]),
):
    if Path(file.filename or "").suffix.lower() not in IMAGE_EXT:
        raise HTTPException(400, "Unsupported image type")
    img = cv2.imdecode(np.frombuffer(file.file.read(), np.uint8), cv2.IMREAD_COLOR)
    if img is None:
        raise HTTPException(400, "Could not decode image")

    model = get_model()
    res = model.predict(
        img, conf=conf, iou=iou, imgsz=imgsz, max_det=max_det,
        classes=class_ids_from_names(model, classes), verbose=False,
    )[0]
    counts = count_classes(res)
    rid = uuid.uuid4().hex[:12]
    cv2.imwrite(str(OUT / f"{rid}.jpg"), res.plot(conf=show_conf, labels=show_labels))

    detections = []
    for b in res.boxes:
        detections.append({
            "class": str(res.names[int(b.cls)]),
            "confidence": round(float(b.conf), 4),
            "box": [round(v, 1) for v in b.xyxy[0].tolist()],
        })
    item = {
        "id": rid, "created_at": now_iso(), "filename": file.filename, "kind": "image",
        "model": MODEL_PATH.name, "total": sum(counts.values()), "counts": counts,
        "inference_ms": round(sum(res.speed.values()), 2), "output_url": f"/outputs/{rid}.jpg", "frames": 1,
    }
    if save:
        save_history(item)
    return {**item, "detections": detections}


# ----- video: processed in a background thread, progress is polled
JOBS: dict = {}


def process_video(job_id, src: Path, filename, p):
    job = JOBS[job_id]
    try:
        model = get_model()
        cap = cv2.VideoCapture(str(src))
        fps = cap.get(cv2.CAP_PROP_FPS) or 25
        w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT)) or 0
        raw = OUT / f"{job_id}_raw.mp4"
        writer = cv2.VideoWriter(str(raw), cv2.VideoWriter_fourcc(*"mp4v"), fps, (w, h))
        class_ids = class_ids_from_names(model, p["classes"])
        counts, ms_total, processed, idx, last = {}, 0.0, 0, 0, None
        while True:
            ok, frame = cap.read()
            if not ok:
                break
            if idx % max(1, p["frame_stride"]) == 0:
                res = model.predict(
                    frame, conf=p["conf"], iou=p["iou"], imgsz=p["imgsz"],
                    max_det=p["max_det"], classes=class_ids, verbose=False,
                )[0]
                for k, v in count_classes(res).items():
                    counts[k] = counts.get(k, 0) + v
                ms_total += sum(res.speed.values())
                processed += 1
                last = res.plot(conf=p["show_conf"], labels=p["show_labels"])
            writer.write(last if last is not None else frame)
            idx += 1
            if total_frames:
                job["progress"] = round(idx / total_frames, 3)
        cap.release()
        writer.release()

        final = OUT / f"{job_id}.mp4"
        if shutil.which("ffmpeg"):  # browsers need H.264
            subprocess.run(
                ["ffmpeg", "-y", "-i", str(raw), "-vcodec", "libx264", "-pix_fmt", "yuv420p",
                 "-movflags", "+faststart", str(final)],
                check=True, capture_output=True,
            )
            raw.unlink(missing_ok=True)
        else:
            raw.rename(final)
        src.unlink(missing_ok=True)

        item = {
            "id": job_id, "created_at": now_iso(), "filename": filename, "kind": "video",
            "model": MODEL_PATH.name, "total": sum(counts.values()), "counts": counts,
            "inference_ms": round(ms_total / max(1, processed), 2),
            "output_url": f"/outputs/{job_id}.mp4", "frames": idx,
        }
        if p["save"]:
            save_history(item)
        job.update(status="done", progress=1.0, result=item)
    except Exception as e:  # noqa: BLE001
        job.update(status="error", error=str(e))


@app.post("/api/detect/video")
def detect_video(
    file: UploadFile = File(...),
    conf: float = Form(DEFAULTS["conf"]),
    iou: float = Form(DEFAULTS["iou"]),
    imgsz: int = Form(DEFAULTS["imgsz"]),
    max_det: int = Form(DEFAULTS["max_det"]),
    frame_stride: int = Form(DEFAULTS["frame_stride"]),
    classes: Optional[str] = Form(None),
    show_labels: bool = Form(DEFAULTS["show_labels"]),
    show_conf: bool = Form(DEFAULTS["show_conf"]),
    save: bool = Form(DEFAULTS["save_history"]),
):
    suffix = Path(file.filename or "").suffix.lower()
    if suffix not in VIDEO_EXT:
        raise HTTPException(400, "Unsupported video type")
    get_model()  # fail early if weights are missing
    job_id = uuid.uuid4().hex[:12]
    src = OUT / f"{job_id}_src{suffix}"
    with open(src, "wb") as f:
        shutil.copyfileobj(file.file, f)
    JOBS[job_id] = {"status": "running", "progress": 0.0}
    params = dict(conf=conf, iou=iou, imgsz=imgsz, max_det=max_det, frame_stride=frame_stride,
                  classes=classes, show_labels=show_labels, show_conf=show_conf, save=save)
    threading.Thread(target=process_video, args=(job_id, src, file.filename, params), daemon=True).start()
    return {"job_id": job_id}


@app.get("/api/jobs/{job_id}")
def job_status(job_id: str):
    if job_id not in JOBS:
        raise HTTPException(404, "Unknown job")
    return JOBS[job_id]


# --------------------------------------------------------------- history
@app.get("/api/history")
def history(kind: Optional[str] = None, cls: Optional[str] = None, q: Optional[str] = None, limit: int = 200):
    sql, args = "SELECT * FROM history WHERE 1=1", []
    if kind in ("image", "video"):
        sql += " AND kind=?"
        args.append(kind)
    if q:
        sql += " AND filename LIKE ?"
        args.append(f"%{q}%")
    sql += " ORDER BY created_at DESC LIMIT ?"
    args.append(limit)
    with db() as con:
        items = [row_to_item(r) for r in con.execute(sql, args)]
    if cls:
        items = [i for i in items if i["counts"].get(cls, 0) > 0]
    return items


def _delete_files(rid: str):
    for p in OUT.glob(f"{rid}*"):
        p.unlink(missing_ok=True)


@app.delete("/api/history/{rid}")
def history_delete(rid: str):
    with db() as con:
        con.execute("DELETE FROM history WHERE id=?", (rid,))
    _delete_files(rid)
    return {"deleted": rid}


@app.delete("/api/history")
def history_clear():
    with db() as con:
        ids = [r["id"] for r in con.execute("SELECT id FROM history")]
        con.execute("DELETE FROM history")
    for rid in ids:
        _delete_files(rid)
    return {"deleted": len(ids)}


@app.get("/api/stats")
def stats():
    """Dashboard numbers: only detections done inside this app, never dataset statistics."""
    with db() as con:
        rows = [row_to_item(r) for r in con.execute("SELECT * FROM history")]
    by_class, per_day = {}, {}
    for r in rows:
        for k, v in r["counts"].items():
            by_class[k] = by_class.get(k, 0) + v
        day = r["created_at"][:10]
        per_day[day] = per_day.get(day, 0) + r["total"]
    return {
        "images": sum(1 for r in rows if r["kind"] == "image"),
        "videos": sum(1 for r in rows if r["kind"] == "video"),
        "damages": sum(r["total"] for r in rows),
        "avg_inference_ms": round(sum(r["inference_ms"] for r in rows) / len(rows), 2) if rows else None,
        "by_class": by_class,
        "per_day": [{"date": d, "damages": per_day[d]} for d in sorted(per_day)],
        "recent": sorted(rows, key=lambda r: r["created_at"], reverse=True)[:5],
    }
