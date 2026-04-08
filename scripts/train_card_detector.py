"""Fine-tune YOLOv8 card detector on close-up card images.

This script generates a close-up training dataset by cropping around individual
cards in the existing training data (data/cards/), then fine-tunes the model
to handle photos where cards fill most of the frame.

Usage:
    uv run python scripts/train_card_detector.py
    uv run python scripts/train_card_detector.py --epochs 50 --base-model models/best.pt
    uv run python scripts/train_card_detector.py --skip-gen   # reuse existing dataset

Output:
    models/best_closeup.pt  — fine-tuned weights ready for use
"""

from __future__ import annotations

import argparse
import csv
import os
import random
import shutil
import subprocess

import torch
from ultralytics import YOLO

# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

parser = argparse.ArgumentParser(description='Fine-tune card detector on close-ups')
parser.add_argument('--base-model', default='models/best.pt', help='Starting weights')
parser.add_argument(
    '--out-model', default='models/best_closeup.pt', help='Output weights path'
)
parser.add_argument('--epochs', type=int, default=50, help='Training epochs')
parser.add_argument('--batch', type=int, default=8, help='Batch size')
parser.add_argument(
    '--closeup-count',
    type=int,
    default=4000,
    help='Number of close-up crops to generate',
)
parser.add_argument(
    '--orig-count',
    type=int,
    default=1500,
    help='Original images to mix in (prevents forgetting)',
)
parser.add_argument(
    '--dataset-dir',
    default='/tmp/finetune_closeup',
    help='Where to write the generated dataset',
)
parser.add_argument(
    '--run-dir', default='/tmp/finetune_run', help='Training output directory'
)
parser.add_argument(
    '--skip-gen', action='store_true', help='Skip dataset generation (reuse existing)'
)
parser.add_argument('--device', default='0', help='Device: 0=GPU, cpu=CPU')
parser.add_argument(
    '--tensorboard',
    action='store_true',
    help='Launch TensorBoard on localhost:6006 after training',
)
args = parser.parse_args()

# ---------------------------------------------------------------------------
# Dataset generation
# ---------------------------------------------------------------------------

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LABELS_DIR = os.path.join(REPO_ROOT, 'data/cards/train/labels')
IMAGES_DIR = os.path.join(REPO_ROOT, 'data/cards/train/images')
DATA_YAML = os.path.join(REPO_ROOT, 'data/cards_test2/data.yaml')

if not args.skip_gen:
    import yaml
    from PIL import Image

    with open(DATA_YAML) as f:
        cfg = yaml.safe_load(f)
    names = cfg['names']

    out = args.dataset_dir
    for split in ['train', 'val']:
        os.makedirs(f'{out}/{split}/images', exist_ok=True)
        os.makedirs(f'{out}/{split}/labels', exist_ok=True)

    random.seed(123)
    all_labels = [f for f in os.listdir(LABELS_DIR) if f.endswith('.txt')]
    random.shuffle(all_labels)

    count = 0

    print(f'Generating {args.closeup_count} close-up crops...')
    for label_file in all_labels:
        if count >= args.closeup_count:
            break

        img_name = label_file.replace('.txt', '.jpg')
        img_path = os.path.join(IMAGES_DIR, img_name)
        if not os.path.exists(img_path):
            continue

        img = Image.open(img_path)
        W, H = img.size

        with open(os.path.join(LABELS_DIR, label_file)) as fp:
            cards = [
                (int(p[0]), float(p[1]), float(p[2]), float(p[3]), float(p[4]))
                for line in fp
                for p in [line.strip().split()]
            ]

        if not cards:
            img.close()
            continue

        for _cls, cx, cy, bw, bh in cards:
            if count >= args.closeup_count:
                break

            # Card should fill 15-50% of the crop frame
            target_ratio = random.uniform(0.15, 0.50)
            scale = max(bw, bh) / target_ratio
            crop_w = scale * random.uniform(0.85, 1.15)
            crop_h = scale * random.uniform(0.85, 1.15)

            offset_x = random.uniform(-crop_w * 0.2, crop_w * 0.2)
            offset_y = random.uniform(-crop_h * 0.2, crop_h * 0.2)

            x1n = max(0, cx + offset_x - crop_w / 2)
            y1n = max(0, cy + offset_y - crop_h / 2)
            x2n = min(1, x1n + crop_w)
            y2n = min(1, y1n + crop_h)

            if x2n - x1n < 0.05 or y2n - y1n < 0.05:
                continue

            x1, y1 = int(x1n * W), int(y1n * H)
            x2, y2 = int(x2n * W), int(y2n * H)

            crop = img.crop((x1, y1, x2, y2))
            if min(crop.size) < 32:
                continue
            crop = crop.resize((640, 640), Image.LANCZOS)

            new_labels = []
            crop_wn = x2n - x1n
            crop_hn = y2n - y1n
            for c2, cx2, cy2, bw2, bh2 in cards:
                new_cx = (cx2 - x1n) / crop_wn
                new_cy = (cy2 - y1n) / crop_hn
                new_bw = bw2 / crop_wn
                new_bh = bh2 / crop_hn
                if (
                    0.05 < new_cx < 0.95
                    and 0.05 < new_cy < 0.95
                    and 0.01 < new_bw < 0.90
                    and 0.01 < new_bh < 0.90
                ):
                    hw, hh = new_bw / 2, new_bh / 2
                    new_cx = max(hw, min(1 - hw, new_cx))
                    new_cy = max(hh, min(1 - hh, new_cy))
                    new_labels.append(
                        f'{c2} {new_cx:.6f} {new_cy:.6f} {new_bw:.6f} {new_bh:.6f}'
                    )

            if not new_labels:
                continue

            split = 'train' if random.random() < 0.9 else 'val'
            fname = f'closeup_{count:05d}'
            crop.save(f'{out}/{split}/images/{fname}.jpg')
            with open(f'{out}/{split}/labels/{fname}.txt', 'w') as fp:
                fp.write('\n'.join(new_labels) + '\n')
            crop.close()
            count += 1

        img.close()

    print(f'Generated {count} close-up images')

    # Mix in original images to prevent catastrophic forgetting
    orig_files = random.sample(
        os.listdir(IMAGES_DIR), min(args.orig_count, len(os.listdir(IMAGES_DIR)))
    )
    orig_added = 0
    for f in orig_files:
        lf = f.replace('.jpg', '.txt')
        lp = os.path.join(LABELS_DIR, lf)
        if os.path.exists(lp):
            split = 'train' if random.random() < 0.9 else 'val'
            shutil.copy(os.path.join(IMAGES_DIR, f), f'{out}/{split}/images/{f}')
            shutil.copy(lp, f'{out}/{split}/labels/{lf}')
            orig_added += 1
    print(f'Added {orig_added} original images (catastrophic forgetting prevention)')

    # Write data.yaml
    data_cfg = {
        'path': out,
        'train': 'train/images',
        'val': 'val/images',
        'nc': 52,
        'names': names,
    }
    with open(f'{out}/data.yaml', 'w') as f:
        yaml.dump(data_cfg, f)

    n_train = len(os.listdir(f'{out}/train/images'))
    n_val = len(os.listdir(f'{out}/val/images'))
    print(f'Dataset ready: {n_train} train, {n_val} val')

else:
    print(f'Skipping generation, reusing dataset at {args.dataset_dir}')

# ---------------------------------------------------------------------------
# Training
# ---------------------------------------------------------------------------

device = args.device
if device == '0' and not torch.cuda.is_available():
    print('WARNING: GPU not available, falling back to CPU')
    device = 'cpu'

print(
    f'\nTraining on: {"GPU: " + torch.cuda.get_device_name(0) if device != "cpu" else "CPU"}'
)
print(f'Base model:  {args.base_model}')
print(f'Epochs:      {args.epochs}')
print(f'Batch size:  {args.batch}')

model = YOLO(args.base_model)

model.train(
    data=f'{args.dataset_dir}/data.yaml',
    epochs=args.epochs,
    patience=20,
    imgsz=640,
    batch=args.batch,
    device=device,
    freeze=10,  # freeze backbone, only train detection head
    lr0=0.001,
    lrf=0.01,
    mosaic=0.5,
    scale=0.5,
    project=args.run_dir,
    name='closeup_ft',
    verbose=True,
    workers=2,
)

# Copy best weights to models/
best_src = os.path.join(args.run_dir, 'closeup_ft', 'weights', 'best.pt')
best_dst = os.path.join(REPO_ROOT, args.out_model)
os.makedirs(os.path.dirname(best_dst), exist_ok=True)
shutil.copy(best_src, best_dst)
print(f'\n=== Done! Fine-tuned weights saved to {args.out_model} ===')

# Quick eval on test images
print('\nQuick eval on test images:')
ft_model = YOLO(best_dst)
for img_path in ['test/data/AcetoFive.JPG', 'test/data/ah-2h.jpg']:
    full = os.path.join(REPO_ROOT, img_path)
    if not os.path.exists(full):
        continue
    results = ft_model(full, conf=0.20, imgsz=640, verbose=False)
    dets = sorted(
        [(r.names[int(b.cls[0])], float(b.conf[0])) for r in results for b in r.boxes],
        key=lambda x: -x[1],
    )
    det_str = ', '.join(f'{label}:{conf:.3f}' for label, conf in dets[:7])
    print(f'  {os.path.basename(img_path)}: {det_str or "nothing"}')

# ---------------------------------------------------------------------------
# TensorBoard — convert results.csv to event files and optionally launch
# ---------------------------------------------------------------------------

run_out = os.path.join(args.run_dir, 'closeup_ft')
results_csv = os.path.join(run_out, 'results.csv')
tb_log_dir = os.path.join(run_out, 'tensorboard')

if os.path.exists(results_csv):
    from torch.utils.tensorboard import SummaryWriter

    writer = SummaryWriter(tb_log_dir)
    with open(results_csv) as f:
        for row in csv.DictReader(f):
            epoch = int(float(row['epoch']))
            writer.add_scalar('Loss/train_box', float(row['train/box_loss']), epoch)
            writer.add_scalar('Loss/train_cls', float(row['train/cls_loss']), epoch)
            writer.add_scalar('Loss/train_dfl', float(row['train/dfl_loss']), epoch)
            writer.add_scalar('Loss/val_box', float(row['val/box_loss']), epoch)
            writer.add_scalar('Loss/val_cls', float(row['val/cls_loss']), epoch)
            writer.add_scalar('Loss/val_dfl', float(row['val/dfl_loss']), epoch)
            writer.add_scalar('Metrics/mAP50', float(row['metrics/mAP50(B)']), epoch)
            writer.add_scalar(
                'Metrics/mAP50-95', float(row['metrics/mAP50-95(B)']), epoch
            )
            writer.add_scalar(
                'Metrics/precision', float(row['metrics/precision(B)']), epoch
            )
            writer.add_scalar('Metrics/recall', float(row['metrics/recall(B)']), epoch)
            writer.add_scalar('LR', float(row['lr/pg0']), epoch)
    writer.close()
    print(f'\nTensorBoard logs written to {tb_log_dir}')
    print(f'  To view: uv run tensorboard --logdir {tb_log_dir} --port 6006')

if args.tensorboard:
    print('\nLaunching TensorBoard on http://localhost:6006 ...')
    subprocess.run(
        ['uv', 'run', 'tensorboard', '--logdir', tb_log_dir, '--port', '6006']
    )
