'use strict';

/* eslint-disable no-restricted-syntax */

/**
 * reporting/formatters.js
 *
 * Legacy presentation helpers for the reporting module. This file has grown
 * organically: several near-duplicate formatters, a hand-rolled CSV writer, a
 * pile of label maps, and a small templating layer. It is intentionally
 * verbose and repetitive — it is the kind of "death by a thousand cuts" file
 * that makes reading an entire module naively blow the context window.
 *
 * NOTE: synthetic data only. Nothing here touches PHI. "Revenue" numbers are
 * made-up demo figures attached to fictional providers.
 */

// ---------------------------------------------------------------------------
// Label maps
// ---------------------------------------------------------------------------

const SPECIALTY_LABELS = {
  Cardiology: 'Cardiology',
  Dermatology: 'Dermatology',
  Pediatrics: 'Pediatrics',
  Orthopedics: 'Orthopedics',
  Neurology: 'Neurology',
};

const STATUS_LABELS = {
  available: 'Available',
  booked: 'Booked',
};

const WEEKDAY_LABELS = {
  0: 'Sunday',
  1: 'Monday',
  2: 'Tuesday',
  3: 'Wednesday',
  4: 'Thursday',
  5: 'Friday',
  6: 'Saturday',
};

const MONTH_LABELS = {
  0: 'January',
  1: 'February',
  2: 'March',
  3: 'April',
  4: 'May',
  5: 'June',
  6: 'July',
  7: 'August',
  8: 'September',
  9: 'October',
  10: 'November',
  11: 'December',
};

function specialtyLabel(key) {
  if (SPECIALTY_LABELS[key]) return SPECIALTY_LABELS[key];
  return key || 'Unknown';
}

function statusLabel(key) {
  if (STATUS_LABELS[key]) return STATUS_LABELS[key];
  return key || 'Unknown';
}

function weekdayLabel(index) {
  if (WEEKDAY_LABELS[index] !== undefined) return WEEKDAY_LABELS[index];
  return 'Unknown';
}

function monthLabel(index) {
  if (MONTH_LABELS[index] !== undefined) return MONTH_LABELS[index];
  return 'Unknown';
}

// ---------------------------------------------------------------------------
// Number / percent / currency formatting (several overlapping variants that
// accumulated over time — a prime candidate for the "consolidate this" task).
// ---------------------------------------------------------------------------

function formatInteger(n) {
  const value = Number(n) || 0;
  return Math.round(value).toLocaleString('en-US');
}

function formatNumber(n) {
  const value = Number(n) || 0;
  return value.toLocaleString('en-US');
}

function formatNumber2dp(n) {
  const value = Number(n) || 0;
  return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatPercent(part, whole) {
  if (!whole) return '0%';
  const pct = (Number(part) / Number(whole)) * 100;
  return `${pct.toFixed(1)}%`;
}

function formatPercentValue(pct) {
  const value = Number(pct) || 0;
  return `${value.toFixed(1)}%`;
}

function formatCurrency(amount) {
  const value = Number(amount) || 0;
  return value.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

function formatCurrencyRounded(amount) {
  const value = Math.round(Number(amount) || 0);
  return value.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}

function formatDuration(minutes) {
  const m = Number(minutes) || 0;
  if (m < 60) return `${m} min`;
  const hours = Math.floor(m / 60);
  const rem = m % 60;
  if (rem === 0) return `${hours} hr`;
  return `${hours} hr ${rem} min`;
}

// ---------------------------------------------------------------------------
// Date helpers (UTC-based to match how slots are stored)
// ---------------------------------------------------------------------------

function isoDate(d) {
  const date = d instanceof Date ? d : new Date(d);
  return date.toISOString().slice(0, 10);
}

function isoDateTime(d) {
  const date = d instanceof Date ? d : new Date(d);
  return date.toISOString();
}

function prettyDate(d) {
  const date = d instanceof Date ? d : new Date(d);
  const day = date.getUTCDate();
  const month = monthLabel(date.getUTCMonth());
  const year = date.getUTCFullYear();
  return `${month} ${day}, ${year}`;
}

function prettyDateTime(d) {
  const date = d instanceof Date ? d : new Date(d);
  const hh = String(date.getUTCHours()).padStart(2, '0');
  const mm = String(date.getUTCMinutes()).padStart(2, '0');
  return `${prettyDate(date)} ${hh}:${mm} UTC`;
}

function weekdayOf(d) {
  const date = d instanceof Date ? d : new Date(d);
  return weekdayLabel(date.getUTCDay());
}

// ---------------------------------------------------------------------------
// Table + CSV rendering (hand-rolled; intentionally not using a library)
// ---------------------------------------------------------------------------

function padRight(str, width) {
  const s = String(str);
  if (s.length >= width) return s;
  return s + ' '.repeat(width - s.length);
}

function padLeft(str, width) {
  const s = String(str);
  if (s.length >= width) return s;
  return ' '.repeat(width - s.length) + s;
}

function renderAsciiTable(headers, rows) {
  const widths = headers.map((h, i) => {
    let max = String(h).length;
    for (const row of rows) {
      const cell = row[i] === undefined || row[i] === null ? '' : String(row[i]);
      if (cell.length > max) max = cell.length;
    }
    return max;
  });

  const headerLine = headers.map((h, i) => padRight(h, widths[i])).join(' | ');
  const sepLine = widths.map((w) => '-'.repeat(w)).join('-+-');
  const bodyLines = rows.map((row) =>
    row.map((cell, i) => padRight(cell === undefined || cell === null ? '' : cell, widths[i])).join(' | ')
  );

  return [headerLine, sepLine, ...bodyLines].join('\n');
}

function escapeCsvCell(value) {
  const s = value === undefined || value === null ? '' : String(value);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function renderCsv(headers, rows) {
  const lines = [];
  lines.push(headers.map(escapeCsvCell).join(','));
  for (const row of rows) {
    lines.push(row.map(escapeCsvCell).join(','));
  }
  return lines.join('\n');
}

function renderKeyValueBlock(title, pairs) {
  const lines = [title, '='.repeat(title.length)];
  let keyWidth = 0;
  for (const [k] of pairs) {
    if (String(k).length > keyWidth) keyWidth = String(k).length;
  }
  for (const [k, v] of pairs) {
    lines.push(`${padRight(k, keyWidth)} : ${v}`);
  }
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Envelope used by every report endpoint so responses look consistent.
// ---------------------------------------------------------------------------

function reportEnvelope(name, params, data) {
  return {
    report: name,
    generated_at: new Date().toISOString(),
    disclaimer: 'Synthetic demo data — NO PHI. Figures are fabricated for teaching.',
    params: params || {},
    data,
  };
}

module.exports = {
  SPECIALTY_LABELS,
  STATUS_LABELS,
  WEEKDAY_LABELS,
  MONTH_LABELS,
  specialtyLabel,
  statusLabel,
  weekdayLabel,
  monthLabel,
  formatInteger,
  formatNumber,
  formatNumber2dp,
  formatPercent,
  formatPercentValue,
  formatCurrency,
  formatCurrencyRounded,
  formatDuration,
  isoDate,
  isoDateTime,
  prettyDate,
  prettyDateTime,
  weekdayOf,
  padRight,
  padLeft,
  renderAsciiTable,
  escapeCsvCell,
  renderCsv,
  renderKeyValueBlock,
  reportEnvelope,
};
