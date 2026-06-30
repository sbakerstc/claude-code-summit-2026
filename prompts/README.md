# Feature-build prompts

Copy-paste prompts for adding a small feature to the clinic scheduler with Claude Code. Each one is **spec-first**: Claude reads the code, writes a short plan for you to approve, then implements it test-first.

## How to use

1. Be on a clean, green branch (e.g. `main`) and run `npm run seed`.
2. Start Claude: `claude` (tip: press `Shift+Tab` for plan mode so it plans before editing).
3. Open one of the prompt files below, copy the block, paste it into Claude, then follow along: approve the plan, watch it implement, and let it run the tests.

- `01-next-available.md` — `GET /providers/:id/next-available`
- `02-stats-summary.md` — `GET /stats`
- `03-reschedule-booking.md` — `PATCH /bookings/:id`

These are for practice and for the live demo. If a build goes sideways, that's a real chance to debug, which is exactly what the next part of the session is about.
