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
  - fetch
description: Document the Three.js 3D rendering layer — scene setup, poker table visualization, card rendering, animations, and WebGL integration within the React frontend.
---

## Goal

Produce clear, grounded documentation for the Three.js rendering layer — covering scene architecture, 3D poker table visualization, card rendering, camera setup, lighting, animations, and how the 3D layer integrates with React state and the broader frontend.

---

## Context

The AIA frontend includes Three.js-based 3D rendering (`frontend/src/scenes/`, potentially `frontend/src/components/` with Three.js canvas elements) for visual poker table representation. This layer:
- Renders a 3D poker table with player positions and card visuals
- Integrates with React via a canvas component or React Three Fiber
- Consumes game state from stores/hooks to update the 3D scene
- May include animations for card dealing, betting, and result reveals

Three.js documentation is evolving — use Context7 MCP to look up current APIs when needed.

---

## Instructions

1. **Scan for Three.js code** — search `frontend/src/` for imports of `three`, `@react-three/fiber`, `@react-three/drei`, or canvas-related components
2. **Read scene files** — load `frontend/src/scenes/` and any Three.js-related components
3. **Read the package.json** — verify which Three.js packages are installed (`three`, `@react-three/fiber`, `@react-three/drei`, etc.)
4. **Read state integration** — understand how 3D scenes consume game state from stores/hooks
5. **Read the mermaid instructions** — load `.github/instructions/kurt-mermaid.instructions.md`
6. **Write the document** combining:
   - **Prose:** Explain the 3D rendering architecture, scene graph structure, why Three.js was chosen, and how it integrates with React's render cycle
   - **Tables:** Scene inventory (scene, file, purpose), 3D asset inventory (meshes, materials, textures), animation inventory
   - **Mermaid flowchart:** Rendering pipeline — React state change → scene update → Three.js render → canvas output
   - **Mermaid class diagram:** Scene graph structure (Scene → Camera + Lights + Table + Cards + Players)
   - **Code references:** Scene classes/components, geometry builders, material definitions, animation functions
   - **Performance notes:** Any relevant performance patterns (instancing, LOD, disposal)
7. **Place the file** at `docs/frontend/threejs-rendering.md` unless directed otherwise
8. **Flag `[TODO]`** for any Three.js features planned but not yet implemented

---

## Output Format

A markdown file with:
- Metadata table
- Rendering architecture overview (prose + pipeline flowchart)
- Scene graph structure (mermaid class diagram or flowchart)
- Scene/component inventory table
- State integration section (how React state drives 3D updates)
- Animation documentation (if present)
- Performance considerations
- Source file references

---

## Example

**Input:**
```
@kurt frontend-3d poker table scene
```

**Expected output:**
A file at `docs/frontend/threejs-poker-table.md` containing:
- Prose: scene architecture overview, React Three Fiber integration
- Pipeline flowchart: game state → React props → Three.js scene graph → WebGL render
- Scene graph diagram: Scene → PerspectiveCamera + AmbientLight + PokerTable + CardMeshes[n] + PlayerPositions[n]
- Scene inventory: PokerTableScene, CardMesh, PlayerSeat, etc.
- State integration: how `useGameSession` hook feeds card data to the 3D scene
- Animation docs: card dealing animation, chip movement, etc.

---

## Anti-patterns

- **Never** document Three.js features without verifying they exist in the codebase
- **Never** assume React Three Fiber is used — check `package.json` and imports
- **Never** skip the rendering pipeline diagram — it clarifies the React ↔ Three.js boundary
- **Never** omit performance considerations for 3D rendering documentation
- **Never** document 3D assets or animations that don't exist — flag as `[TODO]`
