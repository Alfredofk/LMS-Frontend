import { describe, expect, it } from 'vitest';

import { barWidth, signalPath, signalView, studentsAcrossClasses } from './teachingDashboard';

const slot = (id, classId, n) => ({ classSubject: { id, class: { id: classId, name: classId } }, studentsPlacedNow: n });

describe('studentsAcrossClasses - the "Siswa" number', () => {
  it('counts a class taught two subjects once', () => {
    expect(studentsAcrossClasses([slot('mtk', 'ips', 30), slot('bio', 'ips', 30), slot('kim', 'ipa', 28)])).toBe(58);
  });

  it('nothing taught is 0', () => {
    expect(studentsAcrossClasses([])).toBe(0);
    expect(studentsAcrossClasses(undefined)).toBe(0);
  });
});

describe('signalView - a Support Signal as a sentence and a tab', () => {
  const thresholds = { absenceWindowDays: 14 };

  it('each type says its value against its threshold, on the tab with its evidence', () => {
    expect(signalView({ type: 'FREQUENT_ABSENCE', value: 4, threshold: 3 }, thresholds)).toEqual({
      key: 'teacherDash.signal.absence',
      vars: { n: 4, days: 14, limit: 3 },
      tab: 'pertemuan',
    });
    expect(signalView({ type: 'CONTENT_BEHIND', value: 20, threshold: 50 }, thresholds)).toEqual({
      key: 'teacherDash.signal.contentBehind',
      vars: { n: 20, limit: 50 },
      tab: 'progres',
    });
    expect(signalView({ type: 'NOT_SUBMITTING', value: 3, threshold: 2 }, thresholds)).toEqual({
      key: 'teacherDash.signal.notSubmitting',
      vars: { n: 3, limit: 2 },
      tab: 'nilai',
    });
    expect(signalView({ type: 'BELOW_KKTP', value: 61.5, threshold: 75 }, thresholds)).toEqual({
      key: 'teacherDash.signal.belowKktp',
      vars: { n: 61.5, kktp: 75 },
      tab: 'nilai',
      number: true,
    });
    expect(signalView({ type: 'INACTIVE', value: 9, threshold: 7 }, thresholds)).toEqual({
      key: 'teacherDash.signal.inactive',
      vars: { n: 9, limit: 7 },
      tab: 'progres',
    });
  });

  it('one never active in the slot reads as such', () => {
    expect(signalView({ type: 'INACTIVE', value: null, threshold: 7 }, thresholds)).toEqual({
      key: 'teacherDash.signal.neverActive',
      vars: {},
      tab: 'progres',
    });
  });

  it('a type not known here is left out', () => {
    expect(signalView({ type: 'SOMETHING_NEW', value: 1, threshold: 1 }, thresholds)).toBeNull();
  });

  it('leads to the slot page on that tab', () => {
    expect(signalPath('cs-1', 'nilai')).toBe('/teacher/courses/cs-1?tab=nilai');
  });
});

describe('barWidth', () => {
  it('keeps a bar within 0-100 and draws none for no percent', () => {
    expect(barWidth(30)).toBe(30);
    expect(barWidth(140)).toBe(100);
    expect(barWidth(null)).toBe(0);
  });
});
