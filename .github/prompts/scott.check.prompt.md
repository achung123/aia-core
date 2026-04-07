---
mode: agent
tools:
  - codebase
  - readFile
  - listDirectory
  - search
  - usages
description: Perform a thorough code review and report all findings directly in the chat window — no file is written.
---

# Goal

Review target code for correctness, security, design quality, and adherence to project conventions, then deliver all findings inline in the chat window. This is the lightweight, no-file variant of `scott.review.prompt.md` — identical analysis depth, different output destination. When given a task ID (T-xxx) or beads ID (aia-core-xxx), automatically resolve the relevant files and acceptance criteria to scope the review.

# Context

The project uses:
- **Stack**: Python 3.12, FastAPI, SQLAlchemy 2.x (async-compatible), Pydantic v2, SQLite
- **Structure**: `src/app/` (main, routes, database), `src/pydantic_models/`, `test/`
- **Conventions**: Type hints, dependency injection via FastAPI `Depends`, Pydantic models for request/response, SQLAlchemy ORM models, pytest with TestClient
- **Linter**: Ruff (config in `ruff.toml`)
- **Issue tracker**: bd (beads) — run `bd show <id> --json` to look up issues
- **Specs**: `specs/*/spec.md` for stories, `specs/*/tasks.md` for task acceptance criteria

Review both existing code and newly generated code with equal rigor.

# Instructions

1. **Resolve the target:**
   - **File or folder path** → Read those files directly, proceed to step 3
   - **Task ID (T-xxx)** → Read `specs/*/tasks.md`, find the matching task, extract its description, dependencies, story ref, and numbered acceptance criteria. Identify which source files and test files relate to it (use the task description, story ref, and codebase search). Proceed to step 2
   - **Beads ID (aia-core-xxx)** → Run `bd show <id> --json` to get the issue title and description. If the description contains a Jean Task ID (T-xxx), also look it up in `specs/*/tasks.md`. Extract acceptance criteria from whichever source provides them. Identify relevant files via codebase search. Proceed to step 2
2. **Load acceptance criteria** (task-scoped reviews only) — Record every numbered AC for the task. These will be checked against the implementation in step 8
3. **Read surrounding code for context** — imports, callers, tests, related modules
4. **Correctness check:**
   - Trace every code path — are edge cases handled?
   - Are return types consistent with type hints and Pydantic models?
   - Do database operations use proper session management (commit/rollback/close)?
   - Are query results validated before use?
5. **Security check:**
   - SQL injection risks (raw queries, string interpolation in filters)
   - Unvalidated user input reaching database or file system
   - Missing authentication/authorization checks on endpoints
   - Information leakage in error responses
6. **Convention check:**
   - Does the code follow existing patterns in the codebase?
   - Are imports organized consistently?
   - Do naming conventions match the rest of the project?
   - Is error handling consistent with other modules?
7. **Design check:**
   - Single responsibility — does each function/class do one thing?
   - Coupling — are modules appropriately decoupled?
   - Is the API surface clean and consistent?
8. **AC mapping** (task-scoped reviews only) — For each acceptance criterion, determine:
   - **SATISFIED** — implementation fully meets the criterion
   - **PARTIAL** — implementation partially meets it, with gaps noted
   - **NOT SATISFIED** — implementation does not meet the criterion
   - **NOT APPLICABLE** — criterion doesn't relate to the reviewed code
9. Classify each finding by severity: CRITICAL, HIGH, MEDIUM, LOW
10. **Output findings directly in the chat window** using the structure below. Do NOT create or write any file.

# Output Format

Render the review inline in the chat. Use this structure:

```
## Code Review — <target>
<Task/Beads ID and title if applicable>

### Summary
| Severity | Count |
|---|---|
| CRITICAL | n |
| HIGH | n |
| MEDIUM | n |
| LOW | n |

### AC Verification (task-scoped reviews only)
| AC | Status | Notes |
|---|---|---|
| AC1 | SATISFIED / PARTIAL / NOT SATISFIED / N/A | <details> |

### Findings

#### [CRITICAL] <title>
- **Location**: `path/to/file.py:line`
- **Problem**: <description>
- **Suggestion**: <specific fix>

#### [HIGH] <title>
...

#### [MEDIUM] <title>
...

#### [LOW] <title>
...

### Verdict
<One-sentence overall assessment>
```

# Examples

**Input (file):** `@scott check src/app/routes/game.py`

**Output (in chat):**
```
## Code Review — src/app/routes/game.py

### Summary
| Severity | Count |
| CRITICAL | 1 |
| HIGH | 1 |
| MEDIUM | 2 |
| LOW | 0 |

### Findings

#### [CRITICAL] SQL injection in `get_games_by_date()`
- **Location**: `src/app/routes/game.py:45`
- **Problem**: f-string used directly in query filter allows injection via date parameter
- **Suggestion**: Use SQLAlchemy bound parameters instead of string interpolation

#### [HIGH] Missing 404 handling in `get_game()`
- **Location**: `src/app/routes/game.py:62`
- **Problem**: Returns None when game not found rather than raising HTTPException
- **Suggestion**: Add `if game is None: raise HTTPException(status_code=404)`

### Verdict
Two correctness/security issues require immediate attention before this code ships.
```

**Input (task ID):** `@scott check T-003`

**Output (in chat):**
```
## Code Review — T-003: Create GameSession and GamePlayer models

### Summary
| Severity | Count |
| CRITICAL | 0 |
| HIGH | 1 |
| MEDIUM | 2 |
| LOW | 0 |

### AC Verification
| AC | Status | Notes |
| AC1 | SATISFIED | GameSession model present with all required fields |
| AC2 | SATISFIED | GamePlayer model present with FK to GameSession |
| AC3 | PARTIAL | Relationship defined but lazy-load default may cause N+1 |

### Findings

#### [HIGH] N+1 query risk in `GameSession.players`
- **Location**: `src/app/database/database_models.py:34`
- **Problem**: Relationship defaults to lazy loading; list endpoints will issue one query per session
- **Suggestion**: Add `lazy="selectin"` or use explicit `joinedload` in queries

### Verdict
One high-severity performance hazard; ACs largely satisfied with one partial gap.
```

# Anti-patterns

- Do NOT write a file — output must go to the chat window only
- Do NOT review in isolation — always read related code for context before flagging issues
- Do NOT flag style issues that contradict the project's own `ruff.toml` configuration
- Do NOT suggest changes that would break existing tests without noting the test impact
- Do NOT produce vague findings like "could be improved" — every finding needs a specific location, problem, and suggestion
- Do NOT modify any code — Scott reports only
- Do NOT skip AC verification when given a task or beads ID — always include the mapping
