import { describe, expect, it } from 'vitest';

import { DESCRIPTION_MAX, descriptionErrors, descriptionRows, descriptionsBody, draftsAfterSave, isChanged, savedCount, shownRows, textOf, willClear } from './descriptions';

// Rows of GET /grading/class-subjects/:id/grades (grading.grades.js slotGrades), as backend 483be5a answers them.
const student = (id, over = {}) => ({
  studentProfileId: id,
  fullName: id.toUpperCase(),
  placedNow: true,
  reportedHere: true,
  reportedBy: { id: 'c1', name: 'XI IPS' },
  grade: { types: {}, finalGrade: { unrounded: 80.4, value: 80 }, didNotSubmit: 0, waiting: 0, remedialRuleMoved: 0, pooled: 0 },
  describedHere: true,
  description: null,
  ...over,
});
const saved = (text) => ({ text, updatedAt: '2026-10-18T04:00:00.000Z' });

describe('descriptions - who is listed', () => {
  const grades = {
    students: [
      student('ani', { description: saved('Baik.') }),
      student('budi', { reportedHere: false, reportedBy: { id: 'c2', name: 'XI IPA 1' }, grade: null, describedHere: false }),
      student('cici', { grade: { types: {}, finalGrade: null } }),
      student('dodi', { describedHere: false }),
    ],
  };

  it('only the students this slot describes, in the read order, with their final grade and saved text', () => {
    expect(descriptionRows(grades)).toEqual([
      { studentProfileId: 'ani', fullName: 'ANI', finalValue: 80, saved: saved('Baik.') },
      { studentProfileId: 'cici', fullName: 'CICI', finalValue: null, saved: null },
    ]);
    expect(descriptionRows(null)).toEqual([]);
  });

  it('what this card saved since the read wins over it', () => {
    const rows = descriptionRows(grades, { cici: saved('Rajin.') });
    expect(rows[1].saved).toEqual(saved('Rajin.'));
    expect(savedCount(rows)).toBe(2);
    expect(savedCount(descriptionRows(grades))).toBe(1);
  });
});

describe('descriptions - editing and sending', () => {
  const rows = descriptionRows({ students: [student('ani', { description: saved('Baik.') }), student('cici')] });

  it('a box shows the draft, else the saved text, else nothing', () => {
    expect(textOf(rows[0], {})).toBe('Baik.');
    expect(textOf(rows[0], { ani: '' })).toBe('');
    expect(textOf(rows[1], {})).toBe('');
  });

  it('changed means different once trimmed; an untouched or blank new box is not', () => {
    expect(isChanged(rows[0], { ani: '  Baik.  ' })).toBe(false);
    expect(isChanged(rows[0], { ani: 'Baik sekali.' })).toBe(true);
    expect(isChanged(rows[1], { cici: '   ' })).toBe(false);
    expect(isChanged(rows[1], {})).toBe(false);
  });

  it('a saved one emptied will be cleared, never an error (optional since eadf680); only past the cap is, counted trimmed', () => {
    expect(descriptionErrors(rows, { ani: '   ' })).toEqual({});
    expect(willClear(rows[0], { ani: '   ' })).toBe(true);
    expect(willClear(rows[1], { cici: '' })).toBe(false);
    expect(descriptionErrors(rows, { cici: 'x'.repeat(DESCRIPTION_MAX + 1) })).toEqual({ cici: 'tooLong' });
    expect(descriptionErrors(rows, { cici: ` ${'x'.repeat(DESCRIPTION_MAX)} ` })).toEqual({});
    expect(descriptionErrors(rows, { cici: '' })).toEqual({});
  });

  it('the body: changed boxes, text trimmed or null to clear, each with the updatedAt read or null', () => {
    expect(descriptionsBody(rows, { ani: ' Baik sekali. ', cici: 'Rajin.' })).toEqual([
      { studentProfileId: 'ani', text: 'Baik sekali.', updatedAt: '2026-10-18T04:00:00.000Z' },
      { studentProfileId: 'cici', text: 'Rajin.', updatedAt: null },
    ]);
    expect(descriptionsBody(rows, { ani: '' })).toEqual([{ studentProfileId: 'ani', text: null, updatedAt: '2026-10-18T04:00:00.000Z' }]);
    expect(descriptionsBody(rows, { ani: 'Baik.', cici: '  ' })).toEqual([]);
  });

  it('after a save the rows sent leave the drafts, other typing stays', () => {
    expect(draftsAfterSave({ ani: 'a', cici: 'c' }, [{ studentProfileId: 'ani' }])).toEqual({ cici: 'c' });
  });
});

describe('descriptions - the filter (owner, 2026-10-18)', () => {
  const rows = descriptionRows({ students: [student('ani', { description: saved('Baik.') }), student('budi'), student('cici', { description: { text: null, updatedAt: '2026-10-18T04:00:00.000Z' } })] });

  it('all, or the ones with nothing saved (a cleared one too)', () => {
    expect(shownRows(rows, {}, 'all').map((row) => row.studentProfileId)).toEqual(['ani', 'budi', 'cici']);
    expect(shownRows(rows, {}, 'missing').map((row) => row.studentProfileId)).toEqual(['budi', 'cici']);
  });

  it('a row being typed in, or typed in since the filter was picked, stays', () => {
    expect(shownRows(rows, { ani: 'Baik sekali.' }, 'missing').map((row) => row.studentProfileId)).toEqual(['ani', 'budi', 'cici']);
    expect(shownRows(rows, {}, 'missing', new Set(['ani'])).map((row) => row.studentProfileId)).toEqual(['ani', 'budi', 'cici']);
  });
});
