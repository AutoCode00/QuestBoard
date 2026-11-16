// Scout 🦊 — a small fox ranger in a rust scarf with a rolled map and a little lantern. Our own SVG.
// scout({ pose: 'map' | 'magnify' | 'seal' | 'flag' | 'sit', size }) → SVG string.
const C = { line: '#2B1A12', fur: '#D9773F', furDark: '#B85A2A', cream: '#FBF3E4', rust: '#7D3A26', scarf: '#9C3F24', paper: '#F3E6C8', glow: '#FFC94D', dark: '#3A2418' };

export function scout({ pose = 'map', size = 160, cls = '' } = {}) {
  const props = {
    map: `<g class="sc-map"><rect x="74" y="150" width="52" height="24" rx="5" fill="${C.paper}" stroke="${C.line}" stroke-width="2.4"/><path d="M84 157h20M84 164h30M84 170h14" stroke="${C.rust}" stroke-width="1.8" stroke-linecap="round" stroke-dasharray="3 3"/><circle cx="117" cy="158" r="3" fill="${C.scarf}"/><ellipse cx="72" cy="162" rx="7" ry="13" fill="${C.paper}" stroke="${C.line}" stroke-width="2.4"/><ellipse cx="128" cy="162" rx="7" ry="13" fill="${C.paper}" stroke="${C.line}" stroke-width="2.4"/></g>
      <circle cx="70" cy="162" r="7" fill="${C.dark}"/><circle cx="130" cy="162" r="7" fill="${C.dark}"/>`,
    magnify: `<g class="sc-mag"><path d="M136 150 L158 118" stroke="${C.dark}" stroke-width="7" stroke-linecap="round"/><circle cx="166" cy="104" r="17" fill="#E9F6FF" fill-opacity=".7" stroke="${C.line}" stroke-width="3.5"/><path d="M158 98a10 10 0 0 1 8-6" stroke="#fff" stroke-width="3" stroke-linecap="round"/></g><circle cx="134" cy="152" r="7" fill="${C.dark}"/><circle cx="72" cy="160" r="7" fill="${C.dark}"/>`,
    seal: `<g class="sc-seal"><circle cx="146" cy="150" r="17" fill="#B23A2E" stroke="${C.line}" stroke-width="2.4"/><circle cx="146" cy="150" r="11" fill="none" stroke="#E7816F" stroke-width="1.6"/><path d="M146 142l2.4 5 5.4.6-4 3.6 1.2 5.4-5-2.8-5 2.8 1.2-5.4-4-3.6 5.4-.6z" fill="#F7D3C9"/></g><circle cx="132" cy="152" r="7" fill="${C.dark}"/><circle cx="72" cy="160" r="7" fill="${C.dark}"/>`,
    flag: `<g class="sc-flag"><path d="M140 196 V96" stroke="${C.dark}" stroke-width="4" stroke-linecap="round"/><path class="sc-flag-cloth" d="M141 98 Q160 92 176 100 Q162 108 176 118 Q160 112 141 118Z" fill="${C.scarf}" stroke="${C.line}" stroke-width="2.2"/></g><circle cx="138" cy="150" r="7" fill="${C.dark}"/><circle cx="72" cy="160" r="7" fill="${C.dark}"/>`,
    sit: `<g class="sc-scroll"><rect x="76" y="150" width="48" height="20" rx="4" fill="${C.paper}" stroke="${C.line}" stroke-width="2.2"/><path d="M84 157h32M84 163h22" stroke="${C.rust}" stroke-width="1.6" stroke-linecap="round"/></g><circle cx="74" cy="160" r="7" fill="${C.dark}"/><circle cx="126" cy="160" r="7" fill="${C.dark}"/>`,
  }[pose] || '';
  const lantern = pose === 'map' || pose === 'sit'
    ? `<g class="sc-lantern"><path d="M40 168 v10" stroke="${C.dark}" stroke-width="2"/><rect x="31" y="178" width="18" height="22" rx="4" fill="${C.glow}" stroke="${C.line}" stroke-width="2.2"/><rect x="29" y="175" width="22" height="5" rx="2" fill="${C.dark}"/><circle class="sc-glow" cx="40" cy="189" r="15" fill="${C.glow}" opacity=".28"/></g>`
    : '';
  return `<svg class="scout ${cls}" viewBox="0 0 200 240" width="${size}" height="${size * 1.2}" role="img" aria-label="Scout the fox" xmlns="http://www.w3.org/2000/svg">
  <g class="sc-tail"><path d="M124 196 Q186 206 180 140 Q176 110 156 118 Q170 156 124 166Z" fill="${C.fur}" stroke="${C.line}" stroke-width="2.6" stroke-linejoin="round"/><path d="M176 132 Q174 112 158 118 Q164 128 166 140 Q172 138 176 132Z" fill="${C.cream}" stroke="${C.line}" stroke-width="2.2"/></g>
  <path d="M68 122 Q60 172 70 204 L130 204 Q140 172 132 122Z" fill="${C.fur}" stroke="${C.line}" stroke-width="2.6" stroke-linejoin="round"/>
  <ellipse cx="100" cy="174" rx="20" ry="28" fill="${C.cream}"/>
  <rect x="74" y="198" width="22" height="20" rx="9" fill="${C.dark}"/><rect x="104" y="198" width="22" height="20" rx="9" fill="${C.dark}"/>
  <g class="sc-head">
    <path d="M60 66 L68 14 L96 46Z" fill="${C.fur}" stroke="${C.line}" stroke-width="2.6" stroke-linejoin="round"/><path d="M67 54 L71 26 L86 44Z" fill="${C.dark}"/>
    <path d="M140 66 L132 14 L104 46Z" fill="${C.fur}" stroke="${C.line}" stroke-width="2.6" stroke-linejoin="round"/><path d="M133 54 L129 26 L114 44Z" fill="${C.dark}"/>
    <path d="M56 70 Q58 40 100 42 Q142 40 144 70 Q142 100 100 126 Q58 100 56 70Z" fill="${C.fur}" stroke="${C.line}" stroke-width="2.6" stroke-linejoin="round"/>
    <path d="M60 80 Q82 76 100 98 Q118 76 140 80 Q130 110 100 126 Q70 110 60 80Z" fill="${C.cream}"/>
    <g class="sc-eyes"><ellipse cx="82" cy="78" rx="5" ry="6" fill="${C.line}"/><ellipse cx="118" cy="78" rx="5" ry="6" fill="${C.line}"/><circle cx="84" cy="76" r="1.8" fill="#fff"/><circle cx="120" cy="76" r="1.8" fill="#fff"/></g>
    <ellipse cx="100" cy="106" rx="7" ry="5" fill="${C.line}"/><path d="M94 114 Q100 119 106 114" stroke="${C.line}" stroke-width="2" fill="none" stroke-linecap="round"/>
    <ellipse cx="72" cy="94" rx="6" ry="3.5" fill="#F0A98A" opacity=".55"/><ellipse cx="128" cy="94" rx="6" ry="3.5" fill="#F0A98A" opacity=".55"/>
  </g>
  <path d="M64 120 Q100 140 136 120 L138 133 Q100 152 62 133Z" fill="${C.scarf}" stroke="${C.line}" stroke-width="2.4" stroke-linejoin="round"/>
  <path class="sc-scarf-tail" d="M78 132 L70 166 L86 162 L90 136Z" fill="${C.scarf}" stroke="${C.line}" stroke-width="2.4" stroke-linejoin="round"/>
  ${lantern}${props}
</svg>`;
}

/** The QuestBoard mark: Scout's head in his rust scarf. Same art as the favicon. */
export const FOX_HEAD = `<path d="M60 66 L68 14 L96 46Z" fill="#D9773F" stroke="#2B1A12" stroke-width="5" stroke-linejoin="round"/><path d="M67 54 L71 26 L86 44Z" fill="#3A2418"/><path d="M140 66 L132 14 L104 46Z" fill="#D9773F" stroke="#2B1A12" stroke-width="5" stroke-linejoin="round"/><path d="M133 54 L129 26 L114 44Z" fill="#3A2418"/><path d="M64 118 Q100 138 136 118 L138 130 Q100 150 62 130Z" fill="#9C3F24" stroke="#2B1A12" stroke-width="5" stroke-linejoin="round"/><path d="M56 70 Q58 40 100 42 Q142 40 144 70 Q142 100 100 124 Q58 100 56 70Z" fill="#D9773F" stroke="#2B1A12" stroke-width="5" stroke-linejoin="round"/><path d="M61 80 Q82 76 100 98 Q118 76 139 80 Q130 108 100 122 Q70 108 61 80Z" fill="#FBF3E4"/><ellipse cx="82" cy="78" rx="6" ry="7" fill="#2B1A12"/><ellipse cx="118" cy="78" rx="6" ry="7" fill="#2B1A12"/><circle cx="84" cy="75.5" r="2.2" fill="#fff"/><circle cx="120" cy="75.5" r="2.2" fill="#fff"/><ellipse cx="100" cy="105" rx="8" ry="6" fill="#2B1A12"/>`;
export function logoMark(size = 28) {
  return `<svg class="logo-mark" viewBox="38 6 124 146" width="${size}" height="${Math.round(size * 146 / 124)}" aria-hidden="true">${FOX_HEAD}</svg>`;
}
