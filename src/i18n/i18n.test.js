/*
  The two dictionaries, and every key the code asks them for.

  A key that is missing does not crash anything: `t()` falls back to English and
  then to the key itself, so the screen shows `admin.status.WITHDRAWN` in place
  of a word. That is ugly on purpose — silent blanks are worse — but it means the
  only thing that catches a missing key today is somebody looking at the screen.
  These tests catch it first.

  Three kinds of key reach `t()`:

    literal     t('admin.title')                   — found by reading the source
    dynamic     t(`admin.status.${row.status}`)   — expanded over the closed set
                                                     it ranges over, and that set
                                                     is read from the source too
    via a map   t(ROLE_LABEL_KEY[role])            — checked through the map

  All three were clean when this file was written (913 keys, 672 literal uses,
  no placeholder mismatch). This is a guard, not a repair.
*/

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';

import id from './id.js';
import en from './en.js';
import { LANGUAGES } from './languages.js';
import { ROLES, ROLE_LABEL_KEY, ROLE_TAGLINE_KEY } from '../constants/roles.js';

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const read = (rel) => fs.readFileSync(path.join(SRC, rel), 'utf8');

const sourceFiles = (() => {
  const out = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.jsx?$/.test(entry.name) && !/\.test\.jsx?$/.test(entry.name)) out.push(full);
    }
  };
  walk(SRC);
  return out;
})();

const placeholders = (text) =>
  [...String(text).matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

/* ======================================================================== */

describe('the two dictionaries', () => {
  it('carry exactly the same keys', () => {
    const onlyId = Object.keys(id).filter((k) => !(k in en));
    const onlyEn = Object.keys(en).filter((k) => !(k in id));
    expect({ onlyId, onlyEn }).toEqual({ onlyId: [], onlyEn: [] });
  });

  it('have no empty entries', () => {
    const empty = Object.keys(id).filter(
      (k) => typeof id[k] !== 'string' || !id[k].trim() || typeof en[k] !== 'string' || !en[k].trim()
    );
    expect(empty).toEqual([]);
  });

  it('use the same {placeholders} in both languages', () => {
    /* `{n} pendaftaran` against `{count} registrations` would fill one and leave
       the other showing a literal {count}. */
    const mismatched = Object.keys(id)
      .filter((k) => placeholders(id[k]).join() !== placeholders(en[k]).join())
      .map((k) => `${k}: id{${placeholders(id[k])}} en{${placeholders(en[k])}}`);
    expect(mismatched).toEqual([]);
  });
});

/* ======================================================================== */

describe('every literal key the code asks for exists', () => {
  it('in the dictionary', () => {
    const missing = [];
    for (const file of sourceFiles) {
      const text = fs.readFileSync(file, 'utf8');
      for (const m of text.matchAll(/\bt\(\s*(['"])([a-zA-Z][\w.]*)\1/g)) {
        if (!(m[2] in id)) missing.push(`${m[2]}  ← ${path.relative(SRC, file)}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it('including the keys that arrive through the role maps', () => {
    for (const role of Object.values(ROLES)) {
      expect(id).toHaveProperty([ROLE_LABEL_KEY[role]]);
      expect(id).toHaveProperty([ROLE_TAGLINE_KEY[role]]);
    }
  });
});

/* ======================================================================== */

/*
  Dynamic keys, expanded over the set each one ranges over.

  The sets are read out of the component that owns them rather than copied here,
  so adding a tab or a status there without its dictionary entry fails this file.
  If a pattern below stops matching, the constant was renamed or reshaped — the
  test says so rather than passing over an empty list.
*/
const quotedIn = (rel, pattern) => {
  const m = read(rel).match(pattern);
  expect(m, `${rel}: the constant this test reads has moved`).not.toBeNull();
  const items = [...m[1].matchAll(/'(\w+)'/g)].map((x) => x[1]);
  expect(items.length).toBeGreaterThan(0);
  return items;
};

const keysOf = (rel, pattern) => {
  const m = read(rel).match(pattern);
  expect(m, `${rel}: the constant this test reads has moved`).not.toBeNull();
  const items = [...m[1].matchAll(/^\s*(\w+)\s*:/gm)].map((x) => x[1]);
  expect(items.length).toBeGreaterThan(0);
  return items;
};

const expectEvery = (keys) => {
  const missing = keys.filter((k) => !(k in id));
  expect(missing).toEqual([]);
};

describe('every expansion of a dynamic key exists', () => {
  it('admin queue: tabs, statuses and the on/off filter', () => {
    const file = 'views/Admin/AdminRegistrationsPage.jsx';
    const tabs = quotedIn(file, /const TABS = \[([^\]]*)\]/);
    const states = quotedIn(file, /const STATES = \[([^\]]*)\]/);

    expectEvery(tabs.map((s) => `admin.tab.${s}`));
    /* RegistrationReview renders admin.status.${registration.status}; the
       statuses a registration can have are the tabs it can sit in. */
    expectEvery(tabs.map((s) => `admin.status.${s}`));
    expectEvery(states.map((s) => `admin.filter.state.${s}`));
  });

  it('join requests: tabs, statuses and each tab’s empty state', () => {
    const tabs = quotedIn('views/Requests/JoinRequestsPage.jsx', /const TABS = \[([^\]]*)\]/);
    expectEvery(tabs.map((s) => `requests.tab.${s}`));
    expectEvery(tabs.map((s) => `requests.status.${s}`));
    expectEvery(tabs.map((s) => `requests.queue.empty.${s}`));
  });

  it('role picker: a badge for every state that draws one', () => {
    /* Only states with a STATUS_BADGE colour render the badge, which is why
       there is no selectRole.badge.ACTIVE and must not need to be. */
    const states = keysOf('views/Role/SelectRolePage.jsx', /const STATUS_BADGE = \{([\s\S]*?)\};/);
    expectEvery(states.map((s) => `selectRole.badge.${s}`));
  });

  it('the language switch: a name for every language offered', () => {
    expectEvery(LANGUAGES.map((code) => `lang.${code}`));
  });

  it('the dev sign-in buttons: a title for every role they seed', () => {
    const m = read('components/dev/DevSignIn.jsx').match(/const SEEDABLE = \[([^\]]*)\]/);
    expect(m).not.toBeNull();
    const roles = [...m[1].matchAll(/ROLES\.(\w+)/g)].map((x) => x[1]);
    expect(roles.length).toBeGreaterThan(0);
    expectEvery(roles.map((r) => `roleTitle.${r}`));
  });

  it('the landing page: a title and a description for every feature card', () => {
    const features = [...read('views/Landing/LandingPage.jsx').matchAll(/\bkey: '(\w+)'/g)].map(
      (x) => x[1]
    );
    expect(features.length).toBeGreaterThan(0);
    expectEvery(features.flatMap((f) => [`landing.feature.${f}.title`, `landing.feature.${f}.desc`]));
  });
});
