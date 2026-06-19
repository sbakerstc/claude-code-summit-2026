# Best-practices workshop — the task

> Branch: `workshop/03-best-practices`. Synthetic data only, no PHI.

## The ask (deliberately broad)

> "Add a single **`GET /reports/overview`** endpoint and a matching
> **`GET /reports/overview.txt`** that pulls together the *entire* reporting
> module into one consolidated dashboard: overall utilization, utilization by
> specialty / provider / location, fabricated revenue by specialty / provider /
> location, and forward capacity by day / weekday / hour for the next 14 days.
> While you are in there, the formatting and query helpers have drifted into
> near-duplicates over time. Consolidate the redundant `formatNumber*` /
> `formatPercent*` family and the repeated `countBooked*By*` query builders so
> the module is DRY, and make sure every existing `/reports/*` endpoint still
> returns the same shape."

## Why this overflows context if approached naively

Reading `src/reporting/` end to end (`index.js`, `queries.js`, `formatters.js`,
`utilization.js`, `revenue.js`, `capacity.js`) plus the core app just to "see
everything before editing" pulls a large amount of repetitive code into the
window at once. Most of it is not needed to do the task.

## How to do it well (this is the lesson)

1. **Use the `reporting-explorer` skill** (`.claude/skills/reporting-explorer/`).
   It is the module map — start there instead of reading every file.
2. **Read `index.js` first** for the endpoint inventory, then open only the
   files a given sub-task needs.
3. **Reuse** the existing `register*Routes`, `queries.js`, and `formatters.js`
   helpers. The overview endpoint should call the existing builder functions
   (`overallUtilization`, `revenueBySpecialty`, `capacityNextDays`, ...), not
   re-query.
4. **For the consolidation half**, grep for the duplicated shapes first, list
   them, propose one shared helper each, then apply. Do not rewrite all callers
   in one giant pass.
5. **`/compact`** between the "build the endpoint" phase and the "consolidate
   duplication" phase so stale file contents leave the window.
6. **Verify** with `npm test` and `curl http://localhost:3000/reports/overview`.

## Acceptance

- `GET /reports/overview` returns one envelope containing utilization, revenue,
  and capacity sections.
- `GET /reports/overview.txt` renders a readable plain-text dashboard.
- Duplicated formatter/query helpers are reduced to shared implementations.
- All previously-existing `/reports/*` responses are unchanged in shape.
- `npm test` is green.
