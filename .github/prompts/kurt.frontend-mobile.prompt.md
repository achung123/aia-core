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
description: Document mobile-first design choices — responsive patterns, touch interactions, viewport strategies, component adaptations, and CSS/layout decisions for mobile users.
---

## Goal

Produce clear, grounded documentation for the mobile-first design layer — covering responsive layout strategy, touch interaction patterns, viewport handling, component adaptations for small screens, and CSS/layout decisions. Output uses prose for design rationale, tables for breakpoint definitions, and mermaid diagrams for layout flow.

---

## Context

The AIA frontend serves poker players and dealers who may use the app on phones and tablets during live games. Mobile-first considerations:
- **Mobile directory:** `frontend/src/mobile/` — mobile-specific components or layouts
- **CSS/styles:** `frontend/src/style.css` and component-level styles
- **Responsive patterns:** media queries, flexbox/grid layouts, viewport meta
- **Touch interactions:** card selection, swipe gestures, tap targets for dealer actions
- **Vite config:** `frontend/vite.config.ts` — build configuration that may affect mobile

Mobile-first means the base styles target small screens, with progressive enhancement for larger screens — not the other way around.

---

## Instructions

1. **Read mobile-specific code** — load `frontend/src/mobile/` and scan for responsive utilities
2. **Read CSS/styles** — load `frontend/src/style.css` and search for media queries, flexbox/grid patterns
3. **Read component code** — identify components that adapt to screen size (conditional rendering, responsive props)
4. **Read the HTML entry** — load `frontend/index.html` for viewport meta tag and mobile-related headers
5. **Read Vite config** — check for mobile-related build settings
6. **Read the mermaid instructions** — load `.github/instructions/kurt-mermaid.instructions.md`
7. **Write the document** combining:
   - **Prose:** Explain the mobile-first philosophy, why it matters for a poker app used during live games, design tradeoffs made
   - **Tables:** Breakpoint definitions (name, min-width, target devices), touch target sizes, component adaptation matrix (component, mobile behavior, desktop behavior)
   - **Mermaid flowchart:** Layout decision tree — viewport width → breakpoint → layout variant → component adaptation
   - **Code references:** CSS media queries, responsive hooks, mobile-specific components
   - **Screenshots/references:** Call out key mobile vs. desktop differences
8. **Place the file** at `docs/frontend/mobile-first.md` unless directed otherwise
9. **Flag `[TODO]`** for mobile patterns that should exist but don't yet

---

## Output Format

A markdown file with:
- Metadata table
- Mobile-first strategy overview (prose)
- Breakpoint table (name, width, target)
- Component adaptation matrix (table)
- Layout decision flowchart (mermaid)
- Touch interaction patterns section
- CSS/layout patterns section with code examples
- Source file references

---

## Example

**Input:**
```
@kurt frontend-mobile dealer controls
```

**Expected output:**
A file at `docs/frontend/mobile-dealer-controls.md` containing:
- Prose: why dealer controls must be thumb-reachable, one-handed operation during a game
- Breakpoint table: mobile (<640px), tablet (640-1024px), desktop (>1024px)
- Component matrix: DealerControls (stacked buttons on mobile, horizontal bar on desktop)
- Layout flowchart: viewport → breakpoint check → mobile layout vs. desktop layout
- Touch patterns: minimum 44px tap targets, swipe to advance hand, long-press for undo
- CSS examples: actual media queries and responsive utility classes from the codebase

---

## Anti-patterns

- **Never** document responsive patterns without reading the actual CSS/styles
- **Never** assume breakpoint values — read the stylesheet or config
- **Never** skip the component adaptation table — it's the core deliverable for mobile docs
- **Never** document mobile features that don't exist — flag as `[TODO]`
- **Never** ignore touch interaction considerations for a poker app used during live games
