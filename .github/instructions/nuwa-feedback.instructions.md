---
applyTo: "**"
---

# Nuwa Feedback

> Address review findings from Nuwa persona reviews. Use when FEEDBACK.md exists, user mentions nuwa review feedback, or asks to fix review findings.

Systematically address findings in `FEEDBACK.md` from `nuwa review`.

## When to Use

- `FEEDBACK.md` exists in the project root
- User says "address nuwa feedback", "fix review findings", or "/nuwa-feedback"
- After `nuwa review` produced action items

## Workflow

1. **Read** `FEEDBACK.md` completely — check **Trend**, **Severity Scorecard**, and **Review Trace**
2. **Prioritize** by severity: critical → high → medium → low → info
3. **For each finding:**
   - Read the cited file and surrounding context
   - Apply the persona's suggested fix (root cause, not symptom)
   - Run relevant tests / lint
4. **Update** `FEEDBACK.md` — mark addressed items or regenerate via `nuwa review`
5. **Summarize** what changed and what remains

## Rules

- Fix root causes, not symptoms (Linus persona standard)
- Do not skip critical/high items without explicit user approval
- Match project conventions in surrounding code
- After fixes, suggest: `nuwa review --staged` to verify trend improved

## Output Format

```markdown
## Nuwa Feedback Progress

### Fixed
- [severity] title — what you changed

### Remaining
- [severity] title — why deferred (if any)

### Verification
- commands run and results
```
