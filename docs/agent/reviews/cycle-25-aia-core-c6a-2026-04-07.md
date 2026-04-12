# Code Review Report — aia-core

**Date:** 2026-04-07
**Target:** `frontend/README.md`
**Reviewer:** Scott (automated)

**Task:** Write frontend README with dev setup and deployment guide
**Beads ID:** aia-core-c6a

---

## Summary

| Severity | Count |
|---|---|
| CRITICAL | 0 |
| HIGH | 1 |
| MEDIUM | 2 |
| LOW | 1 |
| **Total Findings** | **4** |

---

## Acceptance Criteria Verification

| AC # | Criterion | Status | Evidence | Notes |
|---|---|---|---|---|
| AC 1 | Prerequisites include Node.js version (matches `package.json`/engine requirement), npm version | PARTIAL | `frontend/README.md` lines 9–12 | Versions documented and plausible for Vite 8, but `package.json` has no `engines` field — see M2 |
| AC 2 | Covers `npm install`, `npm run dev`, `npm run build` | SATISFIED | README Installation and Development sections; all three scripts confirmed in `frontend/package.json` | — |
| AC 3 | Documents `VITE_API_BASE_URL` (frontend) and `ALLOWED_ORIGINS` (backend) | SATISFIED | README Environment Variables section; defaults verified against `frontend/src/api/client.js` line 1 and `src/app/main.py` line 10 | — |
| AC 4 | Deployment section showing how to mount `frontend/dist/` in FastAPI | PARTIAL | README Deployment section; Python snippet is syntactically correct but see H1 — the existing `@app.get('/')` route in `main.py` silently intercepts all hash-router requests before StaticFiles can serve `index.html` | — |
| AC 5 | "How the 3D scene works" section understandable by a non-frontend developer | SATISFIED | README "How the 3D Scene Works" section; covers all 7 modules with plain-language descriptions | — |
| AC 6 | No factual errors (wrong port, wrong command, wrong file path) | PARTIAL | Most values correct; see H1 (deployment) and M1 (winner glow animation description) | — |

---

## Findings

### [HIGH] Deployment guide omits interaction with existing `@app.get('/')` route

**File:** `frontend/README.md` (Deployment section) / `src/app/main.py`
**Line(s):** README Deployment section; `main.py` line 37
**Category:** correctness

**Problem:**
The README instructs the developer to add:

```python
app.mount("/", StaticFiles(directory="frontend/dist", html=True), name="frontend")
```

and notes that `StaticFiles` must be mounted last. However, `main.py` already registers:

```python
@app.get('/')
def home():
    return {'message': 'Welcome to the All In Analytics Core Backend!'}
```

In FastAPI/Starlette, route handlers take precedence over mounts under the same path. Because the app uses **hash-based routing** (`#/playback`, `#/data`), the browser only ever requests `"/"` from the server — the hash fragment never leaves the client. As a result, every SPA navigation hit would return `{"message": "Welcome to the All In Analytics Core Backend!"}` instead of `index.html`. The `html=True` fallback never fires for `"/"` because it is a known route, not an unknown one.

A developer following the README exactly would produce a deployment where the frontend is **completely inaccessible** from the browser root.

**Suggested Fix:**
The Deployment section should add a note such as:

> **Important:** The existing `@app.get('/')` health-check route in `main.py` must be removed (or moved to `/api/`) before mounting StaticFiles at `"/"`. The hash-based router means all browser navigation arrives as `GET /`, which will be handled by the route handler — not the StaticFiles fallback — if the route remains.

**Impact:** A developer following this guide would ship a broken deployment. The frontend would never load from `"/"`.

---

### [MEDIUM] "Brief glow animation" description does not match implementation

**File:** `frontend/README.md` (How the 3D Scene Works → Hole cards section) and `frontend/src/scenes/holeCards.js`
**Line(s):** README "Hole cards" paragraph; `holeCards.js` lines 97–103 (`glowWinnerCards`) and lines 176–179 (call site)
**Category:** correctness

**Problem:**
The README states:

> When a hand is marked as a winner, a brief glow animation fires on those meshes.

The actual implementation delivers the glow via a one-shot `setTimeout(350ms)` delay (to allow the flip animation to finish), then calls `glowWinnerCards()`, which **statically sets** `emissiveIntensity = 0.4` on the front face material. There is no time-based fade, pulse, or any animated transition in `glowWinnerCards()`. The glow persists indefinitely until `goToPreFlop()` resets the hand. "Brief glow animation" implies a fading effect that does not exist in the code.

**Suggested Fix:**
Change the description to:

> When a hand is marked as a winner, an emissive gold highlight is applied to those meshes after the flip animation completes (350 ms delay).

**Impact:** Misleads a developer looking to extend or debug the winner highlight, who would expect to find a looping or fading animation rather than a static material property change.

---

### [MEDIUM] Node.js prerequisite versions are unanchored — `package.json` has no `engines` field

**File:** `frontend/README.md` lines 9–10; `frontend/package.json`
**Line(s):** README Prerequisites table
**Category:** convention

**Problem:**
The README Prerequisites table states:

| Tool | Version |
|------|---------|
| Node.js | `^20.19.0` or `>=22.12.0` (required by Vite 8) |
| npm | `>=10` |

Acceptance criterion AC 1 explicitly asks that prerequisites "match actual `package.json`/engine requirement." The `package.json` contains no `engines` field:

```json
{
  "devDependencies": { "vite": "^8.0.4" },
  "dependencies":   { "three": "^0.183.2" }
}
```

There is no project-level source of truth to verify these versions against. If Vite 8's actual Node.js requirement differs from what is documented, a reader has no way to detect the discrepancy, and `npm install` / `npm run dev` will not warn them.

**Suggested Fix:**
Add an `engines` field to `package.json` matching the documented requirements:

```json
"engines": {
  "node": "^20.19.0 || >=22.12.0",
  "npm": ">=10"
}
```

**Impact:** Developers on an incompatible Node.js version will get obscure runtime errors rather than a clear version mismatch warning. The README's prerequisites cannot be machine-validated without this field.

---

### [LOW] npm version parenthetical is slightly imprecise

**File:** `frontend/README.md` line 10
**Line(s):** Prerequisites table, npm row
**Category:** correctness

**Problem:**
The README states `>=10` for npm with the clarification "(bundled with Node.js 22)". npm 10 ships with Node.js **20** and later — it is not exclusive to Node.js 22. A developer on Node.js 20.x would already have npm 10 and might misread this note as meaning they need to upgrade to Node.js 22.

**Suggested Fix:**
Change parenthetical to "(bundled with Node.js 20 and later)" or simply drop the parenthetical since the `node` row already conveys the minimum version.

**Impact:** Cosmetic confusion; no functional consequence since the Node.js version table row is clear.

---

## Positives

- **Comprehensive coverage:** Every `package.json` script (`dev`, `build`, `preview`) is documented; nothing is omitted.
- **Accurate technical values:** Port 5173 (verified against `vite.config.js`), camera position `y=8, z=5` (verified against `table.js`), card geometry `0.7 × 1.0 × 0.02` (verified against `cards.js`), community card animation `OFF_TABLE_Z=5` / `ANIM_DURATION=500ms` (verified against `communityCards.js`), chip stack disc count `5` and animation `400ms` (verified against `chipStacks.js`), flip duration `300ms` (verified against `cards.js`), and `VITE_API_BASE_URL` code snippet (exact match to `client.js` line 1`) are all verified correct.
- **Environment variable documentation is thorough:** Both the frontend build-time variable and the backend runtime variable are explained with their defaults, purpose, and the important note that Vite inlines `VITE_*` variables at build time (requiring a rebuild to change them).
- **Security note correctly preserved:** The `ALLOWED_ORIGINS` documentation accurately reflects `main.py`'s wildcard prohibition (`if '*' in _allowed_origins: raise ValueError`).
- **Plain-language 3D scene explanation is genuinely useful:** The module-by-module walkthrough covers renderer setup, geometry details, texture generation, animation durations, and the seat-label 3D-to-2D projection — all of which are accurate and match the source files.

---

## Overall Assessment

The README is well-structured and the vast majority of technical claims are accurate. The single HIGH finding is the most important to address before this document is promoted: applying the deployment snippet to the existing `main.py` would result in a broken frontend deployment because the hash-based router conflict with `@app.get('/')` is not mentioned. The two MEDIUM findings (static glow described as an animation, and unanchored Node.js prerequisites) reduce the README's reliability as a reference document but do not cause immediate breakage. The LOW finding is cosmetic.

**Commit gate: NOT CLEAN — 1 HIGH finding present. Do not commit.**

---

FINDINGS SUMMARY: C:0 H:1 M:2 L:1
