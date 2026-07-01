---
name: project-tech-stack
description: Tech stack and dev scripts for the clinic-scheduler repo (Node/Express/SQLite/Jest)
metadata:
  type: project
---

The `clinic-scheduler` package is a Node.js (>=20.17 <21, CommonJS) Express API backed by better-sqlite3, with Swagger UI (swagger-ui-express + yaml) serving the OpenAPI docs. Tests run on Jest with supertest, invoked serially via `jest --runInBand`.

Key npm scripts: `start` (node src/server.js), `seed` (scripts/seed.js), `setup` (install + seed), `test` (jest --runInBand).

**Why:** Captures the toolchain so future sessions don't have to re-read package.json to know how to run/test the app.
**How to apply:** Use `npm test` (serial Jest) to verify changes and `npm run seed` to reset synthetic data. Entry point is src/server.js. Relates to [[project-repo-purpose]] and [[project-workshop-branch-map]].
