"""
============================================================
Sima Arome — AI QC Visual Inspection: Model Evaluation
============================================================
Loads trained weights and runs validation to extract enterprise metrics.

Usage:
  cd ai/
  python evaluate.py
"""

import os
from ultralytics import YOLO

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
WEIGHTS_PATH = os.path.join(SCRIPT_DIR, "runs", "detect", "train", "weights", "best.pt")
DATA_YAML = os.path.join(PROJECT_ROOT, "dataset", "sima_qc_data", "data.yaml")


def evaluate():
    """Load best weights and run validation on the QC dataset."""
    print("=" * 60)
    print("  Sima Arome — AI QC Model Evaluation")
    print("=" * 60)
    print()

    if not os.path.exists(WEIGHTS_PATH):
        print(f"❌ Trained weights not found: {WEIGHTS_PATH}")
        print("   Run 'python train.py' first to train the model.")
        return None

    # Load trained model
    print(f"📦 Loading trained weights: {WEIGHTS_PATH}")
    model = YOLO(WEIGHTS_PATH)

    # Run validation
    print("🔍 Running validation...")
    print()

    results = model.val(
        data=DATA_YAML,
        device=0,
        imgsz=640,
        batch=32,
        verbose=False,
    )

    # Extract and display metrics
    precision = results.box.mp
    recall = results.box.mr
    map50 = results.box.map50
    map50_95 = results.box.map

    print("=" * 60)
    print("  📊 ENTERPRISE QC MODEL METRICS")
    print("=" * 60)
    print(f"  Precision:   {precision:.4f}  ({precision * 100:.1f}%)")
    print(f"  Recall:      {recall:.4f}  ({recall * 100:.1f}%)")
    print(f"  mAP@50:      {map50:.4f}  ({map50 * 100:.1f}%)")
    print(f"  mAP@50-95:   {map50_95:.4f}  ({map50_95 * 100:.1f}%)")
    print("=" * 60)
    print()
    print("  Copy these metrics into your pitch deck! 🎯")
    print()

    # Per-class breakdown
    if hasattr(results.box, 'maps') and results.box.maps is not None:
        class_names = model.names
        print("  Per-Class mAP@50:")
        print("  " + "-" * 40)
        for i, m in enumerate(results.box.maps):
            name = class_names.get(i, f"class_{i}")
            print(f"    {name:<20} {m:.4f} ({m * 100:.1f}%)")
        print()

    return results


if __name__ == "__main__":
    evaluate()
