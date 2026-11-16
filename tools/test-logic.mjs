// Checks the pure logic shared by the app and the Worker (proof normalisation, ranking, badges, batching, fallbacks).
// Usage (from the project root): node tools/test-logic.mjs
import assert from 'node:assert/strict';
import { normalizeProof, rankRows, badgesFor, batches, questError, packTitle, unpackTitle, offlineIdeas, heuristicReview } from '../assets/logic.js';

let n = 0;
const ok = (l) => { n++; console.log(`  ✓ ${l}`); };
console.log('QuestBoard logic');

assert.equal(normalizeProof('https://www.Medium.com/@ann/post/?utm_source=x&fbclid=1#top'), 'https://medium.com/@ann/post');
assert.equal(normalizeProof('http://twitter.com/ann/status/1?s=20&t=abc'), 'https://x.com/ann/status/1');
assert.equal(normalizeProof('https://mobile.x.com/ann/status/1'), 'https://x.com/ann/status/1');
assert.equal(normalizeProof('https://t.me/channel/42?single'), 'https://t.me/channel/42?single=');
assert.equal(normalizeProof('  hello   world \n again ', 1), 'hello world again');
ok('normalizeProof strips www, tracking params, hash, trailing slash; maps twitter → x');

const rows = rankRows(['0xb', '0xa', '0xc', '0xd'], [300, 700, 0, 300]);
assert.deepEqual(rows.map((r) => [r.address, r.rank]), [['0xa', 1], ['0xb', 2], ['0xd', 3]]);
assert.deepEqual(rows[0].badges, ['bronze', 'silver', 'gold', 'champion']);
assert.deepEqual(badgesFor(99, 2), []); assert.deepEqual(badgesFor(100, 2), ['bronze']);
ok('rankRows sorts, drops zero, assigns badges (Bronze 100 · Silver 300 · Gold 700 · Champion #1)');

assert.deepEqual(batches(Array.from({ length: 230 }, (_, i) => i)).map((b) => b.length), [100, 100, 30]);
ok('batches splits 100+ approvals into chunks of 100');

assert.equal(questError({ title: 'Share', points: 50, proofType: 0, maxPerWallet: 1 }), '');
assert.match(questError({ title: 'Share', points: 5, proofType: 0, maxPerWallet: 1 }), /Points/);
assert.match(questError({ title: '', points: 50, proofType: 0, maxPerWallet: 1 }), /title/);
assert.deepEqual(unpackTitle(packTitle('Share the post', 'Mention us')), { title: 'Share the post', rules: 'Mention us' });
ok('quest validation + title/rules packing round-trips');

const ideas = offlineIdeas('Bloomly', 'plant app', 'https://bloomly.xyz');
assert.equal(ideas.length, 6); assert.ok(ideas.every((q) => questError({ ...q, title: packTitle(q.title, q.rules), maxPerWallet: 1 }) === ''));
ok('offline ideas: 6 valid quests');

assert.equal(heuristicReview({ quest: { proofType: 0 }, project: { name: 'Bloomly' }, proof: 'x', pageText: 'I love Bloomly', fetched: true }).verdict, 'valid');
assert.equal(heuristicReview({ quest: { proofType: 0 }, project: { name: 'Bloomly' }, proof: 'https://x.com/a/1' }).verdict, 'unsure');
assert.equal(heuristicReview({ quest: { proofType: 1 }, project: { name: 'Bloomly' }, proof: 'nice' }).verdict, 'invalid');
ok('heuristic review (used only when the AI is unavailable)');

console.log(`\n${n} checks passed`);
