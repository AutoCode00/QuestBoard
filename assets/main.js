// Shell: router (/ · /app · /q · /q/:id), notch navbar, wallet button, dot-matrix footer.
/* global gsap, ScrollTrigger, SplitText, Flip, DrawSVGPlugin */
import { CONFIG } from './config.js';
import { $, $$, esc, fmt, short, copy, toast, reducedMotion } from './ui.js';
import { initWallet, onWallet, connect, switchChain, onRightChain, hasMetaMask, txMessage, LIVE, NET, NET_KEY, MAINNET_ADDRESS, explorerAddress, board, wallet, newPreviewWallet } from './chain.js';
import { logoMark, scout, FOX_HEAD } from './scout.js';
import { dotWordmark, dotFox } from './dotfx.js';
import * as home from './home.js';
import * as app from './app.js';
import * as quest from './quest.js';

if (window.gsap) gsap.registerPlugin(...[window.ScrollTrigger, window.SplitText, window.Flip, window.DrawSVGPlugin].filter(Boolean));
const BASE = window.__BASE || '/';
const path = () => decodeURIComponent(location.pathname.slice(BASE.length)).replace(/\/+$/, '');
let dispose = null;

// ---------- router ----------
export function go(to) {
  const url = new URL(to, document.baseURI);
  if (url.origin !== location.origin) { location.href = url.href; return; }
  const keep = new URLSearchParams(location.search);
  for (const k of ['net', 'preview']) if (keep.has(k) && !url.searchParams.has(k)) url.searchParams.set(k, keep.get(k));
  history.pushState(null, '', url.pathname + url.search + url.hash);
  route();
}
window.__go = go;

async function route() {
  try { dispose?.(); } catch (e) { console.error(e); }
  dispose = null; // each view reverts its own GSAP context; the footer's triggers stay alive
  closeMenu();
  const view = $('#view');
  const p = path();
  document.body.dataset.route = p === '' ? 'home' : p.split('/')[0];
  let m;
  if (p === '') dispose = await home.render(view);
  else if (p === 'app') dispose = await app.render(view);
  else if (p === 'q') dispose = await quest.browse(view);
  else if ((m = p.match(/^q\/(\d+)$/))) dispose = await quest.page(view, Number(m[1]));
  else if (p === 'privacy' || p === 'terms') legal(view, p);
  else notFound(view);
  if (location.hash) requestAnimationFrame(() => document.getElementById(location.hash.slice(1))?.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth' }));
  else window.scrollTo(0, 0);
  requestAnimationFrame(() => window.ScrollTrigger?.refresh());
}

document.addEventListener('click', (e) => {
  const a = e.target.closest('a[href]');
  if (!a || a.target === '_blank' || e.metaKey || e.ctrlKey || e.shiftKey || a.hasAttribute('download')) return;
  const url = new URL(a.getAttribute('href'), document.baseURI);
  if (url.origin !== location.origin || !url.pathname.startsWith(BASE) || /\.(html|json|sol|png|svg)$/.test(url.pathname)) return;
  e.preventDefault();
  if (url.pathname === location.pathname && url.hash) {
    document.getElementById(url.hash.slice(1))?.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth' });
    history.replaceState(null, '', url.hash);
    closeMenu();
    return;
  }
  go(url.href);
});
addEventListener('popstate', route);

// ---------- navbar ----------
function renderNav() {
  $('#nav').innerHTML = `
  <nav class="notch" aria-label="Main">
    <a class="brand" href="./">${logoMark(26)}<span>QuestBoard</span></a>
    <div class="notch-links">
      <a href="./#product">Product</a>
      <a href="./#how">How it works</a>
      <a href="q">Quests</a>
      <a href="./#faq">FAQs</a>
    </div>
    <button class="notch-wallet" type="button" id="walletBtn">Connect wallet</button>
    <a class="pill-white" href="app">Start a season <span aria-hidden="true">→</span></a>
    <button class="burger" type="button" id="burger" aria-label="Menu" aria-expanded="false"><span></span><span></span></button>
  </nav>`;
  $('#menu').innerHTML = `
    <a href="./#product">Product</a><a href="./#how">How it works</a><a href="q">Browse quests</a><a href="./#faq">FAQs</a>
    <button class="btn btn-light" type="button" id="walletBtn2">Connect wallet</button>
    <a class="btn btn-dark" href="app">Start a season →</a>`;
  $('#burger').addEventListener('click', () => ($('#menu').hidden ? openMenu() : closeMenu()));
  for (const b of [$('#walletBtn'), $('#walletBtn2')]) b.addEventListener('click', walletClick);
  onWallet(paintWallet);
}
function openMenu() { $('#menu').hidden = false; $('#burger').setAttribute('aria-expanded', 'true'); document.body.classList.add('menu-open'); }
function closeMenu() { const m = $('#menu'); if (!m) return; m.hidden = true; $('#burger')?.setAttribute('aria-expanded', 'false'); document.body.classList.remove('menu-open'); }

function paintWallet(w) {
  for (const b of [$('#walletBtn'), $('#walletBtn2')]) {
    if (!b) continue;
    b.classList.toggle('warn', !!w.account && !onRightChain());
    b.textContent = !w.account ? 'Connect wallet' : !onRightChain() ? 'Switch to BOT Chain' : `${w.preview ? 'Preview · ' : ''}${short(w.account)}`;
    b.title = w.account ? w.account : '';
  }
}
export async function walletClick() {
  try {
    if (!wallet.account) { await connect(); toast(wallet.preview ? 'Preview wallet ready (no MetaMask needed in preview mode)' : 'Wallet connected'); }
    else if (!onRightChain()) await switchChain();
    else if (wallet.preview) { const n = await newPreviewWallet(); toast(`Switched to preview wallet ${n} of 2 (click again to switch back)`); }
    else copy(wallet.account, 'Address copied');
  } catch (e) {
    if (e.code === 'NO_METAMASK') toast('Install MetaMask to connect. Quest pages and leaderboards work without it.', 'err');
    else toast(txMessage(e), 'err');
  }
}

// ---------- preview banner ----------
function renderBanner() {
  if (LIVE && NET_KEY === 'mainnet') return;
  const el = document.createElement('div');
  el.className = 'preview-banner';
  el.innerHTML = LIVE
    ? `Testnet · ${esc(NET.name)} (chain ID ${NET.chainId})`
    : `<b>Preview mode</b> — no contract set yet. Seasons, quests and points are saved in this browser only. <a href="deploy.html">Deploy QuestBoard</a>`;
  el.insertAdjacentHTML('beforeend', '<button type="button" class="x" aria-label="Hide">✕</button>');
  el.querySelector('.x').addEventListener('click', () => el.remove());
  document.body.prepend(el);
  document.body.classList.add('has-banner');
}

// ---------- footer: white, dot-matrix (tabs + marquee · photo + info columns · dotted Scout · legal bar · giant wordmark) ----------
const MARQUEE = {
  quests: ['Share the launch post', 'Write a review', 'Make a meme', 'Record a 15s demo', 'Invite a friend', 'Translate the announcement'],
  proof: ['Medium', 'Mirror', 'Public Telegram posts', 'GitHub', 'Blogs & forums', 'Image links', 'Pasted text'],
};
const marqueeRow = (list) => { const items = list.map((t) => `<span>· ${esc(t)}</span>`).join(''); return `<div class="mq-track">${items}${items}</div>`; };

async function renderFooter() {
  const addr = MAINNET_ADDRESS;
  const shortAddr = addr ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : 'not deployed yet';
  const L = CONFIG.links;
  const email = L.email.replace(/^mailto:/, '');
  $('#footer').innerHTML = `
  <div class="f-wrap">
    <div class="f-top">
      <div class="f-seg" role="tablist" aria-label="Footer ticker">
        <button type="button" class="on" data-mq="quests" role="tab" aria-selected="true">QUESTS</button>
        <button type="button" data-mq="proof" role="tab" aria-selected="false">PROOF IT READS</button>
      </div>
      <div class="f-marquee" aria-hidden="true">${marqueeRow(MARQUEE.quests)}</div>
    </div>

    <div class="f-mid">
      <figure class="f-photo"><img src="assets/hero.webp" alt="Rolling green hills under a blue sky" loading="lazy" width="942" height="534"></figure>
      <div class="f-info">
        <div class="f-col">
          <div class="f-item"><span class="f-k">CONTRACT</span>
            <p>QuestBoard on BOT Chain mainnet,<br><code>${esc(shortAddr)}</code>${addr ? ' <button type="button" class="f-copy" aria-label="Copy contract address">Copy</button>' : ''}</p>
            <a class="f-arrow" href="${esc(explorerAddress())}" target="_blank" rel="noopener"><span aria-hidden="true">↳</span> View on explorer</a>
          </div>
          <div class="f-item"><span class="f-k">LIVE ON BOT CHAIN</span>
            <p class="f-slash"><span>Seasons <b id="fs-seasons">--</b></span><span>Quests <b id="fs-quests">--</b></span><span>Proofs approved <b id="fs-approved">--</b></span></p>
          </div>
        </div>
        <div class="f-col">
          <div class="f-item"><span class="f-k">EMAIL</span><p><a href="${esc(L.email)}">${esc(email)}</a></p></div>
          <div class="f-item"><span class="f-k">COMMUNITY</span><p><a href="${esc(L.telegram)}" target="_blank" rel="noopener">Telegram</a> / <a href="${esc(L.docs)}" target="_blank" rel="noopener">BOT Chain docs</a> / <a href="${esc(L.faucet)}" target="_blank" rel="noopener">Faucet</a></p></div>
          <div class="f-item"><span class="f-k">BUILT ON</span>
            <a class="f-chain" href="${esc(L.botchain)}" target="_blank" rel="noopener"><img src="assets/botchain-mark.png" alt="" width="22" height="22"><span>BOT Chain · chain ID 677</span></a>
          </div>
        </div>
        <div class="f-dots"><canvas id="dotFox" aria-label="Scout drawn in dots" role="img"></canvas></div>
      </div>
    </div>

    <div class="f-bar">
      <span>© 2026 QUESTBOARD · AI RECOMMENDS, PEOPLE DECIDE</span>
      <nav class="f-links" aria-label="Footer">
        <a href="app">START A<br>SEASON</a><a href="q">BROWSE<br>QUESTS</a><a href="./#how">HOW IT<br>WORKS</a><a href="./#faq">FAQS</a><a href="privacy">PRIVACY<br>POLICY</a><a href="terms">TERMS OF<br>USE</a>
      </nav>
      <span>POINTS ARE SCORES, NOT TOKENS · ${LIVE ? esc(NET.name.toUpperCase()) : "PREVIEW MODE"}</span>
    </div>

    <div class="f-mark"><canvas id="dotMark" aria-label="QuestBoard" role="img"></canvas></div>
  </div>`;
  const F = $('#footer');
  $('.f-copy', F)?.addEventListener('click', () => copy(addr, 'Contract address copied'));
  $$('.f-seg button', F).forEach((b) => b.addEventListener('click', () => {
    $$('.f-seg button', F).forEach((x) => { x.classList.toggle('on', x === b); x.setAttribute('aria-selected', x === b); });
    $('.f-marquee', F).innerHTML = marqueeRow(MARQUEE[b.dataset.mq]);
  }));
  dotWordmark($('#dotMark'), 'QUESTBOARD', BLUE);
  dotFox($('#dotFox'), FOX_HEAD, '38 6 124 146', BLUE);
  try {
    const s = await board.stats();
    const set = (id, n) => { const el = $(id); if (!el) return; if (reducedMotion() || !window.gsap) { el.textContent = fmt(n); return; } const o = { v: 0 }; gsap.to(o, { v: n, duration: 1.4, ease: 'power2.out', onUpdate: () => (el.textContent = fmt(Math.round(o.v))), scrollTrigger: { trigger: el, start: 'top 95%', once: true } }); };
    set('#fs-seasons', s.seasons); set('#fs-quests', s.quests); set('#fs-approved', s.approved);
  } catch { /* keep "--" */ }
}
const BLUE = '#1F3BFF';

// ---------- small pages ----------
function legal(view, which) {
  const privacy = which === 'privacy';
  view.innerHTML = `<section class="page-narrow"><span class="eyebrow">${privacy ? 'Privacy' : 'Terms'}</span><h1 class="h2">${privacy ? 'Privacy' : 'Terms of use'}</h1>
  ${privacy
    ? `<p>QuestBoard has no accounts and no database. Seasons, quests, submissions and points are public on BOT Chain. When a proof is reviewed, the proof text and the linked page are sent to our AI Worker; the AI verdict is kept for 180 days so the project owner can see it. We don't use cookies or trackers.</p>`
    : `<p>QuestBoard is a free tool. Points are on-chain scores, not tokens, and have no cash value. Rewards are promised and delivered by each project, not by QuestBoard. The AI only recommends; the project owner decides every approval. Don't submit content you don't own, and don't use QuestBoard for spam.</p>`}
  <p><a class="btn btn-dark" href="./">Back home →</a></p></section>`;
}
function notFound(view) {
  view.innerHTML = `<section class="page-narrow center">${scout({ pose: 'magnify', size: 140 })}<h1 class="h2">Scout can't find this trail.</h1><p>The page you're looking for isn't here.</p><p><a class="btn btn-dark" href="./">Back home →</a> <a class="btn btn-light" href="q">Browse quests</a></p></section>`;
}

// ---------- boot ----------
renderBanner();
renderNav();
renderFooter();
initWallet();
route();
