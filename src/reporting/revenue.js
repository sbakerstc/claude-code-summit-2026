'use strict';

const {
  countBookedSlotsBySpecialty,
  countBookedSlotsByProvider,
  countBookedSlotsByLocation,
  bookedSlotsBetweenByDay,
  allBookingsWithSlots,
} = require('./queries');

const {
  formatCurrency,
  formatCurrencyRounded,
  specialtyLabel,
  reportEnvelope,
  renderAsciiTable,
} = require('./formatters');

/**
 * reporting/revenue.js
 *
 * FAKE revenue reporting. Each specialty has a made-up "list price" per booked
 * slot. None of this is real money or real billing — it exists purely to give
 * the reporting module some numeric heft to summarize. Synthetic data, no PHI.
 *
 * The pricing table and the four "revenue by X" builders below are
 * intentionally repetitive.
 */

// Fabricated demo prices per booked 30-minute slot, in USD.
const SPECIALTY_PRICE = {
  Cardiology: 320,
  Dermatology: 210,
  Pediatrics: 160,
  Orthopedics: 280,
  Neurology: 350,
};

const DEFAULT_PRICE = 200;

function priceFor(specialty) {
  if (SPECIALTY_PRICE[specialty] !== undefined) return SPECIALTY_PRICE[specialty];
  return DEFAULT_PRICE;
}

function revenueBySpecialty(db) {
  const booked = countBookedSlotsBySpecialty(db);
  return booked.map((row) => {
    const price = priceFor(row.specialty);
    const revenue = price * row.n;
    return {
      specialty: specialtyLabel(row.specialty),
      booked_slots: row.n,
      unit_price: price,
      unit_price_label: formatCurrency(price),
      revenue,
      revenue_label: formatCurrency(revenue),
    };
  });
}

function revenueByProvider(db) {
  const booked = countBookedSlotsByProvider(db);
  return booked.map((row) => {
    const price = priceFor(row.specialty);
    const revenue = price * row.n;
    return {
      provider_id: row.provider_id,
      provider_name: row.name,
      specialty: specialtyLabel(row.specialty),
      booked_slots: row.n,
      unit_price: price,
      revenue,
      revenue_label: formatCurrency(revenue),
    };
  });
}

function revenueByLocation(db) {
  // Locations mix specialties, so derive an average price from the bookings
  // actually at each location. This is more involved than the by-specialty
  // path on purpose.
  const rows = allBookingsWithSlots(db);
  const byLocation = {};
  for (const r of rows) {
    if (!byLocation[r.location_name]) {
      byLocation[r.location_name] = { location_name: r.location_name, booked_slots: 0, revenue: 0 };
    }
    byLocation[r.location_name].booked_slots += 1;
    byLocation[r.location_name].revenue += priceFor(r.specialty);
  }
  return Object.values(byLocation)
    .sort((a, b) => b.revenue - a.revenue)
    .map((r) => ({
      location_name: r.location_name,
      booked_slots: r.booked_slots,
      revenue: r.revenue,
      revenue_label: formatCurrency(r.revenue),
    }));
}

function revenueByDay(db, startIso, endIso) {
  const rows = bookedSlotsBetweenByDay(db, startIso, endIso);
  // We do not have per-day specialty breakdown here, so apply the average list
  // price across specialties as a rough demo figure.
  const prices = Object.values(SPECIALTY_PRICE);
  const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
  return rows.map((row) => ({
    day: row.day,
    booked_slots: row.n,
    revenue: Math.round(avg * row.n),
    revenue_label: formatCurrencyRounded(avg * row.n),
  }));
}

function totalRevenue(db) {
  const rows = revenueBySpecialty(db);
  return rows.reduce((sum, r) => sum + r.revenue, 0);
}

function revenueTextSummary(db) {
  const bySpec = revenueBySpecialty(db);
  const total = totalRevenue(db);
  const table = renderAsciiTable(
    ['Specialty', 'Booked', 'Unit', 'Revenue'],
    bySpec.map((r) => [r.specialty, r.booked_slots, r.unit_price_label, r.revenue_label])
  );
  return [
    `Total fabricated revenue: ${formatCurrency(total)}`,
    '(synthetic demo figures — not real billing)',
    '',
    table,
  ].join('\n');
}

function registerRevenueRoutes(router, db) {
  router.get('/revenue', (req, res) => {
    res.json(
      reportEnvelope('revenue.by_specialty', {}, {
        total: totalRevenue(db),
        total_label: formatCurrency(totalRevenue(db)),
        by_specialty: revenueBySpecialty(db),
      })
    );
  });

  router.get('/revenue/by-provider', (req, res) => {
    res.json(reportEnvelope('revenue.by_provider', {}, revenueByProvider(db)));
  });

  router.get('/revenue/by-location', (req, res) => {
    res.json(reportEnvelope('revenue.by_location', {}, revenueByLocation(db)));
  });

  router.get('/revenue/by-day', (req, res) => {
    const now = new Date();
    const start = req.query.start || new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 7)).toISOString();
    const end = req.query.end || new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 21)).toISOString();
    res.json(reportEnvelope('revenue.by_day', { start, end }, revenueByDay(db, start, end)));
  });

  router.get('/revenue/summary.txt', (req, res) => {
    res.type('text/plain').send(revenueTextSummary(db));
  });
}

module.exports = {
  SPECIALTY_PRICE,
  priceFor,
  revenueBySpecialty,
  revenueByProvider,
  revenueByLocation,
  revenueByDay,
  totalRevenue,
  revenueTextSummary,
  registerRevenueRoutes,
};
