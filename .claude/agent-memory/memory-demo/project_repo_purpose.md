---
name: project-repo-purpose
description: What this repo is — a synthetic, no-PHI clinic scheduler teaching artifact for Claude Code Summit 2026
metadata:
  type: project
---

This repo is a deliberately fictional clinic appointment scheduler REST API, used as the shared hands-on repository across Claude Code Summit 2026 sessions. Later sessions add depth via branches (see WORKSHOPS.md).

**Why:** It is a teaching artifact. All data is fabricated (fictional providers, made-up locations, opaque booking codes like `PT-0001`). It contains no real patient information and by design has no field to store a real name, contact detail, DOB, or clinical data.

**How to apply:** Treat "no PHI, ever" as a hard constraint when suggesting changes. Do not add fields or features that would capture real patient identifiers. Keep sample data synthetic.
