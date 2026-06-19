'use strict';

const express = require('express');

const { registerUtilizationRoutes } = require('./utilization');
const { registerRevenueRoutes } = require('./revenue');
const { registerCapacityRoutes } = require('./capacity');
const { reportEnvelope } = require('./formatters');

/**
 * reporting/index.js
 *
 * Mounts the whole (sprawling) reporting surface under a single router. The
 * actual handlers live in the sibling files: utilization.js, revenue.js,
 * capacity.js. This branch exists so the best-practices / context-management
 * workshop has real bulk to work against.
 *
 * Synthetic data only. No PHI. "Revenue" figures are fabricated.
 *
 * @param {import('better-sqlite3').Database} db
 * @returns {import('express').Router}
 */
function reportingRouter(db) {
  const router = express.Router();

  // Index of every report endpoint, so the surface is discoverable.
  router.get('/', (req, res) => {
    res.json(
      reportEnvelope('reporting.index', {}, {
        endpoints: [
          'GET /reports/utilization',
          'GET /reports/utilization/by-provider',
          'GET /reports/utilization/by-location',
          'GET /reports/utilization/by-day',
          'GET /reports/utilization/summary.txt',
          'GET /reports/revenue',
          'GET /reports/revenue/by-provider',
          'GET /reports/revenue/by-location',
          'GET /reports/revenue/by-day?start=&end=',
          'GET /reports/revenue/summary.txt',
          'GET /reports/capacity?days=14',
          'GET /reports/capacity/by-day?days=14',
          'GET /reports/capacity/by-weekday?days=14',
          'GET /reports/capacity/by-hour?days=14',
          'GET /reports/capacity/summary.txt?days=14',
        ],
      })
    );
  });

  registerUtilizationRoutes(router, db);
  registerRevenueRoutes(router, db);
  registerCapacityRoutes(router, db);

  return router;
}

module.exports = { reportingRouter };
