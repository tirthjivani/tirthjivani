// One-off: turns the portfolio's pixel-letter SVGs (public/sigchars) into a
// list of dot centres, so build-header.mjs doesn't depend on that repo.
// Usage: node scripts/extract-signature.mjs "<portfolio>/public/sigchars"
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const dir = process.argv[2];
// Same order, widths and gaps as SIG_CHARS in the portfolio's about page.
const CHARS = [
  ["T.svg", 264, 24], ["I.svg", 38, 24], ["R.svg", 245, 24], ["T-1.svg", 264, 24],
  ["H.svg", 264, 140], ["J.svg", 227, 24], ["dot.svg", 57, 0],
];

const dots = [];
let x0 = 0;
for (const [file, w, gap] of CHARS) {
  const svg = readFileSync(join(dir, file), "utf8");
  const h = Number(svg.match(/viewBox="0 0 [\d.]+ ([\d.]+)"/)[1]);
  const d = svg.match(/ d="([^"]+)"/)[1];
  // Every subpath is one dot: its bbox centre is the dot centre.
  for (const sub of d.split(/(?=M)/)) {
    const nums = sub.match(/-?\d*\.?\d+/g).map(Number);
    const xs = nums.filter((_, i) => i % 2 === 0), ys = nums.filter((_, i) => i % 2 === 1);
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
    // Glyphs sit on a shared 358-unit baseline; the dot glyph is only 57 tall.
    const cy = (Math.min(...ys) + Math.max(...ys)) / 2 + (358 - h);
    dots.push([+(x0 + cx).toFixed(2), +cy.toFixed(2)]);
  }
  x0 += w + gap;
}
writeFileSync(new URL("./signature.json", import.meta.url),
  JSON.stringify({ width: x0, height: 358, r: 9.42, dots }));
console.log(`${dots.length} dots, ${x0}×358`);
