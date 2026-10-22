import { describe, expect, it } from 'vitest';

import {
  backOf,
  defaultReportSemesterOf,
  hasVersionChoice,
  isOlderVersion,
  latestAverageOf,
  letterheadParts,
  newestVersionOf,
  promotionLineOf,
  romanOf,
  sharedKktpOf,
  showsTypeAverages,
  typeAverageText,
} from './reportCards';

// Shapes from backend 3a22f90 / 46c6173: grading.reportCards.js reportCardView and versionView.
const version = (n, id = `rc${n}`) => ({ id, version: n, reportDate: '2026-12-20', writtenAt: '2026-12-20T03:00:00.000Z' });

describe('report cards - which semester the class card opens on', () => {
  const year = {
    semesters: [
      { id: 's1', ordinal: 1, status: 'CLOSED', startDate: '2026-07-13T00:00:00.000Z', endDate: '2026-12-19T00:00:00.000Z' },
      { id: 's2', ordinal: 2, status: 'OPEN', startDate: '2027-01-04T00:00:00.000Z', endDate: '2027-06-19T00:00:00.000Z' },
    ],
  };

  it('the newest closed semester, even while a later one runs', () => {
    expect(defaultReportSemesterOf(year, '2027-02-01')).toBe('s1');
    expect(defaultReportSemesterOf({ semesters: [...year.semesters.slice(0, 1), { ...year.semesters[1], status: 'CLOSED' }] }, '2027-02-01')).toBe('s2');
  });

  it('none closed: the one running today', () => {
    const open = { semesters: year.semesters.map((semester) => ({ ...semester, status: 'OPEN' })) };
    expect(defaultReportSemesterOf(open, '2027-02-01')).toBe('s2');
    expect(defaultReportSemesterOf(null, '2027-02-01')).toBeNull();
  });
});

describe('report cards - versions', () => {
  it("a staff read names its versions, oldest first; the newest is the last", () => {
    const card = { id: 'rc1', version: 1, versions: [version(1), version(2)] };
    expect(newestVersionOf(card)).toMatchObject({ version: 2 });
    expect(isOlderVersion(card)).toBe(true);
    expect(hasVersionChoice(card)).toBe(true);
    expect(isOlderVersion({ ...card, id: 'rc2', version: 2 })).toBe(false);
  });

  it("a student's read has no versions: no choice, never older", () => {
    const card = { id: 'rc2', version: 2 };
    expect(newestVersionOf(card)).toBeNull();
    expect(isOlderVersion(card)).toBe(false);
    expect(hasVersionChoice(card)).toBe(false);
    expect(hasVersionChoice({ version: 1, versions: [version(1)] })).toBe(false);
  });
});

describe('report cards - the KKTP line and the way back', () => {
  it('names the KKTP only when every subject shares one', () => {
    expect(sharedKktpOf([{ kktp: 75 }, { kktp: 75 }])).toBe(75);
    expect(sharedKktpOf([{ kktp: 75 }, { kktp: 70 }])).toBeNull();
    expect(sharedKktpOf([])).toBeNull();
  });

  it('leads back where it was opened from, else the fallback', () => {
    expect(backOf({ back: { to: '/teacher/homeroom', state: { classId: 'c1', semesterId: 's1' } } }, '/report-cards')).toEqual({
      to: '/teacher/homeroom',
      state: { classId: 'c1', semesterId: 's1' },
    });
    expect(backOf(null, '/report-cards')).toEqual({ to: '/report-cards', state: null });
  });
});

describe("report cards - the dashboard's average", () => {
  const card = (id, grades) => ({ id, subjects: grades.map((finalGrade) => ({ finalGrade })) });

  it('the newest report card (the first listed), to one decimal', () => {
    const answer = latestAverageOf([card('new', [88, 72, 90]), card('old', [100])]);
    expect(answer.card.id).toBe('new');
    expect(answer.average).toBe(83.3);
    expect(latestAverageOf([card('a', [80, 85])]).average).toBe(82.5);
    expect(latestAverageOf([card('a', [70, 71, 71])]).average).toBe(70.7);
  });

  it('nothing to average: no report card, or one with no subject', () => {
    expect(latestAverageOf([])).toBeNull();
    expect(latestAverageOf(undefined)).toBeNull();
    expect(latestAverageOf([card('a', [])])).toBeNull();
  });
});

// Backend 4dae152: grading.reportCards.js reportCardView's printed fields.
describe('report cards - what the print adds', () => {
  const line = (types) => ({ subject: { id: 'm', code: 'MTK', name: 'Matematika' }, finalGrade: 84, kktp: 75, letter: 'B', types, description: null });

  it('shows the type columns only when some average was frozen', () => {
    expect(showsTypeAverages([line({ TUGAS: null, KUIS: null, UTS: null, UAS: null })])).toBe(false);
    expect(showsTypeAverages([line(undefined)])).toBe(false);
    expect(showsTypeAverages([line({ TUGAS: null, KUIS: null, UTS: null, UAS: null }), line({ TUGAS: 0, KUIS: null, UTS: null, UAS: null })])).toBe(true);
    expect(showsTypeAverages([])).toBe(false);
  });

  it('writes a type that counts for nothing as "-", and a 0 as 0', () => {
    const subject = line({ TUGAS: 88, KUIS: 0, UTS: null, UAS: 79 });
    expect(['TUGAS', 'KUIS', 'UTS', 'UAS'].map((type) => typeAverageText(subject, type))).toEqual(['88', '0', '-', '79']);
    expect(typeAverageText(line(undefined), 'TUGAS')).toBe('-');
  });

  it('numbers a grade level in Roman numerals, to XIII', () => {
    expect([1, 4, 6, 9, 10, 11, 12, 13].map(romanOf)).toEqual(['I', 'IV', 'VI', 'IX', 'X', 'XI', 'XII', 'XIII']);
  });

  it('states the promotion as the PDF does', () => {
    expect(promotionLineOf({ promotion: { outcome: 'PROMOTED', nextGradeLevel: 11 } })).toEqual({ key: 'rc.promotion.PROMOTED', grade: 'XI' });
    expect(promotionLineOf({ promotion: { outcome: 'RETAINED', nextGradeLevel: 10 } })).toEqual({ key: 'rc.promotion.RETAINED', grade: 'X' });
    expect(promotionLineOf({ promotion: { outcome: 'GRADUATED', nextGradeLevel: null } })).toEqual({ key: 'rc.promotion.GRADUATED', grade: null });
    expect(promotionLineOf({ promotion: null })).toBeNull();
    expect(promotionLineOf({})).toBeNull();
  });

  it('names the address and the phone only when set', () => {
    expect(letterheadParts({ address: 'Jl. Merdeka 1', phone: '021 555' })).toEqual([
      { kind: 'address', value: 'Jl. Merdeka 1' },
      { kind: 'phone', value: '021 555' },
    ]);
    expect(letterheadParts({ address: null, phone: '  ' })).toEqual([]);
    expect(letterheadParts(undefined)).toEqual([]);
  });
});
