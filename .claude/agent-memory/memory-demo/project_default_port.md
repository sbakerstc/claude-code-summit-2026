---
name: default-port
description: The API server default port was changed to 4000 on the main branch
metadata:
  type: project
---

The API server default port is 4000 (changed on `main` in commit b515ecc "main: change default port to 4000").

**Why:** Recorded as a stable configuration fact for the workshop scheduler API. Ports are easy to get wrong when running the app locally.

**How to apply:** When starting the app or writing examples/tests that hit the server, assume port 4000 unless overridden by config/env. Verify against the current source before relying on it, since this is a workshop repo where branches diverge. See [[tech-stack]] and [[repo-purpose]].
