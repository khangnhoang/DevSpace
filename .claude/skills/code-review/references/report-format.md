# Review report format

Read this before writing a formal report with several findings. A small review with no actionable finding needs only a verdict and the next action.

## Finding

```text
[Severity] <short title>

Location: <file and symbol or line>
Problem: <what is wrong>
Impact: <observable consequence or maintenance cost>
Evidence: <code, command output, migration, repository fact>
Required change: <the smallest valid correction>
```

For a `Suggestion`, write "Suggested improvement" instead of "Required change". Every blocking finding (`Critical`, `Required`) needs evidence and a correction that can be done.

## Report

Report language: `AGENTS.md` section 1. Keep identifiers, paths, commands and exact errors.

```text
## Scope reviewed
Goal, baseline and diff range, skills read, evidence examined

## Summary
What changed; overall assessment

## Findings
Critical / Required / Suggestion / Nit / FYI

## Verification
Automated, manual QA, not checked or blocked

## Scope audit
Expected, unrelated, missing

## Verdict and next action
```

Omit empty sections for a small review, but always give the verdict and the next action.
