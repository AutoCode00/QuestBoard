// Wallet (MetaMask), BOT Chain, and the QuestBoard contract — live, or a simulated preview board saved in this browser.
/* global ethers */
import { CONFIG } from './config.js';
import { store } from './ui.js';
import { normalizeProof, MAX_BATCH } from './logic.js';

const SEASON = 'tuple(address owner, string name, string cid, uint64 start, uint64 end)';
const QUEST = 'tuple(uint256 seasonId, string title, uint16 points, uint8 proofType, uint16 maxPerWallet, uint32 completions, bool active)';
const SUB = 'tuple(uint256 questId, address member, string proof, bytes32 proofHash, uint8 status, uint64 at)';
const ABI = [
  'function createSeason(string name, string cid, uint64 start, uint64 end) returns (uint256)',
  'function addQuests(uint256 seasonId, tuple(string title, uint16 points, uint8 proofType, uint16 maxPerWallet)[] qs) returns (uint256)',
  'function setQuestActive(uint256 questId, bool active)',
  'function submit(uint256 questId, string proof) returns (uint256)',
  'function review(uint256[] ids, bool[] approve)',
  `function getSeason(uint256) view returns (${SEASON})`,
  'function seasonCount() view returns (uint256)',
  'function stats() view returns (uint256 seasons, uint256 quests, uint256 approved)',
  'function seasonsOf(address) view returns (uint256[])',
  `function questsOf(uint256) view returns (uint256[] ids, ${QUEST}[] quests)`,
  'function seasonSubmissionCount(uint256) view returns (uint256)',
  `function submissionsOf(uint256, uint256, uint256) view returns (uint256[] ids, ${SUB}[] subs)`,
  'function leaderboard(uint256) view returns (address[] members, uint32[] points)',
  'function pointsOf(uint256, address) view returns (uint32)',
  'function approvedCount(uint256, address) view returns (uint16)',
  'function hasPending(uint256, address) view returns (bool)',
  'event Submitted(uint256 indexed seasonId, uint256 indexed id, uint256 indexed questId, address member)',
  'event SeasonCreated(uint256 indexed seasonId, address indexed owner, string name, uint64 start, uint64 end)',
  'error BadInput()', 'error NoSuchSeason()', 'error NoSuchQuest()', 'error NoSuchSubmission()', 'error NotSeasonOwner()',
  'error SeasonClosed()', 'error QuestInactive()', 'error ProofUsed()', 'error AlreadyPending()', 'error LimitReached()', 'error NotPending()',
];

const params = new URLSearchParams(location.search);
export const NET_KEY = params.get('net') === 'testnet' ? 'testnet' : 'mainnet';
export const NET = CONFIG.networks[NET_KEY];
const K = CONFIG.storageKey;
export const CONTRACT = params.has('preview') ? '' : NET.contract || store.get(`${K}.contract.${NET.chainId}`, '') || '';
export const LIVE = /^0x[0-9a-fA-F]{40}$/.test(CONTRACT);
export const MAINNET_ADDRESS = CONFIG.networks.mainnet.contract || '';
export const explorerAddress = () => `${CONFIG.networks.mainnet.explorer}/address/${MAINNET_ADDRESS || '<MAINNET_CONTRACT_ADDRESS>'}`;
export const explorerTx = (hash) => `${NET.explorer}/tx/${hash}`;

// ---------- wallet ----------
export const wallet = { account: null, chainId: null, preview: false };
const listeners = new Set();
export const onWallet = (fn) => { listeners.add(fn); fn(wallet); return () => listeners.delete(fn); };
const emit = () => listeners.forEach((fn) => { try { fn(wallet); } catch (e) { console.error(e); } });
export const hasMetaMask = () => typeof window.ethereum !== 'undefined';
export const onRightChain = () => wallet.chainId === NET.chainId;

async function refresh() {
  if (hasMetaMask()) {
    try {
      const [accounts, chain] = await Promise.all([ethereum.request({ method: 'eth_accounts' }), ethereum.request({ method: 'eth_chainId' })]);
      wallet.account = accounts[0] ? ethers.getAddress(accounts[0]) : null;
      wallet.chainId = parseInt(chain, 16);
      wallet.preview = false;
    } catch { /* ignore */ }
  }
  if (!wallet.account && !LIVE) {
    // Preview mode without MetaMask: a local stand-in address, so the whole flow can be tried.
    const pw = store.get(`${K}.previewWallet`, null);
    if (pw) { wallet.account = pw; wallet.chainId = NET.chainId; wallet.preview = true; }
  }
  emit();
}
export function initWallet() {
  if (hasMetaMask()) { ethereum.on?.('accountsChanged', refresh); ethereum.on?.('chainChanged', refresh); }
  refresh();
}
const randomAddress = () => ethers.getAddress(ethers.hexlify(ethers.randomBytes(20)));
/** Preview mode only: toggle between two local stand-in wallets (owner side ↔ member side of your own season). Returns 1 or 2. */
export async function newPreviewWallet() {
  const cur = store.get(`${K}.previewWallet`, null);
  const list = store.get(`${K}.previewWallets`, cur ? [cur] : []);
  if (list.length < 2) list.push(randomAddress());
  const next = list[(list.indexOf(cur) + 1) % list.length];
  store.set(`${K}.previewWallets`, list);
  store.set(`${K}.previewWallet`, next);
  wallet.account = null;
  await refresh();
  return list.indexOf(next) + 1;
}
export async function switchChain() {
  const chainId = '0x' + NET.chainId.toString(16);
  try {
    await ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId }] });
  } catch (e) {
    const unknown = e.code === 4902 || e?.data?.originalError?.code === 4902 || /unrecognized chain/i.test(e.message || '');
    if (!unknown) throw e;
    await ethereum.request({ method: 'wallet_addEthereumChain', params: [{ chainId, chainName: NET.name, nativeCurrency: { name: 'BOT', symbol: 'BOT', decimals: 18 }, rpcUrls: [NET.rpc], blockExplorerUrls: [NET.explorer] }] });
  }
  await refresh();
}
/** Connect MetaMask and move to BOT Chain (adds the network if missing). In preview mode without MetaMask, makes a local wallet. */
export async function connect() {
  if (!hasMetaMask()) {
    if (LIVE) throw Object.assign(new Error('MetaMask was not found'), { code: 'NO_METAMASK' });
    if (!store.get(`${K}.previewWallet`, null)) store.set(`${K}.previewWallet`, randomAddress());
    await refresh();
    return wallet.account;
  }
  await ethereum.request({ method: 'eth_requestAccounts' });
  await refresh();
  if (!onRightChain()) await switchChain();
  return wallet.account;
}
export function disconnectPreview() { store.del(`${K}.previewWallet`); wallet.account = null; wallet.preview = false; emit(); }

const ERR_TEXT = {
  ProofUsed: 'This proof was already submitted.',
  AlreadyPending: 'You already have a submission waiting for review on this quest.',
  LimitReached: 'You have completed this quest the maximum number of times.',
  SeasonClosed: 'Submissions are closed for this season.',
  QuestInactive: 'This quest is paused by the project.',
  NotSeasonOwner: 'Only the season owner can do that.',
  NotPending: 'One of these submissions was already reviewed. Refresh and try again.',
  BadInput: 'Something in the form is out of range. Check the fields and try again.',
  NoSuchSeason: 'That season does not exist.',
  NoSuchQuest: 'That quest does not exist.',
  NoSuchSubmission: 'That submission does not exist.',
};
export const userRejected = (e) => e?.code === 4001 || e?.code === 'ACTION_REJECTED' || e?.info?.error?.code === 4001;
const iface = new ethers.Interface(ABI);
function revertName(e) {
  if (e?.revert?.name) return e.revert.name;
  if (e?.qbError) return e.qbError;
  const data = e?.data || e?.info?.error?.data?.data || e?.info?.error?.data || e?.error?.data;
  if (typeof data === 'string' && data.startsWith('0x')) { try { return iface.parseError(data)?.name; } catch { /* ignore */ } }
  return null;
}
export function txMessage(e) {
  if (e?.code === 'NO_METAMASK') return 'Install MetaMask to do this. Quest pages and leaderboards work without it.';
  if (userRejected(e)) return 'Cancelled in MetaMask. Nothing was sent.';
  const name = revertName(e);
  if (name && ERR_TEXT[name]) return ERR_TEXT[name];
  if (e?.code === 'INSUFFICIENT_FUNDS' || /insufficient funds/i.test(e?.message)) return 'Not enough BOT for gas in this wallet.';
  return `Transaction failed: ${e?.shortMessage || e?.reason || e?.message || 'unknown error'}`;
}
export const errorName = revertName;

// ---------- reading ----------
let reader, provider;
const rpc = () => (provider ||= new ethers.JsonRpcProvider(NET.rpc, NET.chainId, { staticNetwork: true }));
const R = () => (reader ||= new ethers.Contract(CONTRACT, ABI, rpc()));
const W = async () => new ethers.Contract(CONTRACT, ABI, await new ethers.BrowserProvider(ethereum).getSigner());

export function parseMeta(cid) {
  try { const m = JSON.parse(cid); return { description: m.d || '', link: m.l || '', reward: m.r || '' }; } catch { return { description: '', link: '', reward: '' }; }
}
const seasonOut = (s, id) => ({ id, owner: s.owner, name: s.name, cid: s.cid, start: Number(s.start), end: Number(s.end), ...parseMeta(s.cid) });
const questOut = (q, id) => ({ id: Number(id), seasonId: Number(q.seasonId), title: q.title, points: Number(q.points), proofType: Number(q.proofType), maxPerWallet: Number(q.maxPerWallet), completions: Number(q.completions), active: q.active });
const subOut = (s, id) => ({ id: Number(id), questId: Number(s.questId), member: s.member, proof: s.proof, proofHash: s.proofHash, status: Number(s.status), at: Number(s.at) });

// ---------- preview board (same rules as the contract, saved in this browser) ----------
const P = {
  load() { return store.get(`${K}.board`, null) || { seasons: [], quests: [], subs: [], points: {}, members: {}, used: {}, approved: 0 }; },
  save(b) { if (!store.set(`${K}.board`, b)) throw new Error('This browser blocked local storage'); },
  err(name) { return Object.assign(new Error(name), { qbError: name }); },
};
const nowS = () => Math.floor(Date.now() / 1000);
const pKey = (a, b) => `${a}:${String(b).toLowerCase()}`;

async function waitTx(tx, onTx) {
  onTx?.(tx.hash);
  const rc = await tx.wait();
  if (rc.status !== 1) throw new Error('The transaction failed on-chain');
  return rc;
}

export const board = {
  async stats() {
    if (!LIVE) { const b = P.load(); return { seasons: b.seasons.length, quests: b.quests.length, approved: b.approved }; }
    const s = await R().stats();
    return { seasons: Number(s.seasons), quests: Number(s.quests), approved: Number(s.approved) };
  },
  async seasonCount() { return LIVE ? Number(await R().seasonCount()) : P.load().seasons.length; },
  async getSeason(id) {
    if (!Number.isInteger(id) || id < 0) return null;
    if (!LIVE) { const s = P.load().seasons[id]; return s ? seasonOut(s, id) : null; }
    try { return seasonOut(await R().getSeason(id), id); } catch (e) { if (/NoSuchSeason|revert|CALL_EXCEPTION/i.test(String(e.code) + e.message)) return null; throw e; }
  },
  /** Newest first. */
  async recentSeasons(count = 12) {
    const total = await this.seasonCount();
    const ids = [];
    for (let i = total - 1; i >= Math.max(0, total - count); i--) ids.push(i);
    return (await Promise.all(ids.map((i) => this.getSeason(i)))).filter(Boolean);
  },
  async seasonsOf(addr) {
    if (!addr) return [];
    const ids = LIVE ? (await R().seasonsOf(addr)).map(Number) : P.load().seasons.map((s, i) => (s.owner.toLowerCase() === addr.toLowerCase() ? i : -1)).filter((i) => i >= 0);
    return (await Promise.all(ids.map((i) => this.getSeason(i)))).filter(Boolean).reverse();
  },
  async quests(seasonId) {
    if (!LIVE) return P.load().quests.map((q, i) => (q.seasonId === seasonId ? questOut(q, i) : null)).filter(Boolean);
    const [ids, qs] = await R().questsOf(seasonId);
    return qs.map((q, i) => questOut(q, ids[i]));
  },
  async submissions(seasonId) {
    if (!LIVE) {
      const b = P.load();
      const qset = new Set(b.quests.map((q, i) => (q.seasonId === seasonId ? i : -1)));
      return b.subs.map((s, i) => (qset.has(s.questId) ? subOut(s, i) : null)).filter(Boolean);
    }
    const total = Number(await R().seasonSubmissionCount(seasonId));
    const out = [];
    for (let from = 0; from < total; from += 200) {
      const [ids, subs] = await R().submissionsOf(seasonId, from, 200);
      subs.forEach((s, i) => out.push(subOut(s, ids[i])));
    }
    return out;
  },
  /** Sorted rows come from logic.rankRows; this returns raw members + points. */
  async leaderboard(seasonId) {
    if (!LIVE) { const b = P.load(); const m = b.members[seasonId] || []; return { members: m, points: m.map((a) => b.points[pKey(seasonId, a)] || 0) }; }
    const [members, points] = await R().leaderboard(seasonId);
    return { members: [...members], points: points.map(Number) };
  },
  async pointsOf(seasonId, addr) {
    if (!addr) return 0;
    if (!LIVE) return P.load().points[pKey(seasonId, addr)] || 0;
    return Number(await R().pointsOf(seasonId, addr));
  },
  /** { questId: { approved, pending } } for one wallet. */
  async memberStatus(questIds, addr) {
    const out = {};
    if (!addr) return out;
    if (!LIVE) {
      const b = P.load();
      for (const q of questIds) {
        const mine = b.subs.filter((s) => s.questId === q && s.member.toLowerCase() === addr.toLowerCase());
        out[q] = { approved: mine.filter((s) => s.status === 1).length, pending: mine.some((s) => s.status === 0) };
      }
      return out;
    }
    await Promise.all(questIds.map(async (q) => {
      const [a, p] = await Promise.all([R().approvedCount(q, addr), R().hasPending(q, addr)]);
      out[q] = { approved: Number(a), pending: p };
    }));
    return out;
  },

  // ---------- writes (return { id?, tx }) ----------
  async createSeason({ name, meta, start, end }, onTx) {
    const cid = JSON.stringify({ d: meta.description || '', l: meta.link || '', r: meta.reward || '' });
    if (!name || name.length > 80 || new TextEncoder().encode(cid).length > 600 || end <= start || end <= nowS()) throw P.err('BadInput');
    if (!LIVE) {
      const b = P.load();
      b.seasons.push({ owner: wallet.account, name, cid, start, end });
      P.save(b);
      return { id: b.seasons.length - 1, tx: null };
    }
    const c = await W();
    const rc = await waitTx(await c.createSeason(name, cid, start, end), onTx);
    const log = rc.logs.map((l) => { try { return c.interface.parseLog(l); } catch { return null; } }).find((l) => l?.name === 'SeasonCreated');
    return { id: Number(log.args.seasonId), tx: rc.hash };
  },
  async addQuests(seasonId, list, onTx) {
    const qs = list.map((q) => ({ title: q.title, points: Number(q.points), proofType: Number(q.proofType), maxPerWallet: Number(q.maxPerWallet) }));
    if (!LIVE) {
      const b = P.load();
      const s = b.seasons[seasonId];
      if (!s) throw P.err('NoSuchSeason');
      if (s.owner.toLowerCase() !== wallet.account?.toLowerCase()) throw P.err('NotSeasonOwner');
      if (nowS() >= s.end) throw P.err('SeasonClosed');
      for (const q of qs) b.quests.push({ seasonId, ...q, completions: 0, active: true });
      P.save(b);
      return { tx: null };
    }
    const c = await W();
    const rc = await waitTx(await c.addQuests(seasonId, qs), onTx);
    return { tx: rc.hash };
  },
  async setQuestActive(questId, active, onTx) {
    if (!LIVE) { const b = P.load(); b.quests[questId].active = active; P.save(b); return { tx: null }; }
    const rc = await waitTx(await (await W()).setQuestActive(questId, active), onTx);
    return { tx: rc.hash };
  },
  async submit(quest, rawProof, onTx) {
    const proof = normalizeProof(rawProof, quest.proofType);
    if (!LIVE) {
      const b = P.load();
      const q = b.quests[quest.id];
      const s = b.seasons[q.seasonId];
      const me = wallet.account.toLowerCase();
      if (nowS() < s.start || nowS() >= s.end) throw P.err('SeasonClosed');
      if (!q.active) throw P.err('QuestInactive');
      if (!proof) throw P.err('BadInput');
      const mine = b.subs.filter((x) => x.questId === quest.id && x.member.toLowerCase() === me);
      if (mine.some((x) => x.status === 0)) throw P.err('AlreadyPending');
      if (mine.filter((x) => x.status === 1).length >= q.maxPerWallet) throw P.err('LimitReached');
      const h = ethers.keccak256(ethers.toUtf8Bytes(proof));
      if (b.used[h]) throw P.err('ProofUsed');
      b.used[h] = true;
      b.subs.push({ questId: quest.id, member: wallet.account, proof, proofHash: h, status: 0, at: nowS() });
      P.save(b);
      return { id: b.subs.length - 1, tx: null, proof };
    }
    const c = await W();
    // Simulate first so a known revert (duplicate proof, closed season…) shows a clear message before MetaMask opens.
    await c.submit.staticCall(quest.id, proof);
    const rc = await waitTx(await c.submit(quest.id, proof), onTx);
    const log = rc.logs.map((l) => { try { return c.interface.parseLog(l); } catch { return null; } }).find((l) => l?.name === 'Submitted');
    return { id: Number(log.args.id), tx: rc.hash, proof };
  },
  /** decisions: [{ id, approve }]. Splits into batches of 100 (one tx each). onBatch(i, n) reports progress. */
  async review(decisions, onTx, onBatch) {
    const out = [];
    for (let i = 0; i < decisions.length; i += MAX_BATCH) {
      const chunk = decisions.slice(i, i + MAX_BATCH);
      onBatch?.(i / MAX_BATCH + 1, Math.ceil(decisions.length / MAX_BATCH));
      if (!LIVE) {
        const b = P.load();
        for (const d of chunk) {
          const s = b.subs[d.id];
          const q = b.quests[s.questId];
          if (b.seasons[q.seasonId].owner.toLowerCase() !== wallet.account?.toLowerCase()) throw P.err('NotSeasonOwner');
          if (s.status !== 0) throw P.err('NotPending');
          if (d.approve) {
            s.status = 1; q.completions += 1; b.approved += 1;
            const k = pKey(q.seasonId, s.member);
            b.points[k] = (b.points[k] || 0) + q.points;
            const list = (b.members[q.seasonId] ||= []);
            if (!list.some((a) => a.toLowerCase() === s.member.toLowerCase())) list.push(s.member);
          } else s.status = 2;
        }
        P.save(b);
        out.push(null);
        continue;
      }
      const c = await W();
      const rc = await waitTx(await c.review(chunk.map((d) => d.id), chunk.map((d) => !!d.approve)), onTx);
      out.push(rc.hash);
    }
    return { txs: out };
  },
};
