# Workshops — branch map

This one repository is reused across every hands-on session at the Claude Code
Summit 2026. `main` is the clean, all-green baseline. Each session works from
its own branch built off `main`, so you can always `git diff main` to see what a
session adds.

> All branches use the same **synthetic, no-PHI** data described in the
> [README](./README.md). Nothing here ever holds real patient information.

| Branch | Session | What it adds |
|--------|---------|--------------|
| `main` | Baseline | App runs, `npm test` all green, `npm run seed` populates synthetic data. |
| `workshop/01-from-zero` | WS1 — Claude Code from zero | One **seeded bug**: `POST /bookings` does not check whether a slot is already booked, so double-booking succeeds. A test, "cannot double-book a slot", **fails** on this branch. The explore → fix → test → commit exercise. |
| `workshop/02-mcp` | WS2 — Intro to MCP | A **well-populated** SQLite DB plus **5–8 seeded GitHub issues** (created on the GitHub repo separately) so you connect the GitHub MCP and a database MCP and pull real context. |
| `workshop/03-best-practices` | WS7 — Best practices | A deliberately **large/sprawling** `src/reporting/` module plus an example `.claude/skills/` skill, so context management, `/compact`, and skills are demonstrable on real bulk. Includes a task that would overflow context if approached naively. |
| `demo/03-debugging` | WS3 — Debugging demo | A **gnarlier multi-layer bug** that produces a real stack trace (a timezone off-by-one in slot-time handling). Drives the live find → test → review loop. |
| `demo/05-agents` | WS5 — State / memory / long-running agents | A **multi-file feature task** ("add a waitlist") spanning model, routes, and tests, left **unimplemented** with a task brief — sized for orchestrating subagents. |

---

## `workshop/01-from-zero` — the double-booking bug

**Symptom.** You can book the same slot twice. The "cannot double-book a slot"
test in `tests/api.test.js` fails on this branch.

**Exercise.** Use Claude Code to explore the code, find where `POST /bookings`
handles a slot, and add the missing check that a slot must be `available`
before it can be booked. Re-run `npm test` until green, then commit.

**Where to look.** `src/routes/bookings.js`.

**Expected end state.** Exactly one test fails before the fix; all tests pass
after a few added lines.

---

## `workshop/02-mcp` — MCP against issues and the database

**Setup.** This branch ships a richer seeded database (more providers and
slots) so database queries return interesting results.

**Exercises.**
- Connect the **GitHub MCP** and pull the 5–8 seeded issues on the repo, then
  let Claude Code triage or implement one.
- Connect a **SQLite/database MCP** pointed at `clinic.db` (run `npm run seed`
  first) and ask questions like *"how many available slots are there next week,
  grouped by specialty?"*

> The GitHub issues are created on the hosted repo separately from this code;
> they are not committed here.

---

## `workshop/03-best-practices` — context management on real bulk

**Setup.** This branch adds a sprawling `src/reporting/` area (several long
files and endpoints) and an example skill under `.claude/skills/`.

**Exercise.** Tackle a task that spans the whole reporting module — large enough
that reading everything naively would blow the context window. Practice
`/compact`, targeted exploration, and invoking the example skill. See the task
brief committed on that branch.

---

## `demo/03-debugging` — the timezone off-by-one

**Setup.** Slot-time handling has a multi-layer timezone bug: slots created or
filtered near a day boundary land on the wrong calendar day, producing a real
stack trace / failing assertion. Repro steps are committed on that branch.

**Demo.** Reproduce, write a failing test that captures the bug, fix across the
layers, and run the review loop.

---

## `demo/05-agents` — add a waitlist (unimplemented)

**Brief.** Add a waitlist so a `holder_ref` can register interest in a fully
booked slot and be promoted (FIFO) when a booking is cancelled. This spans a new
`waitlist` table (model in `src/db.js`), new routes (`src/routes/waitlist.js`
plus wire-up), and promotion logic inside `DELETE /bookings/:id`.

**What's here.** The feature is **intentionally unimplemented**:

- [`docs/waitlist-task.md`](./docs/waitlist-task.md) — the full brief, including
  endpoint contracts, the FIFO promotion rule, and a suggested split across
  three subagents.
- `tests/waitlist.test.js` — a ready **acceptance spec**, currently wrapped in
  `describe.skip(...)` so `npm test` stays green. It is the definition of done:
  remove the `.skip` and make it pass.

**Demo.** Orchestrate subagents (model+seed / routes / promotion+tests) against
the brief, integrate, un-skip the tests, run `npm test`, and `/review` the diff.
Good for showing resumable, long-running work and state carried across agents.
