---
description: "Use when an agent needs to interact with GitHub via the CLI: reading CI run results, opening or reviewing pull requests, reading PR comments, managing branches, or any other GitHub operation. Covers gh CLI patterns for CI, PRs, issues, and comments."
---

# GH CLI — GitHub Operations Reference

The `gh` CLI is the standard tool for all GitHub interactions in this project. Never use raw `curl` against the GitHub REST API when `gh` achieves the same thing.

---

## Authentication

`gh` is pre-authenticated via the environment. Verify with:

```bash
gh auth status
```

If it fails, the workflow environment needs the `GH_TOKEN` secret — do not attempt interactive login.

---

## Pull Requests

### Open a PR

```bash
# From the current branch, open a PR against main
gh pr create \
  --title "feat: short description" \
  --body "Closes #<issue>. Summary of changes." \
  --base main \
  --draft          # omit --draft to publish immediately
```

Use `--fill` to pre-populate title and body from commits:

```bash
gh pr create --base main --fill
```

### View a PR

```bash
gh pr view <number>            # human-readable summary
gh pr view <number> --json title,body,state,reviews,labels
```

### List open PRs

```bash
gh pr list                         # open PRs in the current repo
gh pr list --state all             # include closed/merged
gh pr list --json number,title,headRefName,state
```

### Check out a PR branch locally

```bash
gh pr checkout <number>
```

### Merge a PR

> **Requires user confirmation before running** — this modifies the shared remote.

```bash
gh pr merge <number> --squash --delete-branch
```

---

## PR Comments and Reviews

### Read all comments on a PR

```bash
gh pr view <number> --comments
```

### Read review threads (structured JSON)

```bash
gh api repos/{owner}/{repo}/pulls/<number>/reviews
gh api repos/{owner}/{repo}/pulls/<number>/comments
```

### Post a comment

```bash
gh pr comment <number> --body "Comment text here."
```

### Approve a PR

> **Requires user confirmation before running.**

```bash
gh pr review <number> --approve --body "LGTM"
```

### Request changes

```bash
gh pr review <number> --request-changes --body "Feedback here."
```

---

## CI / Workflow Runs

### List recent runs

```bash
gh run list                             # latest runs on current branch
gh run list --branch main               # runs on main
gh run list --workflow unit.yaml        # filter by workflow file
gh run list --json databaseId,status,conclusion,name,headBranch
```

### Watch a run in real time

```bash
gh run watch <run-id>
```

### View run details and logs

```bash
gh run view <run-id>                    # summary with job list
gh run view <run-id> --log              # full logs
gh run view <run-id> --log-failed       # only failed job logs (most useful)
```

### Get the run ID for the most recent run on current branch

```bash
gh run list --limit 1 --json databaseId --jq '.[0].databaseId'
```

### Re-run a failed workflow

> **Requires user confirmation before running** — re-runs consume CI minutes.

```bash
gh run rerun <run-id> --failed   # re-run only failed jobs
gh run rerun <run-id>            # re-run the entire workflow
```

---

## Issues

### Create an issue

```bash
gh issue create \
  --title "Bug: short description" \
  --body "Steps to reproduce..." \
  --label "bug"
```

### View an issue

```bash
gh issue view <number>
gh issue view <number> --comments
gh issue view <number> --json title,body,state,comments
```

### List open issues

```bash
gh issue list
gh issue list --label "bug"
gh issue list --json number,title,state,labels
```

---

## Branches and Repo

### List branches (remote)

```bash
gh api repos/{owner}/{repo}/branches --jq '.[].name'
```

### Check current repo context

```bash
gh repo view              # current repo name, description, default branch
gh repo view --json name,defaultBranchRef,url
```

---

## JSON Querying Tips

All `--json` outputs can be filtered with `--jq`:

```bash
# Get only failing run conclusions
gh run list --json conclusion,name --jq '.[] | select(.conclusion == "failure")'

# Get PR numbers for open PRs
gh pr list --json number,state --jq '.[] | select(.state == "OPEN") | .number'
```

---

## Common Patterns for Agents

### "Did CI pass on my branch?"

```bash
BRANCH=$(git rev-parse --abbrev-ref HEAD)
gh run list --branch "$BRANCH" --limit 1 --json conclusion,status,name \
  --jq '.[0] | "Status: \(.status) Conclusion: \(.conclusion)"'
```

### "What failed in the last run?"

```bash
RUN_ID=$(gh run list --limit 1 --json databaseId --jq '.[0].databaseId')
gh run view "$RUN_ID" --log-failed
```

### "Show me all review comments on an open PR"

```bash
PR=$(gh pr list --limit 1 --json number --jq '.[0].number')
gh pr view "$PR" --comments
```

---

## Safety Rules

- **Never `gh pr merge` or `gh run rerun` without explicit user confirmation.** These affect shared state.
- **Never `gh repo delete` under any circumstances.**
- **Never force-push via `gh` wrappers** — use Git directly and only with user confirmation.
- Prefer `--json` output for programmatic parsing; pipe through `--jq` rather than `grep`/`awk`.
