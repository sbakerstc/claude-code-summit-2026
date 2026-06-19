'use strict';

const {
  countAllSlots,
  countAvailableSlots,
  countBookedSlots,
  countSlotsBySpecialty,
  countBookedSlotsBySpecialty,
  countSlotsByProvider,
  countBookedSlotsByProvider,
  countSlotsByLocation,
  countBookedSlotsByLocation,
  allSlotsByDay,
} = require('./queries');

const {
  formatPercent,
  formatInteger,
  specialtyLabel,
  reportEnvelope,
  renderAsciiTable,
} = require('./formatters');

/**
 * reporting/utilization.js
 *
 * "Utilization" = how much of the available capacity is booked. This file
 * computes utilization at several grains (overall, by specialty, by provider,
 * by location, by day) with a lot of near-identical reshaping logic. It is
 * deliberately long and repetitive: a realistic legacy reporting file.
 *
 * Synthetic data only. No PHI.
 */

function utilizationRate(booked, total) {
  if (!total) return 0;
  return (booked / total) * 100;
}

function overallUtilization(db) {
  const total = countAllSlots(db);
  const booked = countBookedSlots(db);
  const available = countAvailableSlots(db);
  return {
    total_slots: total,
    booked_slots: booked,
    available_slots: available,
    utilization_pct: Number(utilizationRate(booked, total).toFixed(1)),
    utilization_label: formatPercent(booked, total),
  };
}

function utilizationBySpecialty(db) {
  const totals = countSlotsBySpecialty(db);
  const booked = countBookedSlotsBySpecialty(db);
  const bookedMap = {};
  for (const row of booked) {
    bookedMap[row.specialty] = row.n;
  }
  return totals.map((row) => {
    const b = bookedMap[row.specialty] || 0;
    return {
      specialty: specialtyLabel(row.specialty),
      total_slots: row.n,
      booked_slots: b,
      available_slots: row.n - b,
      utilization_pct: Number(utilizationRate(b, row.n).toFixed(1)),
      utilization_label: formatPercent(b, row.n),
    };
  });
}

function utilizationByProvider(db) {
  const totals = countSlotsByProvider(db);
  const booked = countBookedSlotsByProvider(db);
  const bookedMap = {};
  for (const row of booked) {
    bookedMap[row.provider_id] = row.n;
  }
  return totals.map((row) => {
    const b = bookedMap[row.provider_id] || 0;
    return {
      provider_id: row.provider_id,
      provider_name: row.name,
      specialty: specialtyLabel(row.specialty),
      total_slots: row.n,
      booked_slots: b,
      available_slots: row.n - b,
      utilization_pct: Number(utilizationRate(b, row.n).toFixed(1)),
      utilization_label: formatPercent(b, row.n),
    };
  });
}

function utilizationByLocation(db) {
  const totals = countSlotsByLocation(db);
  const booked = countBookedSlotsByLocation(db);
  const bookedMap = {};
  for (const row of booked) {
    bookedMap[row.location_id] = row.n;
  }
  return totals.map((row) => {
    const b = bookedMap[row.location_id] || 0;
    return {
      location_id: row.location_id,
      location_name: row.name,
      total_slots: row.n,
      booked_slots: b,
      available_slots: row.n - b,
      utilization_pct: Number(utilizationRate(b, row.n).toFixed(1)),
      utilization_label: formatPercent(b, row.n),
    };
  });
}

function utilizationByDay(db) {
  const rows = allSlotsByDay(db);
  const byDay = {};
  for (const row of rows) {
    if (!byDay[row.day]) byDay[row.day] = { day: row.day, total: 0, booked: 0, available: 0 };
    byDay[row.day].total += row.n;
    if (row.status === 'booked') byDay[row.day].booked += row.n;
    if (row.status === 'available') byDay[row.day].available += row.n;
  }
  return Object.values(byDay)
    .sort((a, b) => (a.day < b.day ? -1 : 1))
    .map((d) => ({
      day: d.day,
      total_slots: d.total,
      booked_slots: d.booked,
      available_slots: d.available,
      utilization_pct: Number(utilizationRate(d.booked, d.total).toFixed(1)),
      utilization_label: formatPercent(d.booked, d.total),
    }));
}

function utilizationTextSummary(db) {
  const overall = overallUtilization(db);
  const bySpec = utilizationBySpecialty(db);
  const table = renderAsciiTable(
    ['Specialty', 'Total', 'Booked', 'Util %'],
    bySpec.map((r) => [r.specialty, formatInteger(r.total_slots), formatInteger(r.booked_slots), r.utilization_label])
  );
  return [
    `Overall utilization: ${overall.utilization_label} (${formatInteger(overall.booked_slots)} of ${formatInteger(overall.total_slots)} slots booked)`,
    '',
    table,
  ].join('\n');
}

// ---------------------------------------------------------------------------
// Express handlers
// ---------------------------------------------------------------------------

function registerUtilizationRoutes(router, db) {
  router.get('/utilization', (req, res) => {
    res.json(
      reportEnvelope('utilization.overall', {}, {
        overall: overallUtilization(db),
        by_specialty: utilizationBySpecialty(db),
      })
    );
  });

  router.get('/utilization/by-provider', (req, res) => {
    res.json(reportEnvelope('utilization.by_provider', {}, utilizationByProvider(db)));
  });

  router.get('/utilization/by-location', (req, res) => {
    res.json(reportEnvelope('utilization.by_location', {}, utilizationByLocation(db)));
  });

  router.get('/utilization/by-day', (req, res) => {
    res.json(reportEnvelope('utilization.by_day', {}, utilizationByDay(db)));
  });

  router.get('/utilization/summary.txt', (req, res) => {
    res.type('text/plain').send(utilizationTextSummary(db));
  });
}

module.exports = {
  utilizationRate,
  overallUtilization,
  utilizationBySpecialty,
  utilizationByProvider,
  utilizationByLocation,
  utilizationByDay,
  utilizationTextSummary,
  registerUtilizationRoutes,
};
