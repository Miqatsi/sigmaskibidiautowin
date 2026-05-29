"""
============================================================
Sima Arome — AI QC Visual Inspection: FastAPI Deployment
============================================================
Production-ready REST API for real-time QC image inference.

Endpoints:
  POST /predict         — YOLO defect detection (fresh/rotten classification)
  POST /analyze-color   — Colour consistency analysis (HSV histogram)
  POST /analyze-powder  — Powder QC: colour consistency + contamination detection
  POST /full-inspect    — Combined: YOLO + colour analysis in one call
  GET  /health          — Health check with model status

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
POWDER_WEIGHTS_PATH = os.path.join(SCRIPT_DIR, "runs", "detect", "train", "weights", "best.pt")  # Reuse model; swap with powder_best.pt when available
CONFIDENCE_THRESHOLD = 0.25
DEVICE = "0" if torch.cuda.is_available() else "cpu"

# Global model references
model: YOLO | None = None
powder_model: YOLO | None = None


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
# Powder-Specific Analysis Functions
# ============================================================

def analyze_powder_colour(image_array: np.ndarray) -> dict[str, Any]:
    """
    Specialized colour consistency analysis for extract powders.

    Uses a combination of:
    1. HSV channel variance — measures how uniform the powder colour is
    2. Spatial uniformity — divides image into grid, compares region means
    3. Outlier detection — finds pixels that deviate significantly from the mean

    A good powder should have very low variance (uniform colour throughout).
    Contamination shows as colour outliers or high spatial variance.

    Returns:
      - colour_consistency_score: 0-100% (higher = more uniform)
      - status: PASS/FAIL based on 85% threshold
      - spatial_uniformity: how consistent colour is across the image
      - outlier_percentage: % of pixels that are colour outliers (potential contamination)
    """
    # Convert to HSV — better for separating colour from brightness
    hsv = cv2.cvtColor(image_array, cv2.COLOR_RGB2HSV)
    h_channel = hsv[:, :, 0].astype(np.float64)
    s_channel = hsv[:, :, 1].astype(np.float64)
    v_channel = hsv[:, :, 2].astype(np.float64)

    # --------------------------------------------------------
    # METRIC 1: Channel Variance Score (0-100)
    # Lower variance in H and S channels = more consistent powder colour
    # V (brightness) variance is less important (lighting differences)
    #
    # Math: score = 100 * (1 - normalized_std)
    # Hue range is 0-180, so max std ≈ 52 for uniform distribution
    # Saturation range is 0-255, so max std ≈ 74
    # --------------------------------------------------------
    h_std = float(np.std(h_channel))
    s_std = float(np.std(s_channel))
    v_std = float(np.std(v_channel))

    # Normalize: hue std of 0 = perfect, 52 = worst
    h_score = max(0, (1 - h_std / 52.0)) * 100
    # Normalize: saturation std of 0 = perfect, 74 = worst
    s_score = max(0, (1 - s_std / 74.0)) * 100

    # Weighted combination: hue matters more than saturation for powder
    variance_score = h_score * 0.6 + s_score * 0.4

    # --------------------------------------------------------
    # METRIC 2: Spatial Uniformity (grid-based)
    # Divide image into 4x4 grid, compute mean colour per cell,
    # then measure how much cells deviate from global mean.
    # Low deviation = spatially uniform powder.
    # --------------------------------------------------------
    grid_rows, grid_cols = 4, 4
    height, width = h_channel.shape
    cell_h = height // grid_rows
    cell_w = width // grid_cols

    cell_means_h = []
    cell_means_s = []
    for r in range(grid_rows):
        for c in range(grid_cols):
            cell = h_channel[r * cell_h:(r + 1) * cell_h, c * cell_w:(c + 1) * cell_w]
            cell_s = s_channel[r * cell_h:(r + 1) * cell_h, c * cell_w:(c + 1) * cell_w]
            cell_means_h.append(float(np.mean(cell)))
            cell_means_s.append(float(np.mean(cell_s)))

    # Spatial uniformity: std of cell means (lower = more uniform)
    spatial_std_h = float(np.std(cell_means_h))
    spatial_std_s = float(np.std(cell_means_s))
    # Normalize: spatial std of 0 = perfect, 30 = very non-uniform
    spatial_uniformity = max(0, (1 - (spatial_std_h + spatial_std_s * 0.5) / 30.0)) * 100

    # --------------------------------------------------------
    # METRIC 3: Outlier Detection (contamination indicator)
    # Pixels that deviate > 2 standard deviations from mean hue
    # are potential contaminants (foreign matter with different colour).
    # --------------------------------------------------------
    mean_h = float(np.mean(h_channel))
    threshold = max(h_std * 2.5, 15)  # At least 15 degrees deviation
    outlier_mask = np.abs(h_channel - mean_h) > threshold
    outlier_percentage = float(np.sum(outlier_mask)) / outlier_mask.size * 100

    # --------------------------------------------------------
    # FINAL SCORE: Weighted combination of all metrics
    # --------------------------------------------------------
    # 50% channel variance + 30% spatial uniformity + 20% outlier penalty
    outlier_penalty = max(0, 100 - outlier_percentage * 10)  # 10% outliers = 0 score
    final_score = variance_score * 0.50 + spatial_uniformity * 0.30 + outlier_penalty * 0.20

    # Clamp to 0-100
    final_score = max(0.0, min(100.0, final_score))

    # Status determination
    # PASS: score >= 85% AND outliers < 3%
    # FAIL: score < 85% OR outliers >= 3%
    contamination_detected = outlier_percentage >= 3.0

    if final_score >= 85 and not contamination_detected:
        status = "PASS"
    else:
        status = "FAIL"

    # Dominant powder colour
    mean_hsv = np.uint8([[[int(mean_h), int(np.mean(s_channel)), int(np.mean(v_channel))]]])
    dominant_rgb = cv2.cvtColor(mean_hsv, cv2.COLOR_HSV2RGB)[0][0]

    return {
        "colour_consistency_score": round(final_score, 1),
        "status": status,
        "contamination_detected": contamination_detected,
        "metrics": {
            "channel_variance_score": round(variance_score, 1),
            "spatial_uniformity_score": round(spatial_uniformity, 1),
            "outlier_percentage": round(outlier_percentage, 2),
            "hue_std": round(h_std, 2),
            "saturation_std": round(s_std, 2),
            "brightness_std": round(v_std, 2),
        },
        "powder_color": {
            "rgb": [int(dominant_rgb[0]), int(dominant_rgb[1]), int(dominant_rgb[2])],
            "hex": f"#{int(dominant_rgb[0]):02x}{int(dominant_rgb[1]):02x}{int(dominant_rgb[2]):02x}",
            "mean_hue": round(mean_h, 1),
            "mean_saturation": round(float(np.mean(s_channel)), 1),
        },
    }


# ============================================================
# Application Lifecycle
# ============================================================

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load models on startup, release on shutdown."""
    global model, powder_model
    print(f"🚀 Loading QC model from: {WEIGHTS_PATH}")
    print(f"   Device: {'NVIDIA GPU (cuda:0)' if DEVICE == '0' else 'CPU'}")

    try:
        model = YOLO(WEIGHTS_PATH)
        model.predict(source=Image.new("RGB", (640, 640)), device=DEVICE, verbose=False)
        print("✅ Primary QC model loaded and warmed up!")
    except Exception as e:
        print(f"❌ Failed to load primary model: {e}")
        model = None

    # Load powder contamination model (same weights for now; swap with powder_best.pt when trained)
    try:
        powder_model = YOLO(POWDER_WEIGHTS_PATH)
        print("✅ Powder contamination model loaded!")
    except Exception as e:
        print(f"⚠️  Powder model not available: {e}")
        powder_model = None

    yield
    model = None
    powder_model = None
    print("🛑 Models unloaded.")


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
        "models": {
            "primary_qc": model is not None,
            "powder_contamination": powder_model is not None,
        },
        "device": "cuda:0" if DEVICE == "0" else "cpu",
        "gpu_name": torch.cuda.get_device_name(0) if torch.cuda.is_available() else None,
        "endpoints": ["/predict", "/analyze-color", "/analyze-powder", "/full-inspect"],
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


@app.post("/analyze-powder")
async def analyze_powder(file: UploadFile = File(...)) -> dict[str, Any]:
    """
    Powder QC Analysis: colour consistency + contamination detection.

    Hybrid approach:
      Step A: OpenCV HSV analysis for colour consistency scoring
      Step B: YOLO model for visual contamination/foreign matter detection

    Returns unified JSON with:
      - colour_consistency_score (0-100%)
      - status (PASS/FAIL — fails if score < 85% or contamination found)
      - contamination_detected (boolean)
      - defects (YOLO bounding boxes if any)
    """
    if file.content_type not in ["image/jpeg", "image/png", "image/webp"]:
        raise HTTPException(status_code=400, detail=f"Unsupported: {file.content_type}")

    try:
        image_bytes = await file.read()
        image, image_array = _read_image(image_bytes)

        # ── Step A: OpenCV Colour Consistency Analysis ──
        powder_analysis = analyze_powder_colour(image_array)

        # ── Step B: YOLO Contamination Detection ──
        defects: list[dict[str, Any]] = []
        if powder_model is not None:
            results = powder_model.predict(
                source=image, device=DEVICE, conf=CONFIDENCE_THRESHOLD, verbose=False
            )
            for result in results:
                if result.boxes is None:
                    continue
                for i in range(len(result.boxes)):
                    x_min, y_min, x_max, y_max = result.boxes.xyxy[i].tolist()
                    class_name = powder_model.names[int(result.boxes.cls[i])]
                    confidence = float(result.boxes.conf[i])

                    # Map class names to contamination-relevant labels
                    # "rotten_*" classes indicate degradation/contamination
                    if "rotten" in class_name:
                        defect_class = "contamination"
                    else:
                        defect_class = class_name

                    defects.append({
                        "class": defect_class,
                        "confidence": round(confidence, 4),
                        "box": {
                            "x_min": int(x_min),
                            "y_min": int(y_min),
                            "x_max": int(x_max),
                            "y_max": int(y_max),
                        },
                    })

        defects.sort(key=lambda d: d["confidence"], reverse=True)

        # ── Combine Results ──
        # Final status: FAIL if colour score < 85% OR contamination detected by either method
        yolo_contamination = any(d["class"] == "contamination" for d in defects)
        cv_contamination = powder_analysis["contamination_detected"]
        contamination_detected = yolo_contamination or cv_contamination

        colour_score = powder_analysis["colour_consistency_score"]

        if colour_score < 85 or contamination_detected:
            status = "FAIL"
        else:
            status = "PASS"

        return {
            "success": True,
            "analysis": {
                "colour_consistency_score": colour_score,
                "status": status,
                "contamination_detected": contamination_detected,
                "defects": defects,
                "powder_metrics": powder_analysis["metrics"],
                "powder_color": powder_analysis["powder_color"],
            },
            "metadata": {
                "image_size": {"width": image.width, "height": image.height},
                "methods": ["OpenCV HSV variance analysis", "YOLO contamination detection"],
                "device": "cuda:0" if DEVICE == "0" else "cpu",
            },
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Powder analysis failed: {str(e)}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
