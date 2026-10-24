import { readFile, writeFile } from 'node:fs/promises';
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx';
import { SYSTEM_PROMPT } from '../server/services/ai.js';

const log = await readFile(new URL('../docs/AI_PROMPTS.md', import.meta.url), 'utf8');
const children = log.split('\n').map(line => {
  const heading = line.match(/^(#{1,3}) (.*)$/);
  if (heading) return new Paragraph({ text: heading[2], heading: [HeadingLevel.TITLE, HeadingLevel.HEADING_1, HeadingLevel.HEADING_2][heading[1].length - 1] });
  return new Paragraph({ children: [new TextRun({ text: line, size: 22 })], spacing: { after: 100 } });
});
children.push(new Paragraph({ text: 'Exact runtime system prompt (generated from source)', heading: HeadingLevel.HEADING_1 }), new Paragraph(SYSTEM_PROMPT));
children.push(new Paragraph({ text: 'Runtime user-message example', heading: HeadingLevel.HEADING_1 }));
children.push(new Paragraph(JSON.stringify({ metrics: { api_name: 'Payments API', response_time_ms: 4820, status_code: 503, records_returned: 0 }, anomalies: ['HIGH_RESPONSE_TIME', 'FAILED_REQUEST', 'NO_DATA'], severity: 'critical', slow_response_threshold_ms: 3000 }, null, 2)));
const doc = new Document({ creator: 'Project Care', title: 'AI Prompts — Pulse API Monitor', description: 'Visible user prompts, AI assistance disclosure, and the application alert-generation prompt.', sections: [{ children }] });
await writeFile(new URL('../AI_Prompts.docx', import.meta.url), await Packer.toBuffer(doc));
console.log('Generated AI_Prompts.docx from docs/AI_PROMPTS.md and the runtime prompt.');
