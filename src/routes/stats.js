'use strict';

const express = require('express');

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Daily statistics.
 *   GET /stats?date=YYYY-MM-DD
 *     - date is required and must be YYYY-MM-DD (UTC calendar day); otherwise 400.
 *     - reports slot totals, utilization, and breakdowns by provider and
 *       specialty for that day.
 *
 * Read-only aggregates over synthetic data. No holder_ref or identifying field
 * is ever exposed.
 *
 * @param {import('better-sqlite3').Database} db
 * @returns {import('express').Router}
 */
module.exports = function statsRoutes(db) {
  const router = express.Router();

  router.get('/', (req, res) => {
    const { date } = req.query;
    if (typeof date !== 'string' || !DATE_RE.test(date)) {
      return res.status(400).json({ error: 'date (YYYY-MM-DD) is required' });
    }

    // start_time is an ISO string; a date prefix match selects the calendar day.
    const like = `${date}%`;

    const totalsRow = db
      .prepare(
        'SELECT ' +
          'COUNT(*) AS slots, ' +
          "SUM(CASE WHEN status = 'available' THEN 1 ELSE 0 END) AS available, " +
          "SUM(CASE WHEN status = 'booked' THEN 1 ELSE 0 END) AS booked " +
          'FROM slots WHERE start_time LIKE ?'
      )
      .get(like);

    const totals = {
      slots: totalsRow.slots,
      available: totalsRow.available || 0,
      booked: totalsRow.booked || 0,
    };
    const utilization =
      totals.slots === 0 ? 0 : Math.round((totals.booked / totals.slots) * 100) / 100;

    const byProvider = db
      .prepare(
        'SELECT p.id AS provider_id, p.name, p.specialty, ' +
          'COUNT(*) AS slots, ' +
          "SUM(CASE WHEN s.status = 'available' THEN 1 ELSE 0 END) AS available, " +
          "SUM(CASE WHEN s.status = 'booked' THEN 1 ELSE 0 END) AS booked " +
          'FROM slots s JOIN providers p ON p.id = s.provider_id ' +
          'WHERE s.start_time LIKE ? ' +
          'GROUP BY p.id, p.name, p.specialty ' +
          'ORDER BY p.name'
      )
      .all(like);

    const bySpecialty = db
      .prepare(
        'SELECT p.specialty, ' +
          'COUNT(*) AS slots, ' +
          "SUM(CASE WHEN s.status = 'available' THEN 1 ELSE 0 END) AS available, " +
          "SUM(CASE WHEN s.status = 'booked' THEN 1 ELSE 0 END) AS booked " +
          'FROM slots s JOIN providers p ON p.id = s.provider_id ' +
          'WHERE s.start_time LIKE ? ' +
          'GROUP BY p.specialty ' +
          'ORDER BY p.specialty'
      )
      .all(like);

    res.json({
      date,
      totals,
      utilization,
      by_provider: byProvider,
      by_specialty: bySpecialty,
    });
  });

  return router;
};
