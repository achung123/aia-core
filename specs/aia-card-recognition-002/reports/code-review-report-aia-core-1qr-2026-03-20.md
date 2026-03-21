# Code Review Report — aia-card-recognition-002 / aia-core-1qr

**Date:** 2026-03-20
**Ticket:** aia-core-1qr
**Target:** `test/test_card_detection_integration.py`, `test/test_detection_pipeline_e2e.py`, `pyproject.toml`
**Reviewer:** Scott (automated)

**Task:** T-019 — Integration + E2E pipeline tests
**Beads ID:** aia-core-1qr

---

## Code Description

This task adds two test files covering the card detection pipeline at different levels of the testing pyramid. `test/test_card_detection_integration.py` contains 5 integration tests that exercise `YOLOCardDetector` against a real model and test image, gated behind `@pytest.mark.integration` and automatically skipped when no model file is present. `test/test_detection_pipeline_e2e.py` contains 14 E2E tests using a `DeterministicMockDetector` that exercises the full upload → detect → confirm API workflow through FastAPI's `TestClient`, validating bbox population, correction record creation, and hand record persistence in an in-memory SQLite database. The `pyproject.toml` registers the `integration` marker to avoid pytest warnings.

---

## Summary

| Severity | Count |
|---|---|
| CRITICAL | 0 |
| HIGH | 0 |
| MEDIUM | 0 |
| LOW | 2 |
| **Total Findings** | **2** |

---

## Acceptance Criteria Verification

| AC # | Criterion | Status | Evidence | Notes |
|---|---|---|---|---|
| 1 | Integration test in `test/test_card_detection_integration.py` loads `hand.jpg`, runs `YOLOCardDetector.detect()`, verifies output. `@pytest.mark.integration`, skipped without model. | SATISFIED | `test/test_card_detection_integration.py` L25–L81: 5 tests in `TestYOLOCardDetectorIntegration` class, all marked `@pytest.mark.integration`, `skip_no_model` skipif decorator on L17–19 skips when model absent. Tests verify list return, `DetectionResult` instances, valid fields (confidence range, positive bboxes), no `card_position`, and normalized AIA notation. Confirmed skipped in test run (5 skipped). | `test/data/hand.jpg` exists (8141 bytes). Marker registered in `pyproject.toml`. |
| 2 | E2E test in `test/test_detection_pipeline_e2e.py` uses `MockCardDetector`, exercises full upload → detect → confirm → verify workflow. | SATISFIED | `test/test_detection_pipeline_e2e.py` L40–L430: `DeterministicMockDetector` returns 7 fixed `DetectionResult` objects with known values. Four test classes cover upload (2 tests), detect (5 tests), confirm (6 tests), and full pipeline (1 test). Dependency overrides inject mock detector and in-memory DB. All 14 tests pass. | Full pipeline test (`test_full_pipeline`) exercises all three phases sequentially in a single test method. |
| 3 | E2E verifies `CardDetection` rows have populated `bbox_x`, `bbox_y`, `bbox_width`, `bbox_height` (even with mock data). | SATISFIED | `test_detect_card_detections_have_populated_bbox` (L146–L160) queries DB, asserts all 7 `CardDetection` rows have non-null, positive bbox fields. `test_detect_response_includes_bbox_fields` (L162–L170) verifies JSON response. `test_full_pipeline` (L371–L380) also verifies both DB and response bbox fields. | |
| 4 | E2E verifies correction records created when confirmed values differ from detected values. | SATISFIED | `test_corrections_created_when_confirmed_differs` (L295–L313) confirms 2+ corrections with exact detected/corrected value assertions (AS→AH at flop_1, 2H→9C at hole_1). `test_corrections_count_exact` (L315–L327) asserts exactly 2 corrections. `test_no_corrections_when_confirmed_matches_detected` (L279–L293) verifies zero corrections when payload matches. `test_full_pipeline` (L416–L427) verifies 1 correction for flop_1 (AS→AH). | Both positive and negative correction scenarios covered. |
| 5 | All non-integration tests pass without model/GPU. | SATISFIED | `pytest -m "not integration"` run: 933 passed, 5 deselected (integration tests), 0 failures. `pyproject.toml` L46–48 registers the `integration` marker. | No model or GPU present; all non-integration tests including the 14 E2E tests pass cleanly. |

---

## Findings

### [LOW] Unused import: `CardDetector` protocol

**File:** `test/test_detection_pipeline_e2e.py`
**Line(s):** 22
**Category:** convention

**Problem:**
`CardDetector` is imported from `app.services.card_detector` but never referenced in the file. `DeterministicMockDetector` satisfies the protocol structurally (duck typing) without explicitly referencing it.

**Code:**
```python
from app.services.card_detector import CardDetector
```

**Suggested Fix:**
Remove the unused import. If explicit protocol conformance is desired for documentation, add a type annotation: `detector: CardDetector = DeterministicMockDetector()` in the fixture, or use `assert isinstance(DeterministicMockDetector(), CardDetector)` as a protocol check test.

**Impact:** Minor — lint noise only; no functional impact.

---

### [LOW] Windows Zone.Identifier file tracked in git

**File:** `test/data/hand.jpg:Zone.Identifier`
**Line(s):** N/A
**Category:** convention

**Problem:**
A Windows NTFS alternate data stream marker file (`hand.jpg:Zone.Identifier`) is tracked in git. This is a Windows download artifact that has no purpose in the repository. While it exists in the `test/data/` directory (likely committed alongside `hand.jpg`), it's not part of T-019's scope — noting for awareness.

**Suggested Fix:**
Remove from git tracking: `git rm --cached "test/data/hand.jpg:Zone.Identifier"` and add `*:Zone.Identifier` to `.gitignore`. This is cosmetic and can be addressed in a chore task.

**Impact:** None — cosmetic repository hygiene.

---

## Positives

- **Thorough E2E coverage**: The test suite covers the entire upload → detect → confirm workflow with 14 tests organized into logical phases (upload, detect, confirm, full pipeline). Both happy-path and negative scenarios are tested.
- **Well-designed mock**: `DeterministicMockDetector` provides fixed, known values that enable precise assertions on card positions, correction records, and bbox fields without relying on random data.
- **DB-level verification**: Tests don't just check API responses — they query the SQLite database directly to verify `CardDetection` rows, `DetectionCorrection` records, and `ImageUpload` status, providing strong assurance of data persistence.
- **Proper test isolation**: Each test gets fresh tables via the `setup_db` fixture with create/drop-all, and dependency overrides are cleared after each client fixture usage.
- **Correct skip behavior**: Integration tests use a clean `skipif` conditional on model file existence, with a descriptive reason message. The `integration` marker is properly registered in `pyproject.toml`.
- **Both matching and differing correction scenarios**: AC-4 is covered from both sides — tests verify that matching confirmations produce zero corrections AND that differing confirmations produce exactly the right corrections with correct detected/corrected values.

---

## Overall Assessment

T-019 is well-implemented. All 5 acceptance criteria are fully satisfied. The integration tests are properly gated behind the `@pytest.mark.integration` marker and skip gracefully without a model. The E2E tests are comprehensive, covering upload, detection (with bbox verification at both API and DB layers), confirmation (with correction record assertions in both positive and negative cases), and a single full-pipeline flow test. The full non-integration test suite (933 tests) passes cleanly. Two LOW-severity findings were identified — an unused import and a tracked Windows artifact file — neither of which affect correctness or functionality. No CRITICAL or HIGH issues found.
