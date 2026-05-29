"""
============================================================
Sima Arome — AI QC Visual Inspection: FastAPI Deployment
============================================================
Production-ready REST API for real-time QC image inference.

Endpoints:
  POST /predict        — YOLO defect detection (fresh/rotten classification)
  POST /analyze-color  — Colour consistency analysis (HSV histogram)
  POST /full-inspect   — Combined: YOLO + colour analysis in one call
  GET  /health         — Health check with model status

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

import cv2
import numpy as np
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
# Colour Analysis Functions
# ============================================================

def analyze_colour_consistency(image_array: np.ndarray) -> dict[str, Any]:
    """
    Analyze colour consistency of an image using HSV colour space.

    Returns:
      - dominant_color: RGB tuple of the most common colour
      - consistency_score: 0-100% (higher = more uniform colour)
      - color_distribution: breakdown of hue ranges
      - assessment: PASS/FAIL/WARNING based on consistency
    """
    # Convert to HSV for better colour analysis
    hsv = cv2.cvtColor(image_array, cv2.COLOR_RGB2HSV)

    # Calculate histograms
    h_hist = cv2.calcHist([hsv], [0], None, [180], [0, 180]).flatten()
    s_hist = cv2.calcHist([hsv], [1], None, [256], [0, 256]).flatten()
    v_hist = cv2.calcHist([hsv], [2], None, [256], [0, 256]).flatten()

    # Normalize
    h_hist = h_hist / h_hist.sum()
    s_hist = s_hist / s_hist.sum()
    v_hist = v_hist / v_hist.sum()

    # Consistency score: based on how concentrated the hue distribution is
    # High entropy = inconsistent colour, low entropy = uniform
    h_entropy = -np.sum(h_hist[h_hist > 0] * np.log2(h_hist[h_hist > 0]))
    max_entropy = np.log2(180)  # Maximum possible entropy for hue
    consistency_score = max(0, (1 - h_entropy / max_entropy)) * 100

    # Dominant colour (most frequent hue bin)
    dominant_hue = int(np.argmax(h_hist))
    dominant_sat = int(np.argmax(s_hist))
    dominant_val = int(np.argmax(v_hist))

    # Convert dominant HSV to RGB for display
    dominant_hsv = np.uint8([[[dominant_hue, dominant_sat, dominant_val]]])
    dominant_rgb = cv2.cvtColor(dominant_hsv, cv2.COLOR_HSV2RGB)[0][0]

    # Colour variance (standard deviation in each channel)
    h_std = float(np.std(hsv[:, :, 0]))
    s_std = float(np.std(hsv[:, :, 1]))
    v_std = float(np.std(hsv[:, :, 2]))

    # Mean colour
    mean_h = float(np.mean(hsv[:, :, 0]))
    mean_s = float(np.mean(hsv[:, :, 1]))
    mean_v = float(np.mean(hsv[:, :, 2]))

    # Colour distribution by hue ranges
    color_ranges = {
        "red": float(h_hist[0:10].sum() + h_hist[170:180].sum()),
        "orange": float(h_hist[10:25].sum()),
        "yellow": float(h_hist[25:35].sum()),
        "green": float(h_hist[35:85].sum()),
        "blue": float(h_hist[85:130].sum()),
        "purple": float(h_hist[130:170].sum()),
    }

    # Assessment based on consistency score
    if consistency_score >= 70:
        assessment = "PASS"
        assessment_detail = "Colour is highly uniform — within acceptable QC range."
    elif consistency_score >= 45:
        assessment = "WARNING"
        assessment_detail = "Moderate colour variation detected — manual review recommended."
    else:
        assessment = "FAIL"
        assessment_detail = "High colour inconsistency — possible contamination or degradation."

    return {
        "consistency_score": round(consistency_score, 1),
        "assessment": assessment,
        "assessment_detail": assessment_detail,
        "dominant_color": {
            "rgb": [int(dominant_rgb[0]), int(dominant_rgb[1]), int(dominant_rgb[2])],
            "hex": f"#{int(dominant_rgb[0]):02x}{int(dominant_rgb[1]):02x}{int(dominant_rgb[2]):02x}",
        },
        "color_variance": {
            "hue_std": round(h_std, 2),
            "saturation_std": round(s_std, 2),
            "brightness_std": round(v_std, 2),
        },
        "mean_color_hsv": {
            "hue": round(mean_h, 1),
            "saturation": round(mean_s, 1),
            "value": round(mean_v, 1),
        },
        "color_distribution": {k: round(v * 100, 1) for k, v in color_ranges.items()},
    }


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
    description="Real-time visual quality control: defect detection + colour analysis",
    version="2.0.0",
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
# Helper
# ============================================================

def _read_image(image_bytes: bytes) -> tuple[Image.Image, np.ndarray]:
    """Read image bytes into PIL Image and numpy array."""
    image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    image_array = np.array(image)
    return image, image_array


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
        "endpoints": ["/predict", "/analyze-color", "/full-inspect"],
    }


@app.post("/predict")
async def predict(file: UploadFile = File(...)) -> dict[str, Any]:
    """
    YOLO defect detection — classifies raw materials as fresh or rotten.
    """
    if model is None:
        raise HTTPException(status_code=503, detail="Model not loaded.")

    if file.content_type not in ["image/jpeg", "image/png", "image/webp"]:
        raise HTTPException(status_code=400, detail=f"Unsupported: {file.content_type}")

    try:
        image_bytes = await file.read()
        image, _ = _read_image(image_bytes)

        results = model.predict(source=image, device=DEVICE, conf=CONFIDENCE_THRESHOLD, verbose=False)

        predictions = []
        for result in results:
            if result.boxes is None:
                continue
            for i in range(len(result.boxes)):
                x_min, y_min, x_max, y_max = result.boxes.xyxy[i].tolist()
                predictions.append({
                    "class": model.names[int(result.boxes.cls[i])],
                    "confidence": round(float(result.boxes.conf[i]), 4),
                    "box": {"x_min": int(x_min), "y_min": int(y_min), "x_max": int(x_max), "y_max": int(y_max)},
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


@app.post("/analyze-color")
async def analyze_color(file: UploadFile = File(...)) -> dict[str, Any]:
    """
    Colour consistency analysis using OpenCV HSV histogram.

    Returns consistency score (0-100%), dominant colour, variance metrics,
    and PASS/WARNING/FAIL assessment.
    """
    if file.content_type not in ["image/jpeg", "image/png", "image/webp"]:
        raise HTTPException(status_code=400, detail=f"Unsupported: {file.content_type}")

    try:
        image_bytes = await file.read()
        _, image_array = _read_image(image_bytes)

        color_analysis = analyze_colour_consistency(image_array)

        return {
            "success": True,
            "color_analysis": color_analysis,
            "metadata": {
                "image_size": {"width": image_array.shape[1], "height": image_array.shape[0]},
                "method": "HSV histogram analysis",
            },
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")


@app.post("/full-inspect")
async def full_inspect(file: UploadFile = File(...)) -> dict[str, Any]:
    """
    Full QC inspection: YOLO defect detection + colour consistency analysis.

    Combined endpoint for complete quality assessment in one API call.
    """
    if model is None:
        raise HTTPException(status_code=503, detail="Model not loaded.")

    if file.content_type not in ["image/jpeg", "image/png", "image/webp"]:
        raise HTTPException(status_code=400, detail=f"Unsupported: {file.content_type}")

    try:
        image_bytes = await file.read()
        image, image_array = _read_image(image_bytes)

        # 1. YOLO detection
        results = model.predict(source=image, device=DEVICE, conf=CONFIDENCE_THRESHOLD, verbose=False)
        predictions = []
        for result in results:
            if result.boxes is None:
                continue
            for i in range(len(result.boxes)):
                x_min, y_min, x_max, y_max = result.boxes.xyxy[i].tolist()
                predictions.append({
                    "class": model.names[int(result.boxes.cls[i])],
                    "confidence": round(float(result.boxes.conf[i]), 4),
                    "box": {"x_min": int(x_min), "y_min": int(y_min), "x_max": int(x_max), "y_max": int(y_max)},
                })
        predictions.sort(key=lambda p: p["confidence"], reverse=True)

        # 2. Colour analysis
        color_analysis = analyze_colour_consistency(image_array)

        # 3. Overall QC verdict
        has_rotten = any("rotten" in p["class"] for p in predictions)
        color_pass = color_analysis["assessment"] == "PASS"

        if has_rotten:
            overall_verdict = "FAIL"
            verdict_reason = "Defect detected: material classified as rotten/degraded."
        elif not color_pass:
            overall_verdict = color_analysis["assessment"]
            verdict_reason = color_analysis["assessment_detail"]
        else:
            overall_verdict = "PASS"
            verdict_reason = "No defects detected. Colour consistency within acceptable range."

        return {
            "success": True,
            "overall_verdict": overall_verdict,
            "verdict_reason": verdict_reason,
            "defect_detection": {
                "predictions": predictions,
                "total_detections": len(predictions),
            },
            "color_analysis": color_analysis,
            "metadata": {
                "image_size": {"width": image.width, "height": image.height},
                "model": "YOLOv8n-QC + OpenCV HSV",
                "device": "cuda:0" if DEVICE == "0" else "cpu",
            },
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Inspection failed: {str(e)}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
