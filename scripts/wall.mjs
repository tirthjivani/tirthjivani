// The wall: visitors open an issue titled "wall: <message>" and the workflow
// in .github/workflows/wall.yml runs `node scripts/wall.mjs submit`, which
// validates the note, adds it to wall/wall.json and redraws the board. The
// newest notes each get a row on the board; everyone before them is listed
// underneath, so no one's note disappears.
//
//   node scripts/wall.mjs render   redraw from wall/wall.json
//   node scripts/wall.mjs submit   read TITLE / AUTHOR / ISSUE from env
import { readFileSync, writeFileSync, readdirSync, unlinkSync, appendFileSync } from "node:fs";
import { THEMES, FONT_FACE, FONT_STACK, esc, n } from "./theme.mjs";
import { layout, normalize } from "./dotfont.mjs";

const OWNER = "tirthjivani";
const REPO = "tirthjivani";
const RAW = `https://raw.githubusercontent.com/${OWNER}/${REPO}/master/assets`;
const MAX_LEN = 40;
const COOLDOWN_MIN = 10;
const ON_BOARD = 6;
const LISTED = 100;

const root = new URL("../", import.meta.url);
const DATA = new URL("wall/wall.json", root);
const README = new URL("README.md", root);
const ASSETS = new URL("assets/", root);

const load = () => JSON.parse(readFileSync(DATA, "utf8"));
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const fmtDate = (iso) => {
  const d = new Date(iso);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
};
const plural = (count, one, many) => `${count} ${count === 1 ? one : many}`;

// ── Avatars ────────────────────────────────────────────────────────────────
// SVGs shown through <img> can't load external images, so avatars are fetched
// and inlined. A failed fetch falls back to the person's initial.
async function avatar(login) {
  try {
    const res = await fetch(`https://github.com/${login}.png?size=96`, { signal: AbortSignal.timeout(8000) });
    const type = (res.headers.get("content-type") ?? "").split(";")[0];
    if (!res.ok || !type.startsWith("image/")) return null;
    return `data:${type};base64,${Buffer.from(await res.arrayBuffer()).toString("base64")}`;
  } catch {
    return null;
  }
}

// ── Board ──────────────────────────────────────────────────────────────────
// A departures board: one row per note, newest on top. Each row has its own
// dot-matrix field. Notes that fit are typed in once, left-aligned; longer ones
// scroll through their row like a ticker. The un-animated frame always shows
// the start of every note, for renderers that don't run SVG animation.
function board(notes, avatars, totals, t, dark) {
  const W = 1280, PAD = 56, P = 7.5, R = 2.7, RH = 90, AV = 48;
  const fx = PAD + 300;
  const cols = Math.floor((W - PAD - fx) / P);
  const fieldW = cols * P, fieldH = 7 * P;
  const y0 = PAD + 44;
  const inset = (RH - fieldH) / 2;
  const H = y0 + ON_BOARD * RH + 40;

  let css = "", rows = "", lit = "", clips = "";
  const typedCols = new Set();

  for (let i = 0; i < ON_BOARD; i++) {
    const note = notes[i];
    const ry = y0 + i * RH, fy = ry + inset, cy = ry + RH / 2;
    if (i) rows += `<line x1="${PAD}" y1="${ry}" x2="${W - PAD}" y2="${ry}" stroke="${t.stroke}" stroke-width="2"/>`;
    rows += `<rect x="${fx}" y="${fy}" width="${fieldW}" height="${fieldH}" fill="url(#g)"/>`;
    clips += `<rect x="${fx}" y="${fy}" width="${fieldW}" height="${fieldH}"/>`;

    if (!note) {
      rows += `<circle cx="${PAD + AV / 2}" cy="${cy}" r="${AV / 2 - 1}" fill="none" stroke="${t.muted}" stroke-opacity=".5" stroke-width="2" stroke-dasharray="3 5"/>`;
      rows += `<text x="${PAD + AV + 20}" y="${cy + 7}" fill="${t.muted}">Your note here</text>`;
      continue;
    }

    const src = avatars[note.author];
    rows += src
      ? `<image href="${src}" x="${PAD}" y="${cy - AV / 2}" width="${AV}" height="${AV}" clip-path="url(#av)" filter="url(#mono)" preserveAspectRatio="xMidYMid slice"/>`
      : `<circle cx="${PAD + AV / 2}" cy="${cy}" r="${AV / 2}" fill="${t.stroke}"/><text x="${PAD + AV / 2}" y="${cy + 8}" fill="${t.text}" text-anchor="middle">${esc(note.author[0].toUpperCase())}</text>`;
    const handle = note.author.length > 15 ? `${note.author.slice(0, 14)}…` : note.author;
    rows += `<text x="${PAD + AV + 20}" y="${cy - 5}" fill="${t.text}">@${esc(handle)}</text>`;
    rows += `<text x="${PAD + AV + 20}" y="${cy + 21}" fill="${t.muted}" font-size="18">${fmtDate(note.at)}${i === 0 ? ` · <tspan fill="${t.text}">new</tspan>` : ""}</text>`;

    const { cols: msgCols, dots } = layout(note.text);
    const scroll = msgCols > cols;
    const circles = dots
      .map(([c, r]) => {
        if (!scroll) typedCols.add(c);
        const cls = scroll ? "" : ` class="c c${c}"`;
        return `<circle${cls} cx="${n(fx + c * P + P / 2)}" cy="${n(fy + r * P + P / 2)}" r="${R}"/>`;
      })
      .join("");

    if (scroll) {
      const steps = cols + msgCols;
      const dur = n(steps * 0.07);
      css += `.s${i}{animation:t${i} ${dur}s steps(${steps}) ${n(-(cols / steps) * dur)}s infinite}`;
      css += `@keyframes t${i}{from{transform:translateX(${n(cols * P)}px)}to{transform:translateX(${n(-msgCols * P)}px)}}\n`;
      lit += `<g class="s${i}">${circles}</g>`;
    } else {
      css += `.r${i}{--d:${n(0.2 + i * 0.3)}s}`;
      lit += `<g class="r${i}">${circles}</g>`;
    }
  }
  css += `\n.c{animation:on .01s steps(1) both}@keyframes on{from{opacity:0}to{opacity:1}}\n`;
  css += [...typedCols].map((c) => `.c${c}{animation-delay:calc(var(--d) + ${n(c * 0.012)}s)}`).join("");

  const title = notes.map((m) => `“${m.text}” — @${m.author}`).join(" · ");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-labelledby="t">
<title id="t">${esc(title)}</title>
<style>${FONT_FACE}
text{font-family:${FONT_STACK};font-size:22px}
${css}
@media (prefers-reduced-motion:reduce){.c,[class^="s"]{animation:none}}
</style>
<defs>
<pattern id="g" x="${fx}" y="${y0 + inset}" width="${P}" height="${P}" patternUnits="userSpaceOnUse"><circle cx="${P / 2}" cy="${P / 2}" r="${R}" fill="${t.unlit}"/></pattern>
<clipPath id="k">${clips}</clipPath>
<clipPath id="av" clipPathUnits="objectBoundingBox"><circle cx=".5" cy=".5" r=".5"/></clipPath>
<filter id="mono"><feColorMatrix type="saturate" values="0"/></filter>
${dark ? `<filter id="glow" filterUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${H}"><feGaussianBlur stdDeviation="3" result="b"/><feComponentTransfer in="b" result="s"><feFuncA type="linear" slope=".5"/></feComponentTransfer><feMerge><feMergeNode in="s"/><feMergeNode in="SourceGraphic"/></feMerge></filter>` : ""}
</defs>
<rect width="${W}" height="${H}" rx="22" fill="${t.card}" stroke="${t.stroke}" stroke-width="2"/>
<text x="${PAD}" y="${PAD + 18}" fill="${t.text}">The Wall</text>
<text x="${W - PAD}" y="${PAD + 18}" fill="${t.muted}" text-anchor="end">${plural(totals.notes, "note", "notes")} from ${plural(totals.people, "person", "people")}</text>
${rows}
<g${dark ? ' filter="url(#glow)"' : ""} fill="${t.lit}"><g clip-path="url(#k)">${lit}</g></g>
</svg>`;
}

// ── README ─────────────────────────────────────────────────────────────────
// Opens a new issue with the "wall: " title and instructions prefilled.
const WRITE_URL = "https://github.com/tirthjivani/tirthjivani/issues/new?title=wall%3A%20&body=%F0%9F%91%8B%20Thanks%20for%20stopping%20by%21%0A%0A%2A%2APut%20your%20message%20in%20the%20title%20above%2A%2A%2C%20after%20%60wall%3A%60%20%E2%80%94%20for%20example%20%60wall%3A%20hello%20from%20Berlin%60.%0A%0A-%20Letters%2C%20numbers%20and%20basic%20punctuation%2C%20up%20to%2040%20characters%20%28%60%3C3%60%20becomes%20a%20%E2%99%A5%29%0A-%20Hit%20%2A%2ACreate%2A%2A.%20A%20GitHub%20Action%20paints%20it%20onto%20the%20board%20in%20about%20a%20minute%20and%20closes%20this%20issue.%0A-%20It%27s%20public%20and%20shows%20up%20on%20my%20profile%2C%20so%20keep%20it%20kind.%0A";

// The <a> goes inside <picture>: GitHub hoists an <img> out of a
// <picture> that sits inside a link, which breaks both the link and theming.
const picture = (file, alt, href, attrs = "") =>
  `<picture><source media="(prefers-color-scheme: dark)" srcset="${RAW}/${file}-dark.svg"><a href="${href}"><img alt="${esc(alt)}" src="${RAW}/${file}-light.svg"${attrs}></a></picture>`;

function replaceBlock(md, name, body) {
  const re = new RegExp(`(<!-- ${name}:start -->)[\\s\\S]*?(<!-- ${name}:end -->)`);
  if (!re.test(md)) throw new Error(`README is missing the ${name} markers`);
  return md.replace(re, `$1\n${body}\n$2`);
}

export async function render() {
  const { messages } = load();
  const newest = [...messages].reverse();
  const onBoard = newest.slice(0, ON_BOARD);
  const totals = { notes: messages.length, people: new Set(messages.map((m) => m.author)).size };
  const authors = [...new Set(onBoard.map((m) => m.author))];
  const avatars = Object.fromEntries(await Promise.all(authors.map(async (a) => [a, await avatar(a)])));

  // A fresh filename per note sidesteps GitHub's image cache.
  const file = `wall-${String(messages.length).padStart(4, "0")}`;
  for (const f of readdirSync(ASSETS)) if (/^wall-\d+-(dark|light)\.svg$/.test(f)) unlinkSync(new URL(f, ASSETS));
  for (const [name, t] of Object.entries(THEMES)) {
    writeFileSync(new URL(`${file}-${name}.svg`, ASSETS), board(onBoard, avatars, totals, t, name === "dark"));
  }

  const earlier = newest.slice(ON_BOARD);
  const rows = earlier
    .slice(0, LISTED)
    .map((m) => `<tr><td><code>${esc(m.text)}</code></td><td><a href="https://github.com/${m.author}">@${m.author}</a></td><td>${fmtDate(m.at)}</td></tr>`)
    .join("\n");
  const more = earlier.length > LISTED ? `\n<p>…and ${earlier.length - LISTED} more in <a href="wall/wall.json">wall.json</a>.</p>` : "";
  const history = earlier.length
    ? `<details>\n<summary>${plural(earlier.length, "earlier note", "earlier notes")}</summary>\n<br>\n<table>\n${rows}\n</table>${more}\n</details>`
    : "";

  let md = readFileSync(README, "utf8");
  md = replaceBlock(md, "wall", picture(file, onBoard.map((m) => `“${m.text}” — @${m.author}`).join(" · "), WRITE_URL, ' width="100%"'));
  md = replaceBlock(md, "wall-history", history);
  writeFileSync(README, md);
}

// ── Submissions ────────────────────────────────────────────────────────────
const BLOCKED = readFileSync(new URL("./blocklist.txt", import.meta.url), "utf8")
  .split("\n")
  .map((w) => w.trim().toUpperCase())
  .filter((w) => w && !w.startsWith("#"));

function check(raw, author, messages) {
  const text = normalize(raw);
  if (!text) return { error: "I couldn't find any characters I can draw. The board does letters, numbers and basic punctuation (`! ? . , ' - : & + # @ ♥`)." };
  if (text.length > MAX_LEN) return { error: `That's ${text.length} characters and the board fits ${MAX_LEN}. Try a shorter one!` };
  // Compare plain words, punctuation-stripped ones ("F.U.C.K") and leetspeak.
  const deLeet = (s) => s.replace(/[!1]/g, "I").replace(/[$5]/g, "S").replace(/0/g, "O").replace(/@/g, "A").replace(/3/g, "E");
  const squashed = deLeet(text).replace(/[^A-Z]/g, "");
  const variants = [text, deLeet(text)].flatMap((v) => [v, v.replace(/(?<=\b[A-Z0-9]) (?=[A-Z0-9]\b)/g, "")]);
  const words = variants.flatMap((v) => [...v.split(/[^A-Z0-9]+/), ...v.split(" ").map((w) => w.replace(/[^A-Z0-9]/g, ""))]);
  if (BLOCKED.some((w) => words.includes(w) || (w.length > 4 && squashed.includes(w)))) {
    return { error: "This message didn't pass the filter. Keep it kind." };
  }
  if (/HTTPS?|WWW|\b[A-Z0-9-]+\.(COM|NET|ORG|IO|AI|CO|APP|DEV|XYZ|LY|GG|ME|SH)\b/.test(text)) {
    return { error: "Links aren't allowed on the wall." };
  }
  if (messages.at(-1)?.text === text) return { error: "That's already on the wall 🙂" };
  const last = messages.findLast((m) => m.author === author);
  if (author !== OWNER && last && Date.now() - Date.parse(last.at) < COOLDOWN_MIN * 60_000) {
    return { error: `You posted a few minutes ago. Give someone else a turn and try again in ${COOLDOWN_MIN} minutes.` };
  }
  return { text };
}

async function submit() {
  const { TITLE = "", AUTHOR = "", ISSUE = "", GITHUB_OUTPUT, RUNNER_TEMP = "." } = process.env;
  const out = (k, v) => GITHUB_OUTPUT && appendFileSync(GITHUB_OUTPUT, `${k}=${v}\n`);
  const reply = (body) => writeFileSync(`${RUNNER_TEMP}/wall-comment.md`, body);

  if (!/^[A-Za-z0-9-]{1,39}$/.test(AUTHOR)) throw new Error(`unexpected author: ${AUTHOR}`);
  const data = load();
  const raw = TITLE.replace(/^\s*wall\s*:/i, "");
  const result = check(raw, AUTHOR, data.messages);

  if (result.error) {
    out("status", "rejected");
    reply(`Hey @${AUTHOR}, I couldn't put that one up. ${result.error}\n\nOpen a new issue to try again.`);
    console.log(`rejected: ${result.error}`);
    return;
  }

  data.messages.push({ text: result.text, author: AUTHOR, issue: Number(ISSUE) || null, at: new Date().toISOString() });
  writeFileSync(DATA, JSON.stringify(data, null, 2) + "\n");
  await render();
  out("status", "ok");
  out("number", data.messages.length);
  reply(
    `Thanks @${AUTHOR}! **\`${result.text}\`** is now at the top of [the wall](https://github.com/${OWNER}), note No. ${data.messages.length} ♥\n\n` +
      `<sub>GitHub caches profile images, so it may take a minute to show up.</sub>`,
  );
  console.log(`painted #${data.messages.length}: ${result.text}`);
}

const cmd = process.argv[2];
if (cmd === "render") await render();
else if (cmd === "submit") await submit();
else if (cmd) throw new Error(`unknown command: ${cmd}`);
