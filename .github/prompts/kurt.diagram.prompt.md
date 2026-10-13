---
mode: agent
tools: []
description: "DEPRECATED — mermaid diagrams are now embedded in layer-specific docs. Mermaid styling rules moved to .github/instructions/kurt-mermaid.instructions.md."
---

> **DEPRECATED** — Standalone diagram generation has been folded into layer-specific prompts.
> Mermaid styling rules are now in `.github/instructions/kurt-mermaid.instructions.md`.
> Use one of: `@kurt backend-db`, `@kurt backend-api`, `@kurt backend-ocr`, `@kurt frontend-glue`, `@kurt frontend-pages`, `@kurt frontend-3d`, `@kurt frontend-mobile`, `@kurt deployment`

---

## Context

The All In Analytics project uses mermaid diagrams extensively for architecture, data flow, API sequences, state machines, and ER diagrams. All diagrams must be visually consistent — same colors, same shapes, same legend. The canonical style guide is at `.github/prompts/templates/kurt.mermaid-style.template.md`.

This task is for producing a **single diagram** (not a full document). The output is a markdown file containing just the diagram and a brief title/description.

---

## Instructions

1. **Understand the request** — what system aspect, workflow, or relationship the user wants visualized
2. **Read the mermaid style guide** — load `.github/prompts/templates/kurt.mermaid-style.template.md` and follow every rule
3. **Read relevant source files** — if the diagram depicts real system components, read the actual code to ensure accuracy
4. **Choose the right diagram type** — use the selection guide from the style template:
   - System overview → `flowchart TD`
   - Request/response → `sequenceDiagram`
   - Data models → `erDiagram`
   - Module structure → `classDiagram`
   - Lifecycles → `stateDiagram-v2`
5. **Build the diagram** following all style rules:
   - Apply `classDef` for all six system phases
   - Tag every node with the appropriate class (`:::fe`, `:::be`, `:::db`, `:::ml`, `:::infra`, `:::ext`)
   - Include the Legend subgraph
   - Label every edge with a verb phrase
   - Keep to max 15 nodes; split if larger
6. **Output** — write a markdown file with:
   - H1 title
   - One-sentence description
   - The mermaid code block
   - A brief node-to-source-file mapping table (if depicting real code)
7. **Place the file** at `docs/diagrams/<slug>.md` unless directed otherwise

---

## Output Format

A markdown file containing:
```
# Diagram Title
Brief description of what this diagram shows.

```mermaid
<diagram code>
```

## Node Reference (optional)
| Node | Source File | Description |
|---|---|---|
```

---

## Example

**Input:**
```
@kurt diagram card detection flow
```

**Expected output:**
A file at `docs/diagrams/card-detection-flow.md` containing:
```
# Card Detection Flow

Shows the end-to-end flow from camera capture to persisted card data.
```
Followed by a mermaid flowchart with nodes for: User Upload (ext), API Endpoint (be), YOLO Detector (ml), Confirmation Step (be), Database Persist (db) — all with correct classDefs, legend, and labeled edges.

---

## Anti-patterns

- **Never** produce a diagram without the classDef block and Legend subgraph
- **Never** use inline styles — always use `classDef` classes
- **Never** leave edges unlabeled in flowcharts
- **Never** exceed 15 nodes in a single diagram
- **Never** guess at system components — read the code first if the diagram depicts real architecture
- **Never** mix flow directions (TD and LR) in the same diagram
