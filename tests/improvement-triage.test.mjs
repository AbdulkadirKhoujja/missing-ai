import test from 'node:test';
import assert from 'node:assert/strict';
import { triage } from '../scripts/improvement-triage.mjs';

const now = new Date('2026-10-31T13:15:30.000Z');

function snapshot() {
  return {
    repository: 'AbdulkadirKhoujja/missing-ai',
    complete: true, unavailable: [], main_sha: 'a'.repeat(40),
    observed_at_utc: '2026-10-31T13:15:00.000Z',
    issues: [29, 31, 45, 54].map(number => ({ number, state: 'open' })),
    pulls: [46, 58].map(number =>
      ({ number, state: 'open', head_sha: 'b'.repeat(40) })),
  };
}

test('prioritises the existing extraction fix instead of producing a duplicate PR', () => {
  const result = triage(snapshot(), { now });
  assert.equal(result.outcome, 'recommendation');
  assert.equal(result.recommendation.key, 'imperative-extraction');
  assert.equal(result.recommendation.existingPR, 46);
  assert.equal(result.recommendation.status, 'review_existing_pr');
  assert.equal(result.queue.find(row => row.key === 'extraction-regression').status,
               'same_pr_as_higher_priority');
});

test('one active task locks both issues sharing the same PR', () => {
  const result = triage(snapshot(), { now, activeWork: ['imperative-extraction'] });
  assert.equal(result.queue.find(row => row.key === 'imperative-extraction').status,
               'already_in_progress');
  assert.equal(result.queue.find(row => row.key === 'extraction-regression').status,
               'already_in_progress');
  assert.equal(result.recommendation.key, 'semantic-adjudication');
  assert.equal(result.recommendation.status, 'independent_human_review');
});

test('incomplete source cannot silently become empty backlog', () => {
  const source = snapshot();
  source.complete = false;
  source.main_sha = null;
  source.unavailable = ['main_sha_unavailable'];
  const result = triage(source, { now });
  assert.equal(result.outcome, 'blocked');
  assert.equal(result.recommendation, null);
  assert.equal(result.queue.length, 0);
});

test('rejects expired evidence rather than issuing stale changes', () => {
  const result = triage(snapshot(), { now: new Date('2026-10-31T13:19:00Z') });
  assert.equal(result.outcome, 'blocked');
  assert.match(result.reason, /stale/);
});

test('rejects missing linked PR evidence and malformed or duplicate records', () => {
  const missing = snapshot();
  missing.pulls = [];
  assert.equal(triage(missing, { now }).outcome, 'blocked');
  const malformed = snapshot();
  malformed.issues[0] = null;
  assert.equal(triage(malformed, { now }).outcome, 'blocked');
  const duplicate = snapshot();
  duplicate.issues.push({ number: 54, state: 'closed' });
  assert.equal(triage(duplicate, { now }).outcome, 'blocked');
});

test('closed issues are skipped, no fake tasks or semantic accuracy reported', () => {
  const source = snapshot();
  source.issues.forEach(issue => { issue.state = 'closed'; });
  const result = triage(source, { now });
  assert.equal(result.outcome, 'no_change');
  assert.equal(result.recommendation, null);
  assert.equal(result.queue.every(item => item.status === 'closed_issue'), true);
  assert.equal(JSON.stringify(result).includes('accuracy: 100%'), false);
});

test('a REVIEW change without an open PR needs maintainer approval', () => {
  const source = snapshot();
  source.pulls.find(pr => pr.number === 46).state = 'closed';
  const result = triage(source, { now });
  assert.equal(result.recommendation.status, 'maintainer_review_required');
  assert.equal(result.recommendation.risk, 'REVIEW');
});
