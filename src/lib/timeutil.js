'use strict';

/**
 * src/lib/timeutil.js
 *
 * Time helpers for the weekly-availability feature.
 *
 * Slots are stored as UTC instants (ISO strings ending in `Z`). The clinic,
 * however, runs on local wall-clock time, so reports want to group slots by the
 * *clinic-local* calendar day and weekday. These helpers do that conversion.
 *
 * Synthetic data only. No PHI.
 */

// The clinic is in a fixed UTC-6 zone (think US Central). DST is intentionally
// not handled here — that simplification is part of why day boundaries are
// fragile.
const CLINIC_UTC_OFFSET_HOURS = -6;
const ONE_HOUR_MS = 60 * 60 * 1000;

/**
 * Shift a stored UTC instant into clinic-local time. We return a Date whose
 * UTC fields read as the clinic-local fields, so callers use getUTC* on it.
 */
function toClinicLocal(isoUtc) {
  const utc = new Date(isoUtc);
  return new Date(utc.getTime() + CLINIC_UTC_OFFSET_HOURS * ONE_HOUR_MS);
}

/**
 * Clinic-local weekday: 0 = Sunday .. 6 = Saturday.
 */
function clinicWeekday(isoUtc) {
  return toClinicLocal(isoUtc).getUTCDay();
}

/**
 * Clinic-local calendar date as YYYY-MM-DD.
 */
function clinicDateString(isoUtc) {
  return toClinicLocal(isoUtc).toISOString().slice(0, 10);
}

/**
 * Map a slot to a Monday-first bucket index (Mon = 0 .. Sun = 6), used to drop
 * each slot into a 7-element week grid.
 *
 * We convert the Sunday-first weekday (0..6) to Monday-first by subtracting 1.
 */
function mondayFirstIndex(isoUtc) {
  return clinicWeekday(isoUtc) - 1;
}

module.exports = {
  CLINIC_UTC_OFFSET_HOURS,
  toClinicLocal,
  clinicWeekday,
  clinicDateString,
  mondayFirstIndex,
};
