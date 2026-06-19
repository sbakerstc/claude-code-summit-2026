'use strict';

/**
 * Acceptance spec for the waitlist feature (demo/05-agents).
 *
 * This whole suite is wrapped in `describe.skip(...)` because the feature is
 * NOT implemented yet — that is the workshop task. Remove the `.skip` and make
 * these pass (and add more cases). See docs/waitlist-task.md.
 *
 * Synthetic data only. No PHI.
 */

const request = require('supertest');
const { openDb } = require('../src/db');
const { createApp } = require('../src/app');

function freshApp() {
  const db = openDb(':memory:');

  const providerId = db
    .prepare('INSERT INTO providers (name, specialty) VALUES (?, ?)')
    .run('Dr. A. Rivera', 'Cardiology').lastInsertRowid;
  const locationId = db
    .prepare('INSERT INTO locations (name) VALUES (?)')
    .run('North Clinic').lastInsertRowid;

  // One already-booked slot, plus its booking.
  const bookedSlotId = db
    .prepare(
      'INSERT INTO slots (provider_id, location_id, start_time, duration_min, status) ' +
        "VALUES (?, ?, ?, ?, 'booked')"
    )
    .run(providerId, locationId, '2026-06-22T09:00:00.000Z', 30).lastInsertRowid;
  const bookingId = db
    .prepare('INSERT INTO bookings (slot_id, holder_ref) VALUES (?, ?)')
    .run(bookedSlotId, 'PT-0001').lastInsertRowid;

  // One available slot.
  const availableSlotId = db
    .prepare(
      'INSERT INTO slots (provider_id, location_id, start_time, duration_min, status) ' +
        "VALUES (?, ?, ?, ?, 'available')"
    )
    .run(providerId, locationId, '2026-06-22T10:00:00.000Z', 30).lastInsertRowid;

  return { app: createApp(db), db, bookedSlotId, availableSlotId, bookingId };
}

// eslint-disable-next-line jest/no-disabled-tests
describe.skip('waitlist (demo/05-agents — implement me)', () => {
  test('join the waitlist for a booked slot returns 201', async () => {
    const { app, bookedSlotId } = freshApp();
    const res = await request(app)
      .post(`/slots/${bookedSlotId}/waitlist`)
      .send({ holder_ref: 'PT-0007' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ slot_id: bookedSlotId, holder_ref: 'PT-0007' });
  });

  test('cannot waitlist an available slot (409 — just book it)', async () => {
    const { app, availableSlotId } = freshApp();
    const res = await request(app)
      .post(`/slots/${availableSlotId}/waitlist`)
      .send({ holder_ref: 'PT-0007' });
    expect(res.status).toBe(409);
  });

  test('waitlisting an unknown slot returns 404', async () => {
    const { app } = freshApp();
    const res = await request(app).post('/slots/9999/waitlist').send({ holder_ref: 'PT-0007' });
    expect(res.status).toBe(404);
  });

  test('GET lists waitlist entries in FIFO order', async () => {
    const { app, bookedSlotId } = freshApp();
    await request(app).post(`/slots/${bookedSlotId}/waitlist`).send({ holder_ref: 'PT-0007' });
    await request(app).post(`/slots/${bookedSlotId}/waitlist`).send({ holder_ref: 'PT-0008' });

    const res = await request(app).get(`/slots/${bookedSlotId}/waitlist`);
    expect(res.status).toBe(200);
    expect(res.body.map((e) => e.holder_ref)).toEqual(['PT-0007', 'PT-0008']);
  });

  test('cancelling a booking promotes the FIFO-first waitlist entry', async () => {
    const { app, db, bookedSlotId, bookingId } = freshApp();

    await request(app).post(`/slots/${bookedSlotId}/waitlist`).send({ holder_ref: 'PT-0007' });
    await request(app).post(`/slots/${bookedSlotId}/waitlist`).send({ holder_ref: 'PT-0008' });

    const cancel = await request(app).delete(`/bookings/${bookingId}`);
    expect([200, 204]).toContain(cancel.status);

    // The slot stays booked (promotion happened, not freed).
    const slot = db.prepare('SELECT status FROM slots WHERE id = ?').get(bookedSlotId);
    expect(slot.status).toBe('booked');

    // PT-0007 now holds a real booking; the waitlist has only PT-0008 left.
    const holders = db
      .prepare('SELECT holder_ref FROM bookings WHERE slot_id = ?')
      .all(bookedSlotId)
      .map((b) => b.holder_ref);
    expect(holders).toContain('PT-0007');

    const remaining = db
      .prepare('SELECT holder_ref FROM waitlist WHERE slot_id = ?')
      .all(bookedSlotId)
      .map((w) => w.holder_ref);
    expect(remaining).toEqual(['PT-0008']);
  });

  test('cancelling with an empty waitlist frees the slot', async () => {
    const { app, db, bookedSlotId, bookingId } = freshApp();
    const cancel = await request(app).delete(`/bookings/${bookingId}`);
    expect([200, 204]).toContain(cancel.status);
    const slot = db.prepare('SELECT status FROM slots WHERE id = ?').get(bookedSlotId);
    expect(slot.status).toBe('available');
  });
});
