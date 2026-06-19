# Agents workshop — feature brief: add a waitlist

> Branch: `demo/05-agents`. **Unimplemented on purpose.** This is the task to
> orchestrate. Synthetic data only, no PHI — a waitlist entry uses the same
> opaque `holder_ref` (e.g. `PT-0001`) the rest of the app uses.

## Goal

When a slot is already `booked`, a `holder_ref` should be able to **join a
waitlist** for it. When that slot's booking is **cancelled**, the *first*
waitlisted entry is **automatically promoted** into a real booking (FIFO), and
the slot goes straight back to `booked` rather than `available`.

This spans the model, the routes, and the tests, which is why it is a good fit
for splitting across subagents and resumable, long-running work.

## Scope (multi-file)

1. **Model — `src/db.js`**
   - Add a `waitlist` table:
     `id` (PK), `slot_id` (FK → slots), `holder_ref` (TEXT), `created_at`
     (TEXT, ISO). FIFO ordering is by `id` / `created_at`.
   - Keep it in the same `CREATE TABLE IF NOT EXISTS` schema block.

2. **Routes — `src/routes/waitlist.js` (new) + wire-up in `src/app.js`**
   - `POST /slots/:id/waitlist` — body `{ "holder_ref": "PT-0007" }`.
     - 404 if the slot does not exist.
     - 409 if the slot is currently `available` (you can just book it, no need
       to wait). Only `booked` slots accept waitlist entries.
     - 400 on a missing/blank `holder_ref`.
     - 201 with the created waitlist entry otherwise.
   - `GET /slots/:id/waitlist` — list entries for a slot in FIFO order.
   - `DELETE /waitlist/:id` — leave the waitlist (remove an entry). 204 / 404.

3. **Promotion logic — extend `DELETE /bookings/:id` in `src/routes/bookings.js`**
   - On cancel, inside the existing transaction:
     - If the freed slot has waitlist entries, pop the **oldest** one, create a
       `bookings` row for it, delete that waitlist entry, and set the slot back
       to `booked` (it never becomes `available`).
     - If the waitlist is empty, behave exactly as today (slot → `available`).
   - The cancel response should indicate whether a promotion happened, e.g.
     `{ "cancelled": <id>, "promoted_booking_id": <id|null> }` (keep it small).

4. **Seed — `scripts/seed.js`**
   - Optionally add a few waitlist entries against some `booked` slots so the
     endpoints return data out of the box. Keep it idempotent (clear `waitlist`
     in the FK-safe reset, before `bookings`).

5. **Tests — `tests/waitlist.test.js`**
   - A ready acceptance spec already exists in this file, currently wrapped in
     `describe.skip(...)`. Remove the `.skip` and make it pass. Add edge cases
     as you go.

## Acceptance criteria

- `npm test` is green with `tests/waitlist.test.js` **un-skipped**.
- Join a booked slot's waitlist → 201; joining an available slot → 409.
- Cancelling a booking on a slot with a waitlist promotes the FIFO-first entry,
  creates its booking, removes it from the waitlist, and leaves the slot
  `booked`.
- Cancelling a booking with an empty waitlist frees the slot (`available`), as
  today.
- No PHI; waitlist stores only `slot_id`, opaque `holder_ref`, timestamp.

## Suggested orchestration (the point of WS5)

- **Subagent A — model + seed:** schema migration in `db.js`, FK-safe reset and
  sample rows in `seed.js`.
- **Subagent B — routes:** `src/routes/waitlist.js` and the `app.js` wire-up.
- **Subagent C — promotion + tests:** the `DELETE /bookings/:id` change and
  un-skipping `tests/waitlist.test.js`.
- Integrate, run `npm test`, then `/review` the diff.

State to carry across a long/resumable run: the schema shape, the FIFO rule, the
promotion contract on cancel, and which files each subagent owns.
