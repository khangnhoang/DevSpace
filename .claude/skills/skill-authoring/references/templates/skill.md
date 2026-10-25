---
name: <skill-name>
description: "<What the skill covers, as the verbs and objects a request would contain>. Use when <the tasks that load it>, before <an action>, or for <a purpose>."
---

<!-- Template: skill. Copy to .claude/skills/<skill-name>/SKILL.md, fill every <placeholder>, delete this comment. Required (checked by npm run docs:check): the frontmatter above with name equal to the folder, a non-empty description, the "Use when / do not use when" heading, and a link to every file under references/. Everything else is recommended, not checked. Keep SKILL.md to what every use needs; move situational detail to a reference. -->

# <Skill title>

## Use when / do not use when

Use when <the tasks this skill owns>.

Do not use <the neighbouring tasks and the skill that owns each>.

## Workflow

1. <Step that every use needs.>
2. <Step. Link a rule owned elsewhere by file and section name, do not restate it.>

## Resources

Make each path below a Markdown link to the file; an unlinked reference fails the check.

| Resource | Read when | Skip when |
| --- | --- | --- |
| `references/<name>.md` | <the condition that makes the detail needed> | <the condition that makes it unnecessary> |

## Stop when

- <A hard stop, if the skill has one. Delete this section otherwise.>

## Checklist

- [ ] <Observable check that the work followed the skill.>
