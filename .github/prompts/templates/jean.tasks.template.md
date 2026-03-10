<!--
TASKS TEMPLATE
==============
Output template for Jean's tasks.md files.
Place the generated file at: specs/<project-name>-<project-id>/tasks.md

PLACEHOLDER LEGEND
==================
{{PROJECT_NAME}}          Required. Human-readable project name.
{{PROJECT_ID}}            Required. Kebab-case identifier.
{{DATE}}                  Required. Generation date (YYYY-MM-DD).
{{TOTAL_TASKS}}           Required. Total number of tasks.
{{TASK_ID}}               Required. Format: T-<NNN> zero-padded (e.g., T-001).
{{TASK_TITLE}}            Required. Short descriptive title.
{{CATEGORY}}              Required. One of: setup | feature | test | docs | refactor | infra
{{DEPENDENCIES}}          Required. Comma-separated task IDs, or "none".
{{STORY_REF}}             Required. Comma-separated story IDs from spec.md, or "—".
{{TASK_DESCRIPTION}}      Required. 1-3 sentences describing the work.
{{ACCEPTANCE_CRITERIA}}   Required. Numbered list of testable "done" conditions.
-->

# Tasks — {{PROJECT_NAME}}

**Project ID:** {{PROJECT_ID}}
**Date:** {{DATE}}
**Total Tasks:** {{TOTAL_TASKS}}
**Status:** Draft

---

## Task Index

| ID | Title | Category | Dependencies | Story Ref |
|---|---|---|---|---|
| {{TASK_ID}} | {{TASK_TITLE}} | {{CATEGORY}} | {{DEPENDENCIES}} | {{STORY_REF}} |
<!-- Repeat for all tasks — this index provides a quick overview -->

---

## Task Details

### {{TASK_ID}} — {{TASK_TITLE}}

**Category:** {{CATEGORY}}
**Dependencies:** {{DEPENDENCIES}}
**Story Ref:** {{STORY_REF}}

{{TASK_DESCRIPTION}}

**Acceptance Criteria:**
1. {{ACCEPTANCE_CRITERIA}}
2. {{ACCEPTANCE_CRITERIA}}

---

### {{TASK_ID}} — {{TASK_TITLE}}

**Category:** {{CATEGORY}}
**Dependencies:** {{DEPENDENCIES}}
**Story Ref:** {{STORY_REF}}

{{TASK_DESCRIPTION}}

**Acceptance Criteria:**
1. {{ACCEPTANCE_CRITERIA}}
2. {{ACCEPTANCE_CRITERIA}}

---

<!-- Repeat task blocks in dependency order. No task should appear before its dependencies. -->
