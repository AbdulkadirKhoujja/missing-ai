// Synthetic, local-only source-ID retrieval regression for existing private history.
// This is NOT semantic-memory accuracy, authenticated agent isolation, or hosted deletion proof.
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, mkdir, readFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHistoryStore, dispatchHistoryRpc} from '../private-history/context-mcp.mjs';

const queryRpc = (query, max_results = 3) => ({
  jsonrpc: '2.0', id: 1, method: 'tools/call',
  params: {name: 'missing_ai_search_history', arguments: {query, max_results}}
});

async function recall(store, query, maxResults = 3) {
  const reply = await dispatchHistoryRpc(store, queryRpc(query, maxResults));
  assert.equal(reply?.result?.isError, false, 'Existing private-history adapter returned an error');
  const result = JSON.parse(reply.result.content[0].text);
  assert.equal(result.engine, 'context-lexical-v1');
  assert.ok(result.findings.length <= maxResults, 'Recall exceeded requested result bound');
  return result.findings;
}

function recordSynthetic(folder, conversation, text) {
  // A human-invoked local CLI write; NO new MCP write endpoint or background import.
  const result = spawnSync(process.execPath, ['private-history/record-event.mjs'], {
    cwd: new URL('..', import.meta.url),
    env: {...process.env, MISSING_AI_HISTORY_DIR: folder},
    input: JSON.stringify({conversation, text}),
    encoding: 'utf8', timeout: 10000, maxBuffer: 128 * 1024
  });
  assert.equal(result.status, 0, 'The synthetic opt-in event recording must succeed');
}

async function sourceCatalog(folder) {
  const raw = await readFile(join(folder, 'agent-events.jsonl'), 'utf8');
  const rows = raw.trim().split('\n').map(line => JSON.parse(line));
  // IDs come from actual persisted records, not assumed positional IDs.
  return Object.fromEntries(rows.map(row => [row.conversation, 'event:' + row.id]));
}

function scoreCase(findings, expectedIds, allowedIds) {
  const expected = new Set(expectedIds);
  const observed = new Set(findings.map(f => f.id));
  assert.equal(observed.size, findings.length, 'Duplicate IDs must not inflate recall');
  for (const finding of findings) {
    assert.equal(finding.role, 'event');
    assert.ok(allowedIds.has(finding.id), 'An event from another local folder was returned');
    assert.ok(typeof finding.conversation === 'string' && finding.conversation.length > 0);
    assert.ok(typeof finding.quote === 'string' && finding.quote.length > 0);
  }
  return {
    relevant: expected.size,
    retrieved_relevant: [...observed].filter(id => expected.has(id)).length,
    false_recalls: [...observed].filter(id => !expected.has(id)).length,
    citation_bytes: Buffer.byteLength(findings.map(f => f.quote).join('\n'), 'utf8'),
    returned: observed.size
  };
}

test('synthetic source-ID recall has explicit denominators and no local-folder leakage', async t => {
  const root = await mkdtemp(join(tmpdir(), 'missing-ai-source-id-scorecard-'));
  try {
    const alpha = join(root, 'alpha');
    const beta = join(root, 'beta');
    await Promise.all([mkdir(alpha, {mode: 0o700}), mkdir(beta, {mode: 0o700})]);
    recordSynthetic(alpha, 'Atlas runtime',
      'Atlas build runtime uses Node 22. This is an unverified synthetic agent claim.');
    recordSynthetic(alpha, 'Nimbus queues',
      'Nimbus queue deployment checks were recorded. This is an unverified synthetic agent claim.');
    recordSynthetic(beta, 'Beacon runtime',
      'Beacon build runtime uses Python 3.12. This is an unverified synthetic agent claim.');

    const aIds = await sourceCatalog(alpha);
    const bIds = await sourceCatalog(beta);
    const aAllowed = new Set(Object.values(aIds));
    const bAllowed = new Set(Object.values(bIds));
    const a = createHistoryStore(alpha);
    const b = createHistoryStore(beta);
    const cases = [
      {reader: a, query: 'Atlas Node', expected: [aIds['Atlas runtime']], allowed: aAllowed},
      {reader: a, query: 'Nimbus queues', expected: [aIds['Nimbus queues']], allowed: aAllowed},
      {reader: b, query: 'Beacon Python', expected: [bIds['Beacon runtime']], allowed: bAllowed},
      {reader: a, query: 'build runtime', expected: [aIds['Atlas runtime']], allowed: aAllowed},
      {reader: b, query: 'build runtime', expected: [bIds['Beacon runtime']], allowed: bAllowed},
      {reader: a, query: 'Beacon Python', expected: [], allowed: aAllowed},
      {reader: b, query: 'Atlas Node', expected: [], allowed: bAllowed},
      {reader: a, query: 'meteorite cobalt', expected: [], allowed: aAllowed}
    ];
    let eligible = 0, found = 0, falseRecalls = 0, contextBytes = 0;
    for (const item of cases) {
      const findings = await recall(item.reader, item.query, 3);
      const scored = scoreCase(findings, item.expected, item.allowed);
      eligible += scored.relevant;
      found += scored.retrieved_relevant;
      falseRecalls += scored.false_recalls;
      contextBytes += scored.citation_bytes;
      assert.equal(scored.retrieved_relevant, item.expected.length,
        'Source-ID retrieval differs from the synthetic fixture');
      assert.equal(scored.false_recalls, 0,
        'Unexpected source returned for the synthetic query');
    }
    assert.equal(eligible, 5, 'Report recall against the five actual eligible source/query pairs');
    assert.equal(found, 5);
    assert.equal(falseRecalls, 0);
    assert.ok(contextBytes > 0, 'Actual retrieved excerpts must be measured');
    assert.ok(contextBytes <= 5 * 400, 'Excerpts must remain bounded in this fixture');

    // A deliberate cap demonstrates that a two-relevant-source query has recall@1 = 1/2,
    // rather than manufacturing an always-100% success rate.
    const capped = scoreCase(await recall(a, 'Atlas Nimbus', 1),
      [aIds['Atlas runtime'], aIds['Nimbus queues']], aAllowed);
    assert.equal(capped.relevant, 2);
    assert.equal(capped.retrieved_relevant, 1);
    assert.equal(capped.false_recalls, 0);
    assert.equal(capped.returned, 1);

    // Fresh store reopens the actual persisted file; IDs remain stable.
    const restarted = scoreCase(await recall(createHistoryStore(alpha), 'Atlas Node', 3),
      [aIds['Atlas runtime']], aAllowed);
    assert.equal(restarted.retrieved_relevant, 1);
    assert.equal(restarted.false_recalls, 0);
    t.diagnostic('Synthetic fixture — not independently adjudicated: recall@3 ' +
      found + '/' + eligible + '; false recalls ' + falseRecalls +
      '; excerpt bytes ' + contextBytes + '; two-source recall@1 ' +
      capped.retrieved_relevant + '/' + capped.relevant + '. Local lexical adapter only.');
  } finally {
    await rm(root, {recursive: true, force: true});
  }
});
