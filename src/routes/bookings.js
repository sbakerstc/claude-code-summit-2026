'use strict';

const express = require('express');

/**
 * Booking routes.
 *   POST   /bookings        -> book an available slot   { slot_id, holder_ref }
 *   DELETE /bookings/:id     -> cancel a booking, freeing its slot
 *
 * holder_ref is an opaque synthetic code (e.g. "PT-0001"). It is NOT a name,
 * contact detail, or any clinical information.
 *
 * @param {import('better-sqlite3').Database} db
 * @returns {import('express').Router}
 */
module.exports = function bookingRoutes(db) {
  const router = express.Router();

  router.post('/', (req, res) => {
    const { slot_id, holder_ref } = req.body || {};

    if (!Number.isInteger(slot_id)) {
      return res.status(400).json({ error: 'slot_id (integer) is required' });
    }
    if (typeof holder_ref !== 'string' || holder_ref.trim() === '') {
      return res.status(400).json({ error: 'holder_ref (string) is required' });
    }

    const slot = db.prepare('SELECT id, status FROM slots WHERE id = ?').get(slot_id);
    if (!slot) {
      return res.status(404).json({ error: `no slot with id ${slot_id}` });
    }
    if (slot.status !== 'available') {
      return res.status(409).json({ error: `slot ${slot_id} is not available` });
    }

    // Book the slot and create the booking atomically.
    const book = db.transaction((sid, ref) => {
      db.prepare("UPDATE slots SET status = 'booked' WHERE id = ?").run(sid);
      const info = db
        .prepare('INSERT INTO bookings (slot_id, holder_ref) VALUES (?, ?)')
        .run(sid, ref);
      return info.lastInsertRowid;
    });

    const bookingId = book(slot_id, holder_ref.trim());
    res.status(201).json({ id: bookingId, slot_id, holder_ref: holder_ref.trim() });
  });

  router.delete('/:id', (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: 'booking id must be an integer' });
    }

    const booking = db.prepare('SELECT id, slot_id FROM bookings WHERE id = ?').get(id);
    if (!booking) {
      return res.status(404).json({ error: `no booking with id ${id}` });
    }

    // Cancel the booking and free the slot atomically.
    const cancel = db.transaction((bookingId, slotId) => {
      db.prepare('DELETE FROM bookings WHERE id = ?').run(bookingId);
      db.prepare("UPDATE slots SET status = 'available' WHERE id = ?").run(slotId);
    });

    cancel(booking.id, booking.slot_id);
    res.status(204).end();
  });

  return router;
};
