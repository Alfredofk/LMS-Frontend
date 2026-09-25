/*
  Every coloured utility that needs a dark rule has one.

  The dark theme overrides pale tints and dark text class by class (see
  scripts/build-dark-theme.mjs for why). A class added to a screen after the
  stylesheet was generated would stay light in dark mode — a pale pink badge on
  a near-black card — and nothing would say so. This does.

  When it fails: run `node scripts/build-dark-theme.mjs`, then look at the
  screen in dark mode.
*/
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const css = fs.readFileSync(path.join(ROOT, 'theme/dark.css'), 'utf8');

const sources = [];
(function walk(dir) {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) walk(p);
    else if (/\.(jsx?|mjs)$/.test(f) && !/\.test\./.test(f)) sources.push(fs.readFileSync(p, 'utf8'));
  }
})(ROOT);
const all = sources.join('\n');

const HUE = '(?:red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)';
const found = (re) => [...new Set([...all.matchAll(re)].map((m) => m[0]))];

/* The escaped selector a class becomes in CSS: `hover:bg-red-50/60` → `hover\:bg-red-50\/60`,
   `bg-[#FEF5E7]` → `bg-\[\#FEF5E7\]`. */
const selectorOf = (cls) => cls.replace(/([:/[\]#])/g, '\\$1');

/* Same classification as the generator: which hex colours need a dark rule. */
const luminance = (hex) => {
  const h = hex.length === 4 ? hex.slice(1).split('').map((c) => c + c).join('') : hex.slice(1, 7);
  const [r, g, b] = [0, 2, 4]
    .map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

/*
  The class's own selector, whole — followed by a space, comma, brace or a
  pseudo-class, never by more of a longer name. A bare `includes('.bg-red-50')`
  is satisfied by `.bg-red-50\/30` alone, which is how this test first passed
  with the rule for `bg-red-50` deleted.
*/
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const hasRule = (cls) => new RegExp(`\\.${escapeRe(selectorOf(cls))}(?=[\\s,{:])`).test(css);

describe('the dark theme covers what the app uses', () => {
  it('finds classes to check — a scan that matches nothing proves nothing', () => {
    expect(found(new RegExp(`\\bbg-${HUE}-50\\b`, 'g')).length).toBeGreaterThan(0);
  });

  it.each([
    ['pale backgrounds', new RegExp(`(?:hover:|group-hover:)?bg-${HUE}-(?:50|100|200|300)(?:/\\d+)?(?![\\d])`, 'g')],
    ['pale borders', new RegExp(`(?:hover:|group-hover:)?border-${HUE}-(?:50|100|200|300)(?![\\d/])`, 'g')],
    ['dark text', new RegExp(`(?:hover:|group-hover:)?text-${HUE}-(?:600|700|800|900)(?:/\\d+)?(?![\\d])`, 'g')],
  ])('%s', (_label, re) => {
    const missing = found(re).filter((cls) => !hasRule(cls));
    expect(missing).toEqual([]);
  });

  it('darkens pale hex backgrounds and borders, and lightens dark hex text', () => {
    const hex = found(/(?:hover:|group-hover:)?(?:bg|border|text)-\[#[0-9A-Fa-f]{3,8}\]/g);
    expect(hex.length).toBeGreaterThan(0);
    const needsRule = hex.filter((cls) => {
      const [, kind, value] = cls.match(/(bg|border|text)-\[(#[0-9A-Fa-f]+)\]$/);
      const lum = luminance(value);
      return (kind === 'bg' && lum > 0.7) || (kind === 'border' && lum > 0.6) || (kind === 'text' && lum < 0.35);
    });
    expect(needsRule.filter((cls) => !hasRule(cls))).toEqual([]);
  });

  it('keeps every modal backdrop dark rather than mirroring it to white', () => {
    const backdrops = found(/\bbg-slate-900\/\d+/g);
    const missing = backdrops.filter((cls) => !hasRule(cls));
    expect(missing).toEqual([]);
  });

  it('turns surfaces dark without touching text-white on purple buttons', () => {
    expect(css).toMatch(/\.bg-white[,\s]/);
    expect(css).not.toMatch(/--color-white\s*:/);
  });
});
