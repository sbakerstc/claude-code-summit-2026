'use strict';

/**
 * Seed the clinic scheduler with SYNTHETIC data only.
 *
 * Everything here is fabricated: provider names are fictional, locations are
 * made up, and bookings use opaque codes like "PT-0001". There is no real
 * patient information anywhere, and none should ever be added.
 *
 * The script is idempotent: it clears the four tables and repopulates them, so
 * you can re-run `npm run seed` any time to get back to a known state.
 *
 * Slots are generated relative to *today*, so date-based queries like
 * "available slots next week per specialty" always have fresh data.
 */

const { openDb } = require('../src/db');

// Richer roster than `main` so database-MCP queries (e.g. "available slots next
// week per specialty") return interesting, varied results.
const PROVIDERS = [
  { name: 'Dr. A. Rivera', specialty: 'Cardiology' },
  { name: 'Dr. B. Chen', specialty: 'Dermatology' },
  { name: 'Dr. C. Okafor', specialty: 'Pediatrics' },
  { name: 'Dr. D. Singh', specialty: 'Cardiology' },
  { name: 'Dr. E. Larsson', specialty: 'Orthopedics' },
  { name: 'Dr. F. Nakamura', specialty: 'Dermatology' },
  { name: 'Dr. G. Mwangi', specialty: 'Pediatrics' },
  { name: 'Dr. H. Petrova', specialty: 'Neurology' },
  { name: 'Dr. I. Alvarez', specialty: 'Orthopedics' },
  { name: 'Dr. J. Haddad', specialty: 'Neurology' },
];

const LOCATIONS = [
  { name: 'North Clinic' },
  { name: 'South Clinic' },
  { name: 'Downtown Annex' },
  { name: 'East Wing' },
];

// Appointment start hours (local-naive, applied in UTC) and slot length.
const HOURS = [9, 9.5, 10, 10.5, 11, 13, 13.5, 14, 14.5, 15, 15.5, 16];
const DURATION_MIN = 30;

/**
 * Midnight UTC, `daysFromToday` days out. Keeps generated start_time values
 * stable and easy to reason about in the workshop.
 */
function dayAtUtc(daysFromToday, hour) {
  const now = new Date();
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  d.setUTCDate(d.getUTCDate() + daysFromToday);
  const wholeHours = Math.floor(hour);
  const minutes = Math.round((hour - wholeHours) * 60);
  d.setUTCHours(wholeHours, minutes, 0, 0);
  return d.toISOString();
}

function seed(db) {
  const reset = db.transaction(() => {
    // Clear in FK-safe order.
    db.exec('DELETE FROM bookings');
    db.exec('DELETE FROM slots');
    db.exec('DELETE FROM providers');
    db.exec('DELETE FROM locations');
    db.exec(
      "DELETE FROM sqlite_sequence WHERE name IN ('bookings','slots','providers','locations')"
    );

    const insProvider = db.prepare('INSERT INTO providers (name, specialty) VALUES (?, ?)');
    const providerIds = PROVIDERS.map((p) => insProvider.run(p.name, p.specialty).lastInsertRowid);

    const insLocation = db.prepare('INSERT INTO locations (name) VALUES (?)');
    const locationIds = LOCATIONS.map((l) => insLocation.run(l.name).lastInsertRowid);

    const insSlot = db.prepare(
      'INSERT INTO slots (provider_id, location_id, start_time, duration_min, status) ' +
        'VALUES (?, ?, ?, ?, ?)'
    );
    const insBooking = db.prepare(
      'INSERT INTO bookings (slot_id, holder_ref) VALUES (?, ?)'
    );

    let bookingSeq = 0;
    let slotCount = 0;

    // Generate slots for the next 21 days (skip weekends), every provider,
    // rotating through locations. Book roughly every 4th slot so there is a
    // realistic mix of available and booked across this week and next.
    for (let day = 0; day < 21; day += 1) {
      const dow = new Date(dayAtUtc(day, 0)).getUTCDay();
      if (dow === 0 || dow === 6) continue; // skip Sun/Sat

      providerIds.forEach((providerId, pIdx) => {
        HOURS.forEach((hour, hIdx) => {
          const locationId = locationIds[(pIdx + hIdx) % locationIds.length];
          const startTime = dayAtUtc(day, hour);
          const willBook = slotCount % 4 === 0;
          const status = willBook ? 'booked' : 'available';
          const slotId = insSlot.run(providerId, locationId, startTime, DURATION_MIN, status)
            .lastInsertRowid;
          if (willBook) {
            bookingSeq += 1;
            const holderRef = `PT-${String(bookingSeq).padStart(4, '0')}`;
            insBooking.run(slotId, holderRef);
          }
          slotCount += 1;
        });
      });
    }

    return { providers: providerIds.length, locations: locationIds.length, slots: slotCount, bookings: bookingSeq };
  });

  return reset();
}

function main() {
  const db = openDb();
  const counts = seed(db);
  db.close();
  // eslint-disable-next-line no-console
  console.log(
    `Seeded synthetic data (NO PHI): ${counts.providers} providers, ` +
      `${counts.locations} locations, ${counts.slots} slots, ${counts.bookings} bookings.`
  );
}

if (require.main === module) {
  main();
}

module.exports = { seed, PROVIDERS, LOCATIONS };
