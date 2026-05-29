"""
============================================================
Sima Arome — AI QC Visual Inspection: FastAPI Deployment
============================================================
Production-ready REST API for real-time QC image inference.

Endpoints:
  POST /predict  — Upload image, get defect predictions
  GET  /health   — Health check with model status

Usage:
  cd ai/
  uvicorn main:app --host 0.0.0.0 --port 8000 --reload
  # or
  python main.py
"""

import io
import os
from contextlib import asynccontextmanager
from typing import Any

import torch
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image
from ultralytics import YOLO

# ============================================================
# Model Configuration
# ============================================================

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
WEIGHTS_PATH = os.path.join(SCRIPT_DIR, "runs", "detect", "train", "weights", "best.pt")
CONFIDENCE_THRESHOLD = 0.25
DEVICE = "0" if torch.cuda.is_available() else "cpu"

# Global model reference
model: YOLO | None = None


# ============================================================
# Application Lifecycle
# ============================================================

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load model on startup, release on shutdown."""
    global model
    print(f"🚀 Loading QC model from: {WEIGHTS_PATH}")
    print(f"   Device: {'NVIDIA GPU (cuda:0)' if DEVICE == '0' else 'CPU'}")

    try:
        model = YOLO(WEIGHTS_PATH)
        # Warm up with dummy inference
        model.predict(
            source=Image.new("RGB", (640, 640)),
            device=DEVICE,
            verbose=False,
        )
        print("✅ Model loaded and warmed up!")
    except Exception as e:
        print(f"❌ Failed to load model: {e}")
        print("   Run 'python train.py' first to train the model.")
        model = None

    yield
    model = None
    print("🛑 Model unloaded.")


# ============================================================
# FastAPI Application
# ============================================================

app = FastAPI(
    title="Sima Arome — AI QC Inspection API",
    description="Real-time visual quality control for manufacturing",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3001", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================
# Endpoints
# ============================================================

@app.get("/health")
async def health_check():
    """Health check with model and GPU status."""
    return {
        "status": "ok",
        "model_loaded": model is not None,
        "device": "cuda:0" if DEVICE == "0" else "cpu",
        "gpu_name": torch.cuda.get_device_name(0) if torch.cuda.is_available() else None,
    }


@app.post("/predict")
async def predict(file: UploadFile = File(...)) -> dict[str, Any]:
    """
    Upload an image and get QC defect predictions.

    Returns JSON with bounding boxes, confidence scores, and class names.
    """
    if model is None:
        raise HTTPException(status_code=503, detail="Model not loaded. Train first with 'python train.py'.")

    if file.content_type not in ["image/jpeg", "image/png", "image/webp"]:
        raise HTTPException(status_code=400, detail=f"Unsupported file type: {file.content_type}. Use JPEG, PNG, or WebP.")

    try:
        image_bytes = await file.read()
        image = Image.open(io.BytesIO(image_bytes)).convert("RGB")

        results = model.predict(
            source=image,
            device=DEVICE,
            conf=CONFIDENCE_THRESHOLD,
            verbose=False,
        )

        predictions = []
        for result in results:
            boxes = result.boxes
            if boxes is None:
                continue

            for i in range(len(boxes)):
                x_min, y_min, x_max, y_max = boxes.xyxy[i].tolist()
                confidence = float(boxes.conf[i])
                class_id = int(boxes.cls[i])
                class_name = model.names[class_id]

                predictions.append({
                    "class": class_name,
                    "confidence": round(confidence, 4),
                    "box": {
                        "x_min": int(x_min),
                        "y_min": int(y_min),
                        "x_max": int(x_max),
                        "y_max": int(y_max),
                    },
                })

        predictions.sort(key=lambda p: p["confidence"], reverse=True)

        return {
            "success": True,
            "predictions": predictions,
            "metadata": {
                "image_size": {"width": image.width, "height": image.height},
                "model": "YOLOv8n-QC",
                "device": "cuda:0" if DEVICE == "0" else "cpu",
                "total_detections": len(predictions),
            },
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Inference failed: {str(e)}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
