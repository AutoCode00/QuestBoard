// Worker client: AI quest ideas and AI submission reviews (recommendations only).
// Without a Worker, ideas come from templates and reviews are a basic rule check — both are labelled in the UI.
import { CONFIG } from './config.js';
import { LIVE, NET } from './chain.js';
import { store } from './ui.js';
import { offlineIdeas, heuristicReview, unpackTitle } from './logic.js';

const K = CONFIG.storageKey;
const base = () => CONFIG.worker.replace(/\/$/, '');
async function post(path, body, ms = 30000) {
  const res = await fetch(base() + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(ms) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || 'worker_error'), { code: data.error });
  return data;
}

/** → { quests: [{ title, rules, points, proofType }], ai: bool } */
export async function suggestQuests({ name, description, link }) {
  if (CONFIG.worker) {
    try { return await post('/quest/ideas', { name, description, link }); }
    catch (e) { if (e.code === 'too_short') throw e; }
  }
  return { quests: offlineIdeas(name, description, link), ai: false };
}

// Reviews are kept in the Worker's KV (live) or in this browser (preview). Local copies make the queue instant.
const localKey = (id) => `${K}.review.${LIVE ? NET.chainId : 'preview'}.${id}`;
export const cachedReview = (id) => store.get(localKey(id), null);

/** Reviews one submission. ctx = { sub, quest, season } (used in preview mode / without a Worker). */
export async function reviewSubmission({ sub, quest, season }, force = false) {
  let r = null;
  try {
    if (CONFIG.worker && LIVE) r = await post('/quest/review', { chainId: NET.chainId, id: sub.id, force }, 45000);
    else if (CONFIG.worker) {
      const { title, rules } = unpackTitle(quest.title);
      r = await post('/quest/review', { preview: true, quest: { title, rules, proofType: quest.proofType }, project: { name: season.name, link: season.link, description: season.description }, proof: sub.proof }, 45000);
    }
  } catch { r = null; }
  if (!r) {
    if (CONFIG.worker) return null; // AI error → stays "Not reviewed" in the queue
    const { title, rules } = unpackTitle(quest.title);
    r = { ...heuristicReview({ quest: { title, rules, proofType: quest.proofType }, project: season, proof: sub.proof, fetched: quest.proofType === 1 }), ai: false, fetched: false, at: Date.now() };
    if (quest.proofType !== 1) r.note = "Couldn't open link — please check manually";
  }
  store.set(localKey(sub.id), r);
  return r;
}

/** Loads stored reviews for many submissions: { id: review }. */
export async function loadReviews(ids) {
  const out = {};
  const missing = [];
  for (const id of ids) { const r = cachedReview(id); if (r) out[id] = r; else missing.push(id); }
  if (CONFIG.worker && LIVE && missing.length) {
    try {
      for (let i = 0; i < missing.length; i += 200) {
        const { reviews } = await post('/quest/reviews', { chainId: NET.chainId, ids: missing.slice(i, i + 200) });
        for (const [id, r] of Object.entries(reviews || {})) { out[id] = r; store.set(localKey(id), r); }
      }
    } catch { /* leave as not reviewed */ }
  }
  return out;
}
export const aiMode = () => (CONFIG.worker ? 'ai' : 'basic');
