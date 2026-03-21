#!/usr/bin/env python3
"""Fine-tune YOLOv8 on the Playing Cards dataset.

Usage:
    python3 scripts/train_model.py
    python3 scripts/train_model.py --epochs 100 --batch 32 --imgsz 1280
    python3 scripts/train_model.py --model yolov8s.pt --data data/cards/data.yaml
"""

import argparse

from ultralytics import YOLO


def parse_args(argv=None):
    """Parse command-line arguments."""
    parser = argparse.ArgumentParser(
        description='Fine-tune YOLOv8 on the Playing Cards dataset.'
    )
    parser.add_argument(
        '--epochs', type=int, default=50, help='Number of training epochs (default: 50)'
    )
    parser.add_argument(
        '--batch', type=int, default=16, help='Batch size (default: 16)'
    )
    parser.add_argument(
        '--imgsz', type=int, default=640, help='Image size (default: 640)'
    )
    parser.add_argument(
        '--model',
        type=str,
        default='yolov8n.pt',
        help='Base model (default: yolov8n.pt)',
    )
    parser.add_argument(
        '--data',
        type=str,
        default='data/cards/data.yaml',
        help='Path to data.yaml (default: data/cards/data.yaml)',
    )
    return parser.parse_args(argv)


def train(args):
    """Load model, run training, validate, and print metrics."""
    model = YOLO(args.model)

    model.train(
        data=args.data,
        epochs=args.epochs,
        batch=args.batch,
        imgsz=args.imgsz,
        project='runs/card_detector',
    )

    results = model.val()

    map50 = results.results_dict['metrics/mAP50(B)']
    map50_95 = results.results_dict['metrics/mAP50-95(B)']
    print(f'Validation mAP@50:    {map50:.4f}')
    print(f'Validation mAP@50-95: {map50_95:.4f}')


if __name__ == '__main__':
    train(parse_args())
