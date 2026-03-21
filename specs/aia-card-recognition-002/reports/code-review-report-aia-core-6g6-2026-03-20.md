# Code Review Report — aia-card-recognition-002 / aia-core-6g6

**Date:** 2026-03-20
**Ticket:** aia-core-6g6
**Target:** `scripts/train_model.py`, `test/test_train_model_script.py`, `.gitignore`
**Reviewer:** Scott (automated)

**Task:** T-004 — Create YOLO training script
**Beads ID:** aia-core-6g6

---

## Code Description

`scripts/train_model.py` is a CLI training script that fine-tunes a YOLOv8 model on the Roboflow Playing Cards dataset. It uses `argparse` to accept hyperparameter overrides (epochs, batch size, image size, base model, data config), delegates to the `ultralytics.YOLO` API for training and validation, and prints mAP@50 and mAP@50-95 metrics to stdout. The test suite (`test/test_train_model_script.py`) covers script existence, CLI argument parsing with defaults and custom values, YOLO integration via mocking, and the `.gitignore` entry for `runs/`.

---

## Summary

| Severity | Count |
|---|---|
| CRITICAL | 0 |
| HIGH | 0 |
| MEDIUM | 1 |
| LOW | 1 |
| **Total Findings** | **2** |

---

## Acceptance Criteria Verification

| AC # | Criterion | Status | Evidence | Notes |
|---|---|---|---|---|
| 1 | `scripts/train_model.py` exists and is runnable | SATISFIED | `test_script_exists`, `test_script_is_valid_python`, `test_script_has_main_guard` — all pass. Script has shebang, `__main__` guard, and valid Python syntax. | — |
| 2 | Accepts CLI args: `--epochs` (50), `--batch` (16), `--imgsz` (640), `--model` (yolov8n.pt), `--data` (data/cards/data.yaml) | SATISFIED | `TestTrainScriptCLIArgs` — 10 tests verify all 5 defaults and custom overrides. `parse_args([])` returns exact default values. | — |
| 3 | Calls YOLO train with specified params, saves to `runs/card_detector/` | PARTIAL | `test_train_calls_yolo_train` verifies `model.train()` is called with correct params including `project='runs/card_detector'`. However, the spec calls for `project='runs', name='card_detector'`. See MEDIUM finding. | Output lands under `runs/card_detector/train/` instead of `runs/card_detector/` directly. |
| 4 | Prints validation mAP@50 and mAP@50-95 after training | SATISFIED | `test_train_prints_map_metrics` asserts `mAP@50`, `0.85`, `mAP@50-95`, and `0.60` appear in captured stdout. Implementation at lines 60–63 formats both metrics to 4 decimal places. | — |
| 5 | `runs/` added to `.gitignore` | SATISFIED | `test_gitignore_contains_runs` verifies the entry. `.gitignore` contains `runs/` under a `# Training runs` comment. | — |

---

## Findings

### [MEDIUM] Output path convention differs from spec — missing `name` parameter

**File:** `scripts/train_model.py`
**Line(s):** 49–54
**Category:** correctness

**Problem:**
The `model.train()` call uses `project='runs/card_detector'` without a `name` parameter. YOLO's default behavior appends an auto-generated run name (`train`, `train2`, etc.) under the project directory. This means weights are saved to `runs/card_detector/train/weights/best.pt` instead of `runs/card_detector/weights/best.pt`.

The spec (T-004 AC-3) explicitly states `project='runs', name='card_detector'`, and the downstream task T-005 AC-2 expects best weights at `runs/card_detector/weights/best.pt`. The current path convention will break that expectation.

**Code:**
```python
model.train(
    data=args.data,
    epochs=args.epochs,
    batch=args.batch,
    imgsz=args.imgsz,
    project='runs/card_detector',
)
```

**Suggested Fix:**
```python
model.train(
    data=args.data,
    epochs=args.epochs,
    batch=args.batch,
    imgsz=args.imgsz,
    project='runs',
    name='card_detector',
)
```

**Impact:** T-005 (Train YOLOv8 model on card dataset) will need to account for the extra subdirectory, or this script needs updating before training begins. The test `test_train_calls_yolo_train` also needs a corresponding update.

---

### [LOW] Test imports training script via `sys.path` manipulation

**File:** `test/test_train_model_script.py`
**Line(s):** 39–44
**Category:** convention

**Problem:**
The test imports `train_model` by inserting `SCRIPTS_DIR` into `sys.path` at index 0, then manually removes it and pops the module from `sys.modules`. While this is a common pattern for testing standalone scripts, it's fragile — if a test fails mid-fixture, the cleanup in `finally` runs but `sys.modules.pop` in the yield-based fixture may not. The fixture is a function-scoped `pytest.fixture` returning the function, which is fine, but the `autouse` fixture in `TestTrainScriptSmokeTest` uses a different pattern (yield + manual cleanup) that could leave stale module state on test failure.

**Code:**
```python
@pytest.fixture
def parse_args(self):
    sys.path.insert(0, SCRIPTS_DIR)
    try:
        import train_model
        return train_model.parse_args
    finally:
        sys.path.pop(0)
        sys.modules.pop('train_model', None)
```

**Suggested Fix:**
This is acceptable for testing standalone scripts outside the package. Consider using `importlib.import_module` with a dedicated helper if the pattern is reused across the project. No change required unless test instability is observed.

**Impact:** Minimal. Tests pass reliably in current state. Only a concern if future tests in the same session import conflicting modules.

---

## Positives

- **Clean, minimal script** — 67 lines with clear separation between argument parsing (`parse_args`) and training logic (`train`). The `argv` parameter on `parse_args` enables direct testing without subprocess overhead.
- **Thorough test coverage** — 18 tests across 5 test classes, one per AC. Defaults and custom values tested independently. Mock-based smoke test verifies the full train→val→print pipeline without requiring a GPU or dataset.
- **Good docstring and usage examples** — The module docstring provides copy-paste-ready invocations.
- **Shebang line present** — `#!/usr/bin/env python3` allows direct execution.

---

## Overall Assessment

The training script is well-structured, minimal, and thoroughly tested. All 5 acceptance criteria are substantially met, with one MEDIUM finding: the `project`/`name` parameter convention differs from the spec and will cause the downstream T-005 task to find weights at a different path than expected (`runs/card_detector/train/weights/best.pt` vs `runs/card_detector/weights/best.pt`). This should be corrected before T-005 begins.

**Verdict:** Clean — 0 CRITICAL, 0 HIGH findings. Fix the MEDIUM finding before starting T-005.
