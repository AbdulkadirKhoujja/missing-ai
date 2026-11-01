// Pure, local-only context onboarding. This module never sends or stores input remotely.
// Historical summaries are user-supplied claims, never independently verified evidence.
export const CONTEXT_LIMITS = Object.freeze({
  title: 160, summary: 15000, entry: 3000, packBytes: 2 * 1024 * 1024, entries: 2000
});

const utf8 = new TextEncoder();
const suspicious = [
  /-----BEGIN (?:[A-Z ]*PRIVATE KEY)-----/i,
  /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/,
  /\bgh[pousr]_[A-Za-z0-9]{20,}\b/,
  /\bAKIA[0-9A-Z]{16}\b/
];
function checkText(text, max, name) {
  if (typeof text !== 'string' || !text.trim() || text.length > max) {
    throw Error(`${name} must be 1–${max.toLocaleString('en-US')} characters.`);
  }
  const result = text.replace(/\r\n?/g, '\n').trim();
  if (suspicious.some(re => re.test(result))) throw Error('Potential credential detected. Remove secrets before importing. This is not a complete secret scan.');
  return result;
}
function checkDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d\d-\d\dT/.test(value) || !Number.isFinite(Date.parse(value))) {
    throw Error('Invalid capture date.');
  }
  return value;
}
export function splitSummary(summary) {
  let remaining = checkText(summary, CONTEXT_LIMITS.summary, 'Context summary');
  const chunks = [];
  while (remaining.length > CONTEXT_LIMITS.entry) {
    const max = CONTEXT_LIMITS.entry;
    const breaks = [remaining.lastIndexOf('\n\n', max), remaining.lastIndexOf('\n', max), remaining.lastIndexOf(' ', max)];
    let at = breaks.find(n => n >= Math.floor(max * 0.55));
    if (at === undefined) at = max;
    if (at > 0 && /[\uD800-\uDBFF]/u.test(remaining[at - 1])) at -= 1;
    const chunk = remaining.slice(0, at).trim();
    if (!chunk) throw Error('Context summary cannot be split safely.');
    chunks.push(chunk);
    remaining = remaining.slice(at).trim();
  }
  if (remaining) chunks.push(remaining);
  return chunks;
}
export function makeContextEntries(title, summary, recordedAt = new Date().toISOString()) {
  const cleanTitle = checkText(title, CONTEXT_LIMITS.title, 'Source title');
  const date = checkDate(recordedAt);
  return splitSummary(summary).map(text => ({conversation: cleanTitle, text, role: 'note', date}));
}
function validateEntry(entry) {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) throw Error('Invalid context pack entry.');
  if (entry.role !== 'note') throw Error('Context packs may contain reviewed notes only, not invented speaker attribution.');
  return {
    conversation: checkText(entry.conversation, CONTEXT_LIMITS.title, 'Source title'),
    text: checkText(entry.text, CONTEXT_LIMITS.entry, 'Context entry'),
    role: 'note', date: checkDate(entry.date)
  };
}
export function serializeContextPack(entries) {
  if (!Array.isArray(entries) || !entries.length || entries.length > CONTEXT_LIMITS.entries) {
    throw Error('Context pack needs between 1 and 2,000 reviewed notes.');
  }
  const lines = entries.map(entry => JSON.stringify(validateEntry(entry)));
  const body = lines.join('\n') + '\n';
  if (utf8.encode(body).byteLength > CONTEXT_LIMITS.packBytes) throw Error('Context pack exceeds the 2 MB private-history limit.');
  return body;
}
export function parseContextPack(raw) {
  if (typeof raw !== 'string' || !raw.trim() || utf8.encode(raw).byteLength > CONTEXT_LIMITS.packBytes) {
    throw Error('Context pack is empty or exceeds 2 MB.');
  }
  const lines = raw.trimEnd().split('\n');
  if (lines.length > CONTEXT_LIMITS.entries) throw Error('Context pack exceeds 2,000 notes.');
  const entries = lines.map((line, i) => {
    let record;
    try { record = JSON.parse(line); } catch { throw Error(`Invalid JSON on context pack line ${i + 1}.`); }
    return validateEntry(record);
  });
  if (!entries.length) throw Error('Context pack has no entries.');
  return entries;
}
export function mergeContextEntries(existing, incoming) {
  if (!Array.isArray(existing) || !Array.isArray(incoming)) throw Error('Invalid context entries.');
  const keys = new Set(existing.map(e => `${e.conversation}\0${e.text}`));
  const merged = [...existing]; let added = 0;
  for (const raw of incoming) {
    const entry = validateEntry(raw);
    const key = `${entry.conversation}\0${entry.text}`;
    if (keys.has(key)) continue;
    if (merged.length >= CONTEXT_LIMITS.entries) throw Error('Too many context notes.');
    merged.push(entry); keys.add(key); added++;
  }
  serializeContextPack(merged);
  return {entries: merged, added};
}
