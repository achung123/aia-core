---
name: land-session
description: Land the plane at the end of a work session — run quality gates, update beads state, commit, and push to remote per the AGENTS.md contract. Use at the end of any work session, after closing the final task of an epic, or before declaring a PR ready.
---

# Land Session

Complete the mandatory session-end protocol from `AGENTS.md`: run quality gates, update beads issue state, commit and **push** all work to remote, clean up local stashes, and hand off context — so no work is stranded locally.

## When to use

- Any time you are wrapping a work session, handing off, or pausing
- After the final task of an epic is closed
- Before declaring a pull request ready for review

Work is **not complete** until `git push` succeeds. Always run this skill as the last step.

## Context

- The canonical contract is in `AGENTS.md` under "Landing the Plane"
- `bd sync` runs automatically on bd commands, but we call it explicitly before push to be safe
- Pre-commit hooks must be clean before any commit
- Never use `--no-verify` or force-push without explicit user confirmation

## Instructions

1. **File follow-ups.** Any discovered bugs, TODOs, or cleanups from the session → `bd create "<title>" --description "..." -p <N> --deps discovered-from:<parent>`.
2. **Quality gates (if code changed):**
   - `cd backend && uv run pytest test/` — must be fully green
   - `pre-commit run --all-files` — fix everything it reports, re-run until clean
   - If a frontend change: run its test command from `frontend/`
3. **Update beads state.** Close finished work with `bd close <id> --reason "..."`; make sure no in-progress tasks are left stale.
4. **Commit.** Stage and commit any remaining changes with a message that includes the beads ID:
   ```bash
   git add -A
   git commit -m "<summary> (bd-xxx)"
   ```
5. **Push to remote — MANDATORY:**
   ```bash
   git pull --rebase
   bd sync
   git push
   git status   # must show "up to date with origin"
   ```
   If push fails (conflicts, hook failures, remote changes), resolve and retry until it succeeds. Do **not** stop before this step completes.
6. **Clean up.** Clear any `git stash` entries you own, prune merged remote branches you created.
7. **Verify.** Confirm: all tests pass, pre-commit clean, `git status` clean, `git status -sb` shows up-to-date with origin, beads state reflects reality.
8. **Hand off.** Produce the session report so the next session has full context.

## Output format

```
## Session Landed — <date>

**Beads closed:** <ids>
**Beads opened (discovered):** <ids or "none">
**Quality gates:**
  - pytest: X passed, 0 failed
  - pre-commit: clean
**Commits pushed:** <N> (<first-sha>..<last-sha>)
**Remote:** ✅ up to date with origin/<branch>

### Follow-ups for next session
- <bullet> (<bd-id>)
- <bullet>
```

## Anti-patterns

- Stopping after commit without pushing — this is the single most important rule
- Saying "ready to push when you are" — you push
- Using `git push --force` or `git push --no-verify` without explicit user confirmation
- Skipping `git pull --rebase` before push
- Closing the session with failing tests or unresolved pre-commit hooks
- Leaving work in an uncommitted stash "for later"
- Pushing while in-progress beads tasks are still in `in_progress` without a deliberate reason
