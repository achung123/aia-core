<!--
SPEC TEMPLATE
=============
Output template for Jean's spec.md files.
Place the generated file at: specs/<project-name>-<project-id>/spec.md

PLACEHOLDER LEGEND
==================
{{PROJECT_NAME}}      Required. Human-readable project name.
{{PROJECT_ID}}        Required. Kebab-case identifier (e.g., poker-lobby-001).
{{DATE}}              Required. Generation date (YYYY-MM-DD).
{{EPIC_TITLE}}        Required. Short name for the epic.
{{EPIC_DESCRIPTION}}  Required. 1-2 sentences describing the epic's scope.
{{STORY_ID}}          Required. Format: S-<epic>.<story> (e.g., S-1.1).
{{STORY_TITLE}}       Required. Short descriptive title.
{{ROLE}}              Required. User role / persona.
{{CAPABILITY}}        Required. What the user wants to do.
{{BENEFIT}}           Required. Why the user wants it.
{{ACCEPTANCE_CRITERIA}} Required. Numbered list of testable conditions.
-->

# Spec — {{PROJECT_NAME}}

**Project ID:** {{PROJECT_ID}}
**Date:** {{DATE}}
**Status:** Draft

---

## Table of Contents

1. [Epic 1: {{EPIC_TITLE}}](#epic-1-{{EPIC_TITLE}})
2. [Epic 2: {{EPIC_TITLE}}](#epic-2-{{EPIC_TITLE}})
<!-- Add more epics as needed -->

---

## Epic 1: {{EPIC_TITLE}}

{{EPIC_DESCRIPTION}}

### {{STORY_ID}} — {{STORY_TITLE}}

**As a** {{ROLE}}, **I want** {{CAPABILITY}}, **so that** {{BENEFIT}}.

**Acceptance Criteria:**
1. {{ACCEPTANCE_CRITERIA}}
2. {{ACCEPTANCE_CRITERIA}}
3. {{ACCEPTANCE_CRITERIA}}

---

### {{STORY_ID}} — {{STORY_TITLE}}

**As a** {{ROLE}}, **I want** {{CAPABILITY}}, **so that** {{BENEFIT}}.

**Acceptance Criteria:**
1. {{ACCEPTANCE_CRITERIA}}
2. {{ACCEPTANCE_CRITERIA}}

---

<!-- Repeat Epic + Story blocks as needed -->
