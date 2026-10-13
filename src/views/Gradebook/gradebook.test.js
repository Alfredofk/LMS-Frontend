import { describe, expect, it } from 'vitest';

import { cellOf, gradebookColumns, gradebookCsv, gradebookRows } from './gradebook';

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
