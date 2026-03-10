<!--
PLAN TEMPLATE
=============
Output template for Jean's plan.md files.
Place the generated file at: specs/<project-name>-<project-id>/plan.md

PLACEHOLDER LEGEND
==================
{{PROJECT_NAME}}        Required. Human-readable project name.
{{PROJECT_ID}}          Required. Kebab-case identifier.
{{DATE}}                Required. Generation date (YYYY-MM-DD).
{{OVERVIEW}}            Required. 2-3 sentence project summary.
{{TECH_TOOL}}           Required. Technology or tool name.
{{TECH_PURPOSE}}        Required. Why this technology is chosen.
{{COMPONENT_NAME}}      Required. Architectural component name.
{{COMPONENT_DESC}}      Required. What this component does.
{{PHASE_TITLE}}         Required. Phase name (e.g., "Foundation", "Core Features").
{{PHASE_DESC}}          Required. What gets built in this phase.
{{PHASE_DELIVERABLES}}  Required. Concrete outputs of this phase.
{{RISK}}                Required. Identified risk description.
{{MITIGATION}}          Required. How the risk will be mitigated.
{{DEPENDENCY}}          Optional. External dependency or integration.
-->

# Plan — {{PROJECT_NAME}}

**Project ID:** {{PROJECT_ID}}
**Date:** {{DATE}}
**Status:** Draft

---

## Overview

{{OVERVIEW}}

---

## Tech Stack & Tools

| Technology | Purpose |
|---|---|
| {{TECH_TOOL}} | {{TECH_PURPOSE}} |
| {{TECH_TOOL}} | {{TECH_PURPOSE}} |
<!-- Add rows as needed -->

---

## Architecture Components

### {{COMPONENT_NAME}}

{{COMPONENT_DESC}}

### {{COMPONENT_NAME}}

{{COMPONENT_DESC}}

<!-- Add components as needed -->

---

## Project Phases

### Phase 1: {{PHASE_TITLE}}

{{PHASE_DESC}}

**Deliverables:**
- {{PHASE_DELIVERABLES}}

### Phase 2: {{PHASE_TITLE}}

{{PHASE_DESC}}

**Deliverables:**
- {{PHASE_DELIVERABLES}}

<!-- Add phases as needed -->

---

## Risks & Mitigations

| Risk | Mitigation |
|---|---|
| {{RISK}} | {{MITIGATION}} |
| {{RISK}} | {{MITIGATION}} |

---

## External Dependencies

- {{DEPENDENCY}}

<!-- List external services, APIs, or libraries the project depends on -->
