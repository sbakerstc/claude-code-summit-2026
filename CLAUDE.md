# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

A small **fictional clinic appointment scheduler** REST API (Express + SQLite),
used as the shared hands-on repo across the Claude Code Summit 2026 sessions.
It is a teaching artifact, not production code.

> **Synthetic data only — NO PHI.** Everything here is fabricated: provider
> names are fictional, locations are made up, and bookings use opaque codes like
> `PT-0001`. There is deliberately no field anywhere for a real name, contact
> detail, date of birth, or clinical data. Never add one, and never load real
> patient information.

## Commands

```bash
npm install          # downloads a prebuilt SQLite binary — no compiler needed
npm run seed         # reset + repopulate clinic.db with synthetic data (idempotent)
npm run setup        # = npm install && npm run seed
npm start            # serve on http://localhost:3000 (override with PORT)
npm test             # Jest suite (runs with --runInBand)
```

Run a single test file or test by name:

```bash
npx jest tests/api.test.js                       # one file
npx jest -t "cannot double-book a slot"          # one test by name
```

There is **no lint or format step** configured (no ESLint/Prettier). `npm test`
is the only check. Match the surrounding style by hand.

Node is pinned to the **20.x LTS line** (`>=20.17 <21`, enforced in
`package.json` engines). `better-sqlite3` is used instead of `node:sqlite`
precisely because the built-in module requires Node 22+; do not swap it.

## Architecture

- **`createApp(db)` factory** (`src/app.js`) — the app is built around an
  injected database connection rather than a module-level singleton. This is the
  central design choice: it lets tests pass an isolated `:memory:` database so
  the suite never touches the seeded `clinic.db` and stays deterministic.
  `src/server.js` is just the `npm start` entry point that opens the real DB and
  calls the factory.
- **Routes are factories too** (`src/routes/*.js`) — each exports
  `module.exports = function xRoutes(db)` returning an Express router, so the
  same injected `db` flows down from `createApp`. Follow this pattern when adding
  routes; don't import a DB singleton inside a route.
- **`openDb(filename)`** (`src/db.js`) — opens SQLite, sets `journal_mode=WAL`
  and `foreign_keys=ON`, and applies the schema (`CREATE TABLE IF NOT EXISTS`).
  Resolution order for the path: explicit arg → `DB_PATH` env → `./clinic.db`.
  Pass `':memory:'` for an ephemeral DB. The schema is the single source of
  truth for the data model; `slots.status` is constrained to
  `CHECK (status IN ('available', 'booked'))`.
- **OpenAPI is the contract** — `openapi.yaml` at the repo root is the single
  source of truth, loaded once by `src/openapi.js` and served at both `/docs`
  (Swagger UI) and `/openapi.json`. When you change an endpoint's
  request/response shape or status codes, update `openapi.yaml` to match;
  `tests/openapi.test.js` validates the spec.
- **DB writes that touch two tables use `db.transaction(...)`** (see
  `src/routes/bookings.js`) — booking flips `slots.status` and inserts a
  `bookings` row atomically; cancellation deletes the booking and frees the slot
  atomically. Keep multi-table mutations inside a transaction.

## Tests

`tests/api.test.js` uses a `freshApp()` helper that builds a new in-memory DB
with a small fixed fixture (2 providers, 1 location, 2 available slots) per test
via supertest. There is no shared/global DB state between tests.

## Branch model

`main` is the clean, all-green baseline. Each summit session works on its own
branch built off `main` (e.g. `workshop/01-from-zero` seeds a deliberate
double-booking bug). See `WORKSHOPS.md` for the full branch map and the intent
of each branch. Use `git diff main` to see what a branch adds. Some branches
intentionally ship a failing test or an unimplemented feature — confirm which
branch you're on before treating a red test as something to "fix."
