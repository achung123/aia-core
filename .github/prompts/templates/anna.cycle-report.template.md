<!--
ANNA CYCLE & EPIC REPORT TEMPLATE
==================================
Used by Anna (Rogue) to report per-cycle results and epic summaries.

PLACEHOLDER LEGEND:
  {{CYCLE_NUMBER}}         Required. Current cycle number.
  {{TASK_TITLE}}           Required. Title of the task worked on this cycle.
  {{BEADS_ID}}             Required. Beads ID of the claimed task.
  {{HANK_RESULT}}          Required. Implementation outcome: ✅ Completed / ⚠️ Partial / ❌ Failed
  {{SCOTT_FINDINGS}}       Required. Finding counts: N findings (C: x, H: x, M: x, L: x)
  {{FINDINGS_FILED}}       Required. Number of bugs filed + sync status.
  {{CLOSE_RESULT}}         Required. ✅ Closed / ⏭️ Skipped (findings)
  {{BUG_COUNTER}}          Required. Current bug counter value.
  {{BUG_COUNTER_MAX}}      Required. Break-glass threshold (5).
  {{BUG_STATUS}}           Required. OK / ⚠️ APPROACHING / 🛑 BREAK GLASS
  {{TASKS_COMPLETED}}      Required. Number of tasks completed so far.
  {{TASKS_TOTAL}}          Required. Total number of tasks in the epic.
  {{EPIC_TITLE?}}          Optional. Used in epic summary only.
  {{TOTAL_CYCLES?}}        Optional. Used in epic summary only.
  {{TOTAL_BUGS?}}          Optional. Used in epic summary only.
  {{BREAK_GLASS_HIT?}}     Optional. Yes/No — used in epic summary only.
  {{FINAL_STATUS?}}        Optional. ✅ Complete / 🛑 Halted / ⏸️ Paused
-->

## Cycle {{CYCLE_NUMBER}} — {{TASK_TITLE}}

| Phase | Agent | Result |
|-------|-------|--------|
| Pick | Logan | Claimed {{BEADS_ID}} — {{TASK_TITLE}} |
| Implement | Hank | {{HANK_RESULT}} |
| Review | Scott | {{SCOTT_FINDINGS}} |
| Findings | Jean + Logan | {{FINDINGS_FILED}} |
| Close | Logan | {{CLOSE_RESULT}} |

**Bug counter:** {{BUG_COUNTER}}/{{BUG_COUNTER_MAX}} — {{BUG_STATUS}}
**Epic progress:** {{TASKS_COMPLETED}}/{{TASKS_TOTAL}} tasks complete

---

<!--
EPIC SUMMARY — use this section when the loop ends (completion, halt, or pause)
-->

## Epic {{FINAL_STATUS?}} — {{EPIC_TITLE?}}

| Metric | Value |
|--------|-------|
| Total cycles | {{TOTAL_CYCLES?}} |
| Tasks completed | {{TASKS_COMPLETED}} / {{TASKS_TOTAL}} |
| Bugs filed | {{TOTAL_BUGS?}} |
| Break glass triggered | {{BREAK_GLASS_HIT?}} |
| Final status | {{FINAL_STATUS?}} |
