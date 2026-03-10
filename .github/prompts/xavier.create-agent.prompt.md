---
mode: agent
tools:
  - createFile
  - editFiles
  - codebase
  - readFile
  - listDirectory
description: Invoke Xavier to scaffold a complete agent — agent file, all task prompts, and output templates.
---

## Goal

Use `@xavier create agent` to generate a fully scaffolded agent: one `.agent.md`, one `.prompt.md` per task the agent performs, and one `.template.md` per structured output type.

---

## Context

Xavier is the master prompt engineer in this workspace. He lives at `.github/agents/xavier.agent.md`. Every agent Xavier produces follows `agent-scaffold.template.md` and results in a full three-layer scaffold — never just the agent file alone.

**The key principle:** agents perform multiple distinct tasks, and each task gets its own prompt file. A code reviewer agent that has three quick commands (`review`, `explain`, `suggest-refactor`) should have three corresponding `.prompt.md` files, not one generic one.

**Prompt file naming:** `<agent-slug>.<task>.prompt.md`
**Template file naming:** `<agent-slug>.<output-type>.template.md`

---

## Instructions

1. Open VS Code Copilot Chat and select **Xavier** from the agents dropdown.
2. Run: `@xavier create agent <description of the agent's role and domain>`
3. Xavier will scan the workspace, identify the agent's tasks and quick commands, then generate all files.
4. Review the summary table Xavier returns — it should list one `.agent.md`, one prompt per task, and templates for any structured outputs.
5. Use the **Test the New Agent** handoff to immediately switch to the new agent and run a trial task.

---

## Output Format

Xavier produces a summary table of every file created:

```
| Layer    | File                                          | Purpose                          |
|----------|-----------------------------------------------|----------------------------------|
| Agent    | .github/agents/<slug>.agent.md                | Agent definition                 |
| Prompt   | .github/prompts/<slug>.<task1>.prompt.md      | Prompt for task 1                |
| Prompt   | .github/prompts/<slug>.<task2>.prompt.md      | Prompt for task 2                |
| Template | .github/templates/<slug>.<type>.template.md   | Output template for <type>       |
```

---

## Example

**Input:**
```
@xavier create agent code documenter for a legacy C/C++ codebase
```

**Expected output:**
```
| Layer    | File                                                    | Purpose                            |
|----------|---------------------------------------------------------|------------------------------------|
| Agent    | .github/agents/code-documenter.agent.md                 | Agent definition                   |
| Prompt   | .github/prompts/code-documenter.document-file.prompt.md | Prompt: document a single file     |
| Prompt   | .github/prompts/code-documenter.document-module.prompt.md | Prompt: document a whole module  |
| Prompt   | .github/prompts/code-documenter.generate-index.prompt.md | Prompt: generate a docs index     |
| Template | .github/templates/code-documenter.file-doc.template.md  | File-level documentation template  |
| Template | .github/templates/code-documenter.module-doc.template.md| Module-level documentation template|
```

---

## Anti-patterns

- Do NOT ask Xavier to create just the agent file without its prompts and templates.
- Do NOT use a single generic prompt file for all of an agent's tasks — each task needs its own.
- Do NOT skip the workspace scan — Xavier must understand existing conventions before generating.
