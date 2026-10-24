import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './style.css';

const sample = [
  { api_name: 'Payments API', response_time_ms: 4820, status_code: 503, records_returned: 0 },
  { api_name: 'Inventory API', response_time_ms: 3250, status_code: 200, records_returned: 142 },
  { api_name: 'Customers API', response_time_ms: 185, status_code: 200, records_returned: null },
  { api_name: 'Orders API', response_time_ms: 242, status_code: 200, records_returned: 36 },
];
const names = { HIGH_RESPONSE_TIME: 'Slow response', FAILED_REQUEST: 'Failed request', NO_DATA: 'No data' };
const time = value => value ? new Date(value).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'No checks yet';
async function request(path, options) {
  const response = await fetch(path, options);
  let data;
  try { data = await response.json(); } catch { throw new Error('The server returned an unreadable response.'); }
  if (!response.ok) throw new Error(data.error || 'Request failed.');
  return data;
}
function Icon({ name, size = 20 }) {
  const paths = { pulse: 'M2 12h5l3-8 4 16 3-8h5', grid: 'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z', arrow: 'M5 12h14 M13 6l6 6-6 6', refresh: 'M20 7v5h-5 M4 17v-5h5 M6 7a7 7 0 0 1 12-1l2 3 M4 15l2 3a7 7 0 0 0 12-1', check: 'M5 12l4 4L19 6', alert: 'M12 8v5 M12 17h.01 M10 3L2 19h20L14 3z', code: 'M8 5l-6 7 6 7 M16 5l6 7-6 7 M14 3l-4 18' };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name] || paths.pulse}/></svg>;
}
function App() {
  const [data, setData] = useState({ alerts: [], total: 0 });
  const [stats, setStats] = useState(null), [health, setHealth] = useState(null);
  const [status, setStatus] = useState('active'), [severity, setSeverity] = useState(''), [search, setSearch] = useState(''), [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const [connectionError, setConnectionError] = useState('');
  const [busy, setBusy] = useState(false), [auto, setAuto] = useState(true), [editor, setEditor] = useState(false);
  const [json, setJson] = useState(JSON.stringify(sample, null, 2)), [batch, setBatch] = useState(null);
  const [refresh, setRefresh] = useState(0), [updated, setUpdated] = useState(null);
  const sequence = useRef(0), dialog = useRef(null);
  useEffect(() => {
    const id = ++sequence.current;
    const controller = new AbortController();
    setLoading(true);
    const params = new URLSearchParams({ status, api: search, limit: '12', offset: String(offset) });
    if (severity) params.set('severity', severity);
    const timer = setTimeout(async () => {
      try {
        const [alerts, summary, config] = await Promise.all(['/alerts?' + params, '/stats', '/health'].map(path => request(path, { signal: controller.signal })));
        if (id !== sequence.current) return;
        if (offset && !alerts.alerts.length) { setOffset(0); return; }
        setData(alerts); setStats(summary); setHealth(config); setConnectionError(''); setUpdated(new Date().toISOString());
      } catch (err) { if (err.name !== 'AbortError' && id === sequence.current) setConnectionError(err.message); }
      finally { if (id === sequence.current) setLoading(false); }
    }, search ? 250 : 0);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [status, severity, search, offset, refresh]);
  useEffect(() => { if (!auto) return; const timer = setInterval(() => setRefresh(v => v + 1), 15000); return () => clearInterval(timer); }, [auto]);
  useEffect(() => {
    if (!editor) return;
    const previous = document.activeElement;
    const listener = e => {
      if (e.key === 'Escape') setEditor(false);
      if (e.key !== 'Tab') return;
      const focusable = [...dialog.current.querySelectorAll('button:not(:disabled), textarea, input, select, a[href]')];
      const first = focusable[0], last = focusable.at(-1);
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', listener);
    return () => { document.removeEventListener('keydown', listener); previous?.focus(); };
  }, [editor]);
  async function submit(items) {
    setBusy(true); setError(''); setNotice('');
    try {
      const result = await request('/monitor', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(items) });
      setBatch(result); setNotice(`${result.summary.processed} of ${result.summary.received} checks processed. ${result.summary.invalid} invalid, ${result.summary.failed} failed.`);
      setOffset(0); setRefresh(v => v + 1); if (!result.summary.invalid && !result.summary.failed) setEditor(false);
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }
  async function resolveAlert(id) {
    setBusy(true);
    try { await request(`/alerts/${id}/resolve`, { method: 'PATCH' }); setNotice('Incident marked as resolved. The next unhealthy check can open a new incident.'); setRefresh(v => v + 1); }
    catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  const healthyPercent = stats?.total_apis ? Math.round(stats.healthy_apis / stats.total_apis * 100) : null;
  return <div className="shell">
    <aside className="sidebar">
      <a className="brand" href="/"><span className="brand-icon"><Icon name="pulse" size={25}/></span>pulse<span className="brand-dot">.</span></a>
      <div className="workspace"><span className="workspace-symbol">P</span><div>Project Care<small>API observability</small></div><span className="workspace-caret">⌄</span></div>
      <p className="nav-label">WORKSPACE</p>
      <nav><a href="#overview" className="nav-active"><Icon name="grid"/>Overview</a><button onClick={() => setEditor(true)}><Icon name="code"/>Submit checks</button></nav>
      <div className="sidebar-bottom"><span className="small-label">BUILT FOR CLARITY</span><p>Every signal.<br/>A clearer next step.</p><span className="version">PULSE / V1.0</span></div>
    </aside>
    <main id="overview">
      <header className="topbar"><span>Workspace <span className="slash">/</span> <strong>Overview</strong></span><span className="connection"><i className={connectionError ? 'dot offline' : 'dot'}/>{connectionError ? 'Connection needs attention' : health ? 'Monitor online' : 'Connecting…'}</span></header>
      <div className="content">
        <div className="page-heading"><div><div className="eyebrow">YOUR APIS, AT A GLANCE</div><h1>Monitoring overview</h1><p>Turn API health signals into actionable insights.</p></div><button className="primary" disabled={busy} onClick={() => submit(sample)}><Icon name="pulse"/>{busy ? 'Processing…' : 'Run sample checks'}<Icon name="arrow" size={17}/></button></div>
        {connectionError && <div className="banner error" role="alert">{connectionError} <button onClick={() => setRefresh(v => v + 1)}>Retry connection</button></div>}
        {error && <div className="banner error" role="alert">{error} <button onClick={() => setError('')}>Dismiss</button></div>}
        {notice && <div className="banner success" role="status">{notice}<button aria-label="Dismiss notification" onClick={() => setNotice('')}>×</button></div>}
        <section className="stats" aria-label="Monitoring summary">
          {[['Monitored APIs', stats?.total_apis, 'Unique APIs receiving checks', 'pulse', ''], ['Active incidents', stats?.active_alerts, `${stats?.critical_alerts ?? 0} critical incidents need attention`, 'alert', 'orange'], ['Healthy APIs', healthyPercent == null ? '—' : `${healthyPercent}%`, `${stats?.healthy_apis ?? 0} APIs healthy at their latest check`, 'check', 'green'], ['Checks processed', stats?.total_checks, 'Across all submitted batches', 'grid', '']].map(([title, value, caption, icon, color]) => <article className="stat" key={title}><div className="stat-label">{title}<span className={`stat-icon ${color}`}><Icon name={icon} size={17}/></span></div><strong className={color}>{value ?? '—'}</strong><small>{caption}</small></article>)}
        </section>
        <section className="insight"><div className="insight-icon"><Icon name="pulse" size={24}/></div><div><strong>{health?.ai === 'configured' ? 'AI explanations are enabled' : 'Your monitoring workspace is ready'}</strong><p>{health?.ai === 'configured' ? 'Gemini explains detected anomalies. Provider failures automatically use a template.' : 'Run sample checks to explore incidents. Add a Gemini key in .env to enable AI explanations.'}</p></div><span className="mode-badge">{health?.ai === 'configured' ? 'GEMINI + FALLBACK' : 'TEMPLATE MODE'}</span></section>
        <section className="incident-panel">
          <div className="section-heading"><div><h2>Incident feed <span>{data.total}</span></h2><p>Track anomalies and understand what needs your attention.</p></div><div className="refresh-controls"><label><input type="checkbox" checked={auto} onChange={e => setAuto(e.target.checked)}/>Auto-refresh · 15s</label><button className="icon-button" aria-label="Refresh alerts" onClick={() => setRefresh(v => v + 1)}><Icon name="refresh" size={17}/></button></div></div>
          <div className="filterbar"><div className="tabs" aria-label="Incident status">{['active', 'resolved', 'all'].map(tab => <button key={tab} className={status === tab ? 'selected' : ''} aria-pressed={status === tab} onClick={() => { setStatus(tab); setOffset(0); }}>{tab === 'all' ? 'All incidents' : tab[0].toUpperCase() + tab.slice(1)}</button>)}</div><div className="filters"><input aria-label="Search API name" placeholder="Search API name…" value={search} onChange={e => { setSearch(e.target.value); setOffset(0); }}/><select aria-label="Filter severity" value={severity} onChange={e => { setSeverity(e.target.value); setOffset(0); }}><option value="">All severities</option><option value="critical">Critical</option><option value="high">High</option><option value="medium">Medium</option></select></div></div>
          <div className="feed" aria-busy={loading}>
            {loading && !updated ? <div className="empty">Loading your workspace…</div> : !data.alerts.length ? <div className="empty"><span className="empty-icon"><Icon name="check" size={30}/></span><h3>{search || severity ? 'No matching incidents' : status === 'resolved' ? 'No resolved incidents yet' : 'All quiet here'}</h3><p>{stats?.total_checks ? 'Change the filters or submit another batch of checks.' : 'Submit your first API checks to start monitoring.'}</p><button className="secondary" onClick={() => setEditor(true)}>Submit API checks <Icon name="arrow" size={16}/></button></div> : data.alerts.map(alert => <article className={`incident ${alert.severity}`} key={alert.id}>
              <div className="incident-marker"><Icon name={alert.status === 'resolved' ? 'check' : 'alert'} size={19}/></div>
              <div className="incident-body"><div className="incident-title"><h3>{alert.api_name}</h3><span className={`badge ${alert.severity}`}>{alert.severity}</span>{alert.status === 'resolved' && <span className="badge resolved">Resolved</span>}<time dateTime={alert.updated_at}>{time(alert.updated_at)}</time></div>
                <div className="tags">{alert.anomaly_types.map(type => <span key={type}>{names[type]}</span>)}</div>
                <p className="message">{alert.message}</p>
                <div className="incident-footer"><div className="metrics"><span><b>{alert.metrics.response_time_ms.toLocaleString()}</b> ms</span><span>HTTP <b>{alert.metrics.status_code}</b></span><span><b>{alert.metrics.records_returned ?? 'Missing'}</b> records</span><span><b>{alert.occurrences}</b> occurrence{alert.occurrences === 1 ? '' : 's'}</span></div><span className="source" title={alert.fallback_reason || 'Generated by Gemini'}>{alert.message_source === 'gemini' ? '✧ AI explanation' : 'Template explanation'}</span></div>
                <details><summary>Incident details</summary><div className="details"><span>ID: {alert.id}</span><span>First detected: {time(alert.created_at)}</span>{alert.resolved_at && <span>Resolved: {time(alert.resolved_at)}</span>}{alert.fallback_reason && <span>Template reason: {alert.fallback_reason.replaceAll('_', ' ')}</span>}</div></details>
              </div>{alert.status === 'active' && <button className="resolve" disabled={busy} onClick={() => resolveAlert(alert.id)}><Icon name="check" size={15}/>Resolve</button>}
            </article>)}
          </div>
          <div className="feed-footer"><span>{data.total ? `${offset + 1}–${Math.min(offset + 12, data.total)} of ${data.total} incidents` : 'No incidents to display'}</span><div><button disabled={!offset || loading} onClick={() => setOffset(v => Math.max(0, v - 12))}>Previous</button><button disabled={offset + 12 >= data.total || loading} onClick={() => setOffset(v => v + 12)}>Next</button></div></div>
        </section>
        {batch && (batch.summary.invalid > 0 || batch.summary.failed > 0) && <section className="batch-errors"><h2>Batch feedback</h2>{batch.results.filter(item => item.error).map(item => <p key={item.index}>Item {item.index + 1}: {item.error}</p>)}</section>}
        <footer className="page-footer"><span><i className="dot"/> Last synced: {time(updated)}</span><span>Slow response threshold: {health?.slow_response_ms ?? '—'} ms</span></footer>
      </div>
    </main>
    {editor && <div className="modal-backdrop"><section ref={dialog} className="modal" role="dialog" aria-modal="true" aria-labelledby="editor-title"><div className="modal-heading"><div><div className="eyebrow">INGEST MONITORING DATA</div><h2 id="editor-title">Submit API checks</h2></div><button aria-label="Close editor" onClick={() => setEditor(false)}>×</button></div><p>Paste a JSON array of API results. Up to {health?.max_batch_size ?? 100} checks per batch.</p><label htmlFor="json-input">Monitoring payload</label><textarea id="json-input" autoFocus spellCheck="false" value={json} onChange={e => setJson(e.target.value)}/>{error && <p className="editor-error" role="alert">{error}</p>}{batch?.results.filter(item => item.error).map(item => <p className="editor-error" key={item.index}>Item {item.index + 1}: {item.error}</p>)}<div className="modal-actions"><button className="secondary" onClick={() => setJson(JSON.stringify(sample, null, 2))}>Load sample</button><button className="secondary" onClick={() => setJson(JSON.stringify(sample.map(item => ({ ...item, response_time_ms: 150, status_code: 200, records_returned: 20 })), null, 2))}>Load recovery</button><button className="primary" disabled={busy} onClick={() => { try { const input = JSON.parse(json); submit(input); } catch { setError('Invalid JSON. Check commas, brackets, and quotation marks.'); } }}>{busy ? 'Processing…' : 'Process batch'}<Icon name="arrow" size={16}/></button></div></section></div>}
  </div>;
}
createRoot(document.getElementById('root')).render(<App/>);
