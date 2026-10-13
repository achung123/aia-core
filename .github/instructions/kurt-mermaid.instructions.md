---
description: "Mermaid diagram styling rules for Kurt (Nightcrawler). Defines color palette, node shapes, edge conventions, and legend format for all system diagrams. Read this instruction before producing any mermaid diagram."
applyTo: "docs/**"
---

# Kurt — Mermaid Diagram Style Instructions

These rules govern every mermaid diagram Kurt produces. They ensure visual consistency across all documentation — architecture, API flows, data models, and system overviews.

Kurt writes documents using a **combination of styles**: prose explanations, tabular representations, and mermaid diagrams. Mermaid is one tool among several — use it when spatial relationships, flow, or state transitions are the point. Use tables when comparing attributes. Use prose when explaining reasoning.

---

## Color Palette — System-Phase Legend

All diagrams use this 8-phase palette. Each phase maps to a `classDef` class name.

| Phase | Class | Fill | Stroke | Text | Use For |
|---|---|---|---|---|---|
| Frontend — Pages | `fe` | `#4A90D9` | `#2C6FB3` | `#FFFFFF` | Page components, route views, primary UI logic |
| Frontend — 3D Rendering | `fe3d` | `#5DADE2` | `#3498DB` | `#FFFFFF` | Three.js scenes, WebGL, canvas rendering |
| Frontend — Mobile | `mob` | `#2E86C1` | `#1B6CA8` | `#FFFFFF` | Mobile-first layouts, responsive patterns, touch |
| Backend API | `be` | `#27AE60` | `#1E8449` | `#FFFFFF` | FastAPI routes, poker game logic, middleware |
| Backend Database | `db` | `#8E44AD` | `#6C3483` | `#FFFFFF` | SQLAlchemy models, queries, Alembic migrations |
| Backend OCR / ML | `ml` | `#E67E22` | `#CA6F1E` | `#FFFFFF` | YOLO detection, training, inference, card recognition |
| Infrastructure | `infra` | `#7F8C8D` | `#616A6B` | `#FFFFFF` | Docker, CI/CD, deployment, networking |
| External / User | `ext` | `#E74C3C` | `#C0392B` | `#FFFFFF` | User actions, external APIs, third-party services |

### classDef Block — Include in Every Flowchart

```
classDef fe fill:#4A90D9,stroke:#2C6FB3,color:#FFFFFF
classDef fe3d fill:#5DADE2,stroke:#3498DB,color:#FFFFFF
classDef mob fill:#2E86C1,stroke:#1B6CA8,color:#FFFFFF
classDef be fill:#27AE60,stroke:#1E8449,color:#FFFFFF
classDef db fill:#8E44AD,stroke:#6C3483,color:#FFFFFF
classDef ml fill:#E67E22,stroke:#CA6F1E,color:#FFFFFF
classDef infra fill:#7F8C8D,stroke:#616A6B,color:#FFFFFF
classDef ext fill:#E74C3C,stroke:#C0392B,color:#FFFFFF
```

### Legend Subgraph — Include in Every Flowchart

```
subgraph Legend
    direction LR
    L1[Frontend Pages]:::fe
    L2[3D Rendering]:::fe3d
    L3[Mobile]:::mob
    L4[Backend API]:::be
    L5[Database]:::db
    L6[ML / OCR]:::ml
    L7[Infrastructure]:::infra
    L8[External / User]:::ext
end
```

Only include legend entries that appear in the diagram. If a diagram only touches Backend API and Database, the legend only shows those two.

---

## Sequence Diagram Color Mapping

Sequence diagrams use `box` directives instead of `classDef`:

```
box rgb(231, 76, 60) External
box rgb(74, 144, 217) Frontend
box rgb(93, 173, 226) 3D Rendering
box rgb(46, 134, 193) Mobile
box rgb(39, 174, 96) Backend API
box rgb(142, 68, 173) Database
box rgb(230, 126, 34) ML / OCR
box rgb(127, 140, 141) Infrastructure
```

---

## Node Shape Conventions

| Shape | Syntax | Use For |
|---|---|---|
| Rectangle | `[Node]` | Processes, services, modules |
| Rounded rectangle | `(Node)` | User actions, soft entry points |
| Cylinder | `[(Node)]` | Databases, persistent storage |
| Hexagon | `{{Node}}` | Decision points, conditional logic |
| Stadium | `([Node])` | Events, triggers, signals |
| Parallelogram | `[/Node/]` | Data input/output |
| Circle | `((Node))` | Start/end points |
| Double circle | `(((Node)))` | External system boundary |

---

## Edge Conventions

| Style | Syntax | Use For |
|---|---|---|
| Solid arrow | `-->` | Primary data/control flow |
| Dotted arrow | `-.->` | Async, optional, or secondary flow |
| Thick arrow | `==>` | Critical path, high-volume flow |
| Labeled edge | `-->\|label\|` | Always describe what flows between nodes |

- Every edge SHOULD have a label — use verb phrases: `sends request`, `returns JSON`, `persists row`
- Arrows flow top-to-bottom (`TD`) or left-to-right (`LR`) — never mix in one diagram

---

## Diagram Type Selection

| Scenario | Type | Directive |
|---|---|---|
| System overview, data flow | Flowchart | `flowchart TD` or `flowchart LR` |
| Request/response sequences | Sequence | `sequenceDiagram` |
| Data model relationships | ER | `erDiagram` |
| Class/module structure | Class | `classDiagram` |
| State machines, lifecycles | State | `stateDiagram-v2` |

---

## Complexity Rules

1. **Max 15 nodes** per diagram — split larger systems with cross-references
2. **Max 3 subgraph nesting levels**
3. **Group related nodes** in subgraphs named after the system phase
4. **Consistent node IDs** — lowercase, descriptive, hyphenated: `game-session-router`, `card-detector`
5. **Legend at bottom** of every flowchart diagram

---

## When to Use Mermaid vs. Other Formats

| Content Type | Best Format | Why |
|---|---|---|
| Component relationships, data flow | **Mermaid flowchart** | Spatial layout shows connections |
| Request/response lifecycle | **Mermaid sequence** | Time-ordered interactions |
| State transitions | **Mermaid stateDiagram** | Lifecycle visibility |
| Data model relationships | **Mermaid erDiagram** | Schema-at-a-glance |
| Feature comparison, config options | **Table** | Scannable attribute grid |
| API schemas, field definitions | **Table** | Structured key-value |
| Design rationale, tradeoffs | **Prose** | Nuance needs sentences |
| Step-by-step procedures | **Numbered list** | Sequential clarity |
| File/directory layout | **Code block tree** | Familiar format |

**Rule:** Never force mermaid when a table or prose is clearer. Never write a wall of prose when a diagram would illuminate structure instantly.

---

## Anti-Patterns

- **Never** use inline styles (`style N fill:...`) — always use `classDef`
- **Never** omit the Legend subgraph from flowcharts
- **Never** exceed 15 nodes — split instead
- **Never** leave edges unlabeled in flowcharts
- **Never** mix TD and LR in one diagram
- **Never** use colors outside this palette without updating this instruction first
- **Never** use mermaid for content better served by a table or prose
