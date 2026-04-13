---
mode: agent
tools: []
description: "DEPRECATED — guide content is now produced by layer-specific prompts. Use the appropriate @kurt layer command."
---

> **DEPRECATED** — Guide generation has been folded into layer-specific prompts.
> Use one of: `@kurt backend-db`, `@kurt backend-api`, `@kurt backend-ocr`, `@kurt frontend-glue`, `@kurt frontend-pages`, `@kurt frontend-3d`, `@kurt frontend-mobile`, `@kurt deployment`

---

## Context

All In Analytics serves two primary audiences:
1. **Developers** — need setup guides, architecture walkthroughs, contribution workflows, and domain knowledge
2. **Users** (poker players/dealers) — need feature guides, workflow explanations, and troubleshooting help

The system combines three domains that may be unfamiliar:
- **Software:** FastAPI/React full-stack patterns
- **Machine Learning:** YOLO object detection for card recognition
- **Texas Hold'em:** Hand rankings, betting rounds, positions, game session lifecycle

Guides must be accessible to readers who may know one domain but not the others. An existing user guide lives at `docs/user-onboarding-guide.md` — new guides should complement, not duplicate it.

---

## Instructions

1. **Identify the audience and topic** — is this a developer guide (code-oriented) or user guide (feature-oriented)? What specific topic?
2. **Read existing guides** — check `docs/` for related documentation to avoid duplication and maintain consistency
3. **Read relevant source files** — understand the actual implementation to ground the guide in reality
4. **Read the mermaid style guide** — load `.github/prompts/templates/kurt.mermaid-style.template.md`
5. **Write the guide** with these sections:
   - Metadata header (title, date, author, audience, status)
   - **Overview** — what this guide covers and who it's for (1-2 sentences)
   - **Prerequisites** — what the reader needs before starting
   - **Steps** — numbered, action-oriented instructions with code blocks, screenshots references, or commands
   - **Visual Overview** — at least one mermaid diagram showing the workflow or concept being explained
   - **Key Concepts** — brief definitions of domain-specific terms (poker, ML, or engineering jargon)
   - **Common Issues** — troubleshooting section for known pitfalls
   - **Next Steps** — what to read or do after completing this guide
6. **Tone** — direct, practical, no filler. Use second person ("you") for instructions
7. **Place the file** at `docs/<topic-slug>-guide.md` unless directed otherwise

---

## Output Format

A markdown file with:
- Metadata table
- Numbered step-by-step instructions
- Code blocks with actual commands or code from the project
- At least one mermaid diagram (workflow, architecture context, or concept map)
- Key Concepts glossary for cross-domain terms
- Common Issues / FAQ section

---

## Example

**Input:**
```
@kurt guide developer setup
```

**Expected output:**
A file at `docs/developer-setup-guide.md` containing:
- Prerequisites: Python 3.12, uv, Node.js, Docker
- Steps: clone repo, `uv sync`, run migrations, seed data, start backend, start frontend
- Mermaid flowchart: developer workflow (setup → code → test → lint → commit)
- Key Concepts: beads task tracking, TDD workflow, pre-commit hooks
- Common Issues: SQLite lock errors, port conflicts, missing uv install
- Next Steps: links to architecture doc, contributing guide, agent roster

**Input:**
```
@kurt guide texas holdem basics for developers
```

**Expected output:**
A file at `docs/texas-holdem-basics-guide.md` containing:
- Overview of Texas Hold'em rules relevant to the codebase
- Steps through a complete hand: blinds → hole cards → preflop → flop → turn → river → showdown
- Mermaid state diagram: hand lifecycle states matching the database model
- Key Concepts: blinds, positions, community cards, hand rankings, pot calculation
- Mapping of poker concepts to database models and API endpoints
- Next Steps: links to game session API docs, player stats docs

---

## Anti-patterns

- **Never** write a guide without checking existing docs for overlap
- **Never** include commands or paths that don't exist in the project
- **Never** assume the reader knows all three domains (software, ML, poker) — define jargon
- **Never** skip the mermaid diagram — every guide gets at least one visual
- **Never** write passive, vague instructions — be direct and specific
- **Never** produce a wall of text without code blocks, tables, or diagrams to break it up
