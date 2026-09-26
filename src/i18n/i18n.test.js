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
import { decisionErrorMessage, isAlreadyDecided } from './apiError.js';

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
    /* The subtitle and the empty-queue hint differ by the desk the reader sits at. */
    for (const pov of ['PRINCIPAL', 'TEACHER']) {
      expectEvery([`requests.subtitle.${pov}`, `requests.queue.empty.hint.${pov}`]);
    }
  });

  it('role picker: a badge for every state that draws one', () => {
    /* Only states with a STATUS_BADGE colour render the badge, which is why
       there is no selectRole.badge.ACTIVE and must not need to be. */
    const states = keysOf('views/Role/SelectRolePage.jsx', /const STATUS_BADGE = \{([\s\S]*?)\};/);
    expectEvery(states.map((s) => `selectRole.badge.${s}`));
  });

  it('classes: a label for every year and semester status that draws a badge', () => {
    /* The badge colour tables are the set: a status with a colour is a status
       that reaches the screen, so it needs words as well. */
    const file = 'views/Classes/ClassesPage.jsx';
    const years = keysOf(file, /const YEAR_BADGE = \{([\s\S]*?)\};/);
    const semesters = keysOf(file, /const SEMESTER_BADGE = \{([\s\S]*?)\};/);
    expect(years).toEqual(['ACTIVE', 'CLOSED']);
    expect(semesters).toEqual(['OPEN', 'FINALIZING', 'CLOSED']);
    expectEvery(years.map((s) => `classes.year.status.${s}`));
    expectEvery(semesters.map((s) => `classes.semester.status.${s}`));
  });

  it('classes: a name for every year tab, and an empty sentence for the two that can be empty', () => {
    const tabs = quotedIn('views/Classes/filters.js', /const YEAR_TABS = \[([^\]]*)\]/);
    expect(tabs).toEqual(['ACTIVE', 'CLOSED', 'ALL']);
    expectEvery(tabs.map((s) => `classes.year.tab.${s}`));
    /* ALL is never empty: the tabs only render once a year exists. */
    expectEvery(['ACTIVE', 'CLOSED'].map((s) => `classes.year.tabEmpty.${s}`));
  });

  it('guardian: a label for every relationship offered, and for typing another', () => {
    const presets = quotedIn('components/ChildFields.jsx', /const RELATIONSHIP_PRESETS = \[([^\]]*)\]/);
    expect(presets).toEqual(['Ayah', 'Ibu', 'Wali']);
    expectEvery([...presets, 'OTHER'].map((s) => `getStarted.join.relationship.option.${s}`));
  });

  it('guardian: a label for every child-link status that draws a badge', () => {
    /* GuardianPage's STATUS_BADGE is the set; the review screen names the same
       four for a link that is not the reader's to decide. */
    const statuses = keysOf('views/Guardian/GuardianPage.jsx', /const STATUS_BADGE = \{([\s\S]*?)\};/);
    expect(statuses).toEqual(['ACTIVE', 'PENDING', 'REJECTED', 'CANCELLED']);
    expectEvery(statuses.map((s) => `guardian.status.${s}`));
    expectEvery(statuses.map((s) => `requests.link.status.${s}`));
  });

  it('members: a tab name for every tab, and a title for every role a member can hold', () => {
    const tabs = quotedIn('views/Members/MembersPage.jsx', /const TABS = \[([^\]]*)\]/);
    expect(tabs).toEqual(['ALL', 'TEACHER', 'STUDENT', 'GUARDIAN', 'LEFT']);
    expectEvery(tabs.map((s) => `members.tab.${s}`));
    /* Rows render roleTitle.${role} for every role on a member. */
    expectEvery(['PRINCIPAL', 'TEACHER', 'STUDENT', 'GUARDIAN'].map((r) => `roleTitle.${r}`));
  });

  it('class moves: a name for every tab, a badge and an empty line for every status', () => {
    const tabs = quotedIn('views/Homeroom/moves.js', /export const MOVE_TABS = \[([^\]]*)\]/);
    const statuses = quotedIn('views/Homeroom/moves.js', /export const MOVE_STATUSES = \[([^\]]*)\]/);
    expect(statuses).toEqual(['PENDING', 'ACTIVE', 'REJECTED', 'CANCELLED']);
    expectEvery(tabs.flatMap((s) => [`moves.tab.${s}`, `moves.empty.${s}`]));
    expectEvery(statuses.map((s) => `moves.status.${s}`));
  });

  it('the setup checklist: every step says done, to do, why, and where to go', () => {
    const steps = quotedIn('views/Dashboard/setup.js', /export const SETUP_STEPS = \[([^\]]*)\]/);
    expect(steps).toEqual(['YEAR', 'SEMESTER', 'TEACHERS', 'CLASSES', 'SUBJECTS', 'STUDENTS']);
    expectEvery(steps.flatMap((s) => ['done', 'todo', 'hint', 'action'].map((k) => `setup.${s}.${k}`)));
    expectEvery(['done', 'todo', 'blocked', 'unknown'].map((s) => `setup.state.${s}`));
  });

  it('subjects: a name for every tab', () => {
    const tabs = quotedIn('views/Subjects/subjects.js', /export const SUBJECT_TABS = \[([^\]]*)\]/);
    expect(tabs).toEqual(['BOARD', 'PENDING', 'CATALOG']);
    expectEvery(tabs.map((s) => `subjects.tab.${s}`));
    /* The board's year picker names a year's status in sentence case. */
    expectEvery(['ACTIVE', 'CLOSED'].map((s) => `subjects.board.yearStatus.${s}`));
  });

  it('the language switch: a name for every language offered', () => {
    expectEvery(LANGUAGES.map((code) => `lang.${code}`));
  });

  it('the landing page: a title and a description for every feature card', () => {
    const features = [...read('views/Landing/LandingPage.jsx').matchAll(/\bkey: '(\w+)'/g)].map(
      (x) => x[1]
    );
    expect(features.length).toBeGreaterThan(0);
    expectEvery(features.flatMap((f) => [`landing.feature.${f}.title`, `landing.feature.${f}.desc`]));
  });
});

describe('deciding a join request: CONFLICT is not one thing (membership.service.js)', () => {
  /* The server's own sentences, copied from decideRequest and translateUniqueViolation. */
  const t = (key) => key;
  const refused = (code, message) => ({ status: code === 'CONFLICT' ? 409 : 400, code, message });

  it('reads "decided elsewhere" only when the server says so', () => {
    const decided = refused('CONFLICT', 'This join request has already been decided');
    expect(isAlreadyDecided(decided)).toBe(true);
    expect(decisionErrorMessage(decided, t)).toBe('requests.alreadyDecided');
  });

  it('tells a NISN already at the school apart from it — the case that was hidden', () => {
    const taken = refused('CONFLICT', 'A student with this NISN already exists at this school');
    expect(isAlreadyDecided(taken)).toBe(false);
    expect(decisionErrorMessage(taken, t)).toBe('requests.error.nisnTaken');
  });

  it('names the other refusals, and keeps the server words for anything unknown', () => {
    expect(decisionErrorMessage(refused('CONFLICT', 'A teacher with this NIP or NUPTK already exists at this school'), t)).toBe('requests.error.teacherIdTaken');
    expect(decisionErrorMessage(refused('BAD_REQUEST', 'The STUDENT role cannot be combined with any other role'), t)).toBe('requests.error.studentExclusive');
    expect(decisionErrorMessage(refused('BAD_REQUEST', 'X IPA 1 is grade 10, and this request asks for grade 11'), t)).toBe('requests.error.gradeMismatch');
    expect(decisionErrorMessage(refused('BAD_REQUEST', 'Choose the class this student joins'), t)).toBe('requests.approve.needsClass');
    expect(decisionErrorMessage(refused('CONFLICT', 'Something new'), t)).toBe('Something new');
  });

  it('has every sentence it can answer with, in both languages', () => {
    for (const key of ['requests.error.nisnTaken', 'requests.error.teacherIdTaken', 'requests.error.guardianLinked', 'requests.error.studentExclusive', 'requests.error.noNisn', 'requests.error.gradeMismatch']) {
      expect(id[key]).toBeTruthy();
      expect(en[key]).toBeTruthy();
    }
  });
});
