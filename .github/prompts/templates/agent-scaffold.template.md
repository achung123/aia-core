# Agent Scaffold
<!--
SCAFFOLD USAGE
==============
This file defines the canonical structure for ALL agents in this workspace.
Xavier reads this file before generating any new agent.

FULL SCAFFOLD = three layers, always generated together:
  Layer 1 → .github/agents/<slug>.agent.md          (this file)
  Layer 2 → .github/prompts/<slug>.<task>.prompt.md  (one per distinct task/quick command)
  Layer 3 → .github/templates/<slug>.<type>.template.md (one per structured output type)

Copy this scaffold, replace every {{PLACEHOLDER}}, delete this comment block.

PLACEHOLDER LEGEND
==================
{{AGENT_NAME}}          Required. PascalCase display name. e.g. "CodeReviewer"
{{AGENT_SLUG}}          Required. kebab-case used in file names and @mentions. e.g. "code-reviewer"
{{DESCRIPTION}}         Required. One sentence shown as placeholder text in the chat input field.
{{ARGUMENT_HINT}}       Required. Mirrors the quick command syntax exactly.
                        e.g. "review <file or PR> | explain <diff> | list"
{{TOOLS}}               Required. YAML list — one tool per line, indented two spaces.
{{MODEL?}}              Optional. Preferred model name or priority array of model names.
{{HANDOFF_LABEL?}}      Optional. CTA label for the handoff button. e.g. "Start Implementation"
{{HANDOFF_AGENT?}}      Optional. Target agent slug. e.g. "implementer"
{{HANDOFF_PROMPT?}}     Optional. Pre-filled prompt sent to the target agent on handoff.
{{ROLE_STATEMENT}}      Required. One sentence: who the agent is and its primary purpose.
{{QUICK_COMMAND_N}}     Required. One row per quick command. Format: verb <argument>
                        Each quick command MUST have a corresponding .prompt.md file.
{{QUICK_CMD_N_DESC}}    Required. One sentence describing what each quick command does.
{{WILL_DO}}             Required. Bulleted list of what the agent actively does.
{{WILL_NOT_DO}}         Required. Bulleted list of what the agent explicitly refuses to do.
{{OUTPUT_DESCRIPTION}}  Required. Plain-English description of the output shape.
{{OUTPUT_STRUCTURE}}    Required. Fenced code block or table showing the exact output format.
{{PROMPT_FILES}}        Required. List of every companion .prompt.md file and its task.
                        Format: `<slug>.<task>.prompt.md` — description
{{TEMPLATE_FILES?}}     Optional. List of every companion .template.md file and its output type.
                        Format: `<slug>.<type>.template.md` — description
-->

---
name: {{AGENT_NAME}}
description: {{DESCRIPTION}}
argument-hint: {{ARGUMENT_HINT}}
tools:
  {{TOOLS}}
handoffs:
  - label: {{HANDOFF_LABEL?}}
    agent: {{HANDOFF_AGENT?}}
    prompt: {{HANDOFF_PROMPT?}}
    send: false
---

# {{AGENT_NAME}}

{{ROLE_STATEMENT}}

---

## Quick Commands

| Command | What {{AGENT_NAME}} does |
|---|---|
| `@{{AGENT_SLUG}} {{QUICK_COMMAND_1}}` | {{QUICK_CMD_1_DESC}} |
| `@{{AGENT_SLUG}} {{QUICK_COMMAND_N?}}` | {{QUICK_CMD_N_DESC?}} |

---

## Behavioral Rules

**Will do:**
{{WILL_DO}}

**Will NOT do:**
{{WILL_NOT_DO}}

---

## Output Format

{{OUTPUT_DESCRIPTION}}

```
{{OUTPUT_STRUCTURE}}
```

---

## Companion Files

**Prompts** — one per task, located in `.github/prompts/`:
{{PROMPT_FILES}}

**Templates** — one per structured output type, located in `.github/templates/`:
{{TEMPLATE_FILES?}}
