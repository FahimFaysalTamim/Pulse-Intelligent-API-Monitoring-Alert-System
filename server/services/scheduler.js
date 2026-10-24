import { HttpError } from '../utils/errors.js';

// One global pool across all HTTP requests; a per-API chain preserves input order.
export function createScheduler(concurrency, maxPending) {
  let active = 0, pending = 0;
  const waiters = [], tails = new Map();
  async function slot(task) {
    if (active >= concurrency) await new Promise(resolve => waiters.push(resolve));
    else active++;
    try { return await task(); }
    finally { const next = waiters.shift(); if (next) next(); else active--; }
  }
  return {
    reserve(count) {
      if (pending + count > maxPending) throw new HttpError(429, 'Processing queue is full. Retry this batch later.');
      pending += count;
    },
    run(key, task) {
      const prior = tails.get(key) || Promise.resolve();
      const work = prior.catch(() => {}).then(() => slot(task));
      tails.set(key, work);
      return work.finally(() => { pending--; if (tails.get(key) === work) tails.delete(key); });
    },
  };
}
