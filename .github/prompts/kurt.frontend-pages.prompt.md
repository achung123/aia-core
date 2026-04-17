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
description: Document primary frontend page components — route structure, page composition, component hierarchy, and user interaction flows.
---

## Goal

Produce clear, grounded documentation for the frontend page layer — covering route structure, page components, component hierarchy, layout patterns, and user interaction flows. Output uses prose for design rationale, tables for component inventories, and mermaid diagrams for component trees and user flows.

---

## Context

The AIA frontend pages (`frontend/src/`):
- **Pages/Views:** `frontend/src/pages/` or `frontend/src/views/` — top-level route components
- **Components:** `frontend/src/components/` — reusable UI components
- **Dealer interface:** `frontend/src/dealer/` — dealer-specific views
- **Player interface:** `frontend/src/player/` — player-specific views
- **Scenes:** `frontend/src/scenes/` — scene-based layouts
- **Navigation:** `frontend/src/NavBar.tsx` — app navigation
- **Routing:** configured in `frontend/src/App.tsx` or router config

Pages orchestrate components, hooks, and stores to present the poker game interface — game dashboards, hand recording views, player stats, and dealer controls.

---

## Instructions

1. **Read the App entry point** — load `frontend/src/App.tsx` and `frontend/src/main.tsx` to understand routing setup
2. **Read page/view components** — scan `frontend/src/pages/`, `frontend/src/views/`, `frontend/src/dealer/`, `frontend/src/player/`
3. **Read shared components** — scan `frontend/src/components/` for reusable UI pieces
4. **Read navigation** — load `frontend/src/NavBar.tsx` to understand site structure
5. **Read the mermaid instructions** — load `.github/instructions/kurt-mermaid.instructions.md`
6. **Write the document** combining:
   - **Prose:** Explain the page architecture, how routes map to views, what each major page does
   - **Tables:** Route table (path, component, description), component inventory (name, location, props, purpose)
   - **Mermaid flowchart:** Component hierarchy — App → NavBar + Routes → Pages → Components
   - **Mermaid flowchart:** User flow through the app (landing → create game → add players → dealer view → record hands → stats)
   - **Code references:** Component names, file paths, key props, and state dependencies
7. **Place the file** at `docs/frontend/page-architecture.md` unless directed otherwise

---

## Output Format

A markdown file with:
- Metadata table
- Route structure table (path → component)
- Page architecture overview (prose + component hierarchy diagram)
- Per-page sections (purpose, components used, data dependencies)
- User flow diagram (mermaid)
- Component inventory table
- Source file references

---

## Example

**Input:**
```
@kurt frontend-pages dealer interface
```

**Expected output:**
A file at `docs/frontend/dealer-interface.md` containing:
- Route table: /dealer, /dealer/hand, /dealer/detect, etc.
- Component hierarchy: DealerView → HandControls + CardDetection + PlayerList
- Prose: what the dealer sees and does at each stage of a hand
- User flow: dealer starts hand → deals cards → records community cards → triggers detection → confirms → records result
- Component table: each dealer component with its props and purpose
- References to `frontend/src/dealer/`

---

## Anti-patterns

- **Never** document page components without reading the actual source files
- **Never** fabricate route paths — read the router configuration
- **Never** skip the component hierarchy diagram — page docs need structure visualization
- **Never** describe user flows without tracing them through the actual component code
- **Never** document a component's props without reading its type definition
