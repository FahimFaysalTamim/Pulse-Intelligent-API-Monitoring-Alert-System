# A 7-minute interview walkthrough

Use your own words. Practice once without recording. Keep secrets off screen: do not show `.env`, API keys, or account credentials.

## 0:00–0:45 — Problem and solution

“This application accepts batches of API health results. It finds slow responses, failed requests, and zero or missing records. It stores incidents and explains them in plain English so an engineer can act.”

Explain that health results are submitted; the project does not itself poll API endpoints.

## 0:45–1:30 — Architecture

Show the README diagram. Node runs the backend; Express handles HTTP; SQLite stores durable records; React displays the data; Gemini writes explanations. Rules decide anomalies before the AI runs.

## 1:30–3:00 — Live workflow

1. Start with the dashboard. If old records exist, acknowledge that it contains previous demo runs.
2. Click **Run sample checks**. Explain Payments (503, slow, zero records), Inventory (slow), Customers (missing records), Orders (healthy).
3. Show metrics, anomaly tags, severity, explanation source, and timestamps.
4. Filter critical incidents and search an API name; clear filters afterward.
5. Submit the same sample again. Occurrences increase while one active incident remains per API.

## 3:00–4:00 — Recovery and resilience

1. Submit checks → Load recovery → Process batch.
2. Switch to Resolved to show incident history.
3. Submit a mixed batch containing one valid anomaly and an invalid object. Show partial feedback: valid data still processes.
4. Explain template fallback. If you have a verified Gemini key, show a real AI explanation. Otherwise state honestly that provider integration is implemented but not live-verified yet; complete this verification before the final recording.

## 4:00–5:15 — Code tour

Show `services/detection.js`: threshold uses `>`; multiple rules can fire. Show `services/ai.js`: fixed prompt, separate JSON data, timeout, fallback. Show `models/store.js`: unique active incident index and transaction.

## 5:15–6:15 — Tests and batch processing

Run `npm.cmd test`. Explain `Promise.allSettled`: one failure does not erase successful results. Explain global concurrency limit and same-API ordering. Demonstrate a successful production build if time permits.

## 6:15–7:00 — Tradeoffs and conclusion

SQLite minimizes setup for the reviewer. For a production deployment, use durable queued jobs, database-backed ordering/idempotency, authentication, and endpoint-specific policies. The README documents these limits.

## Questions to practice

- Why not let AI detect anomalies? Deterministic rules are reproducible and testable; AI is for wording.
- What if Gemini fails? Save a template explanation with a source/reason, keeping detection and storage useful.
- Why SQLite? It satisfies SQL persistence with no separate server and is easy to demo.
- What if the same API appears twice? Process its checks in order; update the active incident rather than duplicate it.
- What if the server restarts? Database records survive; in-flight queue work does not.
- Does “resolve” mean the API is healthy? Manual resolution acknowledges an incident; measured health changes only on a new check.
- Can it handle multiple servers? Not safely for arrival ordering yet; production needs distributed coordination.

## Suggested remaining schedule (Asia/Dhaka)

- October 22: get the local app running, review each module, configure Gemini.
- October 23: compare with the original PDF, verify real AI output, polish any mismatches.
- October 24: publish the repo, record the video, generate prompts document, check Drive links.
- October 25: final review and submit before the exact stated deadline.
