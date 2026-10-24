function integer(env, key, fallback, min, max) {
  const value = Number(env[key] ?? fallback);
  if (!Number.isSafeInteger(value) || value < min || value > max) throw new Error(`Invalid ${key}: expected integer ${min}–${max}`);
  return value;
}
export function readConfig(env = process.env) {
  const aiMode = env.AI_MODE || 'template';
  if (!['template', 'gemini'].includes(aiMode)) throw new Error('AI_MODE must be template or gemini');
  const model = env.GEMINI_MODEL || 'gemini-3.8-flash';
  if (!/^[a-zA-Z0-9._-]+$/.test(model)) throw new Error('Invalid GEMINI_MODEL');
  return {
    host: env.HOST || '127.0.0.1', port: integer(env, 'PORT', 3000, 1, 65535),
    databasePath: env.DATABASE_PATH || './data/pulse.sqlite',
    slowResponseMs: integer(env, 'SLOW_RESPONSE_MS', 3000, 1, 3600000),
    maxBatchSize: integer(env, 'MAX_BATCH_SIZE', 100, 1, 1000),
    concurrency: integer(env, 'WORKER_CONCURRENCY', 4, 1, 32),
    maxPending: integer(env, 'MAX_PENDING_ITEMS', 1000, 1, 10000),
    llmTimeoutMs: integer(env, 'LLM_TIMEOUT_MS', 30000, 10, 60000),
    geminiKey: aiMode === 'gemini' ? env.GEMINI_API_KEY || '' : '', geminiModel: model,
    logLevel: env.LOG_LEVEL || 'info',
  };
}
