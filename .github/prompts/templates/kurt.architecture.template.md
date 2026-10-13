<!--
DEPRECATED — Architecture docs are now produced by layer-specific prompts.
Each layer prompt embeds the appropriate document structure.
See: .github/prompts/kurt.backend-db.prompt.md, kurt.backend-api.prompt.md, etc.
-->

# DEPRECATED — Architecture Template

> **Replaced by layer-specific prompts.**
>
> Architecture documentation is now produced by the appropriate `@kurt` layer command.
> Each layer prompt defines its own output structure tailored to that layer's content.

# {{TITLE}}

| Field | Value |
|---|---|
| **Date** | {{DATE}} |
| **Author** | Kurt (Nightcrawler) |
| **Scope** | {{SCOPE}} |
| **Status** | {{STATUS}} |

---

## Overview

{{OVERVIEW}}

---

## System Diagram

{{SYSTEM_DIAGRAM}}

---

## Components

### {{COMPONENT_N_TITLE}}

{{COMPONENT_N_DESC}}

{{COMPONENT_N_DIAGRAM?}}

---

<!-- Repeat component sections as needed -->

## Data Flow

{{DATA_FLOW}}

---

## Tech Stack

| Layer | Technology | Key Files |
|---|---|---|
| <!-- rows --> |

---

## Directory Map

```
{{DIRECTORY_MAP}}
```

---

## Cross-References

{{CROSS_REFERENCES?}}
