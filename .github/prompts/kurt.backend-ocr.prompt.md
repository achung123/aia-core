---
mode: agent
tools:
  - codebase
  - readFile
  - listDirectory
  - search
  - createFile
  - editFiles
  - usages
  - fetch
description: Document the YOLO-based playing card detection pipeline — model architecture, training workflow, inference API, detection-to-confirmation flow, and model versioning.
---

## Goal

Produce clear, grounded documentation for the OCR/ML card detection system — covering the YOLO model, training pipeline, inference endpoints, detection confirmation workflow, and model file management. Output uses prose to explain ML concepts, tables for model metrics and configuration, and mermaid diagrams for the detection pipeline flow.

---

## Context

The AIA card detection system:
- **Model files:** `models/` — trained YOLO `.pt` weights (best.pt, best_closeup.pt, etc.)
- **Training scripts:** `scripts/train_card_detector.py`
- **Training data:** `data/cards/`, `data/cards_test2/`
- **Training runs:** `runs/detect/` — YOLO training output
- **Detection API:** endpoints in `src/app/routes/` for card detection and confirmation
- **Pydantic schemas:** detection request/response models in `src/pydantic_models/`
- **Root model:** `yolo26n.pt` — base model

The pipeline: camera/upload → YOLO inference → detected cards → dealer confirmation → persist to database. Documentation must explain both the ML pipeline (training, metrics, model selection) and the API integration (how detection results flow through the system).

---

## Instructions

1. **Read model files and scripts** — scan `models/`, `scripts/train_card_detector.py`, `runs/detect/`
2. **Read detection routes** — find and read the card detection and confirmation endpoints in `src/app/routes/`
3. **Read detection Pydantic schemas** — load request/response models for detection endpoints
4. **Read detection tests** — scan `test/` for detection-related test files
5. **Read the mermaid instructions** — load `.github/instructions/kurt-mermaid.instructions.md`
6. **Write the document** combining:
   - **Prose:** Explain YOLO architecture basics, why it's used for card detection, the training approach, and how confidence thresholds work
   - **Tables:** Model inventory (file, purpose, training data, metrics if available), detection endpoint reference, training hyperparameters
   - **Mermaid flowchart:** Full detection pipeline — image input → YOLO inference → bounding boxes → card classification → confidence filtering → confirmation → database persist
   - **Mermaid sequence diagram:** API flow for detection request → response → confirmation → persist
   - **Code references:** Training script parameters, model loading, inference functions, API handlers
7. **Place the file** at `docs/backend/ocr-card-detection.md` unless directed otherwise

---

## Output Format

A markdown file with:
- Metadata table
- Overview of the card detection system
- Model inventory table (file, architecture, purpose, dataset)
- Training pipeline section (prose + config table)
- Detection pipeline diagram (mermaid flowchart)
- API integration section (endpoint table + sequence diagram)
- Confirmation workflow section (prose + diagram)
- Source file references

---

## Example

**Input:**
```
@kurt backend-ocr detection pipeline
```

**Expected output:**
A file at `docs/backend/ocr-card-detection.md` containing:
- Prose: YOLO26n architecture, why real-time detection matters for poker
- Model table: best.pt (general), best_closeup.pt (close-up shots), yolo26n.pt (base)
- Training section: dataset structure, augmentation, hyperparameters
- Flowchart: image → YOLO → bounding boxes → card labels → confidence filter → output
- Sequence diagram: frontend uploads image → API calls detector → returns detections → dealer confirms → API persists
- References to `scripts/train_card_detector.py`, `models/`, detection routes

---

## Anti-patterns

- **Never** fabricate model metrics or accuracy numbers — only report what's in training output
- **Never** describe model architecture without checking the actual model file and training script
- **Never** skip the detection pipeline flowchart — it's the core visual for this domain
- **Never** document training parameters without reading the training script
- **Never** conflate the ML inference step with the API confirmation step — they are distinct stages
