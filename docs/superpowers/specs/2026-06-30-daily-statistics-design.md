# Daily Statistics Endpoint — Design

**Date:** 2026-06-30
**Status:** Approved

## Goal

Add a read-only endpoint that reports appointment statistics for a single
calendar day, over the existing synthetic `slots` / `providers` data. No schema
changes, no PHI — pure aggregate counts.

## Endpoint

`GET /stats?date=YYYY-MM-DD`

- `date` is **required** and must match `YYYY-MM-DD`. Missing or malformed →
  `400 { "error": ... }` (same validation style as `src/routes/bookings.js`).
- Day filtering uses the same `start_time LIKE 'YYYY-MM-DD%'` prefix match the
  `/slots` route already uses (UTC calendar day).

## Response (200)

```json
{
  "date": "2026-06-22",
  "totals": { "slots": 4, "available": 3, "booked": 1 },
  "utilization": 0.25,
  "by_provider": [
    { "provider_id": 1, "name": "Dr. A. Rivera", "specialty": "Cardiology",
      "slots": 2, "available": 1, "booked": 1 }
  ],
  "by_specialty": [
    { "specialty": "Cardiology", "slots": 2, "available": 1, "booked": 1 }
  ]
}
```

- `utilization` = `booked / slots`, rounded to 2 decimals. `0` when the day has
  no slots (no divide-by-zero).
- A day with no slots returns `200` with zeroed `totals`, `utilization: 0`, and
  empty breakdown arrays — not a 404.
- `by_provider` ordered by provider name; `by_specialty` ordered by specialty.
  Both deterministic.

## Implementation

1. **`src/routes/stats.js`** — `(db) => express.Router()` factory with one
   `GET /`. Validates `date`, then runs day-filtered aggregate queries against
   `slots` JOIN `providers`. Synchronous `better-sqlite3` calls; read-only.
2. **`src/app.js`** — `require` the module, `app.use('/stats', statsRoutes(db))`,
   and add `/stats` to the `/` index `endpoints` array.
3. **`openapi.yaml`** — add a `stats` tag, the `/stats` path (required `date`
   param, `200` + `400` responses), and a `DailyStats` schema component.
4. **`tests/api.test.js`** — happy-path totals/utilization for a known day,
   per-provider and per-specialty breakdowns, empty-day zeroed 200, and
   missing/invalid `date` → 400.

## Non-goals

- No date ranges or multi-day aggregation.
- No new tables or columns.
- No exposure of `holder_ref` or any identifying field.
