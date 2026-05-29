"""
============================================================
Sima Arome — AI QC Visual Inspection: GPU Training Script
============================================================
Trains a YOLOv8 Nano model on the local QC dataset using NVIDIA GPU.

Dataset: FruitVision Fresh vs Rotten (10 classes)
  - fresh_apple, fresh_banana, fresh_grape, fresh_mango, fresh_orange
  - rotten_apple, rotten_banana, rotten_grape, rotten_mango, rotten_orange

Usage:
  cd ai/
  python train.py
"""

import os
import torch
from ultralytics import YOLO

# Resolve dataset path relative to this script
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
DATASET_DIR = os.path.join(PROJECT_ROOT, "dataset", "sima_qc_data")
DATA_YAML = os.path.join(DATASET_DIR, "data.yaml")


def verify_gpu() -> str:
    """Verify CUDA GPU is available and print device info."""
    if not torch.cuda.is_available():
        print("⚠️  WARNING: CUDA not available. Training will fall back to CPU.")
        print("   This will be significantly slower. Check your NVIDIA drivers.")
        return "cpu"

    device_name = torch.cuda.get_device_name(0)
    vram_gb = torch.cuda.get_device_properties(0).total_mem / (1024 ** 3)
    print(f"✅ GPU Detected: {device_name}")
    print(f"   VRAM: {vram_gb:.1f} GB")
    print(f"   CUDA Version: {torch.version.cuda}")
    return "0"


def train():
    """Initialize YOLOv8 Nano and train on local QC dataset."""
    print("=" * 60)
    print("  Sima Arome — AI QC Model Training")
    print("=" * 60)

    # Step 1: Verify GPU
    device = verify_gpu()
    print()

    # Step 2: Verify dataset exists
    if not os.path.exists(DATA_YAML):
        print(f"❌ Dataset not found at: {DATA_YAML}")
        print("   Download from Roboflow and place in dataset/sima_qc_data/")
        return None

    print(f"📂 Dataset: {DATA_YAML}")

    # Step 3: Load pretrained YOLOv8 Nano model
    print("📦 Loading YOLOv8 Nano pretrained weights...")
    model = YOLO("yolov8n.pt")

    # Step 4: Train on local dataset
    print("🚀 Starting training...")
    print(f"   Device: {'NVIDIA GPU (cuda:0)' if device == '0' else 'CPU'}")
    print()

    results = model.train(
        # Dataset configuration
        data=DATA_YAML,

        # Hardware optimization
        device=device,          # Use NVIDIA GPU (cuda:0)
        workers=4,              # Multi-threaded data loading

        # Training hyperparameters
        epochs=50,              # Total training epochs
        imgsz=640,              # Input image resolution
        batch=-1,               # Auto-VRAM tuning (maximizes batch for available GPU memory)
        patience=10,            # Early stopping patience

        # Output configuration
        project=os.path.join(SCRIPT_DIR, "runs", "detect"),
        name="train",
        exist_ok=True,          # Overwrite previous run

        # Augmentation (good defaults for QC inspection)
        hsv_h=0.015,
        hsv_s=0.7,
        hsv_v=0.4,
        flipud=0.5,
        fliplr=0.5,
        mosaic=1.0,

        # Logging
        verbose=True,
    )

    print()
    print("=" * 60)
    print("✅ Training complete!")
    print(f"   Best weights: ai/runs/detect/train/weights/best.pt")
    print(f"   Last weights: ai/runs/detect/train/weights/last.pt")
    print("=" * 60)

    return results


if __name__ == "__main__":
    train()
