---
mode: agent
tools:
  - codebase
  - readFile
  - listDirectory
  - search
  - usages
  - createFile
  - runInTerminal
description: Orchestration-loop review — performs a full code review, writes the report to docs/agent/reviews/, and outputs findings inline for Anna to parse.
---

# Goal

Perform a full code review of a just-implemented task and produce two outputs in one pass: a persistent report file in `docs/agent/reviews/` and an inline findings summary in the chat window. This dual-output mode lets Anna persist every loop iteration's review while still parsing findings immediately without reading a file.

# Context

- This prompt is called by Anna during each orchestration cycle. The invocation includes:
  - A **task ID** (T-xxx) or **beads ID** (aia-core-xxx) identifying what was just implemented
  - A **cycle number** (`--cycle N`) indicating which iteration of the loop this is
- The project uses Python 3.12, FastAPI, SQLAlchemy 2.x, Pydantic v2, SQLite
- Structure: `src/app/` (main, routes, database), `src/pydantic_models/`, `test/`
- Conventions: type hints, `Depends` injection, Pydantic schemas, SQLAlchemy ORM, pytest with TestClient
- Linter: Ruff (`ruff.toml`)
- Issue tracker: bd — run `bd show <id> --json` to look up issues
- Specs: `specs/*/spec.md` for stories, `specs/*/tasks.md` for task ACs

# Instructions

1. **Extract metadata:**
   - Record the cycle number `N` and the task/beads ID from the invocation
   - Determine today's date in `YYYY-MM-DD` format for the filename
   - Target filename: `docs/agent/reviews/cycle-<N>-<task-id>-YYYY-MM-DD.md`

2. **Resolve the target:**
   - **Task ID (T-xxx)** → Read `specs/*/tasks.md`, find the matching task, extract its description, dependencies, story ref, and numbered acceptance criteria; identify related source and test files via codebase search
   - **Beads ID (aia-core-xxx)** → Run `bd show <id> --json`; if the description contains a Jean Task ID (T-xxx), also read it from `specs/*/tasks.md`; extract acceptance criteria from whichever source provides them; identify relevant files

3. **Load acceptance criteria** — Record every numbered AC. These will be checked in step 9

4. **Read surrounding code for context** — imports, callers, tests, related modules

5. **Correctness check:**
   - Trace every code path — are edge cases handled?
   - Are return types consistent with type hints and Pydantic models?
   - Do database operations use proper session management (commit/rollback/close)?
   - Are query results validated before use?

6. **Security check:**
   - SQL injection risks (raw queries, string interpolation in filters)
   - Unvalidated user input reaching database or file system
   - Missing authentication/authorization checks on endpoints
   - Information leakage in error responses

7. **Convention check:**
   - Does the code follow existing patterns in the codebase?
   - Are imports organized consistently?
   - Do naming conventions match the rest of the project?
   - Is error handling consistent with other modules?

8. **Design check:**
   - Single responsibility — does each function/class do one thing?
   - Coupling — are modules appropriately decoupled?
   - Is the API surface clean and consistent?

9. **AC mapping** — For each acceptance criterion, determine:
   - **SATISFIED** — implementation fully meets the criterion
   - **PARTIAL** — implementation partially meets it, with gaps noted
   - **NOT SATISFIED** — implementation does not meet the criterion
   - **NOT APPLICABLE** — criterion doesn't relate to the reviewed code

10. **Write the report file:**
    - Create `docs/agent/reviews/` if it does not already exist
    - Write the report to `docs/agent/reviews/cycle-<N>-<task-id>-YYYY-MM-DD.md` using `scott.code-review-report.template.md`
    - Add a **Loop Context** header at the top of the report:
      ```
      **Loop Context:** Cycle N | Task: <task-id> | Epic: <epic-id if known> | Date: YYYY-MM-DD
      ```

11. **Output findings inline:**
    - After writing the file, output all findings to the chat grouped by severity: CRITICAL → HIGH → MEDIUM → LOW
    - Use the same section structure as the report template, rendered inline
    - Include a one-line summary at the top: `**Review summary: N findings (C: x, H: x, M: x, L: x) — report: docs/agent/reviews/cycle-<N>-<task-id>-YYYY-MM-DD.md**`
    - Anna reads this inline output to decide Phase 4 actions; she does not need to open the file

12. **Do NOT commit** — Anna owns the git workflow; Scott does not stage or commit during loop reviews

# Output Format

Two simultaneous outputs:

### Output 1 — File at `docs/agent/reviews/cycle-<N>-<task-id>-YYYY-MM-DD.md`

Follows `scott.code-review-report.template.md` with this additional header block at the top:

```markdown
**Loop Context:** Cycle N | Task: <task-id> | Epic: <epic-id> | Date: YYYY-MM-DD
```

### Output 2 — Inline chat summary

```
**Review summary: N findings (C: x, H: x, M: x, L: x) — report: docs/agent/reviews/cycle-<N>-<task-id>-YYYY-MM-DD.md**

### CRITICAL
- [C-1] <location> — <description> — <suggested fix>

### HIGH
- [H-1] <location> — <description> — <suggested fix>

### MEDIUM
- [M-1] <location> — <description> — <suggested fix>

### LOW
- [L-1] <location> — <description> — <suggested fix>

### AC Verification
| AC | Status | Notes |
|----|--------|-------|
| AC-1 | SATISFIED / PARTIAL / NOT SATISFIED | ... |
```

# Examples

**Input:** `@scott loop-review aia-core-3zn --cycle 1`

**Output (inline):**
```
**Review summary: 2 findings (C: 0, H: 1, M: 1, L: 0) — report: docs/agent/reviews/cycle-1-aia-core-3zn-2026-04-06.md**

### CRITICAL
*(none)*

### HIGH
- [H-1] frontend/src/api/client.js:42 — HTTP errors are silently swallowed; `fetch` rejects only on network failure, not 4xx/5xx — add `if (!res.ok) throw new Error(res.status)` after every fetch call

### MEDIUM
- [M-1] frontend/main.js:3 — Three.js version logged to console on every page load; noisy in production — gate behind a dev-mode flag

### AC Verification
| AC | Status | Notes |
|----|--------|-------|
| AC-1 | SATISFIED | package.json has three and vite |
| AC-2 | SATISFIED | index.html has canvas#three-canvas |
| AC-3 | SATISFIED | npm run dev works at localhost:5173 |
| AC-4 | SATISFIED | npm run build produces dist/ |
| AC-5 | PARTIAL | main.js logs version but not gated by dev mode |
```

**Output (file):** Full report written to `docs/agent/reviews/cycle-1-aia-core-3zn-2026-04-06.md`

# Anti-patterns

- Do NOT skip writing the file — the persistent record in `docs/agent/reviews/` is required every cycle
- Do NOT skip the inline output — Anna cannot function without parsing findings from the chat window
- Do NOT commit, stage, or push anything — Anna owns the git workflow
- Do NOT use file paths or folder paths as targets — loop-review only accepts task IDs or beads IDs
- Do NOT invent a cycle number if `--cycle` was not provided — default to `0` and note it in the report header
