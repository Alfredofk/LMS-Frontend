import { describe, expect, it } from 'vitest';

import { NOTE_MAX, notedCount, noteChanged, noteErrors, noteRows, notesBody, noteTextOf, willClear } from './notes';

// GET /grading/classes/:id/semesters/:semesterId/notes (grading.texts.js readNotes), as backend 483be5a answers it.
const at = '2026-10-18T04:00:00.000Z';
const read = {
  class: { id: 'c1', name: 'XI IPS' },
  academicYear: '2026/2027',
  semester: { id: 's1', ordinal: 1, status: 'OPEN' },
  students: [
    { studentProfileId: 'ani', fullName: 'Ani', note: { text: 'Rajin.', updatedAt: at } },
    { studentProfileId: 'budi', fullName: 'Budi', note: { text: null, updatedAt: at } },
    { studentProfileId: 'cici', fullName: 'Cici', note: null },
  ],
};

describe('homeroom notes - the list', () => {
  it('every student of the read, in its order, with the Note saved (a cleared one keeps its row)', () => {
    expect(noteRows(read).map((row) => [row.studentProfileId, row.saved?.text ?? '-'])).toEqual([
      ['ani', 'Rajin.'],
      ['budi', '-'],
      ['cici', '-'],
    ]);
    expect(noteRows(null)).toEqual([]);
  });

  it('counts only Notes with text; what this card saved wins over the read', () => {
    expect(notedCount(noteRows(read))).toBe(1);
    expect(notedCount(noteRows(read, { cici: { text: 'Sopan.', updatedAt: at } }))).toBe(2);
    expect(notedCount(noteRows(read, { ani: { text: null, updatedAt: at } }))).toBe(0);
  });
});

describe('homeroom notes - editing and sending', () => {
  const rows = noteRows(read);

  it('a box shows the draft, else the saved text, else nothing', () => {
    expect(noteTextOf(rows[0], {})).toBe('Rajin.');
    expect(noteTextOf(rows[1], {})).toBe('');
    expect(noteTextOf(rows[0], { ani: '' })).toBe('');
  });

  it('changed means different once trimmed; a cleared or absent Note left empty is not', () => {
    expect(noteChanged(rows[0], { ani: ' Rajin. ' })).toBe(false);
    expect(noteChanged(rows[1], { budi: '  ' })).toBe(false);
    expect(noteChanged(rows[2], { cici: '' })).toBe(false);
    expect(noteChanged(rows[2], { cici: 'Sopan.' })).toBe(true);
  });

  it('a saved Note emptied will be cleared, never an error; only past the cap is', () => {
    expect(willClear(rows[0], { ani: '   ' })).toBe(true);
    expect(willClear(rows[2], { cici: '' })).toBe(false);
    expect(noteErrors(rows, { ani: '' })).toEqual({});
    expect(noteErrors(rows, { cici: 'x'.repeat(NOTE_MAX + 1) })).toEqual({ cici: 'tooLong' });
    expect(noteErrors(rows, { cici: ` ${'x'.repeat(NOTE_MAX)} ` })).toEqual({});
  });

  it('the body: changed boxes, text trimmed or null to clear, each with the updatedAt read or null', () => {
    expect(notesBody(rows, { ani: '', budi: ' Sopan. ', cici: 'Aktif.' })).toEqual([
      { studentProfileId: 'ani', text: null, updatedAt: at },
      { studentProfileId: 'budi', text: 'Sopan.', updatedAt: at },
      { studentProfileId: 'cici', text: 'Aktif.', updatedAt: null },
    ]);
    expect(notesBody(rows, { ani: 'Rajin.', cici: '' })).toEqual([]);
  });
});
