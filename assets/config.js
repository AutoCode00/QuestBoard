// The one place to set contract addresses, the Worker URL and links.
// Leave a contract empty to run in preview mode (a simulated QuestBoard saved in this browser).
export const MAINNET_CONTRACT_ADDRESS = '0x9B90D7938e15715A8D9FEF90188c0Bb246763eD1'; // ← QuestBoard on BOT Chain mainnet (also in README + footer)
export const TESTNET_CONTRACT_ADDRESS = ''; // ← used with ?net=testnet

export const CONFIG = {
  networks: {
    mainnet: { chainId: 677, name: 'BOT Chain', rpc: 'https://rpc.botchain.ai', explorer: 'https://scan.botchain.ai', contract: MAINNET_CONTRACT_ADDRESS },
    testnet: { chainId: 968, name: 'BOT Chain Testnet', rpc: 'https://rpc.bohr.life', explorer: 'https://scan.bohr.life', contract: TESTNET_CONTRACT_ADDRESS },
  },
  // Cloudflare Worker with /quest/ideas, /quest/review, /quest/reviews (see worker/).
  // Empty → quest ideas come from built-in templates and reviews are a basic rule check (both labelled in the UI).
  worker: '',
  links: {
    botchain: 'https://botchain.ai',
    docs: 'https://docs.botchain.ai',
    faucet: 'https://faucet.bohr.life',
    telegram: 'https://t.me/botchain_ai',
    email: 'mailto:hello@questboard.xyz',
    privacy: 'privacy',
    terms: 'terms',
  },
  storageKey: 'questboard',
};
