/**
 * Deterministic, offline Missing AI continuous-improvement triage.
 * This module never contacts GitHub, runs workers, writes files or authorises a release.
 * Input is bounded public metadata supplied by an independently authenticated collector.
 */
import { readFile, stat } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const SHA = /^[0-9a-f]{40}$/;
const TRACKS = Object.freeze([
  { key: 'imperative-extraction', issue: 54, relatedPR: 46, risk: 'REVIEW', priority: 100,
    acceptance: 'Reproduce false negatives and preserve contextual negative controls' },
  { key: 'extraction-regression', issue: 45, relatedPR: 46, risk: 'REVIEW', priority: 95,
    acceptance: 'Keep exact source references; avoid expanding context into obligations' },
  { key: 'semantic-adjudication', issue: 29, relatedPR: null, risk: 'REVIEW', priority: 90,
    acceptance: 'Obtain independent blind labels before any accuracy statement' },
  { key: 'accessible-results', issue: 31, relatedPR: 58, risk: 'OPEN', priority: 80,
    acceptance: 'Validate keyboard flow and perform human assistive-technology smoke' },
]);

function blocked(reason) {
  return { outcome: 'blocked', reason, recommendation: null, queue: [],
    limitations: ['No worker dispatched', 'No deployment or release authorised'] };
}

export function triage(snapshot, { now = new Date(), activeWork = [] } = {}) {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot) ||
      snapshot.repository !== 'AbdulkadirKhoujja/missing-ai' ||
      snapshot.complete !== true || !Array.isArray(snapshot.unavailable) ||
      snapshot.unavailable.length !== 0 || !SHA.test(snapshot.main_sha ?? '')) {
    return blocked('Missing or incomplete verified public metadata');
  }
  // Require an explicitly UTC source timestamp, never a host-local time.
  // Python's aware UTC isoformat emits +00:00; JSON exporters may use Z.
  if (typeof snapshot.observed_at_utc !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|\+00:00)$/.test(
        snapshot.observed_at_utc)) {
    return blocked('Source observation must use explicit UTC');
  }
  const observed = Date.parse(snapshot.observed_at_utc);
  const current = new Date(now).getTime();
  if (!Number.isFinite(observed) || !Number.isFinite(current) ||
      current - observed < -5000 || current - observed > 180000) {
    return blocked('Public metadata is stale or its UTC timestamp is invalid');
  }
  if (!Array.isArray(snapshot.issues) || !Array.isArray(snapshot.pulls) ||
      !Array.isArray(activeWork) || activeWork.length > 20 ||
      activeWork.some(key => typeof key !== 'string' || key.length > 80)) {
    return blocked('Invalid public state or in-flight work list');
  }
  if ([...snapshot.issues, ...snapshot.pulls].some(item =>
        !item || typeof item !== 'object' || !Number.isInteger(item.number))) {
    return blocked('Malformed tracked GitHub record');
  }
  const issues = new Map(snapshot.issues.map(item => [item.number, item]));
  const pulls = new Map(snapshot.pulls.map(item => [item.number, item]));
  if (issues.size !== snapshot.issues.length || pulls.size !== snapshot.pulls.length) {
    return blocked('Conflicting duplicate GitHub record');
  }
  for (const track of TRACKS) {
    if (!['open', 'closed'].includes(issues.get(track.issue)?.state) ||
        (track.relatedPR !== null && (!['open', 'closed'].includes(pulls.get(track.relatedPR)?.state) ||
                                      !SHA.test(pulls.get(track.relatedPR)?.head_sha ?? '')))) {
      return blocked('Tracked issue or pull-request state is missing or invalid');
    }
  }
  const inflight = new Set(activeWork);
  const busyPRs = new Set(TRACKS.filter(item => inflight.has(item.key) &&
    item.relatedPR !== null).map(item => item.relatedPR));
  const seenOpenPRs = new Set();
  const queue = TRACKS.map(track => {
    const issue = issues.get(track.issue);
    const pr = track.relatedPR === null ? null : pulls.get(track.relatedPR);
    let status;
    if (issue.state === 'closed') status = 'closed_issue';
    else if (inflight.has(track.key) || (pr && busyPRs.has(pr.number))) {
      status = 'already_in_progress';
    } else if (pr?.state === 'open') {
      status = seenOpenPRs.has(pr.number) ? 'same_pr_as_higher_priority' : 'review_existing_pr';
      seenOpenPRs.add(pr.number);
    }
    else if (track.key === 'semantic-adjudication') status = 'independent_human_review';
    else if (track.risk === 'REVIEW') status = 'maintainer_review_required';
    else status = 'safe_draft_candidate';
    return { ...track, status, existingPR: pr?.state === 'open' ? pr.number : null };
  });
  const recommendation = queue.find(item =>
    ['review_existing_pr', 'safe_draft_candidate', 'independent_human_review',
     'maintainer_review_required'].includes(item.status)) ?? null;
  return {
    outcome: recommendation ? 'recommendation' : 'no_change',
    source: { main_sha: snapshot.main_sha, observed_at_utc: snapshot.observed_at_utc },
    recommendation, queue,
    limitations: [
      'Public issue/PR state is not proof of test success or semantic accuracy',
      'Selection does not dispatch a worker, merge, deploy, publish or approve a REVIEW change',
      'Lexical-v1 and unshipped candidates must be evaluated separately',
    ],
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const file = process.argv[2];
  if (!file || process.argv.length !== 3) {
    console.error('Usage: node scripts/improvement-triage.mjs <bounded-public-snapshot.json>');
    process.exitCode = 2;
  } else {
    try {
      const info = await stat(file);
      if (info.size > 65536 || !info.isFile()) throw Error('invalid input file');
      const parsed = JSON.parse(await readFile(file, 'utf8'));
      const result = triage(parsed.snapshot ?? parsed,
                            { activeWork: parsed.activeWork ?? [] });
      process.stdout.write(JSON.stringify(result, null, 2) + '\n');
      if (result.outcome === 'blocked') process.exitCode = 1;
    } catch {
      console.error('Unable to read a bounded public snapshot');
      process.exitCode = 2;
    }
  }
}
