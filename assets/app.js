// /app — project owner: seasons list · create season → quests (AI suggest) → review queue (AI verdicts, batch approve) · season stats.
/* global Chart */
import { $, $$, esc, fmt, short, toast, copy } from './ui.js';
import { board, wallet, onWallet, connect, onRightChain, switchChain, txMessage, explorerTx, LIVE, hasMetaMask } from './chain.js';
import { suggestQuests, loadReviews, reviewSubmission, cachedReview, aiMode } from './ai.js';
import { PROOF_TYPES, POINTS, questError, packTitle, unpackTitle, rankRows, isUrl, MAX_BATCH } from './logic.js';
import { scout } from './scout.js';

const VERDICT = { valid: ['✅', 'Looks valid'], unsure: ['⚠️', 'Unsure'], invalid: ['❌', "Doesn't meet rules"] };
const STATUS = ['Pending', 'Approved', 'Rejected'];
const S = { seasons: [], sel: null, mode: 'queue', data: null, filter: 'pending', picked: new Set(), drawer: null, drafts: [], chart: null, busy: false };
let root, offWallet;

export async function render(view) {
  root = view;
  view.innerHTML = `<div class="dash">
    <aside class="d-left"><div class="d-left-head"><h2>Your seasons</h2><button class="btn btn-dark btn-sm" id="newSeason" type="button">+ New</button></div><div id="seasonList" class="season-list"></div></aside>
    <section class="d-main" id="dMain"></section>
    <aside class="d-right" id="dRight"></aside>
  </div>`;
  $('#newSeason').addEventListener('click', () => { S.sel = null; S.mode = 'create'; paint(); });
  let lastAcct;
  offWallet = onWallet(async (w) => {
    if (w.account === lastAcct && S.seasons.length) return;
    lastAcct = w.account;
    await loadSeasons();
    if (!S.sel && S.mode !== 'create') S.mode = S.seasons.length ? 'queue' : 'create';
    if (!S.sel && S.seasons.length && S.mode === 'queue') S.sel = S.seasons[0].id;
    paint();
  });
  return () => { offWallet?.(); S.chart?.destroy(); S.chart = null; };
}

async function loadSeasons() {
  S.seasons = wallet.account ? await board.seasonsOf(wallet.account).catch(() => []) : [];
}

function paint() {
  paintList();
  const main = $('#dMain');
  if (!main) return;
  if (!wallet.account) return paintConnect(main);
  if (S.mode === 'create') return paintCreate(main);
  if (S.mode === 'quests') return paintQuests(main);
  if (S.sel != null) return paintSeason(main);
  paintCreate(main);
}

function paintList() {
  const el = $('#seasonList');
  if (!el) return;
  if (!wallet.account) { el.innerHTML = '<p class="d-empty">Connect your wallet to see your seasons.</p>'; return; }
  if (!S.seasons.length) { el.innerHTML = '<p class="d-empty">No seasons yet. Create your first one.</p>'; return; }
  el.innerHTML = S.seasons.map((s) => `<button type="button" class="season-item${S.sel === s.id ? ' on' : ''}" data-id="${s.id}"><b>${esc(s.name)}</b><span>${phase(s).label}</span></button>`).join('');
  $$('.season-item', el).forEach((b) => b.addEventListener('click', () => { S.sel = Number(b.dataset.id); S.mode = 'queue'; S.picked.clear(); S.drawer = null; paint(); }));
}

function phase(s) {
  const now = Date.now() / 1000;
  if (now < s.start) return { key: 'soon', label: `Starts ${dateStr(s.start)}` };
  if (now >= s.end) return { key: 'ended', label: `Ended ${dateStr(s.end)}` };
  return { key: 'live', label: `Running · ${left(s.end - now)} left` };
}
const dateStr = (t) => new Date(t * 1000).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
const left = (sec) => { const d = Math.floor(sec / 86400), h = Math.floor((sec % 86400) / 3600); return d ? `${d}d ${h}h` : `${h}h ${Math.floor((sec % 3600) / 60)}m`; };
const ago = (t) => { const s = Date.now() / 1000 - t; return s < 3600 ? `${Math.max(1, Math.round(s / 60))}m ago` : s < 86400 ? `${Math.round(s / 3600)}h ago` : `${Math.round(s / 86400)}d ago`; };

function paintConnect(main) {
  $('#dRight').innerHTML = '';
  main.innerHTML = `<div class="d-hello">${scout({ pose: 'map', size: 120 })}<h1 class="h3">Start a quest season</h1>
  <p>Connect the wallet that will own the season. Only this wallet can publish quests and approve proofs.</p>
  <button class="btn btn-dark" id="cBtn" type="button">${hasMetaMask() || !LIVE ? 'Connect wallet' : 'Install MetaMask'} <span aria-hidden="true">→</span></button>
  ${!LIVE ? '<p class="fine">Preview mode: no MetaMask needed — a local preview wallet is created in this browser.</p>' : ''}</div>`;
  $('#cBtn').addEventListener('click', async () => {
    if (LIVE && !hasMetaMask()) { window.open('https://metamask.io/download/', '_blank', 'noopener'); return; }
    try { await connect(); } catch (e) { toast(txMessage(e), 'err'); }
  });
}

// ---------- tx status ----------
function txBox(el) {
  return {
    wait(msg = 'Confirm in MetaMask…') { el.className = 'txbox wait'; el.innerHTML = `<span class="spin"></span>${esc(LIVE ? msg : 'Saving (preview)…')}`; },
    sent(hash) { el.innerHTML = `<span class="spin"></span>Waiting for confirmation… <a href="${explorerTx(hash)}" target="_blank" rel="noopener">view tx</a>`; },
    ok(msg, hash) { el.className = 'txbox ok'; el.innerHTML = `✓ ${esc(msg)}${hash ? ` · <a href="${explorerTx(hash)}" target="_blank" rel="noopener">view tx</a>` : ''}`; },
    err(e, retry) { el.className = 'txbox err'; el.innerHTML = `${esc(txMessage(e))} ${retry ? '<button type="button" class="link-btn">Retry</button>' : ''}`; if (retry) $('button', el).addEventListener('click', retry); },
    clear() { el.className = 'txbox'; el.innerHTML = ''; },
  };
}
async function ensureChain() { if (!onRightChain() && !wallet.preview) await switchChain(); }

// ---------- step 1: create season ----------
function paintCreate(main) {
  $('#dRight').innerHTML = stepsAside(1);
  const toLocal = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  const now = new Date(); const end = new Date(Date.now() + 14 * 86400000);
  main.innerHTML = `<div class="d-card">
    <span class="eyebrow">Step 1 of 3 · Create a season</span><h1 class="h3">Tell members what you're building</h1>
    <form id="seasonForm" class="form" novalidate>
      <label>Project name<input name="name" maxlength="60" required placeholder="e.g. Bloomly"></label>
      <label>Short description<textarea name="description" rows="3" maxlength="300" required placeholder="What it does, who it's for. The AI uses this to suggest quests and check proofs."></textarea></label>
      <label>Project link<input name="link" type="url" maxlength="150" placeholder="https://"></label>
      <div class="row2"><label>Start<input name="start" type="datetime-local" value="${toLocal(now)}" required></label><label>End<input name="end" type="datetime-local" value="${toLocal(end)}" required></label></div>
      <label><span>Reward note <span class="opt">· off-chain, shown on the quest page</span></span><input name="reward" maxlength="140" placeholder="Top 3 get a shout-out + whitelist"></label>
      <p class="form-err" id="fErr" role="alert"></p>
      <div class="form-foot"><button class="btn btn-dark" type="submit">Create season <span aria-hidden="true">→</span></button><span class="fine">One transaction. Name, dates and notes are public on BOT Chain.</span></div>
      <div class="txbox" id="tx1"></div>
    </form></div>`;
  const form = $('#seasonForm');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(form));
    const err = $('#fErr');
    const start = Math.floor(new Date(f.start).getTime() / 1000), endT = Math.floor(new Date(f.end).getTime() / 1000);
    err.textContent = !f.name.trim() ? 'Add the project name.' : f.description.trim().split(/\s+/).length < 4 ? 'Write at least a short sentence about the project.' : f.link && !isUrl(f.link) ? 'The link should start with https://' : !(endT > start) ? 'The end must be after the start.' : endT <= Date.now() / 1000 ? 'The end date is in the past.' : '';
    if (err.textContent) return;
    const tx = txBox($('#tx1'));
    const btn = $('button[type=submit]', form); btn.disabled = true;
    const run = async () => {
      try {
        await ensureChain();
        tx.wait();
        const { id, tx: hash } = await board.createSeason({ name: f.name.trim(), meta: { description: f.description.trim(), link: f.link.trim(), reward: f.reward.trim() }, start, end: endT }, (h) => tx.sent(h));
        tx.ok('Season created', hash);
        await loadSeasons();
        S.sel = id; S.mode = 'quests'; S.drafts = [];
        setTimeout(paint, 500);
      } catch (e2) { tx.err(e2, run); btn.disabled = false; }
    };
    run();
  });
}
function stepsAside(n) {
  return `<div class="d-steps"><h3>Your season in 3 steps</h3>${['Create a season', 'Publish quests', 'Review proofs'].map((t, i) => `<div class="ds${i + 1 === n ? ' on' : i + 1 < n ? ' done' : ''}"><b>${i + 1 < n ? '✓' : i + 1}</b>${t}</div>`).join('')}
  <div class="ds-scout">${scout({ pose: n === 3 ? 'magnify' : 'map', size: 96 })}</div><p class="fine">AI only recommends. You sign every approval, so nobody can farm points by fooling a bot.</p></div>`;
}

// ---------- step 2: quests ----------
function paintQuests(main) {
  const s = S.seasons.find((x) => x.id === S.sel);
  if (!s) { S.mode = 'queue'; return paint(); }
  $('#dRight').innerHTML = stepsAside(2);
  main.innerHTML = `<div class="d-card">
    <span class="eyebrow">Step 2 of 3 · ${esc(s.name)}</span><h1 class="h3">Publish quests</h1>
    <p class="muted">Let AI suggest six marketing quests from your description, or write your own. You can edit everything before publishing.</p>
    <div class="q-tools"><button class="btn btn-light" id="suggest" type="button">✨ Suggest quests</button><button class="btn btn-line" id="addQ" type="button">+ Write your own</button><span class="fine" id="aiNote"></span></div>
    <div id="drafts" class="drafts"></div>
    <p class="form-err" id="qErr" role="alert"></p>
    <div class="form-foot"><button class="btn btn-dark" id="publish" type="button">Publish quests <span aria-hidden="true">→</span></button><button class="btn btn-line" id="skipQ" type="button">Back to season</button></div>
    <div class="txbox" id="tx2"></div></div>`;
  paintDrafts();
  $('#suggest').addEventListener('click', async (e) => {
    const b = e.currentTarget; b.disabled = true; b.innerHTML = '<span class="spin dark"></span>Scout is thinking…';
    try {
      const { quests, ai } = await suggestQuests({ name: s.name, description: s.description, link: s.link });
      S.drafts = [...S.drafts.filter((d) => d.title.trim()), ...quests.map((q) => ({ ...q, maxPerWallet: 1 }))].slice(0, 20);
      $('#aiNote').textContent = ai ? 'Suggested by AI — edit freely.' : 'AI unavailable — these are built-in templates. Edit freely.';
      paintDrafts();
    } catch { toast('Add a longer description to get suggestions.', 'err'); }
    b.disabled = false; b.innerHTML = '✨ Suggest again';
  });
  $('#addQ').addEventListener('click', () => { S.drafts.push({ title: '', rules: '', points: 50, proofType: 0, maxPerWallet: 1 }); paintDrafts(); $$('.draft input[data-k=title]').pop()?.focus(); });
  $('#skipQ').addEventListener('click', () => { S.mode = 'queue'; paint(); });
  $('#publish').addEventListener('click', publishQuests);
}
function paintDrafts() {
  const el = $('#drafts');
  if (!S.drafts.length) { el.innerHTML = `<div class="drafts-empty">No quests yet. Try <b>✨ Suggest quests</b>.</div>`; return; }
  el.innerHTML = S.drafts.map((q, i) => `<div class="draft" data-i="${i}">
    <div class="draft-n mono">${String(i + 1).padStart(2, '0')}</div>
    <div class="draft-body">
      <input data-k="title" value="${esc(q.title)}" maxlength="80" placeholder="Quest title" aria-label="Quest title">
      <textarea data-k="rules" rows="2" maxlength="220" placeholder="Rules — what counts?" aria-label="Rules">${esc(q.rules)}</textarea>
      <div class="draft-meta">
        <label>Points<input data-k="points" type="number" min="${POINTS.min}" max="${POINTS.max}" step="10" value="${q.points}"></label>
        <label>Proof<select data-k="proofType">${PROOF_TYPES.map((p) => `<option value="${p.id}"${p.id === Number(q.proofType) ? ' selected' : ''}>${p.label}</option>`).join('')}</select></label>
        <label>Max per wallet<input data-k="maxPerWallet" type="number" min="1" max="100" value="${q.maxPerWallet}"></label>
      </div>
    </div>
    <button class="icon-btn" type="button" data-del="${i}" aria-label="Remove quest">✕</button></div>`).join('');
  $$('.draft [data-k]', el).forEach((inp) => inp.addEventListener('input', () => {
    const i = Number(inp.closest('.draft').dataset.i);
    const k = inp.dataset.k;
    S.drafts[i][k] = ['points', 'proofType', 'maxPerWallet'].includes(k) ? Number(inp.value) : inp.value;
  }));
  $$('[data-del]', el).forEach((b) => b.addEventListener('click', () => { S.drafts.splice(Number(b.dataset.del), 1); paintDrafts(); }));
}
async function publishQuests() {
  const err = $('#qErr');
  const list = S.drafts.filter((q) => q.title.trim());
  if (!list.length) { err.textContent = 'Add at least one quest.'; return; }
  for (const [i, q] of list.entries()) { const m = questError({ ...q, title: packTitle(q.title, q.rules) }); if (m) { err.textContent = `Quest ${i + 1}: ${m}.`; return; } }
  if (list.length > 20) { err.textContent = 'Up to 20 quests per transaction.'; return; }
  err.textContent = '';
  const tx = txBox($('#tx2'));
  const btn = $('#publish'); btn.disabled = true;
  try {
    await ensureChain();
    tx.wait();
    const { tx: hash } = await board.addQuests(S.sel, list.map((q) => ({ ...q, title: packTitle(q.title, q.rules) })), (h) => tx.sent(h));
    tx.ok(`${list.length} quests published`, hash);
    S.drafts = [];
    setTimeout(() => { S.mode = 'queue'; paint(); }, 600);
  } catch (e) { tx.err(e, publishQuests); btn.disabled = false; }
}

// ---------- step 3: season view (review queue) ----------
async function loadSeasonData() {
  const s = S.seasons.find((x) => x.id === S.sel) || (await board.getSeason(S.sel));
  const [quests, subs, lb] = await Promise.all([board.quests(S.sel), board.submissions(S.sel), board.leaderboard(S.sel)]);
  const reviews = await loadReviews(subs.map((x) => x.id));
  S.data = { season: s, quests, qmap: Object.fromEntries(quests.map((q) => [q.id, q])), subs, reviews, rows: rankRows(lb.members, lb.points) };
}

async function paintSeason(main) {
  main.innerHTML = '<div class="d-loading"><span class="spin dark"></span>Loading season…</div>';
  try { await loadSeasonData(); } catch (e) { main.innerHTML = `<div class="d-card"><p class="form-err">Couldn't read the season from BOT Chain. ${esc(e.message || '')}</p><button class="btn btn-line" id="rl" type="button">Retry</button></div>`; $('#rl').addEventListener('click', paint); return; }
  const { season: s, quests, subs } = S.data;
  const ph = phase(s);
  const pending = subs.filter((x) => x.status === 0).length;
  main.innerHTML = `<div class="d-head">
      <div><span class="eyebrow">Season #${s.id}</span><h1 class="h3">${esc(s.name)}</h1><p class="d-sub"><span class="ph ${ph.key}">${ph.label}</span>${dateStr(s.start)} → ${dateStr(s.end)}</p></div>
      <div class="d-head-act"><a class="btn btn-line btn-sm" href="q/${s.id}">Open quest page ↗</a><button class="btn btn-line btn-sm" id="cpLink" type="button">Copy link</button>${ph.key !== 'ended' ? '<button class="btn btn-dark btn-sm" id="addMore" type="button">+ Quests</button>' : ''}</div>
    </div>
    <div class="d-tabs" role="tablist"><button class="${S.mode === 'queue' ? 'on' : ''}" data-m="queue" type="button">Review queue <span class="count">${pending}</span></button><button class="${S.mode === 'list' ? 'on' : ''}" data-m="list" type="button">Quests <span class="count">${quests.length}</span></button></div>
    <div id="dBody"></div>`;
  $('#cpLink').addEventListener('click', () => copy(new URL(`q/${s.id}`, document.baseURI).href, 'Quest page link copied'));
  $('#addMore')?.addEventListener('click', () => { S.mode = 'quests'; paint(); });
  $$('.d-tabs button').forEach((b) => b.addEventListener('click', () => { S.mode = b.dataset.m; paintSeason(main); }));
  if (S.mode === 'list') paintQuestList(); else paintQueue();
  paintStats();
}

function paintQuestList() {
  const { quests } = S.data;
  const body = $('#dBody');
  if (!quests.length) { body.innerHTML = `<div class="drafts-empty">No quests yet. <button class="link-btn" id="goQ" type="button">Publish quests →</button></div>`; $('#goQ').addEventListener('click', () => { S.mode = 'quests'; paint(); }); return; }
  body.innerHTML = `<div class="qlist">${quests.map((q) => { const { title, rules } = unpackTitle(q.title); return `<div class="ql-item${q.active ? '' : ' off'}"><div><b>${esc(title)}</b><p class="muted">${esc(rules)}</p><span class="mono small">+${q.points} pts · ${PROOF_TYPES[q.proofType].label} · max ${q.maxPerWallet}/wallet · ${fmt(q.completions)} completed</span></div><button class="btn btn-line btn-sm" type="button" data-q="${q.id}" data-a="${q.active ? 0 : 1}">${q.active ? 'Pause' : 'Resume'}</button></div>`; }).join('')}</div><div class="txbox" id="txq"></div>`;
  $$('[data-q]', body).forEach((b) => b.addEventListener('click', async () => {
    const tx = txBox($('#txq'));
    try { await ensureChain(); tx.wait(); const r = await board.setQuestActive(Number(b.dataset.q), b.dataset.a === '1', (h) => tx.sent(h)); tx.ok('Quest updated', r.tx); await loadSeasonData(); paintQuestList(); }
    catch (e) { tx.err(e); }
  }));
}

function verdictChip(r) {
  if (!r) return '<span class="vchip none">Not reviewed</span>';
  const [ic, label] = VERDICT[r.verdict] || VERDICT.unsure;
  return `<span class="vchip ${r.verdict}" title="${esc(r.reason)}">${ic} ${label}<i class="mono">${Math.round((r.confidence || 0) * 100)}%</i></span>`;
}
function proofCell(sub, q) {
  return q?.proofType === 1 ? `<span class="proof-text">${esc(sub.proof.slice(0, 60))}${sub.proof.length > 60 ? '…' : ''}</span>` : `<a href="${esc(sub.proof)}" target="_blank" rel="noopener nofollow" class="mono proof-link">${esc(sub.proof.replace(/^https?:\/\//, '').slice(0, 34))}${sub.proof.length > 42 ? '…' : ''}</a>`;
}

function paintQueue() {
  const { subs, qmap, reviews } = S.data;
  const body = $('#dBody');
  const list = subs.filter((x) => S.filter === 'all' || ['pending', 'approved', 'rejected'][x.status] === S.filter).sort((a, b) => b.at - a.at);
  const pendingNoReview = subs.filter((x) => x.status === 0 && !reviews[x.id]);
  body.innerHTML = `
    <div class="q-bar">
      <div class="filters">${['pending', 'all', 'approved', 'rejected'].map((f) => `<button type="button" class="${S.filter === f ? 'on' : ''}" data-f="${f}">${f[0].toUpperCase() + f.slice(1)}</button>`).join('')}</div>
      <div class="q-bar-act">
        ${pendingNoReview.length ? `<button class="btn btn-line btn-sm" id="runAI" type="button">✨ Review ${pendingNoReview.length} with ${aiMode() === 'ai' ? 'AI' : 'basic check'}</button>` : ''}
        <button class="btn btn-line btn-sm" id="pickValid" type="button">Select AI-valid</button>
      </div>
    </div>
    ${!list.length ? `<div class="drafts-empty">${S.filter === 'pending' ? 'No proofs waiting. Share your quest page to get submissions.' : 'Nothing here yet.'}</div>` : `
    <div class="rq" role="table" aria-label="Review queue">
      <div class="rq-row rq-head" role="row"><span><input type="checkbox" id="pickAll" aria-label="Select all pending"></span><span>Member</span><span>Quest</span><span>Proof</span><span>AI verdict</span><span>Status</span><span>Submitted</span></div>
      ${list.map((x) => { const q = qmap[x.questId]; return `<div class="rq-row${S.picked.has(x.id) ? ' picked' : ''}" role="row" data-id="${x.id}">
        <span>${x.status === 0 ? `<input type="checkbox" class="pick" data-id="${x.id}" ${S.picked.has(x.id) ? 'checked' : ''} aria-label="Select submission ${x.id}">` : ''}</span>
        <span class="mono">${short(x.member)}</span><span class="rq-quest">${esc(unpackTitle(q?.title || '').title)}</span><span>${proofCell(x, q)}</span>
        <span>${verdictChip(reviews[x.id])}</span><span><span class="st st-${x.status}">${STATUS[x.status]}</span></span><span class="muted small">${ago(x.at)}</span>
        <span class="swipe-hint" aria-hidden="true">Swipe → approve · ← reject</span>
      </div>`; }).join('')}
    </div>`}
    <div class="batch${S.picked.size ? ' show' : ''}" id="batchBar"><span><b>${S.picked.size}</b> selected${S.picked.size > MAX_BATCH ? ` · ${Math.ceil(S.picked.size / MAX_BATCH)} transactions` : ''}</span><button class="btn btn-bad btn-sm" id="bReject" type="button">Reject</button><button class="btn btn-ok btn-sm" id="bApprove" type="button">Approve selected →</button></div>
    <div class="txbox" id="txr"></div>
    <div class="drawer" id="drawer" aria-hidden="true"></div>`;
  $$('.filters button', body).forEach((b) => b.addEventListener('click', () => { S.filter = b.dataset.f; paintQueue(); }));
  $$('.pick', body).forEach((c) => c.addEventListener('change', (e) => { e.stopPropagation(); const id = Number(c.dataset.id); c.checked ? S.picked.add(id) : S.picked.delete(id); c.closest('.rq-row').classList.toggle('picked', c.checked); paintBatch(); }));
  $('#pickAll')?.addEventListener('change', (e) => { list.filter((x) => x.status === 0).forEach((x) => (e.target.checked ? S.picked.add(x.id) : S.picked.delete(x.id))); paintQueue(); });
  $('#pickValid').addEventListener('click', () => { subs.filter((x) => x.status === 0 && reviews[x.id]?.verdict === 'valid').forEach((x) => S.picked.add(x.id)); if (!S.picked.size) toast('No pending proofs marked valid yet'); paintQueue(); });
  $('#runAI')?.addEventListener('click', (e) => runReviews(e.currentTarget, pendingNoReview));
  $('#bApprove').addEventListener('click', () => decide([...S.picked].map((id) => ({ id, approve: true }))));
  $('#bReject').addEventListener('click', () => decide([...S.picked].map((id) => ({ id, approve: false }))));
  $$('.rq-row[data-id]', body).forEach((r) => {
    r.addEventListener('click', (e) => { if (e.target.closest('input,a,button')) return; openDrawer(Number(r.dataset.id)); });
    swipe(r);
  });
  if (S.drawer != null) openDrawer(S.drawer);
}
function paintBatch() {
  const b = $('#batchBar');
  b.classList.toggle('show', S.picked.size > 0);
  $('b', b).textContent = S.picked.size;
}

async function runReviews(btn, list) {
  btn.disabled = true;
  let done = 0;
  for (const sub of list) {
    btn.innerHTML = `<span class="spin dark"></span>Reviewing ${++done}/${list.length}…`;
    const r = await reviewSubmission({ sub, quest: S.data.qmap[sub.questId], season: S.data.season });
    if (r) S.data.reviews[sub.id] = r;
  }
  const missed = list.filter((x) => !S.data.reviews[x.id]).length;
  if (missed) toast(`${missed} couldn't be reviewed (AI error) — they stay "Not reviewed".`, 'err');
  paintQueue();
}

async function decide(decisions) {
  if (!decisions.length || S.busy) return;
  S.busy = true;
  const tx = txBox($('#txr'));
  try {
    await ensureChain();
    tx.wait(decisions.length > MAX_BATCH ? `Confirm batch 1 of ${Math.ceil(decisions.length / MAX_BATCH)} in MetaMask…` : 'Confirm in MetaMask…');
    const { txs } = await board.review(decisions, (h) => tx.sent(h), (i, n) => n > 1 && tx.wait(`Confirm batch ${i} of ${n} in MetaMask…`));
    const a = decisions.filter((d) => d.approve).length;
    tx.ok(`${a ? `${a} approved` : ''}${a && a < decisions.length ? ' · ' : ''}${decisions.length - a ? `${decisions.length - a} rejected` : ''}`, txs[txs.length - 1]);
    S.picked.clear(); S.drawer = null;
    await loadSeasonData();
    paintQueue(); paintStats();
    $('#txr') && txBox($('#txr')).ok(`${a} approved, ${decisions.length - a} rejected`, txs[txs.length - 1]);
  } catch (e) { tx.err(e, () => decide(decisions)); }
  S.busy = false;
}

function openDrawer(id) {
  const sub = S.data.subs.find((x) => x.id === id);
  if (!sub) return;
  S.drawer = id;
  const q = S.data.qmap[sub.questId];
  const { title, rules } = unpackTitle(q.title);
  const r = S.data.reviews[id] || cachedReview(id);
  const d = $('#drawer');
  d.setAttribute('aria-hidden', 'false');
  d.classList.add('open');
  d.innerHTML = `<div class="dr-panel" role="dialog" aria-label="Submission ${id}">
    <div class="dr-head"><span class="eyebrow">Submission #${id}</span><button class="icon-btn" type="button" id="drClose" aria-label="Close">✕</button></div>
    <h3>${esc(title)}</h3><p class="muted small">${esc(rules)}</p>
    <dl class="dr-dl"><dt>Member</dt><dd class="mono">${esc(sub.member)}</dd><dt>Points</dt><dd class="mono">+${q.points}</dd><dt>Submitted</dt><dd>${new Date(sub.at * 1000).toLocaleString()}</dd><dt>Status</dt><dd><span class="st st-${sub.status}">${STATUS[sub.status]}</span></dd></dl>
    <div class="dr-proof"><span class="k">Proof · ${PROOF_TYPES[q.proofType].label}</span>${q.proofType === 1 ? `<p>${esc(sub.proof)}</p>` : `<a href="${esc(sub.proof)}" target="_blank" rel="noopener nofollow">${esc(sub.proof)} ↗</a>`}</div>
    <div class="dr-ai"><span class="k">AI review ${r && r.ai === false ? '· basic check' : ''}</span>${r ? `${verdictChip(r)}<p>${esc(r.reason)}</p>${r.note ? `<p class="warn-note">⚠️ ${esc(r.note)}</p>` : ''}` : '<p class="muted">Not reviewed yet.</p>'}
      <button class="link-btn" type="button" id="reAI">${r ? 'Run again' : 'Review now'}</button></div>
    ${sub.status === 0 ? `<div class="dr-act"><button class="btn btn-bad" id="drReject" type="button">Reject</button><button class="btn btn-ok" id="drApprove" type="button">Approve +${q.points} →</button></div><p class="fine">AI only recommends. Your signature decides.</p>` : ''}
  </div>`;
  $('#drClose').addEventListener('click', closeDrawer);
  d.addEventListener('click', (e) => { if (e.target === d) closeDrawer(); }, { once: true });
  $('#drApprove')?.addEventListener('click', () => decide([{ id, approve: true }]));
  $('#drReject')?.addEventListener('click', () => decide([{ id, approve: false }]));
  $('#reAI').addEventListener('click', async (e) => {
    e.currentTarget.innerHTML = '<span class="spin dark"></span>Reviewing…';
    const nr = await reviewSubmission({ sub, quest: q, season: S.data.season }, true);
    if (nr) S.data.reviews[id] = nr; else toast('AI review failed. Try again later.', 'err');
    paintQueue();
  });
}
function closeDrawer() { S.drawer = null; const d = $('#drawer'); d?.classList.remove('open'); d?.setAttribute('aria-hidden', 'true'); }

/** Mobile: swipe a pending card right to approve, left to reject (still confirms the tx). */
function swipe(row) {
  const id = Number(row.dataset.id);
  const sub = S.data.subs.find((x) => x.id === id);
  if (!sub || sub.status !== 0) return;
  let x0 = null, dx = 0;
  row.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'touch') return; x0 = e.clientX; dx = 0; });
  row.addEventListener('pointermove', (e) => { if (x0 == null) return; dx = e.clientX - x0; row.style.transform = `translateX(${Math.max(-120, Math.min(120, dx))}px)`; row.dataset.sw = dx > 60 ? 'ok' : dx < -60 ? 'no' : ''; });
  const end = () => { if (x0 == null) return; x0 = null; row.style.transform = ''; row.dataset.sw = ''; if (Math.abs(dx) > 90) decide([{ id, approve: dx > 0 }]); };
  row.addEventListener('pointerup', end); row.addEventListener('pointercancel', end);
}

// ---------- right column: season stats ----------
function paintStats() {
  const right = $('#dRight');
  if (!right || !S.data) return;
  const { subs, quests, rows, qmap } = S.data;
  const reviewed = subs.filter((x) => x.status !== 0);
  const approved = subs.filter((x) => x.status === 1);
  const rate = reviewed.length ? Math.round((approved.length / reviewed.length) * 100) : null;
  const pts = rows.reduce((n, r) => n + r.points, 0);
  const topQ = quests.map((q) => ({ q, n: subs.filter((x) => x.questId === q.id).length })).sort((a, b) => b.n - a.n).slice(0, 4);
  right.innerHTML = `<div class="stats">
    <h3>Season stats</h3>
    <div class="kpis">
      <div><span class="k">Submissions</span><b class="mono">${fmt(subs.length)}</b></div>
      <div><span class="k">Approval rate</span><b class="mono">${rate == null ? '--' : rate + '%'}</b></div>
      <div><span class="k">Members</span><b class="mono">${fmt(rows.length)}</b></div>
      <div><span class="k">Points awarded</span><b class="mono">${fmt(pts)}</b></div>
    </div>
    <div class="chart-box"><span class="k">Submissions per day</span><canvas id="perDay" height="140" aria-label="Submissions per day chart" role="img"></canvas></div>
    <div class="top"><span class="k">Top quests</span>${topQ.length ? topQ.map(({ q, n }) => `<div class="top-row"><span>${esc(unpackTitle(q.title).title)}</span><b class="mono">${n}</b></div>`).join('') : '<p class="muted small">--</p>'}</div>
    <div class="top"><span class="k">Top members</span>${rows.length ? rows.slice(0, 5).map((r) => `<div class="top-row"><span class="mono">${r.rank}. ${short(r.address)}</span><b class="mono">${fmt(r.points)}</b></div>`).join('') : '<p class="muted small">No approved proofs yet.</p>'}</div>
  </div>`;
  drawChart(subs);
}
function drawChart(subs) {
  S.chart?.destroy(); S.chart = null;
  const cv = $('#perDay');
  if (!cv || !window.Chart) return;
  const days = [];
  const start = new Date(); start.setHours(0, 0, 0, 0);
  for (let i = 13; i >= 0; i--) days.push(new Date(start.getTime() - i * 86400000));
  const counts = days.map((d) => subs.filter((x) => { const t = x.at * 1000; return t >= d.getTime() && t < d.getTime() + 86400000; }).length);
  S.chart = new Chart(cv, {
    type: 'bar',
    data: { labels: days.map((d) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })), datasets: [{ data: counts, backgroundColor: '#3B82F6', borderRadius: 4, maxBarThickness: 14 }] },
    options: { animation: false, plugins: { legend: { display: false }, tooltip: { displayColors: false } }, scales: { x: { grid: { display: false }, ticks: { font: { size: 10 }, maxRotation: 0, autoSkip: true, maxTicksLimit: 5 } }, y: { beginAtZero: true, ticks: { precision: 0, font: { size: 10 } }, grid: { color: '#EFEFEF' }, border: { display: false } } } },
  });
}
