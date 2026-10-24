import pino from 'pino';
import { existsSync, readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { readConfig } from './config.js';
import { createStore } from './models/store.js';
import { createAiService } from './services/ai.js';
import { createApp } from './app.js';

// Local .env is the explicit project configuration, ahead of inherited shell values.
const localEnv = existsSync('.env') ? parseEnv(readFileSync('.env', 'utf8')) : {};
const config = readConfig({ ...process.env, ...localEnv });
const logger = pino({ level: config.logLevel });
const store = createStore(config.databasePath);
const app = createApp({ config, store, logger, explain: createAiService(config, logger) });
const server = app.listen(config.port, config.host, () => {
  logger.info({ url: `http://${config.host}:${config.port}`, ai: config.geminiKey ? 'gemini' : 'template' }, 'Pulse is ready');
});
server.on('error', error => { logger.error({ code: error.code }, 'Server could not start'); store.close(); process.exitCode = 1; });
let stopping = false;
function shutdown() {
  if (stopping) return;
  stopping = true;
  server.close(() => { store.close(); process.exitCode = 0; });
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
