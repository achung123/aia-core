---
mode: plan
tools:
  - codebase
  - readFile
  - listDirectory
  - search
  - fetch
description: Run a focused clarification interview to surface ambiguities before generating planning documents.
---

## Goal

Conduct a structured intake interview with the user to clarify an abstract idea or design document, producing a clear set of confirmed requirements that can feed directly into spec/plan/task generation.

---

## Context

Jean uses intake as a **mandatory** gating step for every planning session. Even well-specified input contains implicit assumptions, unstated priorities, and scope boundaries that benefit from explicit confirmation. The intake phase prevents wasted effort by catching ambiguities, missing scope, and unstated assumptions before any documents are written.

---

## Instructions

1. **Read the input.** Parse the user's idea, design doc, or URL thoroughly.
2. **Scan the workspace.** Use `codebase` and `listDirectory` to understand the existing project — tech stack, structure, patterns.
3. **Identify gaps.** Look for:
   - Undefined scope boundaries (what's in vs. out)
   - Missing user roles or personas
   - Unclear integrations or external dependencies
   - Ambiguous functional requirements
   - Unstated non-functional requirements (performance, security, scale)
   - Unknown constraints (timeline, budget, platform targets)
4. **Formulate questions.** Group them by theme:
   - **Scope** — What's included, what's deferred
   - **Users** — Who uses this, what are their roles
   - **Technical** — Stack preferences, integrations, infrastructure
   - **Constraints** — Deadlines, budget, compliance, platform
5. **Present no more than 7 questions** in the first round. Format every question as **multiple choice** with 3–4 lettered options (`A)`, `B)`, `C)`, `D)`) that cover the most likely answers, plus a final `Other: ___` option. Keep each question to 1 line of text + the options below it. No paragraph-length explanations per question.
6. **Wait for answers.** The user can reply with just letters (e.g. `1:B, 2:A, 3:Other: Vite`). Do not proceed until they respond.
7. **Evaluate answers.** If answers introduce new ambiguity, ask **one follow-up round** of max 3 questions in the same multiple-choice format.
8. **Summarize confirmed requirements.** Present a concise bullet list of what was decided, grouped by theme.
9. **Recommend next step.** Suggest running `@jean plan <idea>` with the confirmed requirements to generate all three documents.

---

## Output Format

**Round 1 — Intake Questions:**

```
**Scope**
1. <question>?
   A) <option>  B) <option>  C) <option>  D) Other: ___

2. <question>?
   A) <option>  B) <option>  C) Other: ___

**Users**
3. <question>?
   A) <option>  B) <option>  C) Other: ___

**Technical**
4. <question>?
   A) <option>  B) <option>  C) <option>  D) Other: ___

5. <question>?
   A) <option>  B) <option>  C) Other: ___

**Constraints**
6. <question>?
   A) <option>  B) <option>  C) Other: ___
```

> Reply with just the letters, e.g. `1:A, 2:B, 3:C` — or fill in `Other: ___` for anything not listed.

**After answers — Confirmed Requirements:**

```
## Confirmed Requirements

**Scope**
- <confirmed item>

**Users**
- <confirmed item>

**Technical**
- <confirmed item>

**Constraints**
- <confirmed item>

---
Ready to generate documents. Run `@jean plan <idea>` to proceed.
```

---

## Example

**Input:**
```
I want to build a dashboard for monitoring IoT devices.
```

**Expected output:**
```
The idea has several open questions. Let me clarify before we plan.

**Scope**
1. What types of IoT devices — sensors, actuators, gateways, or all?
2. Is this a view-only dashboard or should users be able to send commands to devices?

**Users**
3. Who are the primary users — field technicians, operations managers, or developers?
4. Do you need role-based access control (e.g., admin vs. read-only)?

**Technical**
5. Are devices reporting via MQTT, HTTP, or another protocol?
6. Do you need historical data visualization or only real-time?

**Constraints**
7. What's the expected device count — tens, thousands, millions?
```

---

## Anti-patterns

- **Do NOT ask open-ended questions** like "Tell me more about the project." Every question must be answerable in one sentence.
- **Do NOT ask more than 7 questions** in the first round. Prioritize the most impactful gaps.
- **Do NOT skip the workspace scan.** Existing code provides critical context that shapes better questions.
- **Do NOT generate any documents** during intake. This prompt is for questions only.
- **Do NOT ask about things already stated** in the user's input. Read carefully first.
