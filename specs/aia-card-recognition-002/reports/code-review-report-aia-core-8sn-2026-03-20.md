# Code Review Report — aia-card-recognition-002 / aia-core-8sn

**Date:** 2026-03-20
**Ticket:** aia-core-8sn
**Target:** `scripts/download_dataset.py`, `data/cards/data.yaml`, `data/cards/README.md`, `.gitignore`, `test/test_dataset_setup.py`
**Reviewer:** Scott (automated)

**Task:** T-002 — Source and prepare card detection dataset
**Beads ID:** aia-core-8sn

---

## Code Description

This changeset implements the dataset acquisition and preparation step for the card recognition pipeline. It adds a download script (`scripts/download_dataset.py`) that uses the Roboflow Python SDK to fetch the "Playing Cards" dataset in YOLOv8 format, a YOLO configuration file (`data/cards/data.yaml`) defining 52 card classes with train/val/test split paths, a documentation file (`data/cards/README.md`) recording the dataset provenance and statistics, a `.gitignore` entry for the `data/` directory, and a comprehensive test suite (`test/test_dataset_setup.py`) verifying all acceptance criteria.

---

## Summary

| Severity | Count |
|---|---|
| CRITICAL | 0 |
| HIGH | 0 |
| MEDIUM | 1 |
| LOW | 4 |
| **Total Findings** | **5** |

---

## Acceptance Criteria Verification

| AC # | Criterion | Status | Evidence | Notes |
|---|---|---|---|---|
| 1 | Dataset at `data/cards/` with `train/`, `val/`, `test/` subdirs each containing `images/` and `labels/` | PARTIAL | `data/cards/data.yaml` lines 3-4; `data/cards/README.md` directory structure section; `test/test_dataset_setup.py::TestDataYaml::test_split_paths` | Validation split directory is named `valid/` (Roboflow convention) not `val/` as specified. See finding [MEDIUM-1]. Config files are committed; actual image/label directories materialize after running the download script. |
| 2 | 52 classes (one per card) | SATISFIED | `data/cards/data.yaml` line 6 (`nc: 52`) and lines 7-58 (52 names); `test/test_dataset_setup.py::TestDataYaml::test_nc_is_52`, `test_names_has_52_entries` | All 52 standard playing cards represented. |
| 3 | `data/cards/data.yaml` with `path`, `train`, `val`, `test`, `nc` (52), and `names` | SATISFIED | `data/cards/data.yaml` (all 6 required keys present); `test/test_dataset_setup.py::TestDataYaml::test_data_yaml_has_required_keys` | All required keys present with correct values. |
| 4 | `data/cards/README.md` documents source URL, license, image count, annotation count, class distribution | SATISFIED | `data/cards/README.md` — Source section (URL), License section (CC BY 4.0), Statistics section (~24,000 images, ~24,000 annotations), Class Distribution table; `test/test_dataset_setup.py::TestDataReadme` (4 tests) | Annotation count test could be more specific — see finding [LOW-3]. |
| 5 | `data/` added to `.gitignore` | SATISFIED | `.gitignore` line 6; `test/test_dataset_setup.py::TestGitignore::test_gitignore_contains_data` | Confirmed present. Config files (`data.yaml`, `README.md`) are force-tracked despite the ignore rule. |

---

## Findings

### [MEDIUM-1] Validation split directory named `valid/` instead of `val/`

**File:** `data/cards/data.yaml`
**Line(s):** 3
**Category:** correctness

**Problem:**
AC-1 specifies subdirectories `train/`, `val/`, and `test/`. The `data.yaml` configuration uses `valid/images` for the validation path, and the README documents the directory as `valid/`. The Roboflow SDK creates a `valid/` directory by convention, not `val/`. Downstream tasks (T-003, T-004) referencing this dataset will need to use `valid/` not `val/`.

**Code:**
```yaml
val: valid/images
```

**Suggested Fix:**
Either rename the directory to `val/` in the download script's post-processing (e.g., `os.rename("data/cards/valid", "data/cards/val")`) and update `data.yaml` accordingly, or update the AC to reflect Roboflow's `valid/` convention. The latter is pragmatically simpler since changing the convention could break Roboflow's internal references.

**Impact:** Downstream tasks and documentation reference `val/` vs `valid/` inconsistently. Low runtime risk since `data.yaml` already points to the correct `valid/` path.

---

### [LOW-1] Download script hardcodes dataset version

**File:** `scripts/download_dataset.py`
**Line(s):** 37
**Category:** design

**Problem:**
The dataset version is hardcoded as `project.version(4)`. If the dataset is updated on Roboflow Universe, the script would need manual editing rather than accepting the version as a parameter.

**Code:**
```python
version = project.version(4)
```

**Suggested Fix:**
Accept an optional `--version` CLI argument (defaulting to 4) or pass it as a parameter to `download_dataset()`:
```python
def download_dataset(target_dir: str = "data/cards", version: int = 4) -> None:
```

**Impact:** Minor maintainability concern. No immediate functional impact since version 4 is the current target.

---

### [LOW-2] No post-download integrity verification

**File:** `scripts/download_dataset.py`
**Line(s):** 39-41
**Category:** correctness

**Problem:**
After downloading, the script does not verify that the expected directory structure (`train/images/`, `train/labels/`, `valid/images/`, etc.) was actually created, nor does it check that `data.yaml` was written. A partial or failed download could go unnoticed.

**Code:**
```python
dataset = version.download("yolov8", location=target_dir)
print(f"Dataset downloaded to: {dataset.location}")
print("Done.")
```

**Suggested Fix:**
Add a basic sanity check after download:
```python
for split in ("train", "valid", "test"):
    for subdir in ("images", "labels"):
        expected = os.path.join(target_dir, split, subdir)
        if not os.path.isdir(expected):
            print(f"WARNING: Expected directory not found: {expected}")
```

**Impact:** Without verification, a user might not realize the download was incomplete until training fails later.

---

### [LOW-3] Test for annotation count documentation is weak

**File:** `test/test_dataset_setup.py`
**Line(s):** 94-96
**Category:** correctness

**Problem:**
AC-4 requires the README to document "number of annotations." The test `test_documents_image_count` only checks that the word "image" appears in the README — it doesn't verify that annotation count is also documented. A README that mentions images but omits annotation count would still pass this test.

**Code:**
```python
def test_documents_image_count(self, readme_content):
    assert "image" in readme_content.lower(), "README must mention image count"
```

**Suggested Fix:**
Add a dedicated test for annotation documentation:
```python
def test_documents_annotation_count(self, readme_content):
    assert "annotation" in readme_content.lower(), "README must mention annotation count"
```

**Impact:** Weak coverage of AC-4. The README does document annotations (~24,000 bounding boxes), so this is a test gap rather than a documentation gap.

---

### [LOW-4] Config files force-tracked inside gitignored directory

**File:** `.gitignore`
**Line(s):** 6
**Category:** convention

**Problem:**
`data/` is gitignored but `data/cards/data.yaml` and `data/cards/README.md` are force-tracked (confirmed via `git ls-files data/`). This works but may confuse contributors who expect the entire `data/` directory to be untracked. New files added under `data/` will be silently ignored unless force-added.

**Suggested Fix:**
Consider using more specific gitignore patterns that exclude only the large dataset artifacts:
```gitignore
data/cards/train/
data/cards/valid/
data/cards/test/
```
Or add a comment in `.gitignore` explaining the force-tracked files:
```gitignore
# Dataset artifacts (data.yaml and README.md are force-tracked)
data/
```

**Impact:** Minor contributor confusion. No functional impact.

---

## Positives

- **Clean, well-documented download script** — includes docstring with usage instructions, prerequisites, and handles both API key and interactive authentication
- **Thorough test suite** — 13 tests across 4 test classes, covering all 5 acceptance criteria with clear class names mapping to ACs
- **Comprehensive README** — class distribution table, directory structure diagram, download instructions, and all required metadata
- **Correct YOLO configuration** — `data.yaml` is properly structured for YOLOv8 consumption with all 52 classes listed

---

## Overall Assessment

The implementation is solid and well-structured. All acceptance criteria are satisfied or partially satisfied, with the only deviation being the `valid/` vs `val/` directory naming (a Roboflow SDK convention). There are zero critical or high-severity findings. The five findings are minor design and convention improvements. The test suite is comprehensive and all 13 tests pass.

**Recommendation:** Accept with minor follow-up on the `valid/` directory naming convention (MEDIUM-1) — either update the AC to match Roboflow's convention or add a post-download rename step. The LOW findings can be addressed opportunistically.
