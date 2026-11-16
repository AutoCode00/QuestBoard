// Pure logic shared by the app and the Worker (no DOM, no network).

export const PROOF_TYPES = [
  { id: 0, key: 'link', label: 'Link', hint: 'Paste the link to your post' },
  { id: 1, key: 'text', label: 'Text', hint: 'Paste your text' },
  { id: 2, key: 'image', label: 'Image link', hint: 'Paste a link to the image (Imgur, Drive, X media…)' },
];
export const POINTS = { min: 10, max: 500 };
export const BADGES = [
  { id: 'bronze', label: 'Bronze', min: 100 },
  { id: 'silver', label: 'Silver', min: 300 },
  { id: 'gold', label: 'Gold', min: 700 },
];
export const MAX_BATCH = 100;

/** Highest badge for a points total (+ "Season Champion" for rank 1 with points). */
export function badgesFor(points, rank) {
  const out = BADGES.filter((b) => points >= b.min).map((b) => b.id);
  if (rank === 1 && points > 0) out.push('champion');
  return out;
}

/**
 * Normalises a proof before it is hashed on-chain, so the same post can't be submitted twice with tracking junk.
 * Links: lower-case host, no "www.", no hash, no utm_/fbclid/ref params, no trailing slash. Text: trimmed, single spaces.
 */
export function normalizeProof(proof, proofType = 0) {
  const s = String(proof || '').trim();
  if (proofType === 1) return s.replace(/\s+/g, ' ').slice(0, 1000);
  try {
    const u = new URL(s);
    if (!/^https?:$/.test(u.protocol)) return s.slice(0, 1000);
    u.hash = '';
    u.hostname = u.hostname.toLowerCase().replace(/^www\./, '').replace(/^(mobile|m)\.(twitter|x)\.com$/, '$2.com').replace(/^twitter\.com$/, 'x.com');
    for (const k of [...u.searchParams.keys()]) if (/^(utm_|fbclid|gclid|ref|s$|t$|si$|igshid)/i.test(k)) u.searchParams.delete(k);
    let out = u.protocol.replace('http:', 'https:') + '//' + u.host + u.pathname.replace(/\/+$/, '') + (u.searchParams.toString() ? '?' + u.searchParams : '');
    return out.slice(0, 1000);
  } catch {
    return s.slice(0, 1000);
  }
}
export const isUrl = (s) => /^https?:\/\/[^\s/$.?#].[^\s]*$/i.test(String(s || '').trim());

/** Validates a quest draft. Returns an error string or ''. */
export function questError(q) {
  if (!q.title || !q.title.trim()) return 'Give the quest a title';
  if (q.title.length > 200) return 'Title is too long (200 max)';
  const p = Number(q.points);
  if (!Number.isInteger(p) || p < POINTS.min || p > POINTS.max) return `Points must be ${POINTS.min}–${POINTS.max}`;
  if (![0, 1, 2].includes(Number(q.proofType))) return 'Pick a proof type';
  const m = Number(q.maxPerWallet);
  if (!Number.isInteger(m) || m < 1 || m > 100) return 'Max per wallet must be 1–100';
  return '';
}

/** On-chain quest title packs rules in: "Title — rules". Splits it back. */
export const packTitle = (title, rules) => (rules ? `${title.trim()} — ${rules.trim()}` : title.trim()).slice(0, 200);
export function unpackTitle(t) {
  const i = String(t).indexOf(' — ');
  return i < 0 ? { title: t, rules: '' } : { title: t.slice(0, i), rules: t.slice(i + 3) };
}

/** Splits review decisions into batches of 100 (one tx each). */
export function batches(list, size = MAX_BATCH) {
  const out = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

/** Sorted leaderboard rows with rank + badges. */
export function rankRows(members, points) {
  return members
    .map((m, i) => ({ address: m, points: Number(points[i]) }))
    .filter((r) => r.points > 0)
    .sort((a, b) => b.points - a.points || a.address.localeCompare(b.address))
    .map((r, i) => ({ ...r, rank: i + 1, badges: badgesFor(r.points, i + 1) }));
}

// ---------- offline fallbacks (used when the AI is unavailable) ----------

/** Six marketing quests from a project name + description, no AI. */
export function offlineIdeas(name = 'the project', description = '', link = '') {
  const n = String(name || 'the project').trim().slice(0, 40);
  const tag = '#' + n.replace(/[^\p{L}\p{N}]+/gu, '');
  const l = link ? ` with the link ${link}` : '';
  return [
    { title: `Share the ${n} launch post`, rules: `Post about ${n} on X, Telegram or LinkedIn${l} and ${tag}. Public post, your own words.`, points: 50, proofType: 0 },
    { title: `Write a short review of ${n}`, rules: `At least 80 words on what ${n} does and who it's for. Mention ${n} by name. No copy-paste from the website.`, points: 120, proofType: 0 },
    { title: `Make a meme about ${n}`, rules: `An original meme that mentions ${n}. Upload it and paste the image link.`, points: 80, proofType: 2 },
    { title: `Record a 15-second demo`, rules: `Screen-record yourself using ${n} for ~15s, post it publicly and paste the link.`, points: 150, proofType: 0 },
    { title: `Invite a friend to ${n}`, rules: `Tell a friend about ${n} in a public reply or group chat that we can open. Paste the link.`, points: 60, proofType: 0 },
    { title: `Translate the announcement`, rules: `Translate the ${n} announcement into your language and post it publicly with ${tag}.`, points: 100, proofType: 0 },
  ];
}

const words = (s) => (String(s || '').trim().match(/\S+/g) || []).length;

/**
 * Rule-based review used when the model is unavailable. Checks the basics only; always marked lower confidence.
 * Returns { verdict: 'valid'|'unsure'|'invalid', reason, confidence }.
 */
export function heuristicReview({ quest = {}, project = {}, proof = '', pageText = '', fetched = false }) {
  const text = `${pageText || ''} ${proof || ''}`.toLowerCase();
  const name = String(project.name || '').toLowerCase().trim();
  const mentions = name && text.includes(name);
  const link = String(project.link || '').toLowerCase().replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');
  const hasLink = link && text.includes(link);
  const w = words(pageText || proof);
  if (Number(quest.proofType) === 1 && w < 15) return { verdict: 'invalid', reason: 'The text is too short to count as a real submission.', confidence: 0.6 };
  if (mentions || hasLink) {
    return { verdict: fetched ? 'valid' : 'unsure', reason: `${mentions ? `Mentions ${project.name}` : 'Includes the project link'}${fetched ? '' : ' (from the pasted text only)'}. Basic check only — the AI was unavailable.`, confidence: fetched ? 0.55 : 0.4 };
  }
  return { verdict: 'unsure', reason: `Couldn't find ${project.name || 'the project'} mentioned. Basic check only — please check manually.`, confidence: 0.3 };
}
