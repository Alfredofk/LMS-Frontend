import { describe, expect, it } from 'vitest';

import { cellOf, countedFromRemedial, gradebookColumns, gradebookCsv, gradebookRows } from './gradebook';

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

  it('a cell: the score that counts, else why not; a failed read and a column not open say so', () => {
    const results = { students: [{ studentProfileId: 'p1', countedScore: 87.5, status: 'RELEASED' }, { studentProfileId: 'p2', countedScore: null, status: 'DID_NOT_SUBMIT' }] };
    expect(cellOf(columns[0], results, 'p1')).toEqual({ score: 87.5, remedial: false });
    expect(cellOf(columns[0], results, 'p2')).toEqual({ word: 'DID_NOT_SUBMIT' });
    expect(cellOf(columns[0], results, 'p9')).toEqual({ word: 'NOT_STARTED' });
    expect(cellOf(columns[0], null, 'p1')).toEqual({ word: 'failed' });
    expect(cellOf(columns[1], results, 'p1')).toEqual({ word: 'notOpen' });
    expect(cellOf(columns[0], { students: [{ studentProfileId: 'p3', countedScore: 0, status: 'RELEASED' }] }, 'p3')).toEqual({ score: 0, remedial: false });
  });

  it('rows: every student named, by name, moved once moved anywhere', () => {
    const rows = gradebookRows(columns, {
      first: { students: [{ studentProfileId: 'p2', fullName: 'Budi', placedNow: false, countedScore: null, status: 'DID_NOT_SUBMIT' }, { studentProfileId: 'p1', fullName: 'Ani', placedNow: true, countedScore: 90, status: 'RELEASED' }] },
    });
    expect(rows.map((row) => `${row.fullName}:${row.placedNow}`)).toEqual(['Ani:true', 'Budi:false']);
    expect(rows[0].cells).toEqual([{ score: 90, remedial: false }, { word: 'notOpen' }]);
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

describe('a score from a remedial (backend 1e6c749)', () => {
  const attempt = (over) => ({ status: 'RELEASED', releasedAt: '2026-10-20T00:00:00Z', remedial: false, score: { value: 60 }, ...over });
  it('marked only when the counted score is reached by remedial attempts alone', () => {
    expect(countedFromRemedial({ countedScore: 80, attempts: [attempt({}), attempt({ remedial: true, score: { value: 80 } })] })).toBe(true);
    expect(countedFromRemedial({ countedScore: 80, attempts: [attempt({ score: { value: 80 } }), attempt({ remedial: true, score: { value: 80 } })] })).toBe(false);
    expect(countedFromRemedial({ countedScore: 60, attempts: [attempt({}), attempt({ remedial: true, score: { value: 50 } })] })).toBe(false);
    expect(countedFromRemedial({ countedScore: null, attempts: [attempt({ remedial: true })] })).toBe(false);
  });
  it('a void or unreleased remedial attempt does not count', () => {
    expect(countedFromRemedial({ countedScore: 80, attempts: [attempt({ remedial: true, status: 'VOID', score: { value: 80 } })] })).toBe(false);
    expect(countedFromRemedial({ countedScore: 80, attempts: [attempt({ remedial: true, releasedAt: null, score: { value: 80 } })] })).toBe(false);
  });
  it('the cell carries it', () => {
    const column = { assessment: { id: 'a' }, opened: true };
    const results = { students: [{ studentProfileId: 'p1', countedScore: 80, status: 'RELEASED', attempts: [attempt({ remedial: true, score: { value: 80 } })] }] };
    expect(cellOf(column, results, 'p1')).toEqual({ score: 80, remedial: true });
  });
});
