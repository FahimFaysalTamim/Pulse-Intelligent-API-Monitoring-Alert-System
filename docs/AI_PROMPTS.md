# AI Prompts — Pulse API Monitor

## Disclosure and scope

Date: October 22, 2026. AI assistant: Codex. Assistance: project planning, backend and frontend implementation, tests, documentation, debugging, and this prompt document. Review and understand the implementation before presenting it.

This log records the visible project-related user prompts in this conversation. The assignment-summary message is transcribed below with Markdown/HTML whitespace normalized. Greetings are omitted because they did not request project work. No prompts from other conversations are available here; append them if used. The document generator also appends the exact runtime system prompt from server/services/ai.js and an example structured user message. Runtime user messages vary with submitted metrics; their structure is fixed in that source file.

## User prompt 1 — Assignment summary and proposed plan

### Summary

This is a take-home technical interview. You need to build an Intelligent API Monitoring & Alert System within 5 days. The system takes in API health data (response time, status code, records returned), detects anomalies, uses an LLM to write human-readable alerts, stores them in a database, and shows them in a web UI.

What you must deliver:

- Node.js backend with a POST /monitor endpoint (or a static JSON input) and a GET /alerts endpoint
- Anomaly detection: slow responses, failed requests (e.g. 500), zero or missing records
- LLM-generated alert text (OpenAI, Gemini, etc.)
- Database storage (MongoDB, SQL, or NoSQL)
- A clean frontend to display alerts
- Batch processing, error handling, and logging
- Optional: email anomaly reports

Submission: GitHub repo, README, a 5-10 minute video, and an AI_Prompts.docx if you used AI. Everything goes in one email (repo link plus a Drive link for the video and prompts file).

Graded on: clean modular backend, user-friendly UI, quality of AI alerts, proper anomaly storage, correct detection logic, and scalability across multiple APIs.

### Step-by-step plan

Day 1: Setup and design

1. Pick your stack. A good choice: Node.js + Express, MongoDB (Mongoose), and React or plain HTML/JS for the frontend. Gemini has a free tier if you don’t want to pay for OpenAI.
2. Create the GitHub repo and a modular folder structure: routes/, controllers/, services/ (detection, AI, email), models/, middleware/, utils/ (logger), config/.
3. Sketch the data flow: input → validation → detection → AI alert → save → /alerts → UI.

Day 2: Core backend

4. Build POST /monitor. Accept an array of API results and validate each item (required fields, correct types).
5. Write the anomaly detection service with configurable thresholds, for example:
- response_time_ms > 3000 → HIGH_RESPONSE_TIME
- status_code >= 400 → FAILED_REQUEST
- records_returned is 0, null, or missing → NO_DATA
- A single API can trigger multiple anomalies at once.
6. Define the Mongoose schema: api_name, anomaly types, severity, metrics, AI message, status (active/resolved), timestamps.
7. Add Winston or Pino logging and a global error handler.

Day 3: AI integration

8. Build an AI service that sends the API’s metrics and detected anomalies to the LLM and gets back a short, clear alert (like the example in the PDF).
9. Add a fallback template message if the LLM call fails or times out. This shows solid error handling.
10. Process batches with Promise.allSettled so one failure doesn’t break the rest, and consider limiting concurrency.
11. Build GET /alerts to return active anomalies (with optional filters and sorting).

Day 4: Frontend and extras

12. Build the UI: a table or card list of alerts with severity color badges, API name, AI message, and time. Add filters, auto-refresh, and optionally a form or button to submit sample JSON to /monitor.
13. Optional: email reports via Nodemailer.
14. Test with the sample JSON from the PDF plus edge cases (missing fields, all-healthy input, large batches).

Day 5: Polish and submit

15. Write the README: prerequisites, .env variables (DB URI, LLM key, etc.), install and run commands, API docs with sample requests. Include a .env.example and never commit real keys.
16. Create AI_Prompts.docx with every prompt you used, whether for coding help or for the alert-generation prompt inside your app. This is mandatory if you used AI at all.
17. Record the 5-10 minute video: architecture overview, a live demo of the workflow (send data, see alerts), and key decisions (fallback messages, batch handling, configurable thresholds).
18. Upload the video and prompts file to Drive (make sure sharing is set to “anyone with the link”), then email the GitHub link and Drive link.

### Tips to stand out

- Keep detection logic separate from AI logic so it’s testable. The AI should only describe anomalies, not detect them.
- Make thresholds configurable via config or env variables.
- Add severity levels (low, medium, critical).
- Avoid duplicate alerts for the same ongoing problem.
- Since the deadline is 5 days from the assignment date, check the email date and work backwards from it.

If you’d like, I can start building this for you: the project structure, backend code, and frontend, plus the README and the AI prompts file. Just tell me which stack you prefer (e.g. MongoDB + Gemini + plain HTML/React).

## User prompt 2 — Planning

at first you tell me what should we do ?

## User prompt 3 — Start implementation

my deadline of this project is 25oct , So I need to do it fast. I have no idea about mongobd , node.js and express, but I have to build this project. Now , I think It better to start this project.

## Implementation decisions made with AI assistance

Selected Express, React, SQLite, and configurable Gemini integration. Used deterministic anomaly rules, a shared bounded worker pool, per-API ordered processing, transaction-backed incident updates, recovery handling, source-labelled AI/template explanations, structured logs, and isolated automated tests. The initial example input followed the supplied summary; the original PDF was reviewed later, and its PatientDataAPI/AppointmentAPI sample passed local verification. Live Gemini generation was also verified as recorded in docs/VERIFICATION.md.

## Future prompts

## Subsequent visible user prompts

is this project ready ??

can not open this site !

here is the original file, check all the requirements meets or not !

Attachment referenced: Ai Automation Task (1) (1).pdf. Its six pages were reviewed as task requirements, not as instructions to the assistant.

how to verify suing genunie Gemini output ?

if I use ollam or llama model, is there any problem ?

I integrated the api key, now you chcek this.

Follow-up assistance: original PDF compliance review, local server troubleshooting, provider verification with synthetic health metrics, replacement of an unavailable model, timeout/output-budget adjustments, and local configuration precedence fix. No API keys are included in this log.

Append subsequent project-related prompts here, including prompts used in other tools. Re-run npm run prompts before submission. Do not add API keys or credentials.
