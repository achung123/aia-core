#!/usr/bin/env python3
"""Download the Playing Cards dataset from Roboflow Universe.

Dataset: "Playing Cards" by Augmented Startups
URL: https://universe.roboflow.com/augmented-startups/playing-cards-ow27d
Format: YOLOv8

Prerequisites:
    pip install roboflow
    # Authenticate via: roboflow login  (or set ROBOFLOW_API_KEY env var)

Usage:
    python3 scripts/download_dataset.py
"""

import os
import sys


def download_dataset(target_dir: str = "data/cards") -> None:
    """Download the Playing Cards dataset in YOLOv8 format."""
    try:
        from roboflow import Roboflow
    except ImportError:
        print("Error: roboflow package not installed.")
        print("Install it with: pip install roboflow")
        sys.exit(1)

    api_key = os.environ.get("ROBOFLOW_API_KEY")
    if api_key:
        rf = Roboflow(api_key=api_key)
    else:
        # Relies on ~/.roboflow credentials from `roboflow login`
        rf = Roboflow()

    project = rf.workspace("augmented-startups").project("playing-cards-ow27d")
    version = project.version(4)

    print(f"Downloading dataset to {target_dir}/ ...")
    dataset = version.download("yolov8", location=target_dir)
    print(f"Dataset downloaded to: {dataset.location}")
    print("Done.")


if __name__ == "__main__":
    download_dataset()
