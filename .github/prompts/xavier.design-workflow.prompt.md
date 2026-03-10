---
mode: agent
tools:
  - createFile
  - editFiles
  - codebase
  - readFile
  - listDirectory
description: Invoke Xavier to plan and scaffold a full multi-agent pipeline with handoffs.
---

## Goal

Use `@xavier design workflow` to design a multi-agent pipeline where each agent hands off to the next, and get every agent in the chain fully scaffolded in one pass.

---

## Context

Workflows are sequences of specialized agents connected by handoffs. Xavier designs the pipeline, determines which agent handles each stage, defines the handoff labels and pre-filled prompts between them, then scaffolds every agent in the chain using the full three-layer rule (`.agent.md` + task prompts + templates).

---

## Instructions

1. Open VS Code Copilot Chat and select **Xavier** from the agents dropdown.
2. Run: `@xavier design workflow <description of the end-to-end process>`
3. Xavier will propose an ASCII flow diagram of the pipeline for your review before generating files.
4. Confirm or adjust the pipeline shape, then Xavier will scaffold all agents.

---

## Output Format

Xavier first shows the pipeline diagram:

```
[ Planner ] --"Implement Plan"--> [ Implementer ] --"Review Code"--> [ Reviewer ]
```

Then produces the full scaffold summary table grouped by agent.

---

## Example

**Input:**
```
@xavier design workflow plan, implement, and review new features for a C/C++ microservice
```

**Expected output:**
```
Pipeline:
[ Planner ] --"Implement Plan"--> [ Implementer ] --"Review Changes"--> [ Reviewer ]

Files created:
| Agent       | File                                              |
|-------------|---------------------------------------------------|
| Planner     | .github/agents/planner.agent.md                   |
|             | .github/prompts/planner.plan-feature.prompt.md    |
|             | .github/templates/planner.plan.template.md        |
| Implementer | .github/agents/implementer.agent.md               |
|             | .github/prompts/implementer.implement.prompt.md   |
| Reviewer    | .github/agents/reviewer.agent.md                  |
|             | .github/prompts/reviewer.review-changes.prompt.md |
|             | .github/templates/reviewer.review-report.template.md |
```

---

## Anti-patterns

- Do NOT design a workflow with only one agent — use `@xavier create agent` for single agents.
- Do NOT skip handoff definitions — every agent in a chain must have a handoff to the next.
