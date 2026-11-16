# QuestBoard 🦊

**Turn your community into your marketing team.** Post quests, let members submit proof, let AI check every submission — and keep the points and leaderboard on BOT Chain.

*Free (gas only). No tokens, no payments, no accounts. AI only recommends: the season owner signs every approval.*

## Status

| | |
|---|---|
| Live site | _not published yet_ (GitHub Pages + custom domain) |
| QuestBoard (BOT Chain mainnet, chain ID 677) | **[`0x9B90D7938e15715A8D9FEF90188c0Bb246763eD1`](https://scan.botchain.ai/address/0x9B90D7938e15715A8D9FEF90188c0Bb246763eD1)** (deploy block 30500579, tx [`0xefbb8f26…15e7d`](https://scan.botchain.ai/tx/0xefbb8f2636426be4b606363b12d9ab3ccb30d51ffa6ef234201c4d0c88715e7d)). Set in `MAINNET_CONTRACT_ADDRESS` in `assets/config.js` and `CONTRACT_677` in `worker/wrangler.toml`; the footer and **View on explorer** use it. Bytecode matches `contracts/QuestBoard.sol` exactly (see Contract). Not verified on the explorer yet. |
| QuestBoard (testnet, chain ID 968) | _not deployed yet_ (`TESTNET_CONTRACT_ADDRESS`, used with `?net=testnet`) |
| Worker (AI ideas + review) | _not deployed yet_ → `worker/`, then set `CONFIG.worker` in `assets/config.js` |

The site reads and writes the mainnet contract. With `?preview` (or with no contract address) it runs in **preview mode** and says so on screen: seasons, quests, submissions and points are saved in this browser only, and the wallet button toggles between two local preview wallets so you can try both the owner and member side without MetaMask. Without a Worker, quest ideas come from built-in templates and reviews are a basic rule check — both labelled in the UI.

## What's inside

| Route | What it is |
|---|---|
| `/` | Website after the supaste.com layout: black notch navbar, sky-blue hero ("Give every fan / *a quest worth sharing.*") with Scout walking in and unrolling the quest board over the hills, the 1 Post · 2 Check · 3 Reward loop (DrawSVG path), statement lines, the live-looking review-queue panel (rows arrive, verdicts type in, wax-seal approvals, points tick up), 01 / 03 tabs (Fair · Fast · On-chain), 10-card capability grid, the pinned Day 1–16 example-season scrubber, "Ready to try it?", FAQs, "From task → To campaign", and the white dot-matrix footer (QUESTS / PROOF ticker, grayscale photo, contract + **View on explorer**, live on-chain stats, BOT Chain link → botchain.ai, dotted Scout with blue live dots, mono legal bar, and a giant dotted QUESTBOARD wordmark whose dots scatter around a ring cursor — `assets/dotfx.js`). |
| `/app` | Owner: seasons list · Step 1 create season (tx) · Step 2 ✨ Suggest quests / write your own, publish (tx) · review queue table (Member · Quest · Proof · AI verdict · Status · Submitted) with detail drawer, "Select AI-valid", batch approve/reject (auto-split into 100s), swipe-to-approve on mobile · season stats (submissions/day chart, approval rate, top quests, top members) |
| `/q` | Browse seasons |
| `/q/:seasonId` | Member quest page: countdown, quest cards with status (Pending review / Approved +N ✓ / Rejected + AI note / Completed), submit bottom sheet (tx), sticky leaderboard with my points + badges (Bronze 100 · Silver 300 · Gold 700 · Season Champion) |

```
index.html · 404.html (GitHub Pages SPA redirect) · deploy.html (deploy QuestBoard from MetaMask)
assets/
  config.js   ← contract addresses, Worker URL, links (the one place to edit)
  logic.js    pure logic shared with the Worker: proof normalisation, badges, ranking, batching, offline fallbacks
  chain.js    MetaMask, BOT Chain switch/add, QuestBoard (live + preview)
  ai.js       Worker client (ideas, reviews, cached verdicts)
  scout.js    Scout 🦊 SVG + logo mark
  main.js · home.js · app.js · quest.js · ui.js · styles.css
contracts/QuestBoard.sol
worker/       Cloudflare Worker: /quest/ideas · /quest/review · /quest/reviews
tools/        compile, tests, dev server
build/        ABI + bytecode + standard JSON (for explorer verification)
```

## Design

Follows supaste.com: **Montserrat** for UI and headlines, *Instrument Serif* italic for the second headline line, Geist Mono for numbers; the hero, quest-page header and the review-window scenery use the landscape photo `assets/hero.webp` (52 KB, converted from `hero.png`); the logo and favicon are Scout's fox head; capability cards use Microsoft Fluent Emoji 3D icons (MIT) as 160px WebP in `assets/icons/`; type scale 80 / 48 / 40 px with tight negative tracking; sky-gradient hero, white page, `#F7F7F7` stage cards with 30px radius, black 52px buttons with 20px radius; white footer with a blue `#1F3BFF` accent. Scout (our own fox ranger) brings the warm rust/clay accent. GSAP 3.13 (ScrollTrigger, SplitText, DrawSVG); `prefers-reduced-motion` is respected.

## Contract

`contracts/QuestBoard.sol` — Solidity ^0.8.20, no owner, no tokens.

**Mainnet deployment** was compiled in Remix with **solc 0.8.34 · optimizer on, 200 runs · evmVersion osaka (default) · file name `QuestBoard.sol`** — runtime 10,399 bytes, a byte-for-byte match including metadata. For explorer verification use `build/QuestBoard.mainnet.standard-input.json` (Standard JSON input, compiler v0.8.34). The local test build (`tools/compile.mjs`) uses solc 0.8.20 · paris and passes the same tests.

- `createSeason(name, cid, start, end)` — `cid` holds a compact JSON note `{d, l, r}` (description, link, reward)
- `addQuests(seasonId, {title, points, proofType, maxPerWallet}[])` — season owner, points 10–500, up to 20 per call / 60 per season; rules are packed in the title as `Title — rules`
- `setQuestActive(questId, bool)`
- `submit(questId, proof)` — during the season, unique `keccak256(proof)` (the app normalises links first), one pending per quest per wallet, max completions per wallet
- `review(ids[], approve[])` — season owner only, up to 100 per tx; approved → points
- Views: `getSeason`, `getQuest`, `getSubmission`, `questsOf`, `submissionsOf(seasonId, from, count)`, `leaderboard`, `pointsOf`, `seasonsOf(owner)`, `stats()` (footer numbers)
- Events: `SeasonCreated`, `QuestAdded`, `QuestActive`, `Submitted`, `Reviewed(id, approved, points)`

```bash
npm --prefix tools install
node tools/compile.mjs && node tools/test-contract.mjs && node tools/test-logic.mjs
```

## Worker

```bash
cd worker && npm install
npx wrangler kv namespace create REVIEWS   # paste the id into wrangler.toml
npx wrangler deploy
```

Set `ALLOWED_ORIGINS` (your domain) and `CONTRACT_677` in `wrangler.toml`. The Worker reads each submission **from the chain** before reviewing it (so nobody can store a fake verdict for someone else's proof), fetches the proof page when it can (blogs, forums, Medium, public Telegram posts via `?embed=1`), asks the model for `{verdict, reason, confidence}` and keeps it in KV for 180 days. Default model: Cloudflare Workers AI (Llama 3.3 70B); set `PROVIDER = "anthropic"` + `ANTHROPIC_API_KEY` to use Claude.

## Run locally

```bash
node tools/serve.mjs 4632
```
