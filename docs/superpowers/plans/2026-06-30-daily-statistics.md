# Daily Statistics Endpoint Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a read-only `GET /stats?date=YYYY-MM-DD` endpoint reporting slot utilization plus per-specialty and per-provider breakdowns for a UTC calendar day.

**Architecture:** A new `src/routes/stats.js` Express-router factory (same `(db) => router` pattern as the existing routes), mounted in `src/app.js`. It runs one `SELECT ... JOIN providers` over the day's slots and computes totals and both breakdowns in JS from that single result set. Read-only, so no transaction. `openapi.yaml` is updated to keep the spec contract in sync.

**Tech Stack:** Node 20.x, Express 4, better-sqlite3, Jest + supertest.

## Global Constraints

- Node pinned to `>=20.17 <21`. Do not introduce `node:sqlite` (requires Node 22+); use the existing `better-sqlite3`.
- Synthetic data only, NO PHI. Do not add any field for names, contact details, DOB, or clinical data.
- Routes are factories: `module.exports = function xRoutes(db)` returning an `express.Router()`. Never import a DB singleton inside a route.
- A "day" is a UTC calendar day matched as `start_time LIKE '<date>%'`, identical to `GET /slots?date=`.
- `openapi.yaml` is the contract source of truth; update it when endpoints change.
- Run the suite with `npm test` (Jest `--runInBand`). No lint/format step exists.

---

### Task 1: `GET /stats` route — totals + breakdowns + validation

**Files:**
- Create: `src/routes/stats.js`
- Modify: `src/app.js` (add require near line 9; add `app.use` near line 45)
- Test: `tests/api.test.js` (append new tests inside the existing `describe('clinic scheduler API', ...)` block)

**Interfaces:**
- Consumes: `createApp(db)` from `src/app.js` and the `freshApp()` helper already in `tests/api.test.js` (fixture: 2 providers — `Dr. A. Rivera`/Cardiology id=`providerId`, `Dr. B. Chen`/Dermatology; 1 location; 2 available slots on `2026-06-22T09:00:00.000Z` (id=`availableSlotId`) and `2026-06-23T10:00:00.000Z`, both under `providerId`).
- Produces: `statsRoutes(db)` — an `express.Router` mounted at `/stats`. Response body shape:
  `{ date: string, totals: { slots, booked, available, booked_pct }, by_specialty: [{ specialty, slots, booked, available }], by_provider: [{ provider_id, name, specialty, slots, booked, available }] }`.

- [ ] **Step 1: Write the failing tests**

Append inside the `describe('clinic scheduler API', () => { ... })` block in `tests/api.test.js`, before its closing `});`:

```javascript
  test('GET /stats reports utilization for a given day', async () => {
    const { app, availableSlotId } = freshApp();
    await request(app)
      .post('/bookings')
      .send({ slot_id: availableSlotId, holder_ref: 'PT-0001' });

    const res = await request(app).get('/stats?date=2026-06-22');
    expect(res.status).toBe(200);
    expect(res.body.date).toBe('2026-06-22');
    expect(res.body.totals).toEqual({
      slots: 1,
      booked: 1,
      available: 0,
      booked_pct: 100,
    });
  });

  test('GET /stats breaks down by specialty and provider', async () => {
    const { app, providerId } = freshApp();
    const res = await request(app).get('/stats?date=2026-06-22');
    expect(res.status).toBe(200);
    expect(res.body.by_specialty).toEqual([
      { specialty: 'Cardiology', slots: 1, booked: 0, available: 1 },
    ]);
    expect(res.body.by_provider).toEqual([
      {
        provider_id: providerId,
        name: 'Dr. A. Rivera',
        specialty: 'Cardiology',
        slots: 1,
        booked: 0,
        available: 1,
      },
    ]);
  });

  test('GET /stats returns zeroed totals and empty arrays for an empty day', async () => {
    const { app } = freshApp();
    const res = await request(app).get('/stats?date=2026-01-01');
    expect(res.status).toBe(200);
    expect(res.body.totals).toEqual({ slots: 0, booked: 0, available: 0, booked_pct: 0 });
    expect(res.body.by_specialty).toEqual([]);
    expect(res.body.by_provider).toEqual([]);
  });

  test('GET /stats rejects a malformed date with 400', async () => {
    const { app } = freshApp();
    const res = await request(app).get('/stats?date=June-22');
    expect(res.status).toBe(400);
  });

  test('GET /stats with no date defaults to today (UTC) and returns 200', async () => {
    const { app } = freshApp();
    const today = new Date().toISOString().slice(0, 10);
    const res = await request(app).get('/stats');
    expect(res.status).toBe(200);
    expect(res.body.date).toBe(today);
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest tests/api.test.js -t "GET /stats" -v`
Expected: FAIL — the five `GET /stats` tests fail (route not mounted, requests return the fallback `404 { error: 'not found' }`).

- [ ] **Step 3: Create the route**

Create `src/routes/stats.js`:

```javascript
'use strict';

const express = require('express');

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Statistics routes.
 *   GET /stats?date=YYYY-MM-DD
 *     - date is optional; defaults to today (UTC).
 *     - reports slot utilization plus per-specialty and per-provider
 *       breakdowns for that UTC calendar day.
 *
 * Read-only: a single SELECT over the day's slots, aggregated in JS. A "day"
 * is matched as start_time LIKE '<date>%', the same UTC-calendar-day rule used
 * by GET /slots?date=.
 *
 * @param {import('better-sqlite3').Database} db
 * @returns {import('express').Router}
 */
module.exports = function statsRoutes(db) {
  const router = express.Router();

  router.get('/', (req, res) => {
    const date = req.query.date || new Date().toISOString().slice(0, 10);
    if (!DATE_RE.test(date)) {
      return res.status(400).json({ error: 'date must be in YYYY-MM-DD format' });
    }

    const rows = db
      .prepare(
        'SELECT s.status, s.provider_id, p.name AS provider_name, p.specialty ' +
          'FROM slots s JOIN providers p ON p.id = s.provider_id ' +
          'WHERE s.start_time LIKE ? ' +
          'ORDER BY p.name, s.start_time'
      )
      .all(`${date}%`);

    const totals = { slots: 0, booked: 0, available: 0, booked_pct: 0 };
    const bySpecialty = new Map();
    const byProvider = new Map();

    for (const row of rows) {
      const key = row.status === 'booked' ? 'booked' : 'available';

      totals.slots += 1;
      totals[key] += 1;

      const spec =
        bySpecialty.get(row.specialty) ||
        { specialty: row.specialty, slots: 0, booked: 0, available: 0 };
      spec.slots += 1;
      spec[key] += 1;
      bySpecialty.set(row.specialty, spec);

      const prov =
        byProvider.get(row.provider_id) ||
        {
          provider_id: row.provider_id,
          name: row.provider_name,
          specialty: row.specialty,
          slots: 0,
          booked: 0,
          available: 0,
        };
      prov.slots += 1;
      prov[key] += 1;
      byProvider.set(row.provider_id, prov);
    }

    totals.booked_pct =
      totals.slots === 0 ? 0 : Math.round((totals.booked / totals.slots) * 1000) / 10;

    res.json({
      date,
      totals,
      by_specialty: Array.from(bySpecialty.values()).sort((a, b) =>
        a.specialty.localeCompare(b.specialty)
      ),
      by_provider: Array.from(byProvider.values()),
    });
  });

  return router;
};
```

- [ ] **Step 4: Mount the route in `src/app.js`**

Add the require alongside the other route requires (after line 9, `const bookingRoutes = require('./routes/bookings');`):

```javascript
const statsRoutes = require('./routes/stats');
```

Add the mount alongside the other `app.use` mounts (after line 45, `app.use('/bookings', bookingRoutes(db));`):

```javascript
  app.use('/stats', statsRoutes(db));
```

Also add `/stats` to the `endpoints` array in the `GET /` index handler (line 34) so the index stays accurate:

```javascript
      endpoints: ['/health', '/providers', '/providers/:id/slots', '/slots', '/bookings', '/stats'],
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx jest tests/api.test.js -t "GET /stats" -v`
Expected: PASS — all five `GET /stats` tests pass.

- [ ] **Step 6: Run the full suite to confirm nothing regressed**

Run: `npm test`
Expected: PASS — all suites green.

- [ ] **Step 7: Commit**

```bash
git add src/routes/stats.js src/app.js tests/api.test.js
git commit -m "feat: add GET /stats daily statistics endpoint"
```

---

### Task 2: Document `/stats` in `openapi.yaml`

**Files:**
- Modify: `openapi.yaml` (add `stats` tag near lines 17-21; add `/stats` path before `components:` at line 187; add `DayStats` schema after the `Error` schema at line 249)
- Test: `tests/openapi.test.js` (existing; add one assertion)

**Interfaces:**
- Consumes: the response shape produced by Task 1.
- Produces: a `/stats` path and `DayStats` schema in the served `/openapi.json` document.

- [ ] **Step 1: Write the failing test**

In `tests/openapi.test.js`, add to the existing `'GET /openapi.json serves a valid OpenAPI 3 document'` test (after the `/bookings` assertion on line 28):

```javascript
    expect(res.body.paths['/stats']).toBeDefined();
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest tests/openapi.test.js -t "valid OpenAPI" -v`
Expected: FAIL — `res.body.paths['/stats']` is `undefined`.

- [ ] **Step 3: Add the `stats` tag**

In `openapi.yaml`, in the `tags:` list (lines 17-21), add after `- name: bookings`:

```yaml
  - name: stats
```

- [ ] **Step 4: Add the `/stats` path**

In `openapi.yaml`, insert immediately before the `components:` line (currently line 187):

```yaml
  /stats:
    get:
      tags: [stats]
      summary: Slot statistics for a single UTC calendar day
      parameters:
        - name: date
          in: query
          required: false
          schema:
            type: string
            pattern: '^\d{4}-\d{2}-\d{2}$'
            example: '2026-06-22'
          description: >
            UTC calendar day (YYYY-MM-DD). Optional; defaults to today (UTC).
      responses:
        '200':
          description: Statistics for the day
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/DayStats'
        '400':
          description: Malformed date
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'
```

- [ ] **Step 5: Add the `DayStats` schema**

In `openapi.yaml`, in `components.schemas`, add after the `Error` schema (after line 249):

```yaml
    DayStats:
      type: object
      properties:
        date:
          type: string
          example: '2026-06-22'
        totals:
          type: object
          properties:
            slots:
              type: integer
              example: 12
            booked:
              type: integer
              example: 7
            available:
              type: integer
              example: 5
            booked_pct:
              type: number
              example: 58.3
        by_specialty:
          type: array
          items:
            type: object
            properties:
              specialty:
                type: string
                example: Cardiology
              slots:
                type: integer
                example: 6
              booked:
                type: integer
                example: 4
              available:
                type: integer
                example: 2
        by_provider:
          type: array
          items:
            type: object
            properties:
              provider_id:
                type: integer
                example: 1
              name:
                type: string
                example: Dr. A. Rivera
              specialty:
                type: string
                example: Cardiology
              slots:
                type: integer
                example: 6
              booked:
                type: integer
                example: 4
              available:
                type: integer
                example: 2
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `npx jest tests/openapi.test.js -t "valid OpenAPI" -v`
Expected: PASS.

- [ ] **Step 7: Run the full suite**

Run: `npm test`
Expected: PASS — all suites green.

- [ ] **Step 8: Commit**

```bash
git add openapi.yaml tests/openapi.test.js
git commit -m "docs: document GET /stats in openapi.yaml"
```

---

## Self-Review

**Spec coverage:**
- `GET /stats?date=` endpoint, optional date defaulting to today UTC → Task 1 (Steps 1, 3).
- UTC-calendar-day via `LIKE '<date>%'` → Task 1, Step 3.
- Malformed date → 400 → Task 1 (test + `DATE_RE` guard).
- Empty day → 200 zeroed totals + empty arrays → Task 1 (test; loop yields zeros, `booked_pct` guarded against /0).
- `totals` with `booked_pct` rounded to one decimal → Task 1, Step 3 (`Math.round(...*1000)/10`).
- `by_specialty` ordered by specialty name → Task 1 (`.sort(localeCompare)`).
- `by_provider` ordered by provider name → Task 1 (SQL `ORDER BY p.name`).
- Booking activity = booked count via `totals.booked`; no cancellation metric → satisfied by the shape (no such field).
- New `src/routes/stats.js` factory + mount in `app.js` → Task 1, Steps 3-4.
- `openapi.yaml` path + `DayStats` schema; `tests/openapi.test.js` validates → Task 2.
- Out of scope (date ranges, cancellation history, caching, per-location) → no tasks, correct.

**Placeholder scan:** No TBD/TODO/"handle edge cases"; every code step shows full code. Pass.

**Type consistency:** Response keys (`date`, `totals.{slots,booked,available,booked_pct}`, `by_specialty[].{specialty,slots,booked,available}`, `by_provider[].{provider_id,name,specialty,slots,booked,available}`) are identical across the route (Task 1), the tests (Task 1), and the OpenAPI schema (Task 2). `statsRoutes` name matches between `stats.js` export and the `app.js` require/mount. Pass.
