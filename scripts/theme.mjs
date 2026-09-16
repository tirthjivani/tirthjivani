// Shared palette + helpers. Colours follow the portfolio's tokens
// (--bg / --fg / --tile-bg / --cs-tile in app/globals.css).
import { readFileSync } from "node:fs";

export const THEMES = {
  dark: {
    card: "#000000",
    stroke: "#1f1f1f",
    lit: "#ffffff",
    unlit: "#1a1a1a",
    ghost: "#ffffff",
    ghostOpacity: 0.07,
    muted: "#6e6e6e",
    text: "#ffffff",
  },
  light: {
    card: "#f4f4f2",
    stroke: "#e6e6e2",
    lit: "#0a0a0a",
    unlit: "#e0e0db",
    ghost: "#000000",
    ghostOpacity: 0.06,
    muted: "#8c8c87",
    text: "#0a0a0a",
  },
};

const fontData = readFileSync(new URL("./geist-pixel.woff2", import.meta.url)).toString("base64");

// SVGs rendered through <img> can't reach external fonts, so the (subset)
// Geist Pixel face is inlined into every file that sets type.
export const FONT_FACE = `@font-face{font-family:"Geist Pixel";src:url(data:font/woff2;base64,${fontData}) format("woff2")}`;
export const FONT_STACK = `"Geist Pixel",ui-monospace,SFMono-Regular,Menlo,monospace`;

const metrics = JSON.parse(readFileSync(new URL("./geist-pixel-metrics.json", import.meta.url), "utf8"));

/** Width of `text` set in Geist Pixel at `size` px. */
export const measure = (text, size, tracking = 0) =>
  [...text].reduce((w, ch) => w + ((metrics.advance[ch] ?? 600) / metrics.unitsPerEm) * size + tracking, 0);

export const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

export const n = (v) => +v.toFixed(2);

/** A ring of circles as one path — cheap for large static dot fields. */
export const dotsPath = (points, r) =>
  points.map(([x, y]) => `M${n(x - r)} ${n(y)}a${r} ${r} 0 1 0 ${n(2 * r)} 0a${r} ${r} 0 1 0 ${n(-2 * r)} 0`).join("");
