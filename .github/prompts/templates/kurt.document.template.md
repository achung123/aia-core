<!--
DOCUMENT TEMPLATE
=================
General output template for all Kurt documentation across any system layer.
Place the generated file at the default path for the layer (see kurt.agent.md)
or as directed by the user.

PLACEHOLDER LEGEND
==================
{{TITLE}}               Required. Document title.
{{DATE}}                Required. Generation date (YYYY-MM-DD).
{{LAYER}}               Required. System layer: Backend DB | Backend API | Backend OCR | Frontend Glue | Frontend Pages | Frontend 3D | Frontend Mobile | Deployment.
{{SCOPE}}               Required. What this document covers within the layer.
{{STATUS}}              Required. Draft | Review | Final.
{{SUMMARY}}             Required. 2-3 sentence overview.
{{TOC}}                 Required. Auto-generated table of contents for 3+ sections.
{{SECTION_TITLE}}       Required. H2 section heading.
{{SECTION_CONTENT}}     Required. Prose, tables, code references, and/or mermaid diagrams — choose the right format for each piece of content.
{{FILE_REFERENCES}}     Required. List of source files referenced (with workspace-relative paths).
{{CROSS_REFERENCES?}}   Optional. Links to related specs, tasks, or docs.

FORMAT SELECTION GUIDE
======================
For each section, choose the best format:
- PROSE for design rationale, tradeoffs, domain explanations
- TABLES for schema fields, endpoint inventories, config options, comparisons
- MERMAID for component relationships, data flow, state transitions, ER diagrams
- NUMBERED LISTS for step-by-step procedures
- CODE BLOCKS for directory trees, example payloads, CLI commands

Mermaid diagrams follow .github/instructions/kurt-mermaid.instructions.md.
-->

# {{TITLE}}

| Field | Value |
|---|---|
| **Date** | {{DATE}} |
| **Author** | Kurt (Nightcrawler) |
| **Layer** | {{LAYER}} |
| **Scope** | {{SCOPE}} |
| **Status** | {{STATUS}} |

---

## Summary

{{SUMMARY}}

---

## Table of Contents

{{TOC}}

---

## {{SECTION_TITLE}}

{{SECTION_CONTENT}}

<!-- Each section uses the best format for its content:
     - Prose for explanations and rationale
     - Tables for inventories and comparisons
     - Mermaid diagrams for relationships and flow
     - Code blocks for examples and directory trees
     - Numbered lists for procedures -->

---

<!-- Repeat sections as needed -->

## Source Files Referenced

{{FILE_REFERENCES}}

---

## Cross-References

{{CROSS_REFERENCES?}}
