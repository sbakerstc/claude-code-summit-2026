'use strict';

/**
 * Repro for the demo/03-debugging timezone off-by-one.
 *
 *   npm run seed
 *   node scripts/repro-debugging.js
 *
 * Expected: the script prints an HTTP 500 and the server-side stack trace,
 * because GET /availability/week throws on slots whose clinic-local weekday is
 * Sunday. See WORKSHOPS.md -> demo/03-debugging.
 *
 * Synthetic data only. No PHI.
 */

const request = require('supertest');
const { openDb } = require('../src/db');
const { createApp } = require('../src/app');

async function main() {
  const db = openDb();
  const app = createApp(db);

  // Capture the error the route handler logs, so the stack trace is visible
  // even though Express turns it into a 500 response.
  const res = await request(app).get('/availability/week');

  // eslint-disable-next-line no-console
  console.log(`GET /availability/week -> HTTP ${res.status}`);
  if (res.status === 500) {
    // eslint-disable-next-line no-console
    console.log('Reproduced: the weekly grid threw. Look at src/routes/availability.js');
    // eslint-disable-next-line no-console
    console.log('and follow the index back into src/lib/timeutil.js (the clinic-local offset).');
  } else {
    // eslint-disable-next-line no-console
    console.log('Did not reproduce on this data set. Try an explicit Monday, e.g.');
    // eslint-disable-next-line no-console
    console.log('  node scripts/repro-debugging.js  (after npm run seed)');
  }
  db.close();
}

main();
