export function validateMetric(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Each item must be an object.');
  if (typeof input.api_name !== 'string' || !input.api_name.trim() || input.api_name.trim().length > 120 || /[\u0000-\u001f]/.test(input.api_name)) throw new Error('api_name must be a nonempty string of at most 120 characters without control characters.');
  if (typeof input.response_time_ms !== 'number' || !Number.isFinite(input.response_time_ms) || input.response_time_ms < 0 || input.response_time_ms > 86400000) throw new Error('response_time_ms must be a number between 0 and 86400000.');
  if (!Number.isInteger(input.status_code) || input.status_code < 100 || input.status_code > 599) throw new Error('status_code must be an integer between 100 and 599.');
  if (input.records_returned != null && (!Number.isSafeInteger(input.records_returned) || input.records_returned < 0)) throw new Error('records_returned must be a nonnegative safe integer, null, or omitted.');
  return { api_name: input.api_name.trim(), response_time_ms: input.response_time_ms, status_code: input.status_code, records_returned: input.records_returned ?? null };
}
export function detect(metric, threshold) {
  const types = [];
  if (metric.response_time_ms > threshold) types.push('HIGH_RESPONSE_TIME');
  if (metric.status_code >= 400) types.push('FAILED_REQUEST');
  if (metric.records_returned == null || metric.records_returned === 0) types.push('NO_DATA');
  const severity = metric.status_code >= 500 ? 'critical' : (metric.status_code >= 400 || types.length > 1) ? 'high' : 'medium';
  return { types, severity: types.length ? severity : null };
}
