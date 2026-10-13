---
mode: agent
tools: []
description: "DEPRECATED — replaced by layer-specific prompts. See kurt.backend-db, kurt.backend-api, kurt.backend-ocr, kurt.frontend-glue, kurt.frontend-pages, kurt.frontend-3d, kurt.frontend-mobile, kurt.deployment."
---

> **DEPRECATED** — This generic architecture prompt has been replaced by layer-specific prompts.
> Use one of: `@kurt backend-db`, `@kurt backend-api`, `@kurt backend-ocr`, `@kurt frontend-glue`, `@kurt frontend-pages`, `@kurt frontend-3d`, `@kurt frontend-mobile`, `@kurt deployment`

---

## Context

The AIA system spans multiple architectural layers:
- **Frontend:** React/TypeScript SPA (`frontend/src/`) with Vite, component hierarchy, stores, and API hooks
- **Backend:** FastAPI application (`src/app/`) with routers, database layer, and ML integration
- **Database:** SQLAlchemy 2.x ORM with SQLite, Alembic migrations (`alembic/versions/`)
- **ML Pipeline:** YOLO card detection with training scripts, model files, and inference endpoints
- **Infrastructure:** Docker Compose, GitHub Actions CI, pre-commit hooks

The architecture doc must show how these layers connect and where data flows. All diagrams follow `.github/prompts/templates/kurt.mermaid-style.template.md`.

---

## Instructions

1. **Determine scope** — is this a full-system architecture, a subsystem (e.g., "backend API"), or a feature-level architecture (e.g., "card detection pipeline")?
2. **Scan the codebase** — use `listDirectory` on key directories (`src/app/`, `frontend/src/`, `alembic/`, `scripts/`) to map the actual structure
3. **Read key files** — entry points (`src/app/main.py`, `frontend/src/main.tsx`), configuration (`pyproject.toml`, `docker-compose.yml`, `alembic.ini`), and critical modules
4. **Read the mermaid style guide** — load `.github/prompts/templates/kurt.mermaid-style.template.md`
5. **Read the architecture template** — load `.github/prompts/templates/kurt.architecture.template.md`
6. **Create the system overview diagram** — a top-level flowchart showing all major components and their connections, using the full color legend
7. **Create component-level diagrams** — one per major architectural boundary (frontend, backend API, database, ML)
8. **Create a data flow diagram** — sequence diagram or flowchart showing the primary user workflow end-to-end
9. **Write the document** following the architecture template:
   - Metadata, overview, system diagram
   - Component sections with responsibilities and diagrams
   - Data flow section
   - Tech stack table
   - Directory map
   - Cross-references
10. **Place the file** at `docs/<scope-slug>-architecture.md` unless directed otherwise

---

## Output Format

A single markdown file following `kurt.architecture.template.md`. Must include:
- Minimum 3 mermaid diagrams: system overview, data flow, and at least one component detail
- Every diagram has the color legend subgraph and classDef block
- Tech stack table mapping layers to technologies and key files
- Directory map showing project structure relevant to the scope

---

## Example

**Input:**
```
@kurt architecture full system
```

**Expected output:**
A file at `docs/system-architecture.md` containing:
- System overview flowchart (User → Frontend → Backend → DB, with ML and Infra)
- Component sections for Frontend, Backend API, Database, ML Pipeline, Infrastructure
- Sequence diagram: user creates a game, adds players, records hands, views stats
- Tech stack table
- Directory map of the full project
- Cross-references to `docs/initial_system_architecture.md` and relevant specs

---

## Anti-patterns

- **Never** draw an architecture diagram without reading the actual project structure first
- **Never** omit the mermaid color legend from any diagram
- **Never** use colors or styles outside the ones defined in `kurt.mermaid-style.template.md`
- **Never** create a single monolithic diagram with 15+ nodes — split into focused diagrams
- **Never** list technologies that aren't actually in `pyproject.toml` or `package.json`
- **Never** guess at directory structure — use `listDirectory` to verify
