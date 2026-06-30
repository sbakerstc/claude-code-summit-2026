# Feature: stats summary

Copy everything in the block below into Claude:

```
Add a new endpoint GET /stats that returns, for each specialty, the number of
slots that are available vs booked.

Work spec-first. First, read the existing routes, the db helpers, and the test
style. Then write a short plan: the response shape, how you'll aggregate (SQL or
in code), edge cases (a specialty with no slots), the files you'll touch, and the
test you'll add. Show me the plan and wait for my OK.

After approval: implement it, add a Jest test, and run the suite until it's green.
Keep to the existing patterns; don't refactor unrelated code.
```
