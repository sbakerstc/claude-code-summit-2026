'use strict';

const express = require('express');
const swaggerUi = require('swagger-ui-express');

const { loadOpenApiSpec } = require('./openapi');
const providerRoutes = require('./routes/providers');
const slotRoutes = require('./routes/slots');
const bookingRoutes = require('./routes/bookings');
const { reportingRouter } = require('./reporting');

const openApiSpec = loadOpenApiSpec();

/**
 * Build the Express app around a given database connection.
 *
 * Exporting a factory (rather than a singleton app) lets tests inject an
 * isolated in-memory database, so the test run never touches the seeded file
 * and the suite stays deterministic.
 *
 * @param {import('better-sqlite3').Database} db
 * @returns {import('express').Express}
 */
function createApp(db) {
  const app = express();
  app.use(express.json());

  // Meta + docs surface (Swagger UI at /docs, raw spec at /openapi.json).
  app.get('/', (req, res) => {
    res.json({
      name: 'Clinic Scheduler API',
      note: 'Synthetic demo data — NO PHI.',
      docs: '/docs',
      openapi: '/openapi.json',
      endpoints: ['/health', '/providers', '/providers/:id/slots', '/slots', '/bookings'],
    });
  });
  app.get('/favicon.ico', (req, res) => res.status(204).end());
  app.get('/openapi.json', (req, res) => res.json(openApiSpec));
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(openApiSpec, { customSiteTitle: 'Clinic Scheduler API' }));

  app.get('/health', (req, res) => res.json({ ok: true }));

  app.use('/providers', providerRoutes(db));
  app.use('/slots', slotRoutes(db));
  app.use('/bookings', bookingRoutes(db));
  app.use('/reports', reportingRouter(db));

  // Fallback 404 for unknown routes.
  app.use((req, res) => {
    res.status(404).json({ error: 'not found' });
  });

  return app;
}

module.exports = { createApp };
