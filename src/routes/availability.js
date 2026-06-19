'use strict';

const express = require('express');
const { mondayFirstIndex, clinicDateString } = require('../lib/timeutil');

/**
 * Weekly availability routes.
 *   GET /availability/week?start=YYYY-MM-DD
 *     Group the next 7 days of available slots into a Monday-first week grid
 *     (Mon..Sun) using clinic-local time.
 *
 * If `start` is omitted it defaults to today (UTC midnight).
 *
 * @param {import('better-sqlite3').Database} db
 * @returns {import('express').Router}
 */
module.exports = function availabilityRoutes(db) {
  const router = express.Router();

  const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  router.get('/week', (req, res) => {
    let start = req.query.start;
    if (!start) {
      start = new Date().toISOString().slice(0, 10);
    }

    const startMs = new Date(`${start}T00:00:00.000Z`).getTime();
    if (Number.isNaN(startMs)) {
      return res.status(400).json({ error: 'start must be YYYY-MM-DD' });
    }
    const endMs = startMs + 7 * 24 * 60 * 60 * 1000;

    const slots = db
      .prepare(
        "SELECT id, provider_id, location_id, start_time, status FROM slots " +
          "WHERE status = 'available' AND start_time >= ? AND start_time < ? " +
          'ORDER BY start_time'
      )
      .all(new Date(startMs).toISOString(), new Date(endMs).toISOString());

    // Seven day buckets, Monday-first.
    const byDay = [[], [], [], [], [], [], []];
    for (const slot of slots) {
      const idx = mondayFirstIndex(slot.start_time);
      // Drop the slot into its clinic-local weekday bucket.
      byDay[idx].push({ id: slot.id, clinic_date: clinicDateString(slot.start_time) });
    }

    res.json({
      start,
      week: WEEKDAYS.map((label, i) => ({
        weekday: label,
        available: byDay[i].length,
        slot_ids: byDay[i].map((x) => x.id),
      })),
    });
  });

  return router;
};
