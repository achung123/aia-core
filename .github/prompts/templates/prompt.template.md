# Prompt Template
<!--
PROMPT FILE USAGE
=================
One prompt file per distinct agent task. Named: <agent-slug>.<task>.prompt.md

Examples:
  code-reviewer.review-pr.prompt.md
  code-reviewer.explain-diff.prompt.md
  doc-writer.generate-header.prompt.md

PLACEHOLDER LEGEND
==================
{{AGENT_SLUG}}        Required. Agent slug this prompt belongs to. e.g. "code-reviewer"
{{TASK_SLUG}}         Required. kebab-case task name. e.g. "review-pr"
{{MODE}}              Required. One of: agent | ask | edit
{{TOOLS}}             Required. YAML list of tools this prompt may invoke.
{{DESCRIPTION}}       Required. One sentence — what this specific task achieves.
{{GOAL}}              Required. Plain-English statement of the task goal.
{{CONTEXT}}           Required. Background the model needs to execute this task well.
{{INSTRUCTIONS}}      Required. Numbered step-by-step instructions for this task.
{{OUTPUT_FORMAT}}     Required. Expected structure/format of this task's output.
{{EXAMPLE_INPUT}}     Required. A concrete example input for this task.
{{EXAMPLE_OUTPUT}}    Required. The expected output for the example input.
{{ANTI_PATTERNS}}     Required. Things the model must NOT do for this task.
-->

---
mode: {{MODE}}
tools:
  {{TOOLS}}
description: {{DESCRIPTION}}
---

## Goal

{{GOAL}}

---

## Context

{{CONTEXT}}

---

## Instructions

{{INSTRUCTIONS}}

---

## Output Format

{{OUTPUT_FORMAT}}

---

## Example

**Input:**
```
{{EXAMPLE_INPUT}}
```

**Expected output:**
```
{{EXAMPLE_OUTPUT}}
```

---

## Anti-patterns

{{ANTI_PATTERNS}}
