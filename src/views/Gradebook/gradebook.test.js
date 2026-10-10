import { describe, expect, it } from 'vitest';

import { cellOf, gradebookChoices, gradebookColumns, gradebookCsv, gradebookRows, shownChoice } from './gradebook';

const now = new Date('2026-10-20T00:00:00Z');
const a = (id, status, opensAt, title = id) => ({ id, status, opensAt, title, type: 'KUIS' });

describe('gradebook - choosing the class subject', () => {
  const rows = [
    { id: 'old', status: 'ACTIVE', subject: { code: 'MTK' }, class: { name: 'X A' }, semester: { academicYear: '2025/2026', ordinal: 2 } },
    { id: 'fis', status: 'ACTIVE', subject: { code: 'FIS' }, class: { name: 'XI IPS' }, semester: { academicYear: '2026/2027', ordinal: 1 } },
    { id: 'mtk', status: 'ACTIVE', subject: { code: 'MTK' }, class: { name: 'XI IPS' }, semester: { academicYear: '2026/2027', ordinal: 1 } },
    { id: 'pending', status: 'PENDING', subject: { code: 'BIO' }, class: { name: 'XI IPS' }, semester: { academicYear: '2026/2027', ordinal: 1 } },
  ];

  it('taught ones only, newest semester first, then subject and class', () => {
    expect(gradebookChoices(rows).map((row) => row.id)).toEqual(['fis', 'mtk', 'old']);
  });

  it('the one asked for, else the first live one, else the first', () => {
    const choices = gradebookChoices(rows);
    expect(shownChoice(choices, 'old', new Set(['mtk']))).toBe('old');
    expect(shownChoice(choices, 'nope', new Set(['mtk']))).toBe('mtk');
    expect(shownChoice(choices, null, new Set())).toBe('fis');
    expect(shownChoice([], null)).toBeNull();
  });
});

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

  it('a cell: the score that counts, else why not; a failed read and a column not open say so', () => {
    const results = { students: [{ studentProfileId: 'p1', countedScore: 87.5, status: 'RELEASED' }, { studentProfileId: 'p2', countedScore: null, status: 'DID_NOT_SUBMIT' }] };
    expect(cellOf(columns[0], results, 'p1')).toEqual({ score: 87.5 });
    expect(cellOf(columns[0], results, 'p2')).toEqual({ word: 'DID_NOT_SUBMIT' });
    expect(cellOf(columns[0], results, 'p9')).toEqual({ word: 'NOT_STARTED' });
    expect(cellOf(columns[0], null, 'p1')).toEqual({ word: 'failed' });
    expect(cellOf(columns[1], results, 'p1')).toEqual({ word: 'notOpen' });
    expect(cellOf(columns[0], { students: [{ studentProfileId: 'p3', countedScore: 0, status: 'RELEASED' }] }, 'p3')).toEqual({ score: 0 });
  });

  it('rows: every student named, by name, moved once moved anywhere', () => {
    const rows = gradebookRows(columns, {
      first: { students: [{ studentProfileId: 'p2', fullName: 'Budi', placedNow: false, countedScore: null, status: 'DID_NOT_SUBMIT' }, { studentProfileId: 'p1', fullName: 'Ani', placedNow: true, countedScore: 90, status: 'RELEASED' }] },
    });
    expect(rows.map((row) => `${row.fullName}:${row.placedNow}`)).toEqual(['Ani:true', 'Budi:false']);
    expect(rows[0].cells).toEqual([{ score: 90 }, { word: 'notOpen' }]);
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
