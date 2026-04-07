---
mode: ask
tools:
  - listDirectory
  - readFile
description: Invoke Xavier to list all agents, prompts, and templates in the workspace.
---

## Goal

Use `@xavier list` to get a full inventory of every agent, prompt file, and template in the workspace, grouped by type and cross-linked by agent slug.

---

## Context

As a workspace grows, it's easy to lose track of what agents exist, which prompts belong to which agent, and whether every agent has its full scaffold. `@xavier list` gives a single authoritative view.

---

## Instructions

1. Open VS Code Copilot Chat and select **Xavier** from the agents dropdown.
2. Run: `@xavier list`
3. Xavier scans `.github/agents/`, `.github/prompts/`, and `.github/templates/`.
4. Xavier returns the inventory table and flags any agents missing prompts or templates.

---

## Output Format

```
| Type     | File                                              | Purpose                  |
|----------|---------------------------------------------------|--------------------------|
| Agent    | .github/agents/xavier.agent.md                    | Master prompt engineer   |
| Prompt   | .github/prompts/xavier.create-agent.prompt.md     | Scaffold a new agent     |
| Prompt   | .github/prompts/xavier.audit.prompt.md            | Audit an existing agent  |
| Template | .github/templates/agent-scaffold.template.md               | Canonical agent structure|
| ...      | ...                                               | ...                      |

⚠️  Agents missing prompts: none
⚠️  Agents missing templates: none
```

---

## Anti-patterns

- Do NOT list files outside of `.github/agents/`, `.github/prompts/`, and `.github/templates/`.
