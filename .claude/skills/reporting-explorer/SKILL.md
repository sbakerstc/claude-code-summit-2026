---
name: reporting-explorer
description: Navigate and answer questions about the sprawling src/reporting/ module without reading every file. Use when asked to add a report endpoint, find where a metric (utilization, revenue, capacity) is computed, consolidate duplicated reporting helpers, or summarize what the reporting surface exposes. Built for the best-practices / context-management workshop.
---

# Reporting Explorer

The `src/reporting/` module is large and repetitive on purpose. Reading all of
it into context at once is wasteful and can overflow the window. This skill is a
map plus a method so you can work surgically.

## Module map (read targets, not the whole tree)

| File | Owns | Read it when |
|------|------|--------------|
| `src/reporting/index.js` | Router; mounts everything under `/reports`; lists all endpoints. | You need the full endpoint inventory or to add a new sub-router. |
| `src/reporting/queries.js` | All SQL builders (`count*`, `*Between*`, booking queries). | You need data, or you suspect a duplicated query. |
| `src/reporting/formatters.js` | Labels, number/currency/percent formatting, ASCII/CSV rendering, `reportEnvelope`. | You touch presentation, or want to consolidate formatting helpers. |
| `src/reporting/utilization.js` | Booked-vs-total at overall/specialty/provider/location/day grain. | The metric is utilization / occupancy. |
| `src/reporting/revenue.js` | FAKE per-specialty pricing and revenue rollups. | The metric is revenue / pricing. |
| `src/reporting/capacity.js` | Forward-looking availability windows (by day/weekday/hour/specialty). | The metric is "what's open in the next N days". |

## Method

1. **Start from the inventory.** Read `index.js` first — it names every
   endpoint and which sub-router serves it. Map the request to one file.
2. **Read only that file plus `queries.js`/`formatters.js` as needed.** Do not
   open utilization, revenue, and capacity together unless the task truly spans
   all three.
3. **For "consolidate duplication" tasks**, grep for the repeated shape (e.g.
   `countBooked*By`, the `formatPercent`/`formatNumber*` family) and report the
   duplicates before changing anything. Propose one shared helper; do not
   rewrite all callers blindly.
4. **Adding an endpoint:** add a `registerXRoutes(router, db)` in the relevant
   file, call it from `index.js`, and add the path to the index list. Reuse
   existing query + formatter helpers rather than writing new SQL.
5. **Verify** with `npm test` and a quick `curl` against the new/changed route.

## Guardrails

- Synthetic data only. Never introduce fields that could hold PHI.
- Revenue numbers are fabricated demo figures; keep the disclaimer in
  `reportEnvelope`.
- Prefer reusing `queries.js` and `formatters.js` over adding parallel helpers —
  reducing duplication is usually the point of the task.
