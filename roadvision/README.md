# RoadVision AI

Road damage detection: train and compare 3 YOLO models on Kaggle, deploy the best one with FastAPI, and use it from a React dashboard (images and videos, drag & drop).

Dataset: [road-damage-l1ju7](https://universe.roboflow.com/trafficsignssafeway/road-damage-l1ju7) (Roboflow Universe) — 6,768 images, 7 classes:
`crack`, `pothole`, `block`, `edge`, `alligator`, `longitudinal`, `transverse`.

> ## ⚠️ Important note: get the models from Kaggle, not GitHub
>
> The trained model files (`best.pt`, `results.json`) are **not stored in this GitHub repository**.
> Download them from the **Output files of the Kaggle notebook**:
>
> 👉 **[Open the Kaggle notebook](PASTE_YOUR_KAGGLE_NOTEBOOK_LINK_HERE)** → open the **Output** tab → download `export/best.pt` and `export/results.json`
> (you can also download `export/comparison.csv` and the comparison charts from the same place).
>
> Then place both files in `backend/models/`. Without them the backend cannot load a model and the Model Performance page stays empty.

## Project structure

The web application is made of two parts: the **backend** (FastAPI) and the **frontend** (React + Vite).

```
roadvision/
├── notebooks/
│   └── road_damage_yolo_kaggle.ipynb   # import dataset, tune, train, compare, export best model
│
├── backend/                            # 🔧 WEB APP — API (FastAPI)
│   ├── main.py                         # API routes, model loading, image/video detection, history
│   ├── requirements.txt                # Python dependencies
│   ├── history.db                      # SQLite history (created automatically on first run)
│   └── models/                         # ⬅ put best.pt and results.json here (from the Kaggle Output files)
│       ├── best.pt
│       └── results.json
│
└── frontend/                           # 🖥️ WEB APP — Dashboard (React + Vite)
    ├── index.html
    ├── package.json                    # npm dependencies and scripts
    ├── vite.config.js
    └── src/
        ├── main.jsx                    # app entry point
        ├── App.jsx                     # routing between the 5 pages
        ├── pages/                      # the 5 pages
        │   ├── Dashboard               # statistics of detections made inside the app
        │   ├── Detect                  # image / video upload (drag & drop) and results
        │   ├── History                 # past detections
        │   ├── ModelPerformance        # reads results.json (empty state until it exists)
        │   └── Settings                # confidence, IoU, image size, API URL, ...
        └── components/                 # shared UI components
```

> Adjust the page and file names in `frontend/src/` if yours differ.

## Pipeline

1. **Kaggle notebook** — enable GPU + Internet, add the secret `ROBOFLOW_API_KEY`, run all cells.
   It downloads the dataset, tunes and trains YOLOv8 / YOLO11 / YOLO26, evaluates them on the test split
   (mAP, precision, recall, IoU, FPS, model size, deployment efficiency), and writes
   `export/best.pt`, `export/results.json`, `export/comparison.csv` plus the comparison charts.
2. **Download the models from the notebook's Output files on Kaggle** (see the note above — not from GitHub) and copy `best.pt` and `results.json` into `backend/models/`.
3. **Backend**
   ```bash
   cd backend

   # Create virtual environment
   py -m venv .venv

   # Activate virtual environment
   .\.venv\Scripts\activate

   # Upgrade pip
   python -m pip install --upgrade pip

   # Install dependencies
   pip install -r requirements.txt

   # Run Server
   uvicorn main:app --reload
   ```
   Interactive docs: http://localhost:8000/docs. Install `ffmpeg` to get browser-playable annotated videos.
4. **Frontend**
   ```powershell
   cd frontend

   # Install dependencies
   npm install

   # Start development server
   npm run dev
   ```

## Design decisions

- No YOLO metrics are shown before training and evaluation finish: the Model Performance page reads `results.json`, and shows an empty state until it exists.
- All class charts use the 7 real dataset class names.
- The Dashboard shows statistics of detections made inside the app (stored in `backend/history.db`), not dataset statistics.
- Settings defaults: confidence 0.25, IoU 0.70, image size 640, max detections 300, every frame processed for video, labels and confidence shown, history saving on, all 7 classes enabled, API at `http://localhost:8000`. They are saved in the browser (`localStorage`) and sent with every detection request.

## API

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/health`, `/api/model-info`, `/api/settings/defaults` | status, loaded model, defaults |
| POST | `/api/detect/image` | one image → annotated image + detections |
| POST | `/api/detect/video` | starts a job, returns `job_id` |
| GET | `/api/jobs/{id}` | progress and result of a video job |
| GET/DELETE | `/api/history`, `/api/history/{id}` | results history |
| GET | `/api/stats` | dashboard numbers (in-app detections only) |
| GET | `/api/performance` | evaluation results from `models/results.json` |