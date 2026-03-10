# Xavier — Master Prompt Engineer

Xavier is a VS Code custom agent that **designs and generates other agents** — and all their scaffolding — from a single command. Drop the `.github/` folder into any workspace and Xavier is ready to build your entire agent ecosystem.

---

## Quick Start

1. Copy the `.github/` folder into your workspace root.
2. Open VS Code Copilot Chat and select **Xavier** from the agents dropdown.
3. Run a command:

```
@xavier create agent code documenter for a legacy C/C++ codebase
@xavier design workflow plan → implement → review for feature branches
@xavier audit .github/agents/my-agent.agent.md
@xavier list
```

---

## Quick Commands

| Command | What happens |
|---|---|
| `@xavier create agent <description>` | Emits `.agent.md` + one `.prompt.md` per task + `.template.md` per output type — all in one shot |
| `@xavier design workflow <description>` | Plans a multi-agent pipeline and scaffolds every agent in the chain |
| `@xavier audit <path>` | Scores an agent against the scaffold standard and offers to fix it |
| `@xavier list` | Tables every agent, prompt, and template in the workspace |

---

## The Multi-Prompt Model

Agents perform multiple distinct tasks. Each task gets its own `.prompt.md` file.

```
.github/prompts/
├── code-reviewer.review-pr.prompt.md
├── code-reviewer.explain-diff.prompt.md
└── code-reviewer.suggest-refactor.prompt.md
```

Xavier generates all of them automatically as part of `create agent`. You never need to ask separately.

**Naming conventions:**
- Prompts → `<agent-slug>.<task>.prompt.md`
- Templates → `<agent-slug>.<output-type>.template.md`

---

## File Structure

```
.github/
├── agents/
│   └── xavier.agent.md                        ← Xavier (master prompt engineer)
├── prompts/
│   ├── xavier.create-agent.prompt.md          ← How to scaffold a new agent
│   ├── xavier.design-workflow.prompt.md       ← How to design a multi-agent pipeline
│   ├── xavier.audit.prompt.md                 ← How to audit an existing agent
│   └── xavier.list.prompt.md                  ← How to list all workspace agents
└── templates/
    ├── agent-scaffold.template.md                       ← Canonical structure all agents must follow
    └── prompt.template.md                      ← Template for new .prompt.md files
```

---

## The Agent Scaffold

Every agent Xavier generates follows `agent-scaffold.template.md`. Required section order:

1. YAML frontmatter
2. H1 name + role statement
3. **Quick Commands** — always the first substantive section
4. Behavioral Rules
5. Output Format
6. Companion Files (prompts + templates)

---

## Placeholder Convention

| Syntax | Meaning |
|---|---|
| `{{NAME}}` | Required — must be replaced before use |
| `{{NAME?}}` | Optional — replace or delete the line |
