<!-- Template: master plan. Copy to docs/programs/<program>/plan.md, fill every <placeholder>, delete this comment. No State section. Replace the backticked file names with real Markdown links once the file sits in the program folder. -->

# Master plan — <program name>

Progress: `progress.md`. Problems: `problems.md`. Each unit has a detail plan at `implementation-plans/<code>-u<n>-<slug>/plan.md`; follow-up work from `problems.md` or `future-features.md` may have an entry plan at `implementation-plans/<id>-<slug>/plan.md` with no Units row.

## 1. Goal and outcome

- Goal: <one or two sentences>.
- Outcome <n>: <observable result the program delivers>.
- Size and risk: <small / medium / large, and the reason in one line>.

## 2. Owner decisions

One line each: number, date, decision. Keep the decision's meaning; put reasoning in a detail plan, not here.

1. (<YYYY-MM-DD>) <decision>.

## 3. Shared invariants

Rules every unit must keep. One line each, with the failure it prevents.

- <invariant> — prevents <failure>.

## 4. Units

| Unit | Branch | Outcome | Dependencies | Gate to start or enable |
| --- | --- | --- | --- | --- |
| <CODE>-U1 <title> | `<branch>` | Outcome <n> | <none, or hard/soft on <CODE>-U<n>> | <Owner approval, rollout step, merge of <CODE>-U<n>> |

## 5. Order and rollout gates

<Merge and rollout order, including hosted steps and what must be true before each. A numbered list.>

## 6. Program risks

| Risk | Mitigation |
| --- | --- |
| <risk> | <mitigation> |

## 7. Out of scope

- <excluded item>.
