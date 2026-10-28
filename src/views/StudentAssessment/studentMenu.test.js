import { describe, expect, it } from 'vitest';

import {
  afterRuleOf,
  belowKktpOf,
  byClassSubject,
  canRetry,
  cardOf,
  entriesOf,
  handedInOf,
  nextUpcoming,
  onTimeOf,
  pathOf,
  practiceBestOf,
  scoredEntriesOf,
  scoresSummaryOf,
  sectionOf,
  sectionsOf,
  todoAcross,
  todoCount,
  whenOf,
  wordOf,
} from './studentMenu';

/*
  Shapes from assessment.menu.js menuOf (backend 113ae37): each entry is
  { assessment: studentAssessmentView, status, score, attemptsUsed, attemptsLeft,
  inProgressId, canStart }, its window on the student's own terms.
*/

const NOW = new Date('2026-10-14T05:00:00Z');

const MTK = { id: 'sub-mtk', code: 'MTK', name: 'Matematika' };
const BIO = { id: 'sub-bio', code: 'BIO', name: 'Biologi' };

let seq = 0;
const entry = ({
  subject = MTK,
  mode = 'ONLINE',
  cancelled = false,
  opensAt = '2026-10-12T00:00:00Z',
  closesAt = '2026-10-20T16:59:00Z',
  status = 'NOT_STARTED',
  score = null,
  inProgressId = null,
  canStart = false,
  attemptsUsed = 0,
} = {}) => {
  seq += 1;
  return {
    assessment: {
      id: `asm-${seq}`,
      classSubject: { id: 'cs-1', class: { id: 'cls-1', name: 'XI IPS', gradeLevel: 11, academicYear: '2026/2027' }, subject },
      type: 'KUIS',
      mode,
      title: `Kuis ${seq}`,
      opensAt,
      closesAt,
      status: cancelled ? 'CANCELLED' : 'PUBLISHED',
      cancelReason: cancelled ? 'Libur' : null,
      exception: null,
    },
    status: cancelled ? 'CANCELLED' : status,
    score,
    attemptsUsed,
    attemptsLeft: 1,
    inProgressId,
    canStart,
  };
};

describe('sectionOf', () => {
  it('puts a startable one never begun under TODO', () => {
    expect(sectionOf(entry({ canStart: true }), NOW)).toBe('TODO');
  });

  it('puts a running attempt under TODO, whatever canStart says', () => {
    expect(sectionOf(entry({ status: 'IN_PROGRESS', inProgressId: 'sub-1', canStart: false }), NOW)).toBe('TODO');
  });

  it('puts a voided one that may be answered again under TODO', () => {
    expect(sectionOf(entry({ status: 'VOIDED', canStart: true, attemptsUsed: 1 }), NOW)).toBe('TODO');
  });

  it('puts a late one still taken under TODO', () => {
    expect(sectionOf(entry({ closesAt: '2026-10-13T16:59:00Z', status: 'DID_NOT_SUBMIT', canStart: true }), NOW)).toBe('TODO');
  });

  it('keeps one handed in that may be tried again under DONE (owner, 2026-10-12)', () => {
    expect(sectionOf(entry({ status: 'WAITING_FOR_RELEASE', canStart: true, attemptsUsed: 1 }), NOW)).toBe('DONE');
    expect(sectionOf(entry({ status: 'RELEASED', score: 80, canStart: true, attemptsUsed: 1 }), NOW)).toBe('DONE');
  });

  it('puts one not open yet under UPCOMING', () => {
    expect(sectionOf(entry({ opensAt: '2026-10-20T00:00:00Z', closesAt: '2026-10-21T00:00:00Z' }), NOW)).toBe('UPCOMING');
  });

  it('keeps an OFFLINE one under UPCOMING until its window closes, then DONE', () => {
    expect(sectionOf(entry({ mode: 'OFFLINE' }), NOW)).toBe('UPCOMING');
    expect(sectionOf(entry({ mode: 'OFFLINE', closesAt: '2026-10-13T00:00:00Z', status: 'DID_NOT_SUBMIT' }), NOW)).toBe('DONE');
  });

  it('puts an OFFLINE one already released under DONE, even inside its window', () => {
    // Marks may be released before the window closes (measured on "[Uji] Kuis Luring").
    expect(sectionOf(entry({ mode: 'OFFLINE', status: 'RELEASED', score: 90 }), NOW)).toBe('DONE');
    expect(sectionOf(entry({ mode: 'OFFLINE', opensAt: '2026-10-20T00:00:00Z', closesAt: '2026-10-21T00:00:00Z', status: 'RELEASED', score: 90 }), NOW)).toBe(
      'DONE'
    );
  });

  it('puts a cancelled one under DONE, even one that could have been started', () => {
    expect(sectionOf(entry({ cancelled: true, canStart: true }), NOW)).toBe('DONE');
    expect(sectionOf(entry({ cancelled: true, opensAt: '2026-10-20T00:00:00Z' }), NOW)).toBe('DONE');
  });

  it('puts an open one that cannot be started (a class left) under DONE', () => {
    expect(sectionOf(entry({ canStart: false }), NOW)).toBe('DONE');
  });
});

describe('wordOf', () => {
  it('says what a TODO row is', () => {
    expect(wordOf(entry({ canStart: true }), NOW)).toBe('NOT_STARTED');
    expect(wordOf(entry({ status: 'IN_PROGRESS', inProgressId: 's' }), NOW)).toBe('IN_PROGRESS');
    expect(wordOf(entry({ status: 'VOIDED', canStart: true }), NOW)).toBe('VOIDED');
    expect(wordOf(entry({ closesAt: '2026-10-13T00:00:00Z', status: 'DID_NOT_SUBMIT', canStart: true }), NOW)).toBe('LATE');
  });

  it('leaves UPCOMING and a released score without a word', () => {
    expect(wordOf(entry({ opensAt: '2026-10-20T00:00:00Z', closesAt: '2026-10-21T00:00:00Z' }), NOW)).toBeNull();
    expect(wordOf(entry({ closesAt: '2026-10-13T00:00:00Z', status: 'RELEASED', score: 87.5 }), NOW)).toBeNull();
  });

  it("says the server's status under DONE, and CANCELLED first", () => {
    expect(wordOf(entry({ closesAt: '2026-10-13T00:00:00Z', status: 'WAITING_FOR_RELEASE' }), NOW)).toBe('WAITING_FOR_RELEASE');
    expect(wordOf(entry({ closesAt: '2026-10-13T00:00:00Z', status: 'DID_NOT_SUBMIT' }), NOW)).toBe('DID_NOT_SUBMIT');
    expect(wordOf(entry({ cancelled: true }), NOW)).toBe('CANCELLED');
  });
});

describe('canRetry', () => {
  it('is true only for a DONE row the server still lets start', () => {
    expect(canRetry(entry({ status: 'RELEASED', score: 80, canStart: true }), NOW)).toBe(true);
    expect(canRetry(entry({ status: 'RELEASED', score: 80, canStart: false }), NOW)).toBe(false);
    expect(canRetry(entry({ canStart: true }), NOW)).toBe(false);
  });
});

describe('whenOf', () => {
  it('says the opening before, the closing during and after', () => {
    const upcoming = entry({ opensAt: '2026-10-20T00:00:00Z', closesAt: '2026-10-21T00:00:00Z' });
    expect(whenOf(upcoming, NOW)).toEqual({ key: 'opens', instant: '2026-10-20T00:00:00Z' });
    expect(whenOf(entry(), NOW)).toEqual({ key: 'closes', instant: '2026-10-20T16:59:00Z' });
    expect(whenOf(entry({ closesAt: '2026-10-13T00:00:00Z' }), NOW)).toEqual({ key: 'closed', instant: '2026-10-13T00:00:00Z' });
  });
});

describe('sectionsOf', () => {
  it('orders TODO by deadline, UPCOMING by opening, DONE newest closed first, and drops empty sections', () => {
    const late = entry({ canStart: true, closesAt: '2026-10-25T00:00:00Z' });
    const soon = entry({ canStart: true, closesAt: '2026-10-15T00:00:00Z' });
    const old = entry({ closesAt: '2026-10-01T00:00:00Z', status: 'DID_NOT_SUBMIT' });
    const recent = entry({ closesAt: '2026-10-13T00:00:00Z', status: 'WAITING_FOR_RELEASE' });
    const sections = sectionsOf([late, old, soon, recent], NOW);
    expect(sections.map((s) => s.key)).toEqual(['TODO', 'DONE']);
    expect(sections[0].entries).toEqual([soon, late]);
    expect(sections[1].entries).toEqual([recent, old]);
  });

  it('answers nothing for no entries', () => {
    expect(sectionsOf([], NOW)).toEqual([]);
    expect(sectionsOf(undefined, NOW)).toEqual([]);
  });
});

describe('byClassSubject, entriesOf and todoCount', () => {
  const at = (classSubjectId, subject, extra) => {
    const made = entry({ subject, ...extra });
    made.assessment.classSubject = { ...made.assessment.classSubject, id: classSubjectId };
    return made;
  };
  const mtkNow = at('cs-mtk', MTK, { canStart: true });
  const bioNow = at('cs-bio', BIO, { closesAt: '2026-10-13T00:00:00Z', status: 'DID_NOT_SUBMIT' });
  const mtkNow2 = at('cs-mtk', MTK, { opensAt: '2026-10-20T00:00:00Z', closesAt: '2026-10-21T00:00:00Z' });
  const bioLeft = at('cs-bio-old', BIO, { closesAt: '2026-10-01T00:00:00Z', status: 'RELEASED', score: 70 });
  const classes = [
    { id: 'cls-2', name: 'XI IPS', current: true, assessments: [mtkNow, bioNow, mtkNow2] },
    { id: 'cls-1', name: 'XI IPA', current: false, assessments: [bioLeft] },
  ];

  it('groups by class subject, the current class first, subjects by name within it', () => {
    const groups = byClassSubject(classes);
    expect(groups.map((g) => g.classSubject.id)).toEqual(['cs-bio', 'cs-mtk', 'cs-bio-old']);
    expect(groups[1].entries).toEqual([mtkNow, mtkNow2]);
    expect(groups[2].class).toEqual({ id: 'cls-1', name: 'XI IPA', current: false });
  });

  it("finds one class subject's entries, or none", () => {
    expect(entriesOf(classes, 'cs-mtk')).toEqual([mtkNow, mtkNow2]);
    expect(entriesOf(classes, 'cs-none')).toEqual([]);
    expect(entriesOf(undefined, 'cs-mtk')).toEqual([]);
  });

  it('counts what waits to be done', () => {
    expect(todoCount(classes, 'cs-mtk', NOW)).toBe(1);
    expect(todoCount(classes, 'cs-bio', NOW)).toBe(0);
  });
});

describe('cardOf', () => {
  it('leads with what is to do, its soonest deadline, then the total and the rest', () => {
    const soon = entry({ canStart: true, closesAt: '2026-10-15T00:00:00Z' });
    const later = entry({ canStart: true, closesAt: '2026-10-25T00:00:00Z' });
    const upcoming = entry({ opensAt: '2026-10-20T00:00:00Z', closesAt: '2026-10-21T00:00:00Z' });
    const done = entry({ closesAt: '2026-10-13T00:00:00Z', status: 'WAITING_FOR_RELEASE' });
    expect(cardOf([later, upcoming, soon, done], NOW)).toEqual({
      total: 4,
      lead: { key: 'TODO', n: 2, when: { key: 'closes', instant: '2026-10-15T00:00:00Z' } },
      rest: [
        { key: 'UPCOMING', n: 1 },
        { key: 'DONE', n: 1 },
      ],
    });
  });

  it('leads with what is coming when nothing is to do', () => {
    const upcoming = entry({ opensAt: '2026-10-20T00:00:00Z', closesAt: '2026-10-21T00:00:00Z' });
    const done = entry({ closesAt: '2026-10-13T00:00:00Z', status: 'DID_NOT_SUBMIT' });
    expect(cardOf([done, upcoming], NOW)).toEqual({
      total: 2,
      lead: { key: 'UPCOMING', n: 1, when: { key: 'opens', instant: '2026-10-20T00:00:00Z' } },
      rest: [{ key: 'DONE', n: 1 }],
    });
  });

  it('says all done, with nothing else repeated', () => {
    const done = entry({ closesAt: '2026-10-13T00:00:00Z', status: 'RELEASED', score: 80 });
    expect(cardOf([done], NOW)).toEqual({ total: 1, lead: { key: 'ALL_DONE' }, rest: [] });
  });
});

describe('pathOf', () => {
  it('opens a running attempt directly, anything else on its outline', () => {
    const running = entry({ status: 'IN_PROGRESS', inProgressId: 'sub-9' });
    expect(pathOf(running)).toBe(`/assessment/${running.assessment.id}/percobaan/sub-9`);
    const other = entry();
    expect(pathOf(other)).toBe(`/assessment/${other.assessment.id}`);
  });
});

describe('todoAcross and nextUpcoming', () => {
  const late = entry({ canStart: true, closesAt: '2026-10-25T00:00:00Z' });
  const soon = entry({ subject: BIO, canStart: true, closesAt: '2026-10-15T00:00:00Z' });
  const running = entry({ status: 'IN_PROGRESS', inProgressId: 's-1', closesAt: '2026-10-20T00:00:00Z' });
  const far = entry({ opensAt: '2026-11-01T00:00:00Z', closesAt: '2026-11-02T00:00:00Z' });
  const near = entry({ opensAt: '2026-10-20T00:00:00Z', closesAt: '2026-10-21T00:00:00Z' });
  const done = entry({ closesAt: '2026-10-13T00:00:00Z', status: 'DID_NOT_SUBMIT' });
  const classes = [
    { id: 'now', current: true, assessments: [late, far, done] },
    { id: 'left', current: false, assessments: [soon, running, near] },
  ];

  it('gathers what is to do from every class, soonest deadline first', () => {
    expect(todoAcross(classes, NOW)).toEqual([soon, running, late]);
    expect(todoAcross(undefined, NOW)).toEqual([]);
  });

  it('names the next one to open, or null', () => {
    expect(nextUpcoming(classes, NOW)).toBe(near);
    expect(nextUpcoming([{ id: 'x', assessments: [done] }], NOW)).toBeNull();
  });
});

describe('scoredEntriesOf', () => {
  const at = (classSubjectId, subject, extra) => {
    const made = entry({ subject, ...extra });
    made.assessment.classSubject = { ...made.assessment.classSubject, id: classSubjectId };
    return made;
  };
  const released = at('cs-mtk', MTK, { closesAt: '2026-10-12T02:00:00Z', status: 'RELEASED', score: 90 });
  const waiting = at('cs-mtk', MTK, { closesAt: '2026-10-13T16:59:00Z', status: 'WAITING_FOR_RELEASE' });
  const missed = at('cs-mtk', MTK, { closesAt: '2026-10-01T00:00:00Z', status: 'DID_NOT_SUBMIT' });
  const open = at('cs-mtk', MTK, { canStart: true });
  const cancelled = at('cs-mtk', MTK, { cancelled: true });
  const running = at('cs-mtk', MTK, { status: 'IN_PROGRESS', inProgressId: 's' });
  const bioOpen = at('cs-bio', BIO, { canStart: true });
  const classes = [{ id: 'now', name: 'XI IPS', current: true, assessments: [released, open, waiting, cancelled, missed, running, bioOpen] }];

  it('keeps the released, the waiting and the missed, latest closed first', () => {
    expect(scoredEntriesOf(classes, 'cs-mtk')).toEqual([waiting, released, missed]);
  });

  it('a subject with nothing scored yet, or not in the menu, is empty', () => {
    expect(scoredEntriesOf(classes, 'cs-bio')).toEqual([]);
    expect(scoredEntriesOf(classes, 'cs-none')).toEqual([]);
  });
});

describe('handedInOf', () => {
  it('online ones with a known outcome: handed in (marked or waiting) against did not submit', () => {
    const classes = [
      {
        id: 'now',
        current: true,
        assessments: [
          entry({ status: 'RELEASED', score: 80 }),
          entry({ status: 'WAITING_FOR_RELEASE' }),
          entry({ status: 'DID_NOT_SUBMIT' }),
          entry({ status: 'NOT_STARTED', canStart: true }),
          entry({ status: 'IN_PROGRESS', inProgressId: 's' }),
          entry({ mode: 'OFFLINE', status: 'RELEASED', score: 90 }),
          entry({ cancelled: true, status: 'CANCELLED' }),
        ],
      },
    ];
    expect(handedInOf(classes)).toEqual({ handedIn: 2, total: 3, rate: 67 });
  });

  it('nothing known yet: no rate, never a 0 nobody counted', () => {
    expect(handedInOf([{ id: 'now', current: true, assessments: [entry({ canStart: true })] }])).toEqual({ handedIn: 0, total: 0, rate: null });
    expect(handedInOf(undefined)).toEqual({ handedIn: 0, total: 0, rate: null });
  });
});

describe('student menu - the score after the remedial rule (backend 79b319f)', () => {
  // A menu entry and an outline, as assessment.menu.js / outlineForStudent answer them.
  const entry = (over = {}) => ({ status: 'RELEASED', score: 95, afterRule: { score: 70, rule: 'CAP_AT_KKTP' }, ...over });

  it('a released score the rule moved: the score it counts for, and the rule', () => {
    expect(afterRuleOf(entry())).toEqual({ score: 70, rule: 'CAP_AT_KKTP' });
    expect(afterRuleOf({ score: 95, afterRule: { score: 87.5, rule: 'AVERAGE' } })).toEqual({ score: 87.5, rule: 'AVERAGE' });
  });

  it('nothing when the rule moved nothing, or there is no released score to sit under', () => {
    expect(afterRuleOf(entry({ afterRule: null }))).toBeNull();
    expect(afterRuleOf(entry({ score: null }))).toBeNull();
    expect(afterRuleOf(entry({ status: 'WAITING_FOR_RELEASE' }))).toBeNull();
    expect(afterRuleOf({ score: 95 })).toBeNull();
    expect(afterRuleOf(null)).toBeNull();
  });
});

describe('LATIHAN in the menu - backend 026e4f9', () => {
  const practice = (over = {}, practiceSummary = null) => {
    const base = entry(over);
    return { ...base, assessment: { ...base.assessment, type: 'LATIHAN' }, practice: practiceSummary };
  };
  const best = { attempt: 2, value: 90, pointsEarned: 9, pointsTotal: 10 };

  it('done shows its best attempt in place of a word; with no total, "Sudah dikerjakan"', () => {
    const done = practice({ status: 'DONE' }, { best, latest: best });
    expect(practiceBestOf(done)).toBe(90);
    expect(wordOf(done, NOW)).toBeNull();
    expect(wordOf(practice({ status: 'DONE' }, { best: null, latest: null }), NOW)).toBe('DONE');
    expect(practiceBestOf(entry({ status: 'RELEASED', score: 80 }))).toBeNull();
  });

  it('done and still startable stays under DONE with "Bisa dicoba lagi"', () => {
    const again = practice({ status: 'DONE', canStart: true }, { best, latest: best });
    expect(sectionOf(again, NOW)).toBe('DONE');
    expect(canRetry(again, NOW)).toBe(true);
  });

  it('never on the "Nilai" tab and never counted as handed in or on time', () => {
    const classes = [{ id: 'now', current: true, assessments: [practice({ status: 'DONE' }, { best, latest: best })] }];
    classes[0].assessments[0].late = false;
    expect(scoredEntriesOf(classes, 'cs-1')).toEqual([]);
    expect(handedInOf(classes)).toEqual({ handedIn: 0, total: 0, rate: null });
    expect(onTimeOf(classes)).toEqual({ onTime: 0, total: 0, rate: null });
  });
});

describe('late and kktp in the menu - backend 3814cf9', () => {
  it('on time: of the graded ones handed in, how many were not late', () => {
    const late = (value, over = {}) => ({ ...entry({ status: 'RELEASED', score: 80, ...over }), late: value });
    const classes = [
      { id: 'now', current: true, assessments: [late(false), late(false), late(true), late(null, { status: 'DID_NOT_SUBMIT' }), late(null, { mode: 'OFFLINE' })] },
      { id: 'before', current: false, assessments: [late(true, { cancelled: true })] },
    ];
    expect(onTimeOf(classes)).toEqual({ onTime: 2, total: 3, rate: 67 });
    expect(onTimeOf([])).toEqual({ onTime: 0, total: 0, rate: null });
  });

  it('a released score under the KKTP is red; at it, not released, or no KKTP, it is not', () => {
    expect(belowKktpOf({ status: 'RELEASED', score: 74.5, kktp: 75 })).toBe(true);
    expect(belowKktpOf({ status: 'RELEASED', score: 75, kktp: 75 })).toBe(false);
    expect(belowKktpOf({ status: 'WAITING_FOR_RELEASE', score: 10, kktp: 75 })).toBe(false);
    expect(belowKktpOf({ status: 'RELEASED', score: 10, kktp: null })).toBe(false);
    // The outline carries no status: its counted score is compared as it is.
    expect(belowKktpOf({ score: 60, kktp: 75 })).toBe(true);
  });
});

describe('scoresSummaryOf', () => {
  const entry = (status, score, kktp = 70) => ({ status, score, kktp, assessment: { id: `${status}-${score}` } });
  it('counts released, those reaching the KKTP, those under it, and those waiting', () => {
    const entries = [entry('WAITING_FOR_RELEASE', null), entry('RELEASED', 81.82), entry('RELEASED', 0), entry('RELEASED', 50), entry('RELEASED', 90), entry('DID_NOT_SUBMIT', null)];
    expect(scoresSummaryOf(entries)).toEqual({ released: 4, passed: 2, below: 2, waiting: 1 });
  });
  it('says nothing about the KKTP when no entry carries one', () => {
    expect(scoresSummaryOf([entry('RELEASED', 40, null)])).toEqual({ released: 1, passed: null, below: null, waiting: 0 });
  });
  it('a score exactly at the KKTP reaches it', () => {
    expect(scoresSummaryOf([entry('RELEASED', 70)])).toMatchObject({ passed: 1, below: 0 });
  });
});
