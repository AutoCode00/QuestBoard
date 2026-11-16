// Website: 9 sections after the Supaste layout (sky hero, notch nav, grey stage cards, FAQ, black footer).
/* global gsap, ScrollTrigger, SplitText */
import { $, $$, esc, reducedMotion } from './ui.js';
import { scout, logoMark } from './scout.js';

// 3D icons: Microsoft Fluent Emoji 3D (MIT), resized to 160px WebP in assets/icons/.
const icon = (k, size = 64) => `<img src="assets/icons/${k}.webp" alt="" width="${size}" height="${size}" loading="lazy" decoding="async">`;

const CAPS = [
  ['spark', 'AI quest ideas', 'Describe your project and get six marketing quests in seconds: share, review, meme, demo, invite, translate.'],
  ['link', 'Link, text or image proof', 'Members paste a link, a block of text or an image link — whatever fits the quest.'],
  ['read', 'Reads the proof page', 'The AI opens blogs, forums, Medium and public Telegram posts and checks them against your rules.'],
  ['copy', 'Duplicate-proof blocking', 'Every proof is hashed on-chain. The same link can never earn points twice.'],
  ['batch', 'Batch approve', 'Select fifty proofs, approve them in one transaction. 100+ are split for you.'],
  ['clock', 'Season countdown', 'Start and end dates live in the contract. Submissions open and close on time, by themselves.'],
  ['board', 'Live leaderboard', 'Season points per wallet, read straight from BOT Chain and sorted in the app.'],
  ['badge', 'Season badges', 'Bronze at 100, Silver at 300, Gold at 700 — and a Season Champion at the top.'],
  ['page', 'Public quest page', 'Share one link. Anyone can read the quests and the leaderboard, no wallet needed.'],
  ['phone', 'Works on mobile', 'Quests as a list, submit from a bottom sheet, swipe to approve on the go.'],
];
const ROWS = [
  ['0x8a1f…c03e', 'Share the launch post', 'x.com/mira/status/…', 'valid', 'Mentions the project and the link.', 50],
  ['0x3b7d…91a2', 'Write a short review', 'medium.com/@dev/…', 'valid', '120 words, original, names the project.', 120],
  ['0xf04c…2d18', 'Make a meme', 'imgur.com/a/…', 'unsure', "Couldn't open link — please check.", 80],
  ['0x55e2…a7b0', 'Translate the announcement', 't.me/kanal/2241', 'valid', 'Thai translation, includes the hashtag.', 100],
  ['0x9c10…4e6f', 'Share the launch post', 'x.com/bot/status/…', 'invalid', "Copy-paste of the project's own post.", 0],
];
const VERDICT = { valid: '✅ Looks valid', unsure: '⚠️ Unsure', invalid: "❌ Doesn't meet rules" };
const TABS = [
  ['Fair', 'AI recommends, you decide.', 'No one farms points by fooling a bot. The AI reads every proof and tells you what it thinks — but only the season owner can sign an approval.'],
  ['Fast', 'Review 50 proofs in one batch transaction.', 'Tick the ones the AI marked valid, glance at the unsure ones, approve them all in a single signature. Rejections go in the same batch.'],
  ['On-chain', 'Every point and badge is public on BOT Chain.', "Points live in the QuestBoard contract, not in a spreadsheet. Anyone can check the leaderboard before a prize is claimed."],
];
const DAYS = [
  [1, 'Season created', 'Six quests published in one transaction. The quest page link goes out in the project’s Telegram.'],
  [2, 'First 30 proofs', 'Shares and reviews arrive. The AI marks most of them valid; the owner batch-approves over coffee.'],
  [5, 'Meme quest goes viral', 'One meme gets picked up by a bigger account. Submissions double overnight.'],
  [9, 'Duplicates blocked', 'Someone tries the same link from three wallets. The contract refuses the second and third.'],
  [14, 'Winners announced', 'The top three are read straight from the on-chain leaderboard. Scout plants the flag.'],
  [16, 'Season closed', 'Submissions shut on time. Points stay public on BOT Chain for good.'],
];
const FAQ = [
  ['What happens when the AI gets it wrong?', 'Nothing, unless you agree with it. The AI only recommends a verdict with a reason and a confidence score. You approve or reject every submission yourself, with your own wallet signature.'],
  ['Are points tokens?', 'No. Points are on-chain scores in the QuestBoard contract. They can’t be traded or sent. Rewards — shout-outs, whitelist spots, merch — are up to you and handled off-chain.'],
  ['Can people cheat?', 'Each proof is hashed on-chain, so the same link can’t be submitted twice. Every wallet gets one pending submission per quest and a max number of completions. And you approve every point.'],
  ['Which links can it read?', 'Blogs, forums, Medium, Mirror, GitHub, news sites and public Telegram posts. Pages that need a login or only render with JavaScript (like X or Instagram) can’t be opened, so the AI reviews the pasted text and marks them “please check manually”.'],
  ['How fast can I start?', 'Today. Connect MetaMask, describe your project, let the AI suggest quests, and publish. Two transactions and your quest page is live.'],
  ['Does it cost anything?', 'QuestBoard is free. You only pay BOT Chain gas for each transaction — creating a season, publishing quests, approving a batch. Members pay gas to submit.'],
];

export async function render(view) {
  view.innerHTML = `
  <section class="hero" id="top">
    <div class="hero-inner">
      <span class="label-pill">${logoMark(20)} Community quests</span>
      <h1 class="hero-title"><span class="l1">Give every fan</span><em class="l2">a quest worth sharing.</em></h1>
      <p class="hero-sub">Turn your community into your marketing team. Post quests, let members submit proof, let AI check every submission — and keep the points and leaderboard on BOT Chain.</p>
      <div class="hero-ctas">
        <a class="btn btn-dark" href="app">Start a season <span aria-hidden="true">→</span></a>
        <a class="btn btn-light" href="q">Browse quests</a>
      </div>
      <ul class="hero-notes"><li>Free · gas only</li><li>AI recommends, you decide</li><li>BOT Chain · 677</li></ul>
    </div>

    <div class="loop" id="how">
      <svg class="loop-path" viewBox="0 0 1000 60" preserveAspectRatio="none" aria-hidden="true"><path d="M120 30 C 300 -10, 400 70, 500 30 S 760 -10, 880 30" fill="none" stroke="#fff" stroke-width="2.4" stroke-dasharray="1 10" stroke-linecap="round"/></svg>
      ${[['Post', 'Write quests or let AI suggest them'], ['Check', 'AI reviews every proof, you approve'], ['Reward', 'Points and badges live on BOT Chain']].map(([t, d], i) => `
      <div class="loop-step"><span class="loop-num">${i + 1}</span><b>${t}</b><span>${d}</span></div>`).join('')}
    </div>

    <div class="hills" aria-hidden="true">
      <div class="hero-scene">
        <div class="hero-scout">${scout({ pose: 'map', size: 150 })}</div>
        <div class="hero-board" aria-hidden="true">
          <div class="hb-head"><span class="dot"></span><b>Launch Week</b><span class="mono">ends in 09d 14h</span></div>
          ${[['Share the launch post', 50, 23], ['Write a short review', 120, 11], ['Make a meme', 80, 7]].map(([t, p, n]) => `<div class="hb-row"><span>${t}</span><span class="mono">+${p}</span><span class="muted mono">${n} done</span></div>`).join('')}
        </div>
      </div>
    </div>
  </section>

  <section class="statements" id="statements">
    <p class="stmt">Run as many quests as you have fans, for the whole season.</p>
    <p class="stmt">Every proof checked, wherever it was posted.</p>
    <p class="stmt">Points proven on-chain before anyone claims a prize.</p>
  </section>

  <section class="stage" id="product">
    <div class="stage-card">
      <div class="stage-head">
        <h2 class="h3">Every proof, checked before it counts</h2>
        <p>Members submit links, text or image links. The AI opens the page, checks your rules and recommends a verdict. You approve in one batch, and the points land on BOT Chain.</p>
      </div>
      <div class="scene">
        <div class="win" id="demoWin">
          <div class="win-bar"><span class="tl r"></span><span class="tl y"></span><span class="tl g"></span><span class="win-title">QuestBoard · Review queue</span></div>
          <div class="season-strip">
            <div><span class="k">Season</span><b>Launch Week</b></div>
            <div><span class="k">Submissions</span><b class="mono" id="dSubs">--</b></div>
            <div><span class="k">Status</span><b><span class="live-dot"></span>Running</b></div>
            <div><span class="k">Points awarded</span><b class="mono" id="dPts">--</b></div>
          </div>
          <div class="qtable" role="table" aria-label="Example review queue">
            <div class="qrow qhead" role="row"><span>Member</span><span>Quest</span><span class="hide-sm">Proof</span><span>AI verdict</span><span>Status</span></div>
            ${ROWS.map(([m, q, p, v, why, pts], i) => `
            <div class="qrow" role="row" data-i="${i}" data-v="${v}" data-pts="${pts}">
              <span class="mono">${m}</span><span>${q}</span><span class="mono muted hide-sm">${p}</span>
              <span class="verdict ${v}" title="${esc(why)}"><i class="type" data-text="${esc(VERDICT[v])}"></i></span>
              <span class="status pending">Pending</span>
              <span class="seal" aria-hidden="true">✓</span>
            </div>`).join('')}
          </div>
        </div>
        <div class="scene-scout">${scout({ pose: 'magnify', size: 120 })}</div>
      </div>
    </div>
  </section>

  <section class="stage" id="why">
    <div class="stage-card tabs-card">
      <div class="tabs-list" role="tablist">
        ${TABS.map(([t], i) => `<button class="tab${i === 0 ? ' on' : ''}" role="tab" aria-selected="${i === 0}" data-i="${i}"><span class="mono">0${i + 1} / 03</span><b>${t}</b><span class="bar"><i></i></span></button>`).join('')}
      </div>
      <div class="tabs-panel" role="tabpanel" aria-live="polite">
        ${TABS.map(([t, head, body], i) => `<div class="tp${i === 0 ? ' on' : ''}" data-i="${i}"><span class="eyebrow">${t}</span><h3 class="h3">${head}</h3><p>${body}</p></div>`).join('')}
        <div class="tp-art">${scout({ pose: 'seal', size: 130 })}</div>
      </div>
    </div>
  </section>

  <section class="features" id="features">
    <div class="sec-head"><h2 class="h2">Everything a quest season needs</h2><p>From the first quest idea to the winner's flag, without a spreadsheet, a bot farm or a backend.</p></div>
    <div class="chips">${CAPS.map(([k, t]) => `<span class="chip">${icon(k, 20)}${t}</span>`).join('')}</div>
    <div class="cap-grid">${CAPS.map(([k, t, d]) => `<article class="cap reveal"><span class="cap-ic">${icon(k)}</span><h3>${t}</h3><p>${d}</p></article>`).join('')}</div>
  </section>

  <section class="stage" id="example">
    <div class="stage-card timeline-card">
      <div class="stage-head">
        <span class="label-pill grey">Example season</span>
        <h2 class="h3">A hackathon project wants 100 people talking about its launch.</h2>
        <p>An illustration of how a season runs — not a real customer.</p>
      </div>
      <div class="tl-wrap">
        <div class="tl-track"><div class="tl-fill"></div>
          ${Array.from({ length: 16 }, (_, i) => `<span class="tl-tick${DAYS.some((d) => d[0] === i + 1) ? ' ev' : ''}" style="left:${(i / 15) * 100}%"><i>${i + 1}</i></span>`).join('')}
          <span class="tl-head" style="left:0"></span>
        </div>
        <div class="tl-card"><span class="mono tl-day">Day 1</span><h4 class="tl-title">${DAYS[0][1]}</h4><p class="tl-body">${DAYS[0][2]}</p></div>
        <div class="tl-steps"><span class="k">Each quest</span>${['Post the quest', 'Members submit', 'AI checks', 'You approve'].map((s, i) => `<span class="step"><b>${i + 1}</b>${s}</span>`).join('')}</div>
        <p class="tl-result"><span class="k">Result</span> Your real numbers show here once you've run your own season.</p>
      </div>
    </div>
  </section>

  <section class="try" id="start">
    <div class="try-left">
      <h2 class="h2">Ready to try it?</h2>
      <p>Free to use. You only pay BOT Chain gas. No accounts, no tokens, no backend to set up.</p>
      <ul class="ticks"><li>Two transactions to go live</li><li>AI-suggested quests</li><li>Public quest page + leaderboard</li><li>Works with MetaMask</li></ul>
    </div>
    <div class="try-card">
      <div class="seg" role="tablist"><button class="on" data-t="p" role="tab" aria-selected="true">For projects</button><button data-t="m" role="tab" aria-selected="false">For members</button></div>
      <ol class="try-steps" data-t="p">
        <li><b>Create a season</b><span>Name, description, link, dates and a reward note. One transaction.</span></li>
        <li><b>Publish quests</b><span>Let AI suggest six, or write your own. One transaction.</span></li>
        <li><b>Review proofs</b><span>Read the AI verdicts, approve in batches. Points land on-chain.</span></li>
      </ol>
      <ol class="try-steps" data-t="m" hidden>
        <li><b>Connect wallet</b><span>MetaMask on BOT Chain — we add the network for you.</span></li>
        <li><b>Pick a quest</b><span>Read the rules, do the thing, copy the link.</span></li>
        <li><b>Submit proof</b><span>Paste it, sign once, watch it go from Pending to Approved.</span></li>
      </ol>
      <a class="btn btn-dark wide" id="tryCta" href="app">Start a season <span aria-hidden="true">→</span></a>
      <p class="fine">Points are on-chain scores, not tokens. Rewards are set by each project.</p>
    </div>
  </section>

  <section class="faq" id="faq">
    <div class="faq-left"><h2 class="h2">Frequently Asked Questions</h2><p>Everything you need to know before you run your first season.</p></div>
    <div class="faq-list">${FAQ.map(([q, a]) => `<details class="qa"><summary>${q}<span class="plus" aria-hidden="true"></span></summary><p>${a}</p></details>`).join('')}</div>
  </section>

  <section class="contrast" id="campaign">
    <h2 class="h2">From task <span class="arrow">→</span> To campaign</h2>
    <div class="contrast-cols">
      <ul class="dont">${["Don't just ask people to retweet", "Don't just count likes in a spreadsheet", "Don't just hope someone writes a review"].map((t) => `<li><span class="strike">${t}</span></li>`).join('')}</ul>
      <ul class="do">${['Run a full quest season with your whole community', 'Keep a public, on-chain leaderboard', 'Reward the people who actually showed up'].map((t) => `<li>${t}</li>`).join('')}</ul>
    </div>
    <a class="btn btn-dark" href="app">Start a season <span aria-hidden="true">→</span></a>
  </section>`;

  const cleanups = [tabs(view), tryTabs(view)];
  if (!reducedMotion() && window.gsap) cleanups.push(animate(view));
  else staticState(view);
  return () => cleanups.forEach((c) => c?.());
}

// ---------- interactions ----------
function tabs(view) {
  const btns = $$('.tab', view);
  const panes = $$('.tp', view);
  let i = 0, timer, tween;
  const DUR = 6;
  const show = (n, user) => {
    i = n;
    btns.forEach((b, k) => { b.classList.toggle('on', k === n); b.setAttribute('aria-selected', k === n); b.querySelector('.bar i').style.transform = 'scaleX(0)'; });
    panes.forEach((p, k) => p.classList.toggle('on', k === n));
    tween?.kill(); clearTimeout(timer);
    if (user || reducedMotion()) return; // stop auto-advance once the reader picks a tab
    const bar = btns[n].querySelector('.bar i');
    if (window.gsap) tween = gsap.fromTo(bar, { scaleX: 0 }, { scaleX: 1, duration: DUR, ease: 'none', onComplete: () => show((i + 1) % btns.length) });
    else timer = setTimeout(() => show((i + 1) % btns.length), DUR * 1000);
  };
  btns.forEach((b, k) => b.addEventListener('click', () => show(k, true)));
  show(0);
  return () => { tween?.kill(); clearTimeout(timer); };
}
function tryTabs(view) {
  const seg = $$('.seg button', view);
  seg.forEach((b) => b.addEventListener('click', () => {
    seg.forEach((x) => { x.classList.toggle('on', x === b); x.setAttribute('aria-selected', x === b); });
    $$('.try-steps', view).forEach((ol) => (ol.hidden = ol.dataset.t !== b.dataset.t));
    const cta = $('#tryCta', view);
    if (b.dataset.t === 'm') { cta.href = 'q'; cta.innerHTML = 'Browse quests <span aria-hidden="true">→</span>'; }
    else { cta.href = 'app'; cta.innerHTML = 'Start a season <span aria-hidden="true">→</span>'; }
  }));
}
function staticState(view) {
  $$('.type', view).forEach((t) => (t.textContent = t.dataset.text));
  $$('.qrow[data-i]', view).forEach((r) => { if (r.dataset.v !== 'unsure') { const s = r.querySelector('.status'); s.className = `status ${r.dataset.v === 'valid' ? 'approved' : 'rejected'}`; s.textContent = r.dataset.v === 'valid' ? 'Approved' : 'Rejected'; } });
  $('#dSubs', view).textContent = '54';
  $('#dPts', view).textContent = '1,270';
  setDay(view, 0);
}
function setDay(view, idx) {
  const d = DAYS[idx];
  $('.tl-day', view).textContent = `Day ${d[0]}`;
  $('.tl-title', view).textContent = d[1];
  $('.tl-body', view).textContent = d[2];
}

// ---------- GSAP ----------
function animate(view) {
  const ctx = gsap.context(() => {
    // Hero: headline line by line, Scout walks in and unrolls the map into the quest board.
    const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
    tl.from('.label-pill', { y: 16, opacity: 0, duration: 0.6 })
      .from(['.hero-title .l1', '.hero-title .l2'], { yPercent: 60, opacity: 0, filter: 'blur(8px)', stagger: 0.18, duration: 0.9 }, '-=0.3')
      .from('.hero-sub, .hero-ctas, .hero-notes', { y: 18, opacity: 0, stagger: 0.08, duration: 0.6 }, '-=0.5')
      .from('.loop-step', { y: 20, opacity: 0, stagger: 0.1, duration: 0.6 }, '-=0.3')
      .from('.hero-scout', { x: -260, duration: 1.4, ease: 'power2.out' }, 0.5)
      .to('.hero-scout .scout', { y: -6, duration: 0.18, repeat: 7, yoyo: true, ease: 'sine.inOut' }, 0.5)
      .from('.hero-board', { scaleX: 0.04, scaleY: 0.3, opacity: 0, transformOrigin: '0% 70%', duration: 0.9, ease: 'expo.out' }, 1.8)
      .from('.hb-row', { x: -12, opacity: 0, stagger: 0.1, duration: 0.4 }, 2.3);
    gsap.to('.hero-scout .sc-tail', { rotate: 6, transformOrigin: '20% 90%', duration: 0.9, repeat: -1, yoyo: true, ease: 'sine.inOut' });
    gsap.to('.sc-glow', { opacity: 0.5, scale: 1.15, transformOrigin: '50% 50%', duration: 0.8, repeat: -1, yoyo: true, ease: 'sine.inOut' });

    // Loop: the dotted path draws between the numbers as you scroll.
    if (window.DrawSVGPlugin) gsap.fromTo('.loop-path path', { drawSVG: '0%' }, { drawSVG: '100%', ease: 'none', scrollTrigger: { trigger: '.loop', start: 'top 85%', end: 'bottom 35%', scrub: true } });

    // Statements: words go from faint to ink as you read.
    $$('.stmt', view).forEach((p) => {
      const split = window.SplitText ? new SplitText(p, { type: 'words' }) : null;
      gsap.fromTo(split ? split.words : p, { opacity: 0.15 }, { opacity: 1, stagger: 0.08, ease: 'none', scrollTrigger: { trigger: p, start: 'top 85%', end: 'top 45%', scrub: true } });
    });

    // Product panel: rows arrive, verdicts type in, statuses flip with Scout's seal, points tick up.
    const rows = $$('.qrow[data-i]', view);
    gsap.set(rows, { opacity: 0, y: 14 });
    const subs = { v: 49 }, pts = { v: 0 };
    const dSubs = $('#dSubs', view), dPts = $('#dPts', view);
    const demo = gsap.timeline({ paused: true, repeat: -1, repeatDelay: 2.5, onRepeat: () => resetDemo(rows) });
    demo.to(subs, { v: 54, duration: 2.6, ease: 'none', onUpdate: () => (dSubs.textContent = Math.round(subs.v)) }, 0);
    let total = 0;
    rows.forEach((r, i) => {
      const t = i * 0.5;
      demo.to(r, { opacity: 1, y: 0, duration: 0.45, ease: 'power2.out' }, t);
      const type = r.querySelector('.type');
      const txt = type.dataset.text;
      const o = { n: 0 };
      demo.to(o, { n: txt.length, duration: 0.6, ease: 'none', onUpdate: () => (type.textContent = [...txt].slice(0, Math.round(o.n)).join('')) }, t + 0.35);
    });
    rows.forEach((r, i) => {
      if (r.dataset.v === 'unsure') return;
      const t = 3.4 + i * 0.45;
      const ok = r.dataset.v === 'valid';
      const seal = r.querySelector('.seal');
      const status = r.querySelector('.status');
      const p = Number(r.dataset.pts);
      const from = total; total += p;
      demo.call(() => { status.className = `status ${ok ? 'approved' : 'rejected'}`; status.textContent = ok ? 'Approved' : 'Rejected'; }, null, t);
      if (ok) {
        demo.fromTo(seal, { scale: 2.4, opacity: 0, rotate: -25 }, { scale: 1, opacity: 1, rotate: -8, duration: 0.35, ease: 'back.out(3)' }, t);
        const to = total;
        demo.to(pts, { v: to, duration: 0.4, ease: 'power1.out', onStart: () => (pts.v = from), onUpdate: () => (dPts.textContent = Math.round(pts.v).toLocaleString('en-US')) }, t);
      }
    });
    demo.to({}, { duration: 1 });
    ScrollTrigger.create({ trigger: '#demoWin', start: 'top 80%', onEnter: () => demo.play(), onLeaveBack: () => demo.pause() });
    gsap.from('.scene-scout', { y: 60, opacity: 0, duration: 0.8, ease: 'back.out(1.6)', scrollTrigger: { trigger: '.scene', start: 'top 70%', once: true } });

    // Timeline: pin the card, scrolling moves the playhead and updates the event card.
    const card = $('.timeline-card', view);
    const head = $('.tl-head', view), fill = $('.tl-fill', view);
    let last = -1;
    ScrollTrigger.create({
      trigger: card, start: 'top 12%', end: '+=1400', pin: matchMedia('(min-width: 900px)').matches, scrub: 0.4,
      onUpdate: (st) => {
        const day = 1 + st.progress * 15;
        head.style.left = fill.style.width = `${st.progress * 100}%`;
        let idx = 0;
        DAYS.forEach((d, k) => { if (day >= d[0]) idx = k; });
        if (idx !== last) {
          last = idx;
          setDay(view, idx);
          gsap.fromTo('.tl-card', { y: 10, opacity: 0.3 }, { y: 0, opacity: 1, duration: 0.35, overwrite: true });
        }
      },
    });

    // From task → To campaign: the left column is struck through as the right column fades in.
    const ctl = gsap.timeline({ scrollTrigger: { trigger: '.contrast-cols', start: 'top 75%', end: 'bottom 50%', scrub: true } });
    $$('.dont li', view).forEach((li, i) => {
      ctl.to(li.querySelector('.strike'), { '--strike': 1, color: '#9A9A9A', duration: 1 }, i);
      ctl.fromTo($$('.do li', view)[i], { opacity: 0, x: 24 }, { opacity: 1, x: 0, duration: 1 }, i + 0.3);
    });

    // Generic reveals.
    gsap.utils.toArray('.reveal, .sec-head, .stage-head, .faq-left, .try-left, .try-card').forEach((el) => {
      gsap.from(el, { y: 28, opacity: 0, duration: 0.7, ease: 'power2.out', scrollTrigger: { trigger: el, start: 'top 88%', once: true } });
    });
    gsap.from('.chip', { y: 10, opacity: 0, stagger: 0.04, duration: 0.4, scrollTrigger: { trigger: '.chips', start: 'top 90%', once: true } });
  }, view);
  return () => ctx.revert();
}
function resetDemo(rows) {
  rows.forEach((r) => {
    gsap.set(r, { opacity: 0, y: 14 });
    r.querySelector('.type').textContent = '';
    const s = r.querySelector('.status'); s.className = 'status pending'; s.textContent = 'Pending';
    gsap.set(r.querySelector('.seal'), { opacity: 0 });
  });
}
