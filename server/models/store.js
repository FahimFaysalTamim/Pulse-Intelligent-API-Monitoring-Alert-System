import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';

export function createStore(path) {
  if (path !== ':memory:') mkdirSync(dirname(resolve(path)), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS alerts (
      id TEXT PRIMARY KEY, api_name TEXT NOT NULL, anomaly_types TEXT NOT NULL,
      severity TEXT NOT NULL CHECK(severity IN ('medium','high','critical')),
      metrics TEXT NOT NULL, message TEXT NOT NULL, message_source TEXT NOT NULL,
      fallback_reason TEXT, status TEXT NOT NULL CHECK(status IN ('active','resolved')),
      occurrences INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, resolved_at TEXT
    );
    CREATE UNIQUE INDEX IF NOT EXISTS one_active_per_api ON alerts(api_name) WHERE status='active';
    CREATE INDEX IF NOT EXISTS alert_filters ON alerts(status, severity, updated_at DESC);
    CREATE TABLE IF NOT EXISTS api_states (
      api_name TEXT PRIMARY KEY, metrics TEXT NOT NULL, healthy INTEGER NOT NULL,
      checks INTEGER NOT NULL DEFAULT 1, last_checked TEXT NOT NULL
    );`);
  const decode = row => row ? { ...row, anomaly_types: JSON.parse(row.anomaly_types), metrics: JSON.parse(row.metrics) } : null;
  const get = id => decode(db.prepare('SELECT * FROM alerts WHERE id=?').get(id));
  return {
    close: () => db.close(), get,
    record(metric, anomaly, explanation) {
      const now = new Date().toISOString();
      db.exec('BEGIN IMMEDIATE');
      try {
        db.prepare(`INSERT INTO api_states(api_name,metrics,healthy,last_checked) VALUES(?,?,?,?)
          ON CONFLICT(api_name) DO UPDATE SET metrics=excluded.metrics, healthy=excluded.healthy,
          checks=api_states.checks+1,last_checked=excluded.last_checked`).run(metric.api_name, JSON.stringify(metric), anomaly.types.length ? 0 : 1, now);
        const existing = db.prepare("SELECT id FROM alerts WHERE api_name=? AND status='active'").get(metric.api_name);
        let id = existing?.id;
        let outcome = 'healthy';
        if (!anomaly.types.length) {
          if (id) { db.prepare("UPDATE alerts SET status='resolved',resolved_at=?,updated_at=? WHERE id=?").run(now, now, id); outcome = 'recovered'; }
        } else {
          const values = [JSON.stringify(anomaly.types), anomaly.severity, JSON.stringify(metric), explanation.message, explanation.source, explanation.reason, now];
          if (id) {
            db.prepare('UPDATE alerts SET anomaly_types=?,severity=?,metrics=?,message=?,message_source=?,fallback_reason=?,updated_at=?,occurrences=occurrences+1 WHERE id=?').run(...values, id);
            outcome = 'updated';
          } else {
            id = randomUUID();
            db.prepare("INSERT INTO alerts(anomaly_types,severity,metrics,message,message_source,fallback_reason,updated_at,id,api_name,status,created_at) VALUES(?,?,?,?,?,?,?,?,?,'active',?)").run(...values, id, metric.api_name, now);
            outcome = 'created';
          }
        }
        db.exec('COMMIT');
        return { outcome, alert_id: id ?? null };
      } catch (error) { db.exec('ROLLBACK'); throw error; }
    },
    resolve(id) {
      const now = new Date().toISOString();
      db.prepare("UPDATE alerts SET status='resolved',resolved_at=?,updated_at=? WHERE id=? AND status='active'").run(now, now, id);
      return get(id);
    },
    list({ status, severity, api, limit, offset }) {
      const parts = [], values = [];
      if (status !== 'all') { parts.push('status=?'); values.push(status); }
      if (severity) { parts.push('severity=?'); values.push(severity); }
      if (api) { parts.push('instr(lower(api_name),lower(?)) > 0'); values.push(api); }
      const where = parts.length ? `WHERE ${parts.join(' AND ')}` : '';
      const total = db.prepare(`SELECT count(*) AS count FROM alerts ${where}`).get(...values).count;
      const rows = db.prepare(`SELECT * FROM alerts ${where} ORDER BY updated_at DESC,id DESC LIMIT ? OFFSET ?`).all(...values, limit, offset);
      return { alerts: rows.map(decode), total, limit, offset };
    },
    stats() {
      const counts = db.prepare(`SELECT count(*) AS total_apis, coalesce(sum(checks),0) AS total_checks,
        coalesce(sum(healthy),0) AS healthy_apis, max(last_checked) AS last_checked FROM api_states`).get();
      const alerts = db.prepare(`SELECT coalesce(sum(status='active'),0) AS active_alerts,
        coalesce(sum(status='active' AND severity='critical'),0) AS critical_alerts,
        coalesce(sum(status='resolved'),0) AS resolved_alerts FROM alerts`).get();
      return { ...counts, ...alerts };
    },
  };
}
