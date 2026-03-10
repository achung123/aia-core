---
mode: agent
tools:
  - readFile
  - listDirectory
  - editFiles
description: Invoke Xavier to audit an existing agent against the scaffold standard.
---

## Goal

Use `@xavier audit` to score an existing agent against the scaffold standard and get a concrete list of gaps with an offer to fix them in place.

---

## Context

Over time agents drift from the scaffold standard — missing prompts, wrong section order, over-broad tool lists, missing templates. Xavier's audit reads the agent file, checks every companion file, and scores each criterion from `agent-scaffold.template.md`.

---

## Instructions

1. Open VS Code Copilot Chat and select **Xavier** from the agents dropdown.
2. Run: `@xavier audit <path to .agent.md or agent slug>`
3. Xavier reads the agent file and all files in `.github/prompts/` and `.github/templates/` that share its slug.
4. Xavier returns a scored checklist and a list of recommended fixes.
5. Confirm to have Xavier apply the fixes directly.

---

## Output Format

```
## Audit: <agent-name>

| Check | Status | Notes |
|-------|--------|-------|
| YAML frontmatter valid | ✅ / ❌ | ... |
| Quick Commands first section | ✅ / ❌ | ... |
| argument-hint matches commands | ✅ / ❌ | ... |
| tools list minimal | ✅ / ❌ | ... |
| One prompt per task | ✅ / ❌ | Missing: <slug>.<task>.prompt.md |
| Templates for structured output | ✅ / ❌ | ... |
| Handoffs defined | ✅ / ❌ | ... |
| Matches agent-scaffold.template.md | ✅ / ❌ | ... |

### Recommended fixes
1. ...
2. ...

Apply all fixes? (yes / review each)
```

---

## Anti-patterns

- Do NOT audit Xavier himself unless asked — focus on user-created agents.
- Do NOT silently fix files without announcing the changes first.
