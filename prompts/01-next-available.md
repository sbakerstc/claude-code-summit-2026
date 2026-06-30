# Feature: next available slot

Copy everything in the block below into Claude:

```
We're adding a feature to this clinic-scheduler API: a new endpoint
GET /providers/:id/next-available that returns the soonest upcoming slot with
status "available" for that provider, or a 404 if the provider has none.

Work spec-first. Before writing any code:
1. Read how the existing provider and slot routes and their tests are structured
   (look in src/routes and tests).
2. Write a short plan: the exact response shape, edge cases (no open slots,
   unknown provider id), which files you'll change, and the test you'll add.
3. Show me the plan and wait for my OK.

After I approve: implement it following the existing route patterns, add a Jest
test covering the happy path and the "no open slots" case, and run the tests
until they pass. Don't change unrelated code.
```
