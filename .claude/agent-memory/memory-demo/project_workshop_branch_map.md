---
name: project-workshop-branch-map
description: How the repo is organized for the Summit — main is the all-green baseline, each session lives on its own branch off main
metadata:
  type: project
---

This one repo is reused across every hands-on Claude Code Summit 2026 session (see WORKSHOPS.md). `main` is the clean, all-green baseline; each session works from its own branch built off `main`, so `git diff main` shows exactly what a session adds. Notable branches: `workshop/01-from-zero` (seeded double-booking bug), `workshop/02-mcp` (richer seeded DB + GitHub issues), `workshop/03-best-practices` (sprawling `src/reporting/` for context-management practice), `demo/03-debugging` (timezone off-by-one), `demo/05-agents` (unimplemented waitlist feature for subagent orchestration).

**Why:** Deliberate teaching structure. Some branches carry *intentional* broken/unimplemented state (seeded bugs, `describe.skip`ped acceptance specs) that is the exercise, not a defect to fix unprompted. See [[project-repo-purpose]].

**How to apply:** Before treating a failing test or missing feature as a bug, check which branch you are on and consult WORKSHOPS.md — it may be the intended workshop starting point. Do not "fix" seeded exercises unless asked.
