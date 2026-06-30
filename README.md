# Clinic Scheduler — Claude Code Summit 2026

A small **fictional clinic appointment scheduler** REST API, used as the shared
hands-on repository across the Claude Code Summit 2026 sessions. You clone it
once and reuse it all conference; later sessions add depth via branches (see
[`WORKSHOPS.md`](./WORKSHOPS.md)).

> ## ⚠️ Synthetic data only — NO PHI
>
> This repository is a **teaching artifact**. Everything in it is **fabricated
> sample data**: provider names are fictional, locations are made up, and
> bookings use opaque codes like `PT-0001`. It contains **no real patient
> information (no PHI)** and **must never be loaded with PHI**. There is
> deliberately no field anywhere to store a real name, contact detail, date of
> birth, or any clinical information.

---

## What it does

A tiny REST API for booking and cancelling appointment slots:

| Method | Path | Description |
|--------|------|-------------|
| `GET`  | `/providers` | List all providers. |
| `GET`  | `/providers/:id/slots` | List a provider's slots (optional `?status=available`). |
| `GET`  | `/slots?date=&specialty=` | List slots, filtered by calendar day and/or specialty. |
| `POST` | `/bookings` | Book an available slot. Body: `{ "slot_id": 1, "holder_ref": "PT-0001" }`. |
| `DELETE` | `/bookings/:id` | Cancel a booking and free its slot. |
| `GET`  | `/health` | Liveness check. |
| `GET`  | `/docs` | **Swagger UI** — browsable, interactive API docs. |
| `GET`  | `/openapi.json` | The OpenAPI 3 spec as JSON (source: `openapi.yaml`). |

### Data model (all synthetic)

- `providers` (`id`, `name`, `specialty`)
- `locations` (`id`, `name`)
- `slots` (`id`, `provider_id`, `location_id`, `start_time`, `duration_min`, `status` = `available` \| `booked`)
- `bookings` (`id`, `slot_id`, `holder_ref`) — `holder_ref` is an opaque synthetic code, never a name.

---

## Prerequisites

- **Node.js 20.x** (pinned: `>=20.17 <21`). Verified on `v20.17.0`. The exact
  version is also enforced in `package.json` `engines`.
- **npm** (ships with Node).
- **No C/C++ compiler toolchain required.** See the SQLite note below.

> Tip: if you use a Node version manager, run `nvm use 20` (or `fnm use 20`)
> before installing.

### Why `better-sqlite3` (and not `node:sqlite`)

Storage is **SQLite** via [`better-sqlite3`](https://github.com/WiseLibs/better-sqlite3).
It ships **prebuilt binaries** (downloaded by `prebuild-install` during
`npm install`), so it installs cleanly on macOS, Windows, and WSL **with no
compiler toolchain**. We deliberately did **not** use Node's built-in
`node:sqlite`, because that module requires **Node 22+**, and this repo pins to
the Node 20 LTS line that the workshop environment is verified against.

---

## Setup (pre-work — do this before the summit)

Clone, install, seed, and run the tests once to confirm your machine is ready.

### macOS / Linux / WSL

```bash
git clone <REPO_URL>
cd claude-code-summit-2026
npm install      # downloads a prebuilt SQLite binary — no compiler needed
npm run seed     # populates a local clinic.db with synthetic data
npm test         # should be all green
```

### Windows (PowerShell)

```powershell
git clone <REPO_URL>
cd claude-code-summit-2026
npm install      # downloads a prebuilt SQLite binary — no compiler needed
npm run seed     # populates a local clinic.db with synthetic data
npm test         # should be all green
```

`npm run setup` is a shortcut for `npm install && npm run seed`.

> **Registry note:** these commands assume the public npm registry
> (`https://registry.npmjs.org/`). If your machine is configured for a private
> registry that lacks these public packages, append
> `--registry https://registry.npmjs.org/` to the `npm install`.

---

## Run it

```bash
npm run seed     # only needed once, or to reset to a known state
npm start        # serves on http://localhost:4000 (override with PORT)
```

Then open **http://localhost:4000/docs** in a browser for the interactive
Swagger UI, or hit the endpoints directly.

Example request (in another terminal):

```bash
curl -s http://localhost:4000/providers
# [{"id":1,"name":"Dr. A. Rivera","specialty":"Cardiology"}, ...]

curl -s "http://localhost:4000/slots?specialty=Cardiology&date=2026-06-22"
```

Book and cancel:

```bash
# Book slot 2 (must be available)
curl -s -X POST http://localhost:4000/bookings \
  -H 'Content-Type: application/json' \
  -d '{"slot_id": 2, "holder_ref": "PT-0001"}'
# {"id":1,"slot_id":2,"holder_ref":"PT-0001"}

# Cancel booking 1 (frees the slot)
curl -s -X DELETE http://localhost:4000/bookings/1 -i
# HTTP/1.1 204 No Content
```

---

## Test

```bash
npm test
```

Jest runs against an **in-memory** SQLite database with a small fixed fixture,
so the suite is deterministic and never touches your seeded `clinic.db`.

---

## Project layout

```
src/
  db.js            open SQLite + schema
  app.js           createApp(db) Express factory (injectable DB for tests)
  server.js        npm start entry point
  routes/          providers.js, slots.js, bookings.js
scripts/
  seed.js          populates synthetic data (idempotent)
tests/
  api.test.js      endpoint + happy-path book/cancel tests
```

## npm scripts

| Script | Does |
|--------|------|
| `npm start` | Start the API server. |
| `npm run seed` | Reset and repopulate `clinic.db` with synthetic data. |
| `npm test` | Run the Jest suite. |
| `npm run setup` | `npm install && npm run seed`. |

---

## License

MIT. Sample/teaching code.
