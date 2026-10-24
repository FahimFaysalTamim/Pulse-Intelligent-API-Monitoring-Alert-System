import express from 'express';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { createScheduler } from './services/scheduler.js';
import { createMonitor } from './services/monitor.js';
import { HttpError } from './utils/errors.js';

export function createApp({ config, store, explain, logger }) {
  const app = express();
  const scheduler = createScheduler(config.concurrency, config.maxPending);
  const monitor = createMonitor({ config, store, explain, scheduler, logger });
  app.disable('x-powered-by');
  app.use((req, res, next) => {
    req.requestId = randomUUID();
    res.setHeader('X-Request-Id', req.requestId);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Content-Security-Policy', "default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'");
    const start = Date.now();
    res.on('finish', () => logger.info({ requestId: req.requestId, method: req.method, path: req.path, status: res.statusCode, durationMs: Date.now() - start }, 'HTTP request'));
    next();
  });
  app.use(express.json({ limit: '1mb' }));
  app.get('/health', (req, res) => res.json({ status: 'ok', ai: config.geminiKey ? 'configured' : 'template', model: config.geminiModel, slow_response_ms: config.slowResponseMs, max_batch_size: config.maxBatchSize }));
  app.get('/stats', (req, res) => res.json(store.stats()));
  app.post('/monitor', async (req, res) => {
    if (!req.is('application/json')) throw new HttpError(415, 'Content-Type must be application/json.');
    const result = await monitor(req.body);
    res.status(result.summary.invalid || result.summary.failed ? 207 : 200).json(result);
  });
  app.get('/alerts', (req, res) => {
    const { status = 'active', severity, api = '', limit = '20', offset = '0' } = req.query;
    if (!['active', 'resolved', 'all'].includes(status) || (severity !== undefined && !['critical', 'high', 'medium'].includes(severity))) throw new HttpError(400, 'Invalid status or severity filter.');
    if (typeof api !== 'string' || api.length > 120 || typeof limit !== 'string' || typeof offset !== 'string' || !/^\d+$/.test(limit) || !/^\d+$/.test(offset) || Number(limit) < 1 || Number(limit) > 100 || !Number.isSafeInteger(Number(offset))) throw new HttpError(400, 'Invalid search or pagination parameters.');
    res.json(store.list({ status, severity, api, limit: Number(limit), offset: Number(offset) }));
  });
  app.patch('/alerts/:id/resolve', async (req, res) => {
    const alert = store.get(req.params.id);
    if (!alert) throw new HttpError(404, 'Alert not found.');
    scheduler.reserve(1);
    const result = await scheduler.run(alert.api_name, () => store.resolve(alert.id));
    res.json(result);
  });
  app.use(express.static(resolve('dist')));
  app.use((req, res) => res.status(404).json({ error: 'Route not found. Build the frontend with npm run build if opening the dashboard.' }));
  app.use((error, req, res, next) => {
    const status = error.status >= 400 && error.status < 600 ? error.status : 500;
    logger.error({ requestId: req.requestId, status, event: 'request_error' }, 'Request failed');
    const message = error.type === 'entity.parse.failed' ? 'Invalid JSON body.' : status === 413 ? 'Request body exceeds 1 MB.' : status < 500 ? error.message : 'Internal server error.';
    if (status === 429) res.setHeader('Retry-After', '5');
    res.status(status).json({ error: message, request_id: req.requestId });
  });
  return app;
}
