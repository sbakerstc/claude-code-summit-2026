'use strict';

/**
 * reporting/queries.js
 *
 * A grab-bag of SQL builders and raw query helpers for the reporting module.
 * Many of these overlap (several "count slots by X" variants), which is exactly
 * the sort of redundancy a consolidation task would target. Kept verbose on
 * purpose for the best-practices / context-management workshop.
 *
 * Synthetic data only. No PHI.
 */

// ---------------------------------------------------------------------------
// Slot counting
// ---------------------------------------------------------------------------

function countAllSlots(db) {
  return db.prepare('SELECT COUNT(*) AS n FROM slots').get().n;
}

function countSlotsByStatus(db) {
  return db
    .prepare('SELECT status, COUNT(*) AS n FROM slots GROUP BY status ORDER BY status')
    .all();
}

function countAvailableSlots(db) {
  return db.prepare("SELECT COUNT(*) AS n FROM slots WHERE status = 'available'").get().n;
}

function countBookedSlots(db) {
  return db.prepare("SELECT COUNT(*) AS n FROM slots WHERE status = 'booked'").get().n;
}

function countSlotsBySpecialty(db) {
  return db
    .prepare(
      'SELECT p.specialty, COUNT(*) AS n ' +
        'FROM slots s JOIN providers p ON p.id = s.provider_id ' +
        'GROUP BY p.specialty ORDER BY p.specialty'
    )
    .all();
}

function countAvailableSlotsBySpecialty(db) {
  return db
    .prepare(
      'SELECT p.specialty, COUNT(*) AS n ' +
        'FROM slots s JOIN providers p ON p.id = s.provider_id ' +
        "WHERE s.status = 'available' " +
        'GROUP BY p.specialty ORDER BY p.specialty'
    )
    .all();
}

function countBookedSlotsBySpecialty(db) {
  return db
    .prepare(
      'SELECT p.specialty, COUNT(*) AS n ' +
        'FROM slots s JOIN providers p ON p.id = s.provider_id ' +
        "WHERE s.status = 'booked' " +
        'GROUP BY p.specialty ORDER BY p.specialty'
    )
    .all();
}

function countSlotsByProvider(db) {
  return db
    .prepare(
      'SELECT p.id AS provider_id, p.name, p.specialty, COUNT(s.id) AS n ' +
        'FROM providers p LEFT JOIN slots s ON s.provider_id = p.id ' +
        'GROUP BY p.id ORDER BY p.id'
    )
    .all();
}

function countBookedSlotsByProvider(db) {
  return db
    .prepare(
      'SELECT p.id AS provider_id, p.name, p.specialty, COUNT(s.id) AS n ' +
        "FROM providers p LEFT JOIN slots s ON s.provider_id = p.id AND s.status = 'booked' " +
        'GROUP BY p.id ORDER BY p.id'
    )
    .all();
}

function countSlotsByLocation(db) {
  return db
    .prepare(
      'SELECT l.id AS location_id, l.name, COUNT(s.id) AS n ' +
        'FROM locations l LEFT JOIN slots s ON s.location_id = l.id ' +
        'GROUP BY l.id ORDER BY l.id'
    )
    .all();
}

function countBookedSlotsByLocation(db) {
  return db
    .prepare(
      'SELECT l.id AS location_id, l.name, COUNT(s.id) AS n ' +
        "FROM locations l LEFT JOIN slots s ON s.location_id = l.id AND s.status = 'booked' " +
        'GROUP BY l.id ORDER BY l.id'
    )
    .all();
}

// ---------------------------------------------------------------------------
// Date-windowed queries
// ---------------------------------------------------------------------------

function slotsBetween(db, startIso, endIso) {
  return db
    .prepare(
      'SELECT s.*, p.specialty, p.name AS provider_name, l.name AS location_name ' +
        'FROM slots s ' +
        'JOIN providers p ON p.id = s.provider_id ' +
        'JOIN locations l ON l.id = s.location_id ' +
        'WHERE s.start_time >= ? AND s.start_time < ? ' +
        'ORDER BY s.start_time'
    )
    .all(startIso, endIso);
}

function countSlotsBetween(db, startIso, endIso) {
  return db
    .prepare('SELECT COUNT(*) AS n FROM slots WHERE start_time >= ? AND start_time < ?')
    .get(startIso, endIso).n;
}

function availableSlotsBetweenBySpecialty(db, startIso, endIso) {
  return db
    .prepare(
      'SELECT p.specialty, COUNT(*) AS n ' +
        'FROM slots s JOIN providers p ON p.id = s.provider_id ' +
        "WHERE s.status = 'available' AND s.start_time >= ? AND s.start_time < ? " +
        'GROUP BY p.specialty ORDER BY p.specialty'
    )
    .all(startIso, endIso);
}

function bookedSlotsBetweenByDay(db, startIso, endIso) {
  return db
    .prepare(
      "SELECT substr(s.start_time, 1, 10) AS day, COUNT(*) AS n " +
        'FROM slots s ' +
        "WHERE s.status = 'booked' AND s.start_time >= ? AND s.start_time < ? " +
        'GROUP BY day ORDER BY day'
    )
    .all(startIso, endIso);
}

function allSlotsByDay(db) {
  return db
    .prepare(
      "SELECT substr(start_time, 1, 10) AS day, status, COUNT(*) AS n " +
        'FROM slots GROUP BY day, status ORDER BY day, status'
    )
    .all();
}

// ---------------------------------------------------------------------------
// Booking / holder queries
// ---------------------------------------------------------------------------

function allBookingsWithSlots(db) {
  return db
    .prepare(
      'SELECT b.id AS booking_id, b.holder_ref, s.id AS slot_id, s.start_time, ' +
        's.duration_min, p.name AS provider_name, p.specialty, l.name AS location_name ' +
        'FROM bookings b ' +
        'JOIN slots s ON s.id = b.slot_id ' +
        'JOIN providers p ON p.id = s.provider_id ' +
        'JOIN locations l ON l.id = s.location_id ' +
        'ORDER BY s.start_time'
    )
    .all();
}

function bookingsCountByHolderPrefix(db) {
  // holder_ref looks like "PT-0001"; group by the alpha prefix.
  return db
    .prepare(
      "SELECT substr(holder_ref, 1, instr(holder_ref, '-') - 1) AS prefix, COUNT(*) AS n " +
        'FROM bookings GROUP BY prefix ORDER BY prefix'
    )
    .all();
}

function totalBookings(db) {
  return db.prepare('SELECT COUNT(*) AS n FROM bookings').get().n;
}

module.exports = {
  countAllSlots,
  countSlotsByStatus,
  countAvailableSlots,
  countBookedSlots,
  countSlotsBySpecialty,
  countAvailableSlotsBySpecialty,
  countBookedSlotsBySpecialty,
  countSlotsByProvider,
  countBookedSlotsByProvider,
  countSlotsByLocation,
  countBookedSlotsByLocation,
  slotsBetween,
  countSlotsBetween,
  availableSlotsBetweenBySpecialty,
  bookedSlotsBetweenByDay,
  allSlotsByDay,
  allBookingsWithSlots,
  bookingsCountByHolderPrefix,
  totalBookings,
};
