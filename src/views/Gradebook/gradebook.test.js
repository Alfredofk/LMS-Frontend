import { describe, expect, it } from 'vitest';

import { belowKktp, cellOf, finalFlags, finalNotes, finalOf, gradebookColumns, gradebookCsv, gradebookRows } from './gradebook';

const now = new Date('2026-10-20T00:00:00Z');
const a = (id, status, opensAt, title = id) => ({ id, status, opensAt, title, type: 'KUIS' });

describe('gradebook - the table', () => {
  const columns = gradebookColumns(
    [a('later', 'PUBLISHED', '2026-10-25T00:00:00Z'), a('first', 'PUBLISHED', '2026-10-12T00:00:00Z'), a('draft', 'DRAFT', '2026-10-01T00:00:00Z'), a('cancelled', 'CANCELLED', '2026-10-01T00:00:00Z')],
    now
  );

  it('published ones, earliest first, each saying whether it opened', () => {
    expect(columns.map((c) => `${c.assessment.id}:${c.opened}`)).toEqual(['first:true', 'later:false']);
  });

  it('an offline one is read before its window: its marks may be released early', () => {
    const [offline] = gradebookColumns([{ ...a('paper', 'PUBLISHED', '2026-10-25T00:00:00Z'), mode: 'OFFLINE' }], now);
    expect(offline.opened).toBe(true);
  });

  it('a cell: the score that counts, else why not; a column not open says so', () => {
    expect(cellOf(columns[0], { status: 'RELEASED', countedScore: 87.5, countedFromRemedial: false })).toEqual({ score: 87.5, remedial: false });
    expect(cellOf(columns[0], { status: 'DID_NOT_SUBMIT', countedScore: null, countedFromRemedial: false })).toEqual({ word: 'DID_NOT_SUBMIT' });
    expect(cellOf(columns[0], { status: null, countedScore: null, countedFromRemedial: false })).toEqual({ word: 'NOT_STARTED' });
    expect(cellOf(columns[0], undefined)).toEqual({ word: 'NOT_STARTED' });
    expect(cellOf(columns[1], { status: 'RELEASED', countedScore: 90 })).toEqual({ word: 'notOpen' });
    expect(cellOf(columns[0], { status: 'RELEASED', countedScore: 0, countedFromRemedial: false })).toEqual({ score: 0, remedial: false });
  });

  it('a score only a remedial reached carries the recap flag', () => {
    expect(cellOf(columns[0], { status: 'RELEASED', countedScore: 80, countedFromRemedial: true })).toEqual({ score: 80, remedial: true });
  });

  it('rows: the recap students by name, cells matched by assessment id, cancelled columns skipped', () => {
    const cell = (assessmentId, over) => ({ assessmentId, status: 'NOT_STARTED', countedScore: null, countedFromRemedial: false, ...over });
    const rows = gradebookRows(columns, {
      students: [
        { studentProfileId: 'p2', fullName: 'Budi', placedNow: false, cells: [cell('cancelled'), cell('first', { status: 'DID_NOT_SUBMIT' }), cell('later')] },
        { studentProfileId: 'p1', fullName: 'Ani', placedNow: true, cells: [cell('cancelled'), cell('later'), cell('first', { status: 'RELEASED', countedScore: 90 })] },
      ],
    });
    expect(rows.map((row) => `${row.fullName}:${row.placedNow}`)).toEqual(['Ani:true', 'Budi:false']);
    expect(rows[0].cells).toEqual([{ score: 90, remedial: false }, { word: 'notOpen' }]);
    expect(rows[1].cells).toEqual([{ word: 'DID_NOT_SUBMIT' }, { word: 'notOpen' }]);
  });

  it('no recap students, no rows', () => {
    expect(gradebookRows(columns, { students: [] })).toEqual([]);
    expect(gradebookRows(columns, null)).toEqual([]);
  });

  it('CSV in the reader language: ; and 87,5 in Indonesian, , and 87.5 in English, a BOM first', () => {
    const rows = [{ fullName: 'Ani; "A"', cells: [{ score: 87.5 }, { word: 'notOpen' }] }];
    const opts = { nameHeader: 'Nama', columnHeader: (x) => x.title, words: (key) => (key === 'notOpen' ? 'Belum dibuka' : key) };
    const id = gradebookCsv(columns, rows, { ...opts, lang: 'id' });
    expect(id.charCodeAt(0)).toBe(0xfeff);
    expect(id.slice(1)).toBe('Nama;first;later\r\n"Ani; ""A""";87,5;Belum dibuka\r\n');
    expect(gradebookCsv(columns, rows, { ...opts, lang: 'en' }).slice(1)).toBe('Nama,first,later\r\nAni; "A",87.5,Belum dibuka\r\n'.replace('Ani; "A"', '"Ani; ""A"""'));
  });
});

describe('gradebook - under the KKTP', () => {
  it('a score under it is marked; at it, a word, or no KKTP read is not', () => {
    expect(belowKktp({ score: 69.5, remedial: false }, 70)).toBe(true);
    expect(belowKktp({ score: 70, remedial: false }, 70)).toBe(false);
    expect(belowKktp({ score: 0, remedial: false }, 70)).toBe(true);
    expect(belowKktp({ word: 'DID_NOT_SUBMIT' }, 70)).toBe(false);
    expect(belowKktp({ score: 10, remedial: false }, null)).toBe(false);
    expect(belowKktp({ score: 10, remedial: false }, 0)).toBe(false);
    expect(belowKktp({ score: null }, 70)).toBe(false);
    expect(belowKktp(undefined, 70)).toBe(false);
  });
});

describe('gradebook - the final grade', () => {
  // A row of GET /grading/class-subjects/:id/grades (grading.grades.js slotGrades).
  const graded = (over = {}) => ({
    studentProfileId: 'p1',
    fullName: 'Ani',
    placedNow: true,
    reportedHere: true,
    reportedBy: { id: 'c1', name: 'XI IPS' },
    grade: {
      types: { TUGAS: { average: 82.5, weight: 26.67, count: 2 }, KUIS: null, UTS: { average: 75, weight: 46.67, count: 1 }, UAS: null },
      finalGrade: { unrounded: 78.4, value: 78 },
      didNotSubmit: 1,
      waiting: 2,
      remedialRuleMoved: 1,
      pooled: 0,
    },
    describedHere: true,
    description: null,
    ...over,
  });

  it('a student this slot reports: the grade, its types and the counts', () => {
    expect(finalOf(graded())).toEqual({
      value: 78,
      unrounded: 78.4,
      types: graded().grade.types,
      didNotSubmit: 1,
      waiting: 2,
      remedialRuleMoved: 1,
      pooled: 0,
    });
  });

  it('nothing weighted counts yet: no value, the counts still said', () => {
    const final = finalOf(graded({ grade: { types: {}, finalGrade: null, didNotSubmit: 0, waiting: 3, remedialRuleMoved: 0, pooled: 0 } }));
    expect(final.value).toBeNull();
    expect(final.unrounded).toBeNull();
    expect(final.waiting).toBe(3);
  });

  it('reported by another class: that class, no grade; no row at all: null', () => {
    expect(finalOf(graded({ reportedHere: false, reportedBy: { id: 'c2', name: 'XI IPA 1' }, grade: null }))).toEqual({ reportedBy: 'XI IPA 1' });
    expect(finalOf(graded({ reportedHere: false, reportedBy: null, grade: null }))).toEqual({ reportedBy: null });
    expect(finalOf(undefined)).toBeNull();
  });

  it('under the number: waiting, then did not submit, only above 0', () => {
    expect(finalFlags(finalOf(graded()))).toEqual([
      { key: 'waiting', n: 2 },
      { key: 'didNotSubmit', n: 1 },
    ]);
    expect(finalFlags(finalOf(graded({ grade: { ...graded().grade, waiting: 0, didNotSubmit: 0 } })))).toEqual([]);
    expect(finalFlags({ reportedBy: 'XI IPA 1' })).toEqual([]);
    expect(finalFlags(null)).toEqual([]);
  });

  it('in the details: all four counts above 0', () => {
    expect(finalNotes(finalOf(graded()))).toEqual([
      { key: 'waiting', n: 2 },
      { key: 'didNotSubmit', n: 1 },
      { key: 'remedialRuleMoved', n: 1 },
    ]);
    expect(finalNotes({ reportedBy: null })).toEqual([]);
  });

  it('rows carry it by student id; no grade read, null for every row', () => {
    const columns = gradebookColumns([a('q', 'PUBLISHED', '2026-10-12T00:00:00Z')], now);
    const recap = { students: [{ studentProfileId: 'p1', fullName: 'Ani', cells: [] }, { studentProfileId: 'p9', fullName: 'Zed', cells: [] }] };
    const rows = gradebookRows(columns, recap, { students: [graded()] });
    expect(rows[0].final.value).toBe(78);
    expect(rows[1].final).toBeNull();
    expect(gradebookRows(columns, recap).map((row) => row.final)).toEqual([null, null]);
  });

  it('under the KKTP like a score', () => {
    expect(belowKktp({ score: finalOf(graded()).value }, 80)).toBe(true);
    expect(belowKktp({ score: finalOf(graded()).value }, 78)).toBe(false);
    expect(belowKktp({ score: null }, 80)).toBe(false);
  });

  it('CSV: a last column with the whole number, "-" where none', () => {
    const columns = gradebookColumns([a('q', 'PUBLISHED', '2026-10-12T00:00:00Z')], now);
    const rows = [
      { fullName: 'Ani', cells: [{ score: 87.5 }], final: { value: 78 } },
      { fullName: 'Budi', cells: [{ score: 60 }], final: { reportedBy: 'XI IPA 1' } },
      { fullName: 'Cici', cells: [{ score: 70 }], final: null },
    ];
    const csv = gradebookCsv(columns, rows, { lang: 'id', nameHeader: 'Nama', columnHeader: (x) => x.title, words: (key) => key, finalHeader: 'Nilai akhir' });
    expect(csv.slice(1)).toBe('Nama;q;Nilai akhir\r\nAni;87,5;78\r\nBudi;60;-\r\nCici;70;-\r\n');
  });
});
