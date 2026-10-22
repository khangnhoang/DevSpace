# Future features — backlog

Direction the Owner has set that is outside the current scope. Work that is in scope belongs in the plan.

## FEAT-001: Dependency update policy

- Status: Deferred until the test-infra program exists, because an update is only safe to accept with tests.
- Direction: set one policy by update type. Patch: update regularly and run the tests. Minor: read the changelog first. Major: handle it as its own migration task. Security fix: handle early, ordered by impact.
- Target program: none yet.
