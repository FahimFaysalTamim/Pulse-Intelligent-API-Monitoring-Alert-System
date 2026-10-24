# Local verification — October 22, 2026

- Node.js 22.14.0, Windows PowerShell.
- `npm.cmd test`: nine automated test groups passed. SQLite persistence test closes/reopens an actual temporary database. Provider tests use mocks.
- `npm.cmd run build`: production React/Vite build passed.
- `npm.cmd run prompts`: generated `AI_Prompts.docx` successfully.
- HTTP smoke: built dashboard returned 200; POST /monitor saved a labelled fallback incident; GET /alerts returned it.
- Headless Chrome smoke on a separate in-memory database: empty state, sample ingestion, severity filter, API search, duplicate counting, manual resolve, healthy recovery, invalid JSON feedback, desktop and 390px mobile layout all passed. No JavaScript page errors or horizontal mobile overflow. This one-off browser check is not part of `npm test`.
- Real Gemini generation is **not verified**. A key was present in the process environment, but a sandboxed request failed and used the fallback. Automatic approval review rejected the subsequent external-network test pending explicit permission to send synthetic metrics to Gemini. No successful provider response was obtained.

The screenshots and temporary browser tooling are under ignored `.qa/`. A demo incident may exist in the ignored local `data/` database from the HTTP check. These are not submission source files.

## Follow-up verification

The original PDF was reviewed; its exact PatientDataAPI/AppointmentAPI sample passed. A batch of 100 APIs also passed in template mode.

After the user added a key and requested verification, live Gemini generation succeeded with HTTP 200, finishReason STOP, and source gemini using gemini-3.8-flash. The old gemini-2.5-flash model returned 404 (unavailable to new users). Temporary 503, incomplete output, and timeout responses were also observed. The output allowance is now 2048 tokens and the timeout is 30 seconds. The exact successful response was saved as an AppointmentAPI incident for viewing. Project .env values now take precedence over inherited environment values. All nine automated test groups passed after these changes.

Pending: GitHub publication, video recording, Drive upload, and email submission. Keep the prompts document current through submission.
