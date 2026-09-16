// Renders the parts of the profile that only change when edited by hand:
// the signature header, the impact strip and the link buttons.
// Usage: node scripts/build-static.mjs
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { THEMES, FONT_FACE, FONT_STACK, esc, n, dotsPath, measure } from "./theme.mjs";
import { layout } from "./dotfont.mjs";

const out = (name, svg) => {
  mkdirSync(new URL("../assets/", import.meta.url), { recursive: true });
  writeFileSync(new URL(`../assets/${name}`, import.meta.url), svg);
};

// ── Header ─────────────────────────────────────────────────────────────────
// The "Tirth J." signature from the portfolio footer, dot by dot. Dots sweep
// in left to right, then a slow wave rolls through them; the full stop blinks
// like a cursor.
function header(t) {
  const W = 1280, H = 460, PAD = 56;
  const sig = JSON.parse(readFileSync(new URL("./signature.json", import.meta.url), "utf8"));
  const s = (W - PAD * 2) / sig.width;
  const top = H - PAD - sig.height * s;
  const r = n(sig.r * s * 0.9);
  const pts = sig.dots.map(([x, y]) => [PAD + x * s, top + y * s]);
  const pitch = 18.84 * s;
  const periodX = PAD + (sig.width - 57) * s - 1;

  const buckets = new Set();
  const circles = pts.map(([x, y]) => {
    const b = Math.round((x - PAD) / pitch);
    buckets.add(b);
    const cls = x >= periodX ? `d p b${b}` : `d b${b}`;
    return `<circle class="${cls}" cx="${n(x)}" cy="${n(y)}" r="${r}"/>`;
  });
  const delays = [...buckets]
    .sort((a, b) => a - b)
    .map((b) => `.b${b}{animation-delay:${n(b * 0.014)}s,${n(1.4 + b * 0.02)}s}`)
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-labelledby="t">
<title id="t">Tirth Jivani — Sr. Product Designer, Engineer &amp; Photographer, Bangalore</title>
<style>${FONT_FACE}
text{font-family:${FONT_STACK};font-size:22px}
.d{fill:${t.lit};transform-box:fill-box;transform-origin:center;animation:in .7s cubic-bezier(.2,.8,.2,1) both,wave 7s ease-in-out infinite}
.p{animation-name:in,blink;animation-duration:.7s,1.1s;animation-timing-function:ease-out,steps(1)}
@keyframes in{from{opacity:0;transform:scale(.1)}to{opacity:1;transform:scale(1)}}
@keyframes wave{0%,16%,100%{transform:scale(1)}8%{transform:scale(.45);opacity:.55}}
@keyframes blink{50%{opacity:.12}}
${delays}
@media (prefers-reduced-motion:reduce){.d{animation:none}}
</style>
<rect width="${W}" height="${H}" rx="22" fill="${t.card}" stroke="${t.stroke}" stroke-width="2"/>
<text x="${PAD}" y="${PAD + 22}" fill="${t.text}">Tirth Jivani</text>
<text x="${PAD}" y="${PAD + 56}" fill="${t.muted}">Sr. Product Designer, Engineer &amp; Photographer</text>
<text x="${W - PAD}" y="${PAD + 22}" fill="${t.text}" text-anchor="end">Bangalore, India</text>
<text x="${W - PAD}" y="${PAD + 56}" fill="${t.muted}" text-anchor="end">12.97° N · 77.59° E</text>
<path d="${dotsPath(pts, r)}" fill="${t.ghost}" opacity="${t.ghostOpacity}"/>
${circles.join("")}
</svg>`;
}

// ── Impact strip ───────────────────────────────────────────────────────────
const STATS = [
  ["$60M", "ARR, raised from $4M", "at Outbox Labs"],
  ["70%", "less UX complexity", "at ReachInbox"],
  ["10+", "SaaS products taken", "from zero to launch"],
  ["I/O", "presented at Google I/O", "ONDC × Google"],
];

function stats(t) {
  const W = 1280, H = 262, PAD = 56, P = 9.4, R = 3.5;
  const colW = (W - PAD * 2) / STATS.length;
  let body = "", delays = "";
  STATS.forEach(([value, l1, l2], i) => {
    const x0 = PAD + i * colW + (i ? 28 : 0);
    const { dots } = layout(value);
    dots.forEach(([c, row]) => {
      body += `<circle class="s k${i}_${c}" cx="${n(x0 + c * P + R)}" cy="${n(PAD + row * P + R)}" r="${R}"/>`;
    });
    const cols = new Set(dots.map(([c]) => c));
    cols.forEach((c) => (delays += `.k${i}_${c}{animation-delay:${n(0.25 + i * 0.35 + c * 0.03)}s}`));
    const ty = PAD + 6 * P + R * 2 + 52;
    body += `<text x="${x0}" y="${ty}" fill="${t.text}">${esc(l1)}</text>`;
    body += `<text x="${x0}" y="${ty + 32}" fill="${t.muted}">${esc(l2)}</text>`;
    if (i) body += `<line x1="${PAD + i * colW}" y1="${PAD}" x2="${PAD + i * colW}" y2="${H - PAD}" stroke="${t.stroke}" stroke-width="2"/>`;
  });

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-labelledby="t">
<title id="t">$4M → $60M ARR at Outbox Labs · 70% less UX complexity at ReachInbox · 10+ SaaS products zero to launch · Presented at Google I/O</title>
<style>${FONT_FACE}
text{font-family:${FONT_STACK};font-size:20px}
.s{fill:${t.lit};animation:on .05s steps(1) both}
@keyframes on{from{opacity:.08}to{opacity:1}}
${delays}
@media (prefers-reduced-motion:reduce){.s{animation:none}}
</style>
<rect width="${W}" height="${H}" rx="22" fill="${t.card}" stroke="${t.stroke}" stroke-width="2"/>
${body}
</svg>`;
}

// ── Buttons ────────────────────────────────────────────────────────────────
// Rendered at 2× so they stay crisp; the README halves them with height=.
export const BUTTONS = {
  wall: "Write on the wall ↗",
  site: "tirthjivani.in ↗",
  linkedin: "LinkedIn ↗",
  instagram: "Instagram ↗",
  email: "Email ↗",
};

function button(label, t, { primary = false } = {}) {
  const size = 26, H = 76, PADX = 34;
  const W = Math.ceil(measure(label, size) + PADX * 2);
  const fill = primary ? t.lit : t.card;
  const ink = primary ? t.card : t.text;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(label)}">
<style>${FONT_FACE}text{font-family:${FONT_STACK};font-size:${size}px}</style>
<rect x="1" y="1" width="${W - 2}" height="${H - 2}" rx="${(H - 2) / 2}" fill="${fill}" stroke="${primary ? fill : t.stroke}" stroke-width="2"/>
<text x="${W / 2}" y="${H / 2 + size * 0.36}" fill="${ink}" text-anchor="middle">${esc(label)}</text>
</svg>`;
}

for (const [name, t] of Object.entries(THEMES)) {
  out(`header-${name}.svg`, header(t));
  out(`stats-${name}.svg`, stats(t));
  for (const [id, label] of Object.entries(BUTTONS)) {
    out(`btn-${id}-${name}.svg`, button(label, t, { primary: id === "wall" }));
  }
}
console.log("built header, stats and buttons");
