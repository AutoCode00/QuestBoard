// Runs the compiled QuestBoard on an in-memory chain and checks the PRD rules (sections 4, 5 and 11).
// Usage (from the project root): node tools/compile.mjs && node tools/test-contract.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import ganache from 'ganache';
import { BrowserProvider, ContractFactory, Interface } from 'ethers';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const { abi, bytecode } = JSON.parse(readFileSync(join(root, 'build/QuestBoard.json'), 'utf8'));
const chain = ganache.provider({ logging: { quiet: true }, chain: { hardfork: 'merge', chainId: 677, vmErrorsOnRPCResponse: true }, wallet: { totalAccounts: 5 } });
const provider = new BrowserProvider(chain);
const [owner, ann, ben, cat] = await Promise.all([0, 1, 2, 3].map((i) => provider.getSigner(i)));
const GAS = { gasLimit: 8_000_000 };
const qb = await (await new ContractFactory(abi, bytecode, owner).deploy()).waitForDeployment();
const as = (s) => qb.connect(s);
const sim = (s) => new Proxy({}, { get: (_, k) => (...a) => as(s)[k].staticCall(...a) });
const iface = new Interface(abi);
const sel = (name) => iface.getError(name).selector.slice(2);
const dump = (e) => { try { return JSON.stringify(e, (k, v) => (typeof v === 'bigint' ? String(v) : v)); } catch { return String(e?.message); } };
const reverts = (call, name) => assert.rejects(call, (e) => e.revert?.name === name || dump(e).includes(sel(name)), `expected ${name}`);
const now = async () => (await provider.getBlock('latest')).timestamp;
const warp = async (s) => { await chain.request({ method: 'evm_increaseTime', params: [s] }); await chain.request({ method: 'evm_mine', params: [] }); };
let checks = 0;
const ok = (label) => { checks++; console.log(`  ✓ ${label}`); };
const DAY = 86400;

console.log('QuestBoard contract');

// ---- seasons
const t0 = await now();
await reverts(sim(owner).createSeason('', '', t0, t0 + DAY, GAS), 'BadInput');
await reverts(sim(owner).createSeason('Launch Week', '', t0 + DAY, t0, GAS), 'BadInput');
const rc = await (await as(owner).createSeason('Launch Week', '{"d":"desc"}', t0 + 100, t0 + 14 * DAY, GAS)).wait();
console.log(`    gas createSeason ≈ ${rc.gasUsed}`);
assert.equal(iface.parseLog(rc.logs[0]).name, 'SeasonCreated');
const s = await qb.getSeason(0);
assert.equal(s.owner, owner.address); assert.equal(s.name, 'Launch Week'); assert.equal(s.cid, '{"d":"desc"}');
assert.deepEqual((await qb.seasonsOf(owner.address)).map(Number), [0]);
await reverts(qb.getSeason(9), 'NoSuchSeason');
ok('createSeason validates dates/name, stores the season, lists it under the owner');

// ---- quests
const Q = (title, points, proofType = 0, maxPerWallet = 1) => ({ title, points, proofType, maxPerWallet });
await reverts(sim(ann).addQuests(0, [Q('Share', 50)], GAS), 'NotSeasonOwner');
await reverts(sim(owner).addQuests(0, [Q('Share', 5)], GAS), 'BadInput');
await reverts(sim(owner).addQuests(0, [Q('Share', 501)], GAS), 'BadInput');
await reverts(sim(owner).addQuests(0, [Q('Share', 50, 3)], GAS), 'BadInput');
const rq = await (await as(owner).addQuests(0, [Q('Share the launch post', 50), Q('Write a review', 100, 1, 2), Q('Make a meme', 80, 2)], GAS)).wait();
console.log(`    gas addQuests(3) ≈ ${rq.gasUsed}`);
const [qids, quests] = await qb.questsOf(0);
assert.deepEqual(qids.map(Number), [0, 1, 2]);
assert.equal(quests[1].title, 'Write a review'); assert.equal(Number(quests[1].points), 100); assert.equal(Number(quests[1].maxPerWallet), 2); assert.equal(quests[1].active, true);
ok('addQuests: owner only, points 10–500, proof type 0–2, emits QuestAdded');

// ---- submit before start
await reverts(sim(ann).submit(0, 'https://medium.com/@ann/launch', GAS), 'SeasonClosed');
ok('submissions closed before the season starts');
await warp(200);

const rs = await (await as(ann).submit(0, 'https://medium.com/@ann/launch', GAS)).wait();
console.log(`    gas submit ≈ ${rs.gasUsed}`);
assert.equal(iface.parseLog(rs.logs[0]).name, 'Submitted');
await reverts(sim(ann).submit(0, 'https://medium.com/@ann/launch-2', GAS), 'AlreadyPending');
await reverts(sim(ben).submit(0, 'https://medium.com/@ann/launch', GAS), 'ProofUsed');
await as(ben).submit(0, 'https://x.com/ben/status/1', GAS);
await as(cat).submit(1, 'I love this project because…', GAS);
await as(ann).submit(1, 'Ann review text', GAS);
assert.equal(Number(await qb.seasonSubmissionCount(0)), 4);
ok('submit: one pending per quest per wallet, duplicate proofs blocked');

// ---- inactive quest
await reverts(sim(ann).setQuestActive(2, false, GAS), 'NotSeasonOwner');
await as(owner).setQuestActive(2, false, GAS);
await reverts(sim(ann).submit(2, 'https://imgur.com/meme', GAS), 'QuestInactive');
await as(owner).setQuestActive(2, true, GAS);
ok('setQuestActive pauses a quest');

// ---- review
await reverts(sim(ann).review([0], [true], GAS), 'NotSeasonOwner');
await reverts(sim(owner).review([0, 1], [true], GAS), 'BadInput');
const rr = await (await as(owner).review([0, 1, 2, 3], [true, false, true, true], GAS)).wait();
console.log(`    gas review(4) ≈ ${rr.gasUsed}`);
await reverts(sim(owner).review([0], [true], GAS), 'NotPending');
assert.equal(Number(await qb.pointsOf(0, ann.address)), 150);
assert.equal(Number(await qb.pointsOf(0, ben.address)), 0);
assert.equal(Number(await qb.pointsOf(0, cat.address)), 100);
const [members, pts] = await qb.leaderboard(0);
assert.deepEqual([...members], [ann.address, cat.address]); assert.deepEqual(pts.map(Number), [150, 100]);
const sub1 = await qb.getSubmission(1);
assert.equal(Number(sub1.status), 2);
assert.equal(Number((await qb.getQuest(1)).seasonId), 0); await reverts(qb.getQuest(99), 'NoSuchQuest');
const [, q2] = await qb.questsOf(0);
assert.equal(Number(q2[0].completions), 1); assert.equal(Number(q2[1].completions), 2);
const st = await qb.stats();
assert.deepEqual([Number(st[0]), Number(st[1]), Number(st[2])], [1, 3, 3]);
ok('review: batch approve/reject, points added, leaderboard + stats updated, no double review');

// ---- limits
await reverts(sim(ann).submit(0, 'https://medium.com/@ann/second', GAS), 'LimitReached');
await as(ann).submit(1, 'Ann second review', GAS);
await as(owner).review([4], [true], GAS);
await reverts(sim(ann).submit(1, 'Ann third review', GAS), 'LimitReached');
await as(ben).submit(0, 'https://x.com/ben/status/2', GAS); // ben was rejected, can retry with a new proof
ok('max completions per wallet enforced; rejected members can retry with new proof');

// ---- paging
const [ids, subs] = await qb.submissionsOf(0, 1, 2);
assert.deepEqual(ids.map(Number), [1, 2]); assert.equal(subs[1].member, cat.address);
const [ids2] = await qb.submissionsOf(0, 50, 10);
assert.equal(ids2.length, 0);
ok('submissionsOf pages through a season');

// ---- batch limit
await reverts(sim(owner).review(Array(101).fill(0), Array(101).fill(true), GAS), 'BadInput');
ok('review refuses more than 100 at once');

// ---- season end
await warp(15 * DAY);
await reverts(sim(cat).submit(2, 'https://imgur.com/late', GAS), 'SeasonClosed');
await reverts(sim(owner).addQuests(0, [Q('Late', 50)], GAS), 'SeasonClosed');
await as(owner).review([5], [true], GAS); // reviewing still works after the season ends
ok('season end closes submissions and new quests; review still allowed');

console.log(`\n${checks} checks passed`);
