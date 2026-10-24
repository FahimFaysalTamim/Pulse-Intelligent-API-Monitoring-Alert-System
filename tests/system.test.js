import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readConfig } from '../server/config.js';
import { validateMetric, detect } from '../server/services/detection.js';
import { createAiService } from '../server/services/ai.js';
import { createStore } from '../server/models/store.js';
import { createScheduler } from '../server/services/scheduler.js';
import { createApp } from '../server/app.js';

const logger = { info() {}, warn() {}, error() {} };
const config = readConfig({});
const healthy = { api_name: 'Orders', response_time_ms: 3000, status_code: 200, records_returned: 4 };
const bad = { ...healthy, response_time_ms: 3100, status_code: 503, records_returned: 0 };
const list = { status: 'all', limit: 100, offset: 0, api: '' };
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

test('detection boundary, multiple anomalies, missing/null records, and severity', () => {
  assert.deepEqual(detect(healthy, 3000), { types: [], severity: null });
  assert.deepEqual(detect(bad, 3000), { types: ['HIGH_RESPONSE_TIME', 'FAILED_REQUEST', 'NO_DATA'], severity: 'critical' });
  for (const records_returned of [0, null, undefined]) assert.deepEqual(detect({ ...healthy, records_returned }, 3000), { types: ['NO_DATA'], severity: 'medium' });
  assert.equal(detect({ ...healthy, status_code: 404 }, 3000).severity, 'high');
  assert.equal(detect(healthy, 2999).types[0], 'HIGH_RESPONSE_TIME');
});
test('strict metric validation rejects malformed input without rejecting omitted records', () => {
  for (const item of [null, [], {}, { ...healthy, api_name: ' ' }, { ...healthy, response_time_ms: '3000' }, { ...healthy, status_code: 600 }, { ...healthy, response_time_ms: -1 }, { ...healthy, records_returned: 1.5 }, { ...healthy, records_returned: false }]) assert.throws(() => validateMetric(item));
  const { records_returned, ...missing } = healthy;
  assert.equal(validateMetric(missing).records_returned, null);
});
test('configuration rejects bad thresholds and limits', () => {
  assert.equal(readConfig({ GEMINI_API_KEY: 'ambient-key' }).geminiKey, '');
  assert.equal(readConfig({ AI_MODE: 'gemini', GEMINI_API_KEY: 'test-key' }).geminiKey, 'test-key');
  for (const env of [{ WORKER_CONCURRENCY: '0' }, { SLOW_RESPONSE_MS: 'abc' }, { MAX_BATCH_SIZE: '-1' }]) assert.throws(() => readConfig(env));
});
test('AI uses Gemini output, sends isolated structured metrics, and falls back safely', async () => {
  const anomaly = detect(bad, 3000);
  let body;
  const ai = createAiService({ ...config, geminiKey: 'test-key' }, logger, async (url, options) => {
    body = JSON.parse(options.body);
    assert.equal(options.headers['x-goog-api-key'], 'test-key');
    assert.ok(options.signal instanceof AbortSignal);
    return { ok: true, json: async () => ({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: 'Orders returned HTTP 503 with zero records in 3100 ms. Inspect server logs.' }] } }] }) };
  });
  assert.equal((await ai(bad, anomaly)).source, 'gemini');
  assert.deepEqual(JSON.parse(body.contents[0].parts[0].text).anomalies, anomaly.types);
  assert.ok(body.systemInstruction.parts[0].text.includes('untrusted'));
  for (const response of [{ ok: false, status: 429 }, { ok: true, json: async () => ({ candidates: [] }) }, { ok: true, json: async () => { throw new Error('bad JSON'); } }]) {
    const result = await createAiService({ ...config, geminiKey: 'test-key' }, logger, async () => response)(bad, anomaly);
    assert.equal(result.source, 'template'); assert.match(result.message, /503/); assert.match(result.message, /3100/);
  }
  assert.equal((await createAiService(config, logger)(bad, anomaly)).reason, 'not_configured');
  const timeout = await createAiService({ ...config, geminiKey: 'x', llmTimeoutMs: 10 }, logger, async (url, { signal }) => {
    await sleep(20); signal.throwIfAborted();
  })(bad, anomaly);
  assert.equal(timeout.reason, 'timeout');
});
test('SQLite persists, deduplicates, resolves, and opens a new recurrence', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'pulse-test-'));
  const path = join(directory, 'test.sqlite');
  let store = createStore(path);
  try {
    const anomaly = detect(bad, 3000), explanation = await createAiService(config, logger)(bad, anomaly);
    const first = store.record(bad, anomaly, explanation);
    store.record(bad, anomaly, explanation);
    assert.equal(store.list(list).total, 1); assert.equal(store.get(first.alert_id).occurrences, 2);
    store.close(); store = createStore(path);
    assert.equal(store.list(list).total, 1);
    assert.equal(store.record(healthy, detect(healthy, 3000), null).outcome, 'recovered');
    assert.equal(store.get(first.alert_id).status, 'resolved');
    assert.notEqual(store.record(bad, anomaly, explanation).alert_id, first.alert_id);
    assert.equal(store.stats().total_checks, 4);
  } finally { store.close(); rmSync(directory, { recursive: true, force: true }); }
});
test('global scheduler bounds concurrency, preserves API order, and rejects overload', async () => {
  const scheduler = createScheduler(2, 5), events = [];
  let active = 0, peak = 0;
  scheduler.reserve(5);
  assert.throws(() => scheduler.reserve(1), /queue is full/);
  const work = ['A', 'A', 'B', 'C', 'A'].map((key, index) => scheduler.run(key, async () => {
    active++; peak = Math.max(peak, active); await sleep(5); events.push(index); active--;
    if (index === 0) throw new Error('first item fails');
  }));
  const results = await Promise.allSettled(work);
  assert.equal(results[0].status, 'rejected'); assert.ok(peak <= 2);
  assert.ok(events.indexOf(0) < events.indexOf(1) && events.indexOf(1) < events.indexOf(4));
  scheduler.reserve(1); await scheduler.run('A', () => {});
});

async function harness(t, overrides = {}) {
  const store = createStore(':memory:');
  const app = createApp({ config, store, logger, explain: createAiService(config, logger), ...overrides });
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(async () => { await new Promise(resolve => server.close(resolve)); store.close(); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = async (path, method = 'GET', body) => {
    const response = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: response.status, data: await response.json() };
  };
  return { call, store, base };
}
test('HTTP workflow: partial batch, dedupe, filters, resolution, recovery, pagination', async t => {
  const { call } = await harness(t);
  const batch = await call('/monitor', 'POST', [bad, { api_name: 'Invalid' }, { ...healthy, api_name: 'Healthy' }]);
  assert.equal(batch.status, 207); assert.deepEqual(batch.data.summary, { received: 3, processed: 2, invalid: 1, failed: 0 });
  assert.equal((await call('/alerts')).data.total, 1);
  await call('/monitor', 'POST', [bad, bad]);
  const alert = (await call('/alerts')).data.alerts[0]; assert.equal(alert.occurrences, 3);
  assert.equal((await call('/alerts?severity=medium')).data.total, 0);
  assert.equal((await call('/alerts?api=ORD')).data.total, 1);
  assert.equal((await call('/alerts?limit=1&offset=1')).data.alerts.length, 0);
  assert.equal((await call(`/alerts/${alert.id}/resolve`, 'PATCH')).data.status, 'resolved');
  assert.equal((await call('/alerts')).data.total, 0);
  await call('/monitor', 'POST', [bad, healthy]);
  assert.equal((await call('/alerts')).data.total, 0);
  assert.equal((await call('/alerts?status=resolved')).data.total, 2);
  assert.equal((await call('/stats')).data.healthy_apis, 2);
  assert.equal((await call('/health')).data.ai, 'template');
});
test('HTTP rejects malformed payloads, oversized batches and invalid filters', async t => {
  const { call, base } = await harness(t);
  for (const input of [[], {}, Array(101).fill(healthy)]) assert.equal((await call('/monitor', 'POST', input)).status, 400);
  for (const query of ['limit=-1', 'limit=101', 'status=bad', 'severity=bad', 'offset=1.5', 'api[x]=y&api=z&api=w']) assert.equal((await call(`/alerts?${query}`)).status, 400);
  assert.equal((await call('/alerts/missing/resolve', 'PATCH')).status, 404);
  assert.equal((await fetch(base + '/monitor', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{' })).status, 400);
  assert.equal((await fetch(base + '/monitor', { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: '[]' })).status, 415);
  assert.equal((await fetch(base + '/monitor', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(['x'.repeat(1050000)]) })).status, 413);
});
test('an unexpected item failure does not discard the rest of the batch', async t => {
  const { call } = await harness(t, { explain: async metric => { if (metric.api_name === 'Broken') throw new Error('injected failure'); return { message: 'Test alert', source: 'template', reason: 'test' }; } });
  const result = await call('/monitor', 'POST', [{ ...bad, api_name: 'Broken' }, bad]);
  assert.equal(result.status, 207); assert.equal(result.data.summary.failed, 1); assert.equal(result.data.summary.processed, 1);
});
