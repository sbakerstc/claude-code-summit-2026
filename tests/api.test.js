'use strict';

const request = require('supertest');
const { openDb } = require('../src/db');
const { createApp } = require('../src/app');

/**
 * Each test gets a fresh in-memory database with a tiny, predictable fixture.
 * No file on disk is touched, so `npm test` never disturbs the seeded clinic.db
 * and the output stays clean and deterministic.
 */
function freshApp() {
  const db = openDb(':memory:');

  const providerId = db
    .prepare('INSERT INTO providers (name, specialty) VALUES (?, ?)')
    .run('Dr. A. Rivera', 'Cardiology').lastInsertRowid;
  db.prepare('INSERT INTO providers (name, specialty) VALUES (?, ?)')
    .run('Dr. B. Chen', 'Dermatology');

  const locationId = db
    .prepare('INSERT INTO locations (name) VALUES (?)')
    .run('North Clinic').lastInsertRowid;

  const availableSlotId = db
    .prepare(
      'INSERT INTO slots (provider_id, location_id, start_time, duration_min, status) ' +
        "VALUES (?, ?, ?, ?, 'available')"
    )
    .run(providerId, locationId, '2026-06-22T09:00:00.000Z', 30).lastInsertRowid;

  // A second slot, same provider, different day.
  db.prepare(
    'INSERT INTO slots (provider_id, location_id, start_time, duration_min, status) ' +
      "VALUES (?, ?, ?, ?, 'available')"
  ).run(providerId, locationId, '2026-06-23T10:00:00.000Z', 30);

  return { app: createApp(db), db, providerId, locationId, availableSlotId };
}

describe('clinic scheduler API', () => {
  test('GET /providers lists synthetic providers', async () => {
    const { app } = freshApp();
    const res = await request(app).get('/providers');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0]).toMatchObject({ name: 'Dr. A. Rivera', specialty: 'Cardiology' });
  });

  test("GET /providers/:id/slots lists that provider's slots", async () => {
    const { app, providerId } = freshApp();
    const res = await request(app).get(`/providers/${providerId}/slots`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body.every((s) => s.provider_id === providerId)).toBe(true);
  });

  test('GET /providers/:id/slots returns 404 for an unknown provider', async () => {
    const { app } = freshApp();
    const res = await request(app).get('/providers/9999/slots');
    expect(res.status).toBe(404);
  });

  test('GET /slots?date= filters by calendar day', async () => {
    const { app } = freshApp();
    const res = await request(app).get('/slots').query({ date: '2026-06-22' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].start_time).toBe('2026-06-22T09:00:00.000Z');
  });

  test('GET /slots?specialty= filters by provider specialty', async () => {
    const { app } = freshApp();
    const res = await request(app).get('/slots').query({ specialty: 'Cardiology' });
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body.every((s) => s.specialty === 'Cardiology')).toBe(true);
  });

  test('happy path: book an available slot then cancel it', async () => {
    const { app, db, availableSlotId } = freshApp();

    // Book it.
    const booked = await request(app)
      .post('/bookings')
      .send({ slot_id: availableSlotId, holder_ref: 'PT-0001' });
    expect(booked.status).toBe(201);
    expect(booked.body).toMatchObject({ slot_id: availableSlotId, holder_ref: 'PT-0001' });

    // The slot is now marked booked.
    const afterBooking = db
      .prepare('SELECT status FROM slots WHERE id = ?')
      .get(availableSlotId);
    expect(afterBooking.status).toBe('booked');

    // Cancel it.
    const cancelled = await request(app).delete(`/bookings/${booked.body.id}`);
    expect(cancelled.status).toBe(204);

    // The slot is available again and the booking is gone.
    const afterCancel = db.prepare('SELECT status FROM slots WHERE id = ?').get(availableSlotId);
    expect(afterCancel.status).toBe('available');
    const remaining = db
      .prepare('SELECT COUNT(*) AS n FROM bookings WHERE id = ?')
      .get(booked.body.id);
    expect(remaining.n).toBe(0);
  });

  test('cannot double-book a slot', async () => {
    const { app, availableSlotId } = freshApp();

    // First booking should succeed.
    const first = await request(app)
      .post('/bookings')
      .send({ slot_id: availableSlotId, holder_ref: 'PT-0001' });
    expect(first.status).toBe(201);

    // Second booking of the SAME slot must be refused. A slot that is already
    // booked is not available, so the API should reject this with a 409
    // (Conflict) instead of creating a second booking.
    const second = await request(app)
      .post('/bookings')
      .send({ slot_id: availableSlotId, holder_ref: 'PT-0002' });

    expect(second.status).toBe(409); // FAILS until POST /bookings checks slot availability
  });

  test('POST /bookings rejects a missing slot with 404', async () => {
    const { app } = freshApp();
    const res = await request(app)
      .post('/bookings')
      .send({ slot_id: 9999, holder_ref: 'PT-0001' });
    expect(res.status).toBe(404);
  });

  test('POST /bookings rejects a malformed body with 400', async () => {
    const { app } = freshApp();
    const res = await request(app).post('/bookings').send({ holder_ref: 'PT-0001' });
    expect(res.status).toBe(400);
  });

  describe('GET /stats?date=', () => {
    // Augment the base fixture so 2026-06-22 has a mix of providers,
    // specialties, and a booked slot. After this helper the 2026-06-22 day has:
    //   - Dr. A. Rivera (Cardiology):  2 slots, 1 available, 1 booked
    //   - Dr. B. Chen   (Dermatology): 1 slot,  1 available, 0 booked
    // => totals: 3 slots, 2 available, 1 booked; utilization 1/3 = 0.33
    function statsApp() {
      const ctx = freshApp();
      const { db, locationId, availableSlotId } = ctx;

      // Book the existing 2026-06-22 Cardiology slot.
      db.prepare("UPDATE slots SET status = 'booked' WHERE id = ?").run(availableSlotId);
      db.prepare('INSERT INTO bookings (slot_id, holder_ref) VALUES (?, ?)').run(
        availableSlotId,
        'PT-0001'
      );

      // Add a second Cardiology (provider 1) slot on the same day, left available.
      db.prepare(
        'INSERT INTO slots (provider_id, location_id, start_time, duration_min, status) ' +
          "VALUES (?, ?, ?, ?, 'available')"
      ).run(1, locationId, '2026-06-22T13:00:00.000Z', 30);

      // Add a Dermatology (provider 2) slot on the same day, left available.
      db.prepare(
        'INSERT INTO slots (provider_id, location_id, start_time, duration_min, status) ' +
          "VALUES (?, ?, ?, ?, 'available')"
      ).run(2, locationId, '2026-06-22T11:00:00.000Z', 30);

      return ctx;
    }

    test('reports totals and utilization for the day', async () => {
      const { app } = statsApp();
      const res = await request(app).get('/stats').query({ date: '2026-06-22' });
      expect(res.status).toBe(200);
      expect(res.body.date).toBe('2026-06-22');
      expect(res.body.totals).toEqual({ slots: 3, available: 2, booked: 1 });
      expect(res.body.utilization).toBeCloseTo(0.33, 2);
    });

    test('breaks counts down by provider', async () => {
      const { app } = statsApp();
      const res = await request(app).get('/stats').query({ date: '2026-06-22' });
      expect(res.status).toBe(200);
      expect(res.body.by_provider).toEqual([
        {
          provider_id: 1,
          name: 'Dr. A. Rivera',
          specialty: 'Cardiology',
          slots: 2,
          available: 1,
          booked: 1,
        },
        {
          provider_id: 2,
          name: 'Dr. B. Chen',
          specialty: 'Dermatology',
          slots: 1,
          available: 1,
          booked: 0,
        },
      ]);
    });

    test('breaks counts down by specialty', async () => {
      const { app } = statsApp();
      const res = await request(app).get('/stats').query({ date: '2026-06-22' });
      expect(res.status).toBe(200);
      expect(res.body.by_specialty).toEqual([
        { specialty: 'Cardiology', slots: 2, available: 1, booked: 1 },
        { specialty: 'Dermatology', slots: 1, available: 1, booked: 0 },
      ]);
    });

    test('returns a zeroed 200 for a day with no slots', async () => {
      const { app } = statsApp();
      const res = await request(app).get('/stats').query({ date: '2000-01-01' });
      expect(res.status).toBe(200);
      expect(res.body.totals).toEqual({ slots: 0, available: 0, booked: 0 });
      expect(res.body.utilization).toBe(0);
      expect(res.body.by_provider).toEqual([]);
      expect(res.body.by_specialty).toEqual([]);
    });

    test('rejects a missing date with 400', async () => {
      const { app } = statsApp();
      const res = await request(app).get('/stats');
      expect(res.status).toBe(400);
    });

    test('rejects a malformed date with 400', async () => {
      const { app } = statsApp();
      const res = await request(app).get('/stats').query({ date: '06/22/2026' });
      expect(res.status).toBe(400);
    });
  });
});
