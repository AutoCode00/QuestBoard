// /q — browse seasons · /q/:seasonId — member quest page: header, countdown, quest cards, leaderboard, submit sheet.
import { $, $$, esc, fmt, short, toast, copy } from './ui.js';
import { board, wallet, onWallet, connect, onRightChain, switchChain, txMessage, explorerTx, LIVE, hasMetaMask } from './chain.js';
import { reviewSubmission, cachedReview } from './ai.js';
import { PROOF_TYPES, unpackTitle, rankRows, badgesFor, normalizeProof, isUrl, BADGES } from './logic.js';
import { scout } from './scout.js';

const BADGE_TEXT = { bronze: '🥉 Bronze', silver: '🥈 Silver', gold: '🥇 Gold', champion: '🏆 Season Champion' };
const dateStr = (t) => new Date(t * 1000).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
function phase(s) {
  const now = Date.now() / 1000;
  return now < s.start ? 'soon' : now >= s.end ? 'ended' : 'live';
}
function countdown(sec) {
  sec = Math.max(0, Math.floor(sec));
  const d = Math.floor(sec / 86400), h = Math.floor((sec % 86400) / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  return `${String(d).padStart(2, '0')}d ${String(h).padStart(2, '0')}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`;
}

// ---------- browse ----------
export async function browse(view) {
  view.innerHTML = `<section class="browse"><div class="browse-head"><span class="eyebrow">Quests</span><h1 class="h2">Pick a season, start a quest</h1><p class="muted">Every season below lives on BOT Chain. Read the quests and leaderboards without a wallet.</p></div><div class="season-grid" id="sg"><div class="d-loading"><span class="spin dark"></span>Loading seasons…</div></div></section>`;
  try {
    const list = await board.recentSeasons(24);
    const sg = $('#sg');
    if (!list.length) { sg.innerHTML = `<div class="empty-card">${scout({ pose: 'map', size: 110 })}<h3>No seasons yet</h3><p class="muted">Be the first project to start one.</p><a class="btn btn-dark" href="app">Start a season →</a></div>`; return; }
    sg.innerHTML = list.map((s) => { const p = phase(s); return `<a class="season-card" href="q/${s.id}"><span class="ph ${p === 'live' ? 'live' : p}">${p === 'live' ? 'Running' : p === 'soon' ? 'Starts soon' : 'Ended'}</span><h3>${esc(s.name)}</h3><p>${esc(s.description || '')}</p><span class="mono small">${p === 'live' ? `ends in ${countdown(s.end - Date.now() / 1000).slice(0, 7)}` : p === 'soon' ? `starts ${dateStr(s.start)}` : `ended ${dateStr(s.end)}`}</span>${s.reward ? `<span class="reward">🎁 ${esc(s.reward)}</span>` : ''}</a>`; }).join('');
  } catch (e) { $('#sg').innerHTML = `<p class="form-err">Couldn't read seasons from BOT Chain. ${esc(e.message || '')}</p>`; }
}

// ---------- season page ----------
const Q = { s: null, quests: [], mine: {}, mySubs: [], rows: [], my: 0, timer: null, tab: 'quests' };

export async function page(view, id) {
  view.innerHTML = '<div class="qp-loading"><span class="spin dark"></span>Loading season…</div>';
  const s = await board.getSeason(id).catch(() => null);
  if (!s) { view.innerHTML = `<section class="page-narrow center">${scout({ pose: 'magnify', size: 130 })}<h1 class="h2">Season #${id} not found</h1><p>It may not exist yet on this network.</p><p><a class="btn btn-dark" href="q">Browse quests →</a></p></section>`; return; }
  Q.s = s;
  view.innerHTML = `<section class="qp">
    <header class="qp-hero">
      <div class="qp-hero-in">
        <span class="label-pill">🦊 Quest season #${s.id}</span>
        <h1 class="qp-title">${esc(s.name)}</h1>
        ${s.description ? `<p class="qp-desc">${esc(s.description)}</p>` : ''}
        <div class="qp-meta">${s.link ? `<a href="${esc(s.link)}" target="_blank" rel="noopener nofollow">${esc(s.link.replace(/^https?:\/\//, ''))} ↗</a>` : ''}${s.reward ? `<span>🎁 ${esc(s.reward)}</span>` : ''}<button type="button" class="link-btn light" id="share">Copy quest link</button></div>
        <div class="qp-count" id="qpCount"></div>
      </div>
    </header>
    <div class="qp-tabs" role="tablist"><button class="on" data-t="quests" type="button">Quests</button><button data-t="board" type="button">Leaderboard</button></div>
    <div class="qp-body">
      <div class="qp-quests" id="qpQuests"></div>
      <aside class="qp-board" id="qpBoard"></aside>
    </div>
  </section>
  <div class="sheet" id="sheet" aria-hidden="true"></div>`;
  $('#share').addEventListener('click', () => copy(location.href.split('#')[0], 'Quest link copied'));
  $$('.qp-tabs button').forEach((b) => b.addEventListener('click', () => { Q.tab = b.dataset.t; $$('.qp-tabs button').forEach((x) => x.classList.toggle('on', x === b)); $('.qp-body').dataset.tab = Q.tab; }));
  $('.qp-body').dataset.tab = 'quests';
  tick();
  Q.timer = setInterval(tick, 1000);
  const off = onWallet(() => load());
  return () => { clearInterval(Q.timer); off(); };
}

function tick() {
  const el = $('#qpCount');
  if (!el || !Q.s) return;
  const now = Date.now() / 1000, p = phase(Q.s);
  el.innerHTML = p === 'live'
    ? `<span class="k light">Ends in</span><b class="mono">${countdown(Q.s.end - now)}</b>`
    : p === 'soon'
      ? `<span class="k light">Opens in</span><b class="mono">${countdown(Q.s.start - now)}</b><span class="closed">Submissions open ${dateStr(Q.s.start)}</span>`
      : `<span class="closed">Season ended ${dateStr(Q.s.end)} · submissions closed</span>`;
}

async function load() {
  try {
    const [quests, lb, subs] = await Promise.all([board.quests(Q.s.id), board.leaderboard(Q.s.id), board.submissions(Q.s.id)]);
    Q.quests = quests;
    Q.rows = rankRows(lb.members, lb.points);
    Q.counts = {};
    const me = wallet.account?.toLowerCase();
    Q.mySubs = me ? subs.filter((x) => x.member.toLowerCase() === me) : [];
    Q.mine = wallet.account ? await board.memberStatus(quests.map((q) => q.id), wallet.account) : {};
    Q.my = wallet.account ? await board.pointsOf(Q.s.id, wallet.account) : 0;
  } catch (e) { $('#qpQuests').innerHTML = `<p class="form-err">Couldn't read quests from BOT Chain. ${esc(e.message || '')}</p>`; return; }
  paintQuests(); paintBoard();
}

function questState(q) {
  const st = Q.mine[q.id] || { approved: 0, pending: false };
  const mine = Q.mySubs.filter((x) => x.questId === q.id).sort((a, b) => b.at - a.at);
  const last = mine[0];
  if (st.pending) return { key: 'pending', label: 'Pending review', sub: last };
  if (st.approved >= q.maxPerWallet) return { key: 'done', label: 'Completed', sub: last };
  if (last?.status === 1) return { key: 'approved', label: `Approved +${q.points} pts ✓`, sub: last, again: true };
  if (last?.status === 2) return { key: 'rejected', label: 'Rejected', sub: last, again: true };
  return { key: 'open', label: '' };
}

function paintQuests() {
  const el = $('#qpQuests');
  const p = phase(Q.s);
  const isOwner = wallet.account && wallet.account.toLowerCase() === Q.s.owner.toLowerCase();
  if (!Q.quests.length) { el.innerHTML = `<div class="empty-card">${scout({ pose: 'map', size: 100 })}<h3>No quests published yet</h3><p class="muted">Check back soon.</p>${isOwner ? '<a class="btn btn-dark" href="app">Publish quests →</a>' : ''}</div>`; return; }
  el.innerHTML = `${isOwner ? '<div class="owner-note">You own this season. <a href="app">Review submissions in the app →</a></div>' : ''}
  <div class="quest-grid">${Q.quests.map((q) => {
    const { title, rules } = unpackTitle(q.title);
    const st = questState(q);
    const r = st.sub ? cachedReview(st.sub.id) : null;
    const closed = p !== 'live' || !q.active;
    return `<article class="quest${st.key === 'done' ? ' done' : ''}${!q.active ? ' paused' : ''}" data-q="${q.id}">
      <div class="quest-top"><span class="pts mono">+${q.points}</span><span class="ptype">${PROOF_TYPES[q.proofType].label}</span></div>
      <h3>${esc(title)}</h3>
      ${rules ? `<p class="rules">${esc(rules)}</p>` : ''}
      <div class="quest-foot">
        <span class="muted small">${fmt(q.completions)} completed${q.maxPerWallet > 1 ? ` · up to ${q.maxPerWallet}× per wallet` : ''}</span>
        ${st.key !== 'open' ? `<span class="qstate ${st.key}">${st.label}</span>` : ''}
      </div>
      ${st.key === 'rejected' && r?.reason ? `<p class="reject-why">AI note: ${esc(r.reason)}</p>` : ''}
      ${st.key === 'done' ? '' : closed ? `<button class="btn btn-line btn-sm" type="button" disabled>${!q.active ? 'Paused' : p === 'soon' ? 'Opens soon' : 'Closed'}</button>`
        : st.key === 'pending' ? '<button class="btn btn-line btn-sm" type="button" disabled>Waiting for review…</button>'
        : `<button class="btn btn-dark btn-sm start" type="button" data-q="${q.id}">${st.again ? 'Submit again' : 'Start quest'} →</button>`}
    </article>`;
  }).join('')}</div>`;
  $$('.start', el).forEach((b) => b.addEventListener('click', () => openSheet(Q.quests.find((q) => q.id === Number(b.dataset.q)))));
}

function paintBoard() {
  const el = $('#qpBoard');
  const me = wallet.account?.toLowerCase();
  const myRow = Q.rows.find((r) => r.address.toLowerCase() === me);
  const myBadges = badgesFor(Q.my, myRow?.rank);
  const next = BADGES.find((b) => Q.my < b.min);
  el.innerHTML = `<div class="lb">
    <div class="my">${wallet.account
      ? `<span class="k">My points</span><b class="mono big">${fmt(Q.my)}</b><span class="muted small">${myRow ? `Rank #${myRow.rank}` : 'Not ranked yet'}${next ? ` · ${next.min - Q.my} to ${next.label}` : ''}</span>${myBadges.length ? `<div class="badges">${myBadges.map((b) => `<span class="badge ${b}">${BADGE_TEXT[b]}</span>`).join('')}</div>` : ''}`
      : `<span class="k">My points</span><b class="mono big">--</b><button class="btn btn-dark btn-sm" type="button" id="lbConnect">Connect wallet</button>`}</div>
    <h3>Leaderboard</h3>
    ${Q.rows.length ? `<ol class="lb-list">${Q.rows.slice(0, 50).map((r) => `<li class="${r.address.toLowerCase() === me ? 'me' : ''}"><span class="rk mono">${r.rank === 1 ? '🚩' : r.rank}</span><span class="mono">${short(r.address)}</span><span class="b">${r.badges.filter((b) => b !== 'champion').slice(-1).map((b) => BADGE_TEXT[b].split(' ')[0]).join('')}</span><b class="mono">${fmt(r.points)}</b></li>`).join('')}</ol>`
      : `<div class="lb-empty">${scout({ pose: 'flag', size: 80 })}<p class="muted small">No points yet. The first approved proof plants the flag.</p></div>`}
    <p class="fine">Read from BOT Chain. Badges: Bronze 100 · Silver 300 · Gold 700 · Champion = #1.</p>
  </div>`;
  $('#lbConnect')?.addEventListener('click', doConnect);
}

async function doConnect() {
  try { await connect(); } catch (e) { if (e.code === 'NO_METAMASK') { toast('Install MetaMask to submit proof.', 'err'); window.open('https://metamask.io/download/', '_blank', 'noopener'); } else toast(txMessage(e), 'err'); }
}

// ---------- submit sheet ----------
function openSheet(q) {
  const { title, rules } = unpackTitle(q.title);
  const t = PROOF_TYPES[q.proofType];
  const sh = $('#sheet');
  sh.classList.add('open'); sh.setAttribute('aria-hidden', 'false');
  sh.innerHTML = `<div class="sheet-panel" role="dialog" aria-modal="true" aria-label="Submit proof">
    <div class="sheet-grip" aria-hidden="true"></div>
    <div class="dr-head"><span class="eyebrow">Submit proof · +${q.points} pts</span><button class="icon-btn" type="button" id="shClose" aria-label="Close">✕</button></div>
    <h3>${esc(title)}</h3>${rules ? `<p class="muted">${esc(rules)}</p>` : ''}
    <label class="form">${t.label}${q.proofType === 1 ? `<textarea id="proof" rows="5" maxlength="1000" placeholder="${t.hint}"></textarea>` : `<input id="proof" type="url" maxlength="500" placeholder="https://…" inputmode="url">`}<span class="fine left">${t.hint}. Each proof can only be used once.</span></label>
    <p class="form-err" id="pErr" role="alert"></p>
    ${!wallet.account ? `<button class="btn btn-dark wide" id="shConnect" type="button">${LIVE && !hasMetaMask() ? 'Install MetaMask to submit' : 'Connect wallet to submit'}</button>`
      : !onRightChain() ? '<button class="btn btn-dark wide" id="shSwitch" type="button">Switch to BOT Chain</button>'
      : `<button class="btn btn-dark wide" id="shSubmit" type="button">Submit proof →</button>`}
    <div class="txbox" id="txs"></div>
    <p class="fine">AI checks your proof and the project approves it. ${LIVE ? 'One transaction (gas only).' : 'Preview mode: saved in this browser.'}</p>
  </div>`;
  const close = () => { sh.classList.remove('open'); sh.setAttribute('aria-hidden', 'true'); };
  $('#shClose').addEventListener('click', close);
  sh.addEventListener('click', (e) => { if (e.target === sh) close(); });
  $('#shConnect')?.addEventListener('click', async () => { if (LIVE && !hasMetaMask()) { window.open('https://metamask.io/download/', '_blank', 'noopener'); return; } await doConnect(); if (wallet.account) openSheet(q); });
  $('#shSwitch')?.addEventListener('click', async () => { try { await switchChain(); openSheet(q); } catch (e) { toast(txMessage(e), 'err'); } });
  $('#proof').focus();
  $('#shSubmit')?.addEventListener('click', async function run() {
    const raw = $('#proof').value.trim();
    const err = $('#pErr');
    err.textContent = !raw ? 'Paste your proof first.' : q.proofType !== 1 && !isUrl(raw) ? 'That doesn\'t look like a link. It should start with https://' : q.proofType === 1 && raw.split(/\s+/).length < 5 ? 'Write a little more.' : '';
    if (err.textContent) return;
    const btn = $('#shSubmit'); btn.disabled = true;
    const box = $('#txs');
    box.className = 'txbox wait'; box.innerHTML = `<span class="spin"></span>${LIVE ? 'Confirm in MetaMask…' : 'Saving (preview)…'}`;
    try {
      const res = await board.submit(q, raw, (h) => { box.innerHTML = `<span class="spin"></span>Waiting for confirmation… <a href="${explorerTx(h)}" target="_blank" rel="noopener">view tx</a>`; });
      box.className = 'txbox ok';
      box.innerHTML = `✓ Submitted — Pending review${res.tx ? ` · <a href="${explorerTx(res.tx)}" target="_blank" rel="noopener">view tx</a>` : ''}`;
      // Ask the AI to review now so the owner sees a verdict in the queue. Failures just leave it "Not reviewed".
      reviewSubmission({ sub: { id: res.id, proof: res.proof, member: wallet.account, questId: q.id }, quest: q, season: Q.s }).catch(() => {});
      setTimeout(() => { close(); load(); }, 900);
    } catch (e) {
      box.className = 'txbox err';
      box.innerHTML = `${esc(txMessage(e))} <button type="button" class="link-btn">Retry</button>`;
      $('button', box).addEventListener('click', run);
      btn.disabled = false;
    }
  });
}
