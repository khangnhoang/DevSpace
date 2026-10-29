# Agent model selection

Read this before assigning a model or effort to an exploration subagent, implementor or independent reviewer. This is the single source of truth for the Owner's role-to-model choices across Codex and Claude.

Main uses the model and effort the Owner selected in the current chat; do not override them through this table.

| Role | Codex model | Reasoning effort | Claude model | Effort |
| --- | --- | --- | --- | --- |
| Explore | GPT-6 Luna (`gpt-6-luna`) | `high` | Haiku | `high` |
| Implementor | GPT-6.1 Sol (`gpt-6.1-sol`) | `medium` | Sonnet (`claude-sonnet-5-5`) | `high` |
| Independent reviewer | GPT-6.1 Sol (`gpt-6.1-sol`) | `high` | Opus | `high` |

Use the selected model's supported identifier from the current execution tool. Haiku and Opus name families, not pinned API versions; do not invent an identifier. If the selected model, effort or required execution method is unavailable or ambiguous, report the blocker instead of silently selecting another model or effort. Verify the effective model and effort when the tool exposes them.

The Owner's explicit assignment for a task takes precedence over this table. Model selection does not assign a role or authorize execution: responsibilities and permissions are owned by [AGENTS.md](../AGENTS.md), execution boundaries by [agent-loops.md](agent-loops.md), and Claude tool bindings by [.claude/rules.md](../.claude/rules.md).
