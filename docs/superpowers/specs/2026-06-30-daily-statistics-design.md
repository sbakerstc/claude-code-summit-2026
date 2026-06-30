# Daily statistics endpoint — design

**Date:** 2026-06-30
**Status:** Approved for planning

## Summary

Add a read-only `GET /stats` endpoint that reports appointment-slot statistics
for a single calendar day: overall utilization plus breakdowns by specialty and
by provider. Synthetic data only, consistent with the rest of the repo.

## Endpoint

```
GET /stats?date=YYYY-MM-DD
```

- **`date`** — optional. When omitted, defaults to the **current UTC calendar
  day**. When present, must match `^\d{4}-\d{2}-\d{2}$`; a malformed value
  returns `400`.
- A valid day with no slots returns `200` with zeroed totals and empty
  breakdown arrays. "No slots that day" is a valid answer, not a `404`.

### Day semantics

A day is a **UTC calendar day**, matched the same way `GET /slots?date=` already
does it: `start_time LIKE '<date>%'` against the ISO 8601 `start_time` string.
This keeps a single, consistent definition of "day" across the API. The default
(when `date` is omitted) is computed as `new Date().toISOString().slice(0, 10)`,
i.e. today in UTC.

## Response shape

```json
{
  "date": "2026-06-22",
  "totals": { "slots": 12, "booked": 7, "available": 5, "booked_pct": 58.3 },
  "by_specialty": [
    { "specialty": "Cardiology", "slots": 6, "booked": 4, "available": 2 }
  ],
  "by_provider": [
    { "provider_id": 1, "name": "Dr. A. Rivera", "specialty": "Cardiology",
      "slots": 6, "booked": 4, "available": 2 }
  ]
}
```

- `booked_pct` is `booked / slots * 100`, rounded to one decimal. When
  `slots` is `0`, `booked_pct` is `0` (no division by zero).
- `by_specialty` is ordered by specialty name; `by_provider` is ordered by
  provider name. Both arrays are empty when the day has no slots.

### Booking activity

`slots.status` already tracks `booked` vs `available`, and the schema stores
**no cancellation history**. Booking activity for the day is therefore the
count of booked slots, surfaced as `totals.booked`. We deliberately do not
invent a separate cancellations metric we cannot truthfully back.

## Architecture

Follows existing repo conventions exactly:

- **`src/routes/stats.js`** — new `module.exports = function statsRoutes(db)`
  factory returning an Express router, matching `providers.js` / `slots.js` /
  `bookings.js`. The injected `db` flows from `createApp`.
- **`src/app.js`** — mount with `app.use('/stats', statsRoutes(db))`.
- Read-only: **no `db.transaction`**. A single
  `SELECT ... FROM slots s JOIN providers p ON p.id = s.provider_id
  WHERE s.start_time LIKE ? ORDER BY p.name, s.start_time` returns the day's
  rows; totals and both breakdowns are computed in JS from that one result set.
- **`openapi.yaml`** — add the `/stats` path (one `200`, one `400`) and a
  `DayStats` component schema. The spec is the contract and
  `tests/openapi.test.js` validates it.

## Validation and errors

| Condition | Response |
|-----------|----------|
| `date` omitted | `200`, stats for today (UTC) |
| `date` malformed (fails regex) | `400 { "error": "..." }` |
| Valid `date`, no slots | `200`, zeroed totals + empty arrays |
| Valid `date`, slots exist | `200`, computed stats |

## Testing

Add tests to `tests/api.test.js` using the existing `freshApp()` fixture
(2 providers, 1 location, 2 available slots on 2026-06-22 and 2026-06-23):

1. Utilization math: book one slot, then `GET /stats?date=2026-06-22` reports
   `slots: 1, booked: 1, available: 0, booked_pct: 100`.
2. Breakdowns group correctly by specialty and by provider.
3. Empty day: a date with no slots returns zeroed totals and empty arrays.
4. Malformed `date` returns `400`.
5. Omitted `date` returns `200` (defaults to today, UTC).

`tests/openapi.test.js` continues to validate the updated spec.

## Out of scope (YAGNI)

- Date ranges / multi-day stats.
- Cancellation history or audit metrics (no data to back them).
- Caching or persisted aggregates — the dataset is tiny and the query is cheap.
- Per-location breakdown (not requested).
