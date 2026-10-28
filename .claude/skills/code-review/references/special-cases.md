# Special review cases

Read this only when the target is a bug fix, a refactor, a dead-code removal or a dependency change. Skip it for a feature review or a re-review that only checks earlier findings.

- **Bug fix.** Confirm the root cause, a direct correction, regression coverage or the reason none is practical ([test-quality-strategy](../../test-quality-strategy/SKILL.md#regression), Regression) plus the manual check where it applies, adjacent behavior still valid, safe failure paths, and correct permission and data boundaries.
- **Refactor.** Confirm observable behavior and public contracts are preserved, checks protect the behavior, error and performance characteristics hold, and no new behavior is mixed in.
- **Dead code.** Created by this change: remove it once safe. Pre-existing and out of scope: report as a follow-up. Unclear ownership: investigate before deleting.
- **Dependency.** Check necessity, existing alternatives, maintenance and security status, license when relevant, runtime versus dev placement, lockfile changes, and that installation was permitted. The update procedures and the table of special-case dependencies are in [dependency-updates](../../dependency-updates/SKILL.md).
