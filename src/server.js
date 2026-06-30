'use strict';

/**
 * Entry point for `npm start`.
 *
 * Opens the on-disk SQLite database (run `npm run seed` first to populate it
 * with synthetic data) and starts the HTTP server.
 */

const { openDb } = require('./db');
const { createApp } = require('./app');

const PORT = process.env.PORT || 4000;

const db = openDb();
const app = createApp(db);

const server = app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Clinic scheduler (synthetic data, no PHI) listening on http://localhost:${PORT}`);
});

// Close the database cleanly on shutdown.
function shutdown() {
  server.close(() => {
    db.close();
    process.exit(0);
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
