'use strict';

const {
  slotsBetween,
  availableSlotsBetweenBySpecialty,
  countSlotsBetween,
} = require('./queries');

const {
  specialtyLabel,
  weekdayOf,
  reportEnvelope,
  renderAsciiTable,
  formatInteger,
} = require('./formatters');

/**
 * reporting/capacity.js
 *
 * Forward-looking capacity views: what is open over the next N days, broken out
 * by day, weekday, specialty, and hour-of-day. Lots of small bucketing loops
 * that look alike. Synthetic data, no PHI.
 */

function windowIso(daysAhead) {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + daysAhead);
  return { startIso: start.toISOString(), endIso: end.toISOString() };
}

function capacityNextDays(db, daysAhead) {
  const { startIso, endIso } = windowIso(daysAhead);
  const slots = slotsBetween(db, startIso, endIso);
  let available = 0;
  let booked = 0;
  for (const s of slots) {
    if (s.status === 'available') available += 1;
    else if (s.status === 'booked') booked += 1;
  }
  return {
    window_days: daysAhead,
    start: startIso,
    end: endIso,
    total_slots: slots.length,
    available_slots: available,
    booked_slots: booked,
  };
}

function availableByDay(db, daysAhead) {
  const { startIso, endIso } = windowIso(daysAhead);
  const slots = slotsBetween(db, startIso, endIso);
  const byDay = {};
  for (const s of slots) {
    if (s.status !== 'available') continue;
    const day = s.start_time.slice(0, 10);
    byDay[day] = (byDay[day] || 0) + 1;
  }
  return Object.entries(byDay)
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([day, n]) => ({ day, weekday: weekdayOf(day), available_slots: n }));
}

function availableByWeekday(db, daysAhead) {
  const { startIso, endIso } = windowIso(daysAhead);
  const slots = slotsBetween(db, startIso, endIso);
  const byWeekday = {};
  for (const s of slots) {
    if (s.status !== 'available') continue;
    const wd = weekdayOf(s.start_time);
    byWeekday[wd] = (byWeekday[wd] || 0) + 1;
  }
  return Object.entries(byWeekday).map(([weekday, n]) => ({ weekday, available_slots: n }));
}

function availableByHour(db, daysAhead) {
  const { startIso, endIso } = windowIso(daysAhead);
  const slots = slotsBetween(db, startIso, endIso);
  const byHour = {};
  for (const s of slots) {
    if (s.status !== 'available') continue;
    const hour = new Date(s.start_time).getUTCHours();
    byHour[hour] = (byHour[hour] || 0) + 1;
  }
  return Object.entries(byHour)
    .map(([hour, n]) => ({ hour: Number(hour), available_slots: n }))
    .sort((a, b) => a.hour - b.hour);
}

function availableBySpecialty(db, daysAhead) {
  const { startIso, endIso } = windowIso(daysAhead);
  return availableSlotsBetweenBySpecialty(db, startIso, endIso).map((r) => ({
    specialty: specialtyLabel(r.specialty),
    available_slots: r.n,
  }));
}

function capacityTextSummary(db, daysAhead) {
  const cap = capacityNextDays(db, daysAhead);
  const bySpec = availableBySpecialty(db, daysAhead);
  const table = renderAsciiTable(
    ['Specialty', 'Available'],
    bySpec.map((r) => [r.specialty, formatInteger(r.available_slots)])
  );
  return [
    `Capacity for the next ${daysAhead} days:`,
    `  ${formatInteger(cap.available_slots)} available of ${formatInteger(cap.total_slots)} total slots`,
    '',
    table,
  ].join('\n');
}

function parseDays(req, fallback) {
  const n = Number(req.query.days);
  if (Number.isInteger(n) && n > 0 && n <= 90) return n;
  return fallback;
}

function registerCapacityRoutes(router, db) {
  router.get('/capacity', (req, res) => {
    const days = parseDays(req, 14);
    res.json(
      reportEnvelope('capacity.window', { days }, {
        summary: capacityNextDays(db, days),
        by_specialty: availableBySpecialty(db, days),
      })
    );
  });

  router.get('/capacity/by-day', (req, res) => {
    const days = parseDays(req, 14);
    res.json(reportEnvelope('capacity.by_day', { days }, availableByDay(db, days)));
  });

  router.get('/capacity/by-weekday', (req, res) => {
    const days = parseDays(req, 14);
    res.json(reportEnvelope('capacity.by_weekday', { days }, availableByWeekday(db, days)));
  });

  router.get('/capacity/by-hour', (req, res) => {
    const days = parseDays(req, 14);
    res.json(reportEnvelope('capacity.by_hour', { days }, availableByHour(db, days)));
  });

  router.get('/capacity/summary.txt', (req, res) => {
    const days = parseDays(req, 14);
    res.type('text/plain').send(capacityTextSummary(db, days));
  });
}

module.exports = {
  windowIso,
  capacityNextDays,
  availableByDay,
  availableByWeekday,
  availableByHour,
  availableBySpecialty,
  capacityTextSummary,
  registerCapacityRoutes,
};
