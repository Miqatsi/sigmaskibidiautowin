# 🔬 Sima Arome — AI QC Visual Inspection

Computer vision-powered quality control for manufacturing. Detects defects, contamination, and quality issues in raw materials and extract powders.

## Prerequisites

- Python 3.10+
- NVIDIA GPU with CUDA configured
- Dataset downloaded from Roboflow Universe

## Setup

```bash
cd ai
pip install -r requirements.txt
```

## Dataset Structure

Download your dataset from Roboflow and place it in:

```
ai/
├── datasets/
│   └── sima_qc_data/
│       ├── data.yaml        # Class definitions & paths
│       ├── train/
│       │   ├── images/
│       │   └── labels/
│       └── valid/
│           ├── images/
│           └── labels/
```

> ⚠️ The `datasets/` and `runs/` folders are gitignored. Each team member trains on their own machine.

## Usage

### 1. Train the Model

```bash
python train.py
```

This will:
- Verify your GPU is available
- Load YOLOv8 Nano pretrained weights
- Train for 50 epochs with auto batch sizing
- Save best weights to `runs/detect/train/weights/best.pt`

### 2. Evaluate the Model

```bash
python evaluate.py
```

Outputs Precision, Recall, mAP50, mAP50-95 for the pitch deck.

### 3. Run the API Server

```bash
python main.py
# or
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

### 4. Test Prediction

```bash
curl -X POST http://localhost:8000/predict \
  -F "file=@test_image.jpg"
```

Response:
```json
{
  "success": true,
  "predictions": [
    {
      "class": "contamination",
      "confidence": 0.94,
      "box": { "x_min": 120, "y_min": 45, "x_max": 300, "y_max": 250 }
    }
  ]
}
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | /health | Health check + GPU status |
| POST | /predict | Upload image → get predictions |

## Architecture

```
train.py      → Trains YOLOv8 on local GPU
evaluate.py   → Validates model, prints metrics
main.py       → FastAPI server for real-time inference
```
