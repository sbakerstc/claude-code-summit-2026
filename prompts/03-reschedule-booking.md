# Feature: reschedule a booking

Copy everything in the block below into Claude:

```
Add a new endpoint PATCH /bookings/:id that reschedules an existing booking to a
different slot: free the booking's current slot, move it to the new slot, and
reject the request if the new slot isn't "available" (the same rule we enforce
when creating a booking).

Work spec-first. First read the bookings route and its tests. Then write a short
plan: the happy path, the "new slot not available" case (which status code and
message), the "booking or slot not found" cases, which files change, and the
tests you'll add. Show me the plan and wait for my OK.

After approval: implement it following the existing patterns, add Jest tests for
the happy path and the rejection case, and run the suite until it's green.
```
