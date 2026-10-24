import { validateMetric, detect } from './detection.js';
import { HttpError } from '../utils/errors.js';

export function createMonitor({ config, store, explain, scheduler, logger }) {
  return async input => {
    if (!Array.isArray(input) || !input.length || input.length > config.maxBatchSize) throw new HttpError(400, `Send an array containing 1–${config.maxBatchSize} API results.`);
    const validated = input.map((item, index) => {
      try { return { index, metric: validateMetric(item) }; }
      catch (error) { return { index, status: 'invalid', error: error.message }; }
    });
    scheduler.reserve(validated.filter(item => item.metric).length);
    const settled = await Promise.allSettled(validated.map(item => {
      if (!item.metric) return Promise.resolve(item);
      return scheduler.run(item.metric.api_name, async () => {
        const anomaly = detect(item.metric, config.slowResponseMs);
        const explanation = anomaly.types.length ? await explain(item.metric, anomaly) : null;
        const saved = store.record(item.metric, anomaly, explanation);
        return { index: item.index, api_name: item.metric.api_name, status: 'processed', ...saved, anomaly_types: anomaly.types, message_source: explanation?.source ?? null };
      });
    }));
    const results = settled.map((result, index) => {
      if (result.status === 'fulfilled') return result.value;
      logger.error({ event: 'monitor_item_failed', index }, 'Could not process monitoring item');
      return { index, status: 'failed', error: 'Processing failed. Retry this item.' };
    });
    const processed = results.filter(item => item.status === 'processed').length;
    logger.info({ event: 'batch_complete', received: input.length, processed }, 'Monitoring batch complete');
    return { summary: { received: input.length, processed, invalid: results.filter(item => item.status === 'invalid').length, failed: results.filter(item => item.status === 'failed').length }, results };
  };
}
