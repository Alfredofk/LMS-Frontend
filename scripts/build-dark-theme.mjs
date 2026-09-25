/*
  Writes src/theme/dark.css — the dark palette for the signed-in app.

  Run it after adding a coloured utility the dark theme does not cover yet:

      node scripts/build-dark-theme.mjs

  src/theme/dark.test.js fails when a class in src/ has no dark rule, so the
  suite says when this needs running; nobody has to remember.

  ## How the dark theme works, and why it is two mechanisms

  The app writes colours as plain utilities — `bg-white`, `text-slate-800`,
  `bg-red-50` — thousands of them across 84 files, none with a `dark:` variant.
  Rewriting every one was the alternative, and the owner chose not to (2026-09-24).

  1. **Slate, canvas and the brand tint flip through variables.** Tailwind 4
     utilities read `var(--color-slate-500)` and so on, so redefining the scale
     under `:root[data-theme="dark"]` turns every slate utility at once. The
     scale is mirrored: text shades become light, surface shades become dark.

  2. **Everything else is overridden per class**, because flipping a variable
     flips every use of it. `violet-100` is a pale tint behind a badge on one
     screen and pale text on a purple banner on another; `rose-700` is dark text
     in one place and a button's hover background in another. So pale tints
     (bg/border 50–300) and dark text (text 600–900) are rewritten as classes,
     and the variables they share are left alone. `bg-white` is a class rule too:
     redefining `--color-white` would also turn every `text-white` on a purple
     button dark.

  Values are literal, read from Tailwind's own theme.css, not `var(...)`:
  Tailwind 4 only emits the theme variables that some utility uses, so a
  reference to an unused one would resolve to nothing.

  Rules are unlayered on purpose: Tailwind's utilities live in @layer utilities,
  and an unlayered rule beats a layered one whatever its specificity.
*/
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')), '..');
const THEME = path.join(ROOT, 'node_modules/tailwindcss/theme.css');
const OUT = path.join(ROOT, 'src/theme/dark.css');

const theme = fs.readFileSync(THEME, 'utf8');
const value = (name) => {
  const m = theme.match(new RegExp(`--color-${name}:\\s*([^;]+);`));
  if (!m) throw new Error(`no --color-${name} in theme.css`);
  return m[1].trim();
};

/*
  The dark palette's lightness, in one place. "Redup" — dim, not black — the
  owner's choice (2026-09-24) after students had to turn their screens up to full
  brightness to read the first version, whose canvas sat at L 12.9% and cards at
  18.2%. Surfaces rose by about twelve points, and every grey used as text rose
  with them: a lighter background lowers contrast, so lifting one without the
  other trades "too dark" for "too faint".

  Grey is slate's own hue and chroma at a chosen lightness, so the mirrored scale
  still reads as slate rather than as neutral grey.
*/
const grey = (l, c = 0.03) => `oklch(${l}% ${c} 262)`;
const SURFACE = {
  canvas: grey(25),
  card: grey(30.5, 0.032),
  slate: {
    50: grey(33.5),
    100: grey(36),
    200: grey(40),
    300: grey(46),
    400: grey(62, 0.035),
    500: grey(80, 0.03),
    600: grey(88, 0.02),
    700: grey(93, 0.013),
    800: value('slate-100'),
    900: value('slate-50'),
    950: '#fff',
  },
  brandTint: 'oklch(40% 0.11 292)',
  brandText: 'oklch(80% 0.13 293)',
  hexBg: 37,
  hexBorder: 46,
  hexText: 82,
};

const HUES = ['red', 'orange', 'amber', 'yellow', 'lime', 'green', 'emerald', 'teal', 'cyan', 'sky', 'blue', 'indigo', 'violet', 'purple', 'fuchsia', 'pink', 'rose'];

/* A tint is the hue's 500 mixed into transparency, so it reads on any dark surface. */
const tint = (hue, pct) => `color-mix(in oklab, ${value(`${hue}-500`)} ${pct}%, transparent)`;

const BG = { 50: 12, 100: 18, 200: 26, 300: 34 };
const BORDER = { 50: 20, 100: 28, 200: 38, 300: 48 };
/* Coloured text, lifted to a light shade of its own hue. One step lighter than
   the first dark palette, and 400/500 included: on the dimmer surfaces a rose-600
   lifted only to rose-400 measured 3.7:1 on its own tint, and an untouched
   rose-500 2.8:1 — both under the 4.5:1 body text needs. */
const TEXT = { 400: 300, 500: 300, 600: 300, 700: 200, 800: 200, 900: 100 };

const VARIANTS = [
  ['', (cls) => `.${cls}`],
  ['hover:', (cls) => `.hover\\:${cls}:hover`],
  ['group-hover:', (cls) => `.group:hover .group-hover\\:${cls}`],
];

const scope = ':root[data-theme="dark"]';
const lines = [];
const rule = (selector, decl) => lines.push(`${scope} ${selector} { ${decl} }`);

/* Opacity variants actually in use (bg-rose-50/60 and the like) get the same tint. */
const src = [];
(function walk(dir) {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) walk(p);
    else if (/\.(jsx?|mjs)$/.test(f) && !/\.test\./.test(f)) src.push(fs.readFileSync(p, 'utf8'));
  }
})(path.join(ROOT, 'src'));
const all = src.join('\n');
const opacities = (utility) =>
  [...new Set([...all.matchAll(new RegExp(`${utility.replace('-', '\\-')}/(\\d+)`, 'g'))].map((m) => m[1]))];

for (const hue of HUES) {
  for (const [shade, pct] of Object.entries(BG)) {
    const cls = `bg-${hue}-${shade}`;
    for (const [, sel] of VARIANTS) rule(sel(cls), `background-color: ${tint(hue, pct)};`);
    for (const op of opacities(cls)) for (const [, sel] of VARIANTS) rule(sel(`${cls}\\/${op}`), `background-color: ${tint(hue, pct)};`);
  }
  for (const [shade, pct] of Object.entries(BORDER)) {
    const cls = `border-${hue}-${shade}`;
    for (const [, sel] of VARIANTS) rule(sel(cls), `border-color: ${tint(hue, pct)};`);
  }
  for (const [shade, lighter] of Object.entries(TEXT)) {
    const cls = `text-${hue}-${shade}`;
    for (const [, sel] of VARIANTS) rule(sel(cls), `color: ${value(`${hue}-${lighter}`)};`);
    for (const op of opacities(cls)) for (const [, sel] of VARIANTS) rule(sel(`${cls}\\/${op}`), `color: ${value(`${hue}-${lighter}`)};`);
  }
}

/*
  Arbitrary hex colours — `bg-[#FEF5E7]`, `text-[#15803D]` — mostly in the
  sample dashboard widgets and the scores page. No variable touches them, so
  left alone they keep a cream background under text this sheet has lightened.

  Classified by how light the hex is: a pale background or border becomes a dark
  tint of its own hue, dark text becomes a light version of its own hue, and a
  saturated colour (a button's bg-[#E11D48]) is left exactly as it is. Written
  with CSS relative colour syntax, so the hue is the hex's own, not a guess.
*/
const luminance = (hex) => {
  const h = hex.length === 4 ? hex.slice(1).split('').map((c) => c + c).join('') : hex.slice(1, 7);
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const escapeClass = (cls) => cls.replace(/([:\[\]#/])/g, '\\$1');
const hexClasses = [...new Set([...all.matchAll(/(?:hover:|group-hover:)?(?:bg|border|text)-\[#[0-9A-Fa-f]{3,8}\]/g)].map((m) => m[0]))];
for (const full of hexClasses.sort()) {
  const [, variant = '', kind, hex] = full.match(/^(hover:|group-hover:)?(bg|border|text)-\[(#[0-9A-Fa-f]+)\]$/);
  const lum = luminance(hex);
  let decl = null;
  if (kind === 'bg' && lum > 0.7) decl = `background-color: oklch(from ${hex} ${SURFACE.hexBg}% calc(c * 3) h);`;
  if (kind === 'border' && lum > 0.6) decl = `border-color: oklch(from ${hex} ${SURFACE.hexBorder}% calc(c * 3) h);`;
  if (kind === 'text' && lum < 0.35) decl = `color: oklch(from ${hex} ${SURFACE.hexText}% c h);`;
  if (!decl) continue;
  const sel = escapeClass(full);
  const selector = variant === 'hover:' ? `.${sel}:hover` : variant === 'group-hover:' ? `.group:hover .${sel}` : `.${sel}`;
  rule(selector, decl);
}

const header = `/*
  GENERATED by scripts/build-dark-theme.mjs — do not edit by hand; edit the
  script and run it. The reasoning lives there.

  Active only while the signed-in shell is mounted: MainLayout sets
  data-theme on <html> and removes it on the way out, so the landing page and
  the sign-in screens keep their own colours.
*/

${scope} {
  color-scheme: dark;

  /* Slate mirrored: surface shades become dim greys, text shades light ones.
     Values from SURFACE in scripts/build-dark-theme.mjs. */
${Object.entries(SURFACE.slate).map(([shade, v]) => `  --color-slate-${shade}: ${v};`).join('\n')}

  /* The page behind the cards, and the brand's pale tile colour. */
  --color-canvas: ${SURFACE.canvas};
  --color-brand-tint: ${SURFACE.brandTint};
}

/* Cards, sidebar, navbar and menus. A class rule, not --color-white, so every
   text-white on a purple button stays white. */
${scope} .bg-white,
${scope} .hover\\:bg-white:hover { background-color: ${SURFACE.card}; }

/* The brand purple is dark enough to disappear as text on a dark card; lifted
   for text only. Buttons keep bg-brand as it is — and an element carrying both
   is skipped: /schedule's "today" circle is bg-brand with text-white, plus a
   stray text-brand, and this rule would otherwise beat text-white there. */
${scope} .text-brand:not(.bg-brand),
${scope} .hover\\:text-brand:not(.bg-brand):hover,
${scope} .group:hover .group-hover\\:text-brand:not(.bg-brand) { color: ${SURFACE.brandText}; }

/* Modal backdrops are slate-900 at an opacity. Mirrored, that would be a white
   veil; they stay a dark one. */
${['5', '40', '60'].map((op) => `${scope} .bg-slate-900\\/${op} { background-color: oklch(12.9% 0.042 264.695 / ${op}%); }`).join('\n')}

/* Pale tints, their borders, and dark text, per hue. */
`;

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, header + lines.join('\n') + '\n');
console.log(`wrote ${path.relative(ROOT, OUT)} — ${lines.length} rules`);
