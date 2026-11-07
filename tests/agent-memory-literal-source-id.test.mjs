// OPEN-class, fictional, local-only provenance regression.
// Oracle IDs below are literal fixtures, NOT copied from the history reader's output.
// This does not prove semantic accuracy, correction, deletion or authenticated isolation.
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, writeFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHistoryStore, dispatchHistoryRpc} from '../private-history/context-mcp.mjs';

const FIXED = Object.freeze({
  atlas: 'event:atlas-source-001',
  beacon: 'event:beacon-source-002',
  spare: 'event:spare-source-003'
});
const records = Object.freeze({
  atlas: {
    id: 'atlas-source-001', role: 'event',
    conversation: 'Atlas release runtime',
    text: 'Atlas Node release runtime was recorded in a fictional project.'
  },
  beacon: {
    id: 'beacon-source-002', role: 'event',
    conversation: 'Beacon routing',
    text: 'Beacon Python routing was recorded in a separate fictional project.'
  },
  spare: {
    id: 'spare-source-003', role: 'event',
    conversation: 'Spare glossary',
    text: 'A spare unrelated glossary item exists only to shift record positions.'
  }
});

const lookup = {
  jsonrpc: '2.0', id: 1, method: 'tools/call',
  params: {
    name: 'missing_ai_search_history',
    arguments: {query: 'Atlas Node release runtime', max_results: 3}
  }
};

test('literal source IDs survive reorder, prepend and fresh local reader instances', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'missing-ai-literal-source-'));
  const scenarios = [
    ['atlas', 'beacon'],
    ['beacon', 'atlas'],
    ['spare', 'beacon', 'atlas'],
    ['atlas', 'spare', 'beacon']
  ];
  let checked = 0;
  try {
    for (const order of scenarios) {
      await writeFile(join(directory, 'agent-events.jsonl'),
        order.map(key => JSON.stringify(records[key])).join('\n') + '\n',
        {encoding: 'utf8', mode: 0o600});
      // Deliberately instantiate a new store each time: no cache reuse.
      const store = createHistoryStore(directory);
      const {messages, status} = await store.load();
      assert.deepEqual(status.source_types, ['agent-events']);
      assert.equal(status.message_count, order.length);
      assert.equal(messages.length, order.length);
      const byConversation = new Map(messages.map(item => [item.conversation, item]));
      assert.equal(byConversation.get(records.atlas.conversation)?.id, FIXED.atlas);
      assert.equal(byConversation.get(records.beacon.conversation)?.id, FIXED.beacon);
      assert.equal(byConversation.get(records.atlas.conversation)?.text, records.atlas.text);
      assert.equal(byConversation.get(records.beacon.conversation)?.text, records.beacon.text);
      if (order.includes('spare')) {
        assert.equal(byConversation.get(records.spare.conversation)?.id, FIXED.spare);
      }
      const response = await dispatchHistoryRpc(store, lookup);
      assert.equal(response?.result?.isError, false);
      const result = JSON.parse(response.result.content[0].text);
      const attributed = result.findings.filter(x => x.id === FIXED.atlas);
      assert.equal(attributed.length, 1,
        'Atlas source ID must be cited once independently of its row position');
      assert.equal(attributed[0].conversation, records.atlas.conversation);
      assert.match(attributed[0].quote, /Atlas Node release runtime/);
      checked++;
    }
    assert.equal(checked, scenarios.length);
    t.diagnostic('Synthetic exact-source provenance: ' + checked + '/' +
      scenarios.length + ' reordered/prepended local fixtures; no real-world accuracy claim.');
  } finally {
    await rm(directory, {recursive: true, force: true});
  }
});
