import { describe, it, expect } from 'vitest';

import { splitMoves, pendingMoveByStudent, groupTargets, changesGrade } from './moves.js';
import { validateOptionalReason } from '../../utils/validation.js';

/* The shape classMoveView (academics.service.js) answers with. */
const move = (id, status, { canDecide = false, canCancel = false, student = 's-' + id, from = 10, to = 10 } = {}) => ({
  id,
  status,
  reason: null,
  requestedAt: '2026-09-25T00:00:00.000Z',
  decidedAt: null,
  rejectionReason: null,
  student: { studentProfileId: student, fullName: 'Siswa ' + id, nisn: '0012345678' },
  fromClass: { id: 'c-from', name: 'X A', gradeLevel: from },
  toClass: { id: 'c-to', name: 'X B', gradeLevel: to },
  canDecide: status === 'PENDING' && canDecide,
  canCancel: status === 'PENDING' && canCancel,
});

describe('splitMoves — which list a move belongs in (classMoveView canDecide / canCancel)', () => {
  it('puts a waiting move this teacher decides under decide, one they sent under waiting', () => {
    const out = splitMoves([move('a', 'PENDING', { canDecide: true }), move('b', 'PENDING', { canCancel: true })]);
    expect(out.decide.map((m) => m.id)).toEqual(['a']);
    expect(out.waiting.map((m) => m.id)).toEqual(['b']);
    expect(out.history).toEqual([]);
  });

  it('puts every decided or withdrawn move in history, in the order the server sent', () => {
    const out = splitMoves([move('c', 'REJECTED'), move('d', 'ACTIVE'), move('e', 'CANCELLED')]);
    expect(out.history.map((m) => m.id)).toEqual(['c', 'd', 'e']);
    expect(out.decide).toEqual([]);
    expect(out.waiting).toEqual([]);
  });

  it('answers empty lists for nothing at all', () => {
    expect(splitMoves(null)).toEqual({ decide: [], waiting: [], history: [] });
  });
});

describe('pendingMoveByStudent — a roster row that already has a move waiting', () => {
  it('maps only PENDING moves, by studentProfileId', () => {
    const map = pendingMoveByStudent([
      move('a', 'PENDING', { canCancel: true, student: 's1' }),
      move('b', 'REJECTED', { student: 's2' }),
    ]);
    expect([...map.keys()]).toEqual(['s1']);
    expect(map.get('s1').id).toBe('a');
  });
});

describe('groupTargets — the classes a student may move to (listMoveTargets)', () => {
  it('groups by grade, lowest first, and sorts each grade by name', () => {
    const groups = groupTargets([
      { id: '1', name: 'XI B', gradeLevel: 11 },
      { id: '2', name: 'X C', gradeLevel: 10 },
      { id: '3', name: 'X A', gradeLevel: 10 },
    ]);
    expect(groups.map((g) => g.grade)).toEqual([10, 11]);
    expect(groups[0].classes.map((c) => c.name)).toEqual(['X A', 'X C']);
  });
});

describe('changesGrade — a move across grades is allowed, and said', () => {
  it('is true only when the two grades differ', () => {
    expect(changesGrade(move('a', 'PENDING', { from: 10, to: 11 }))).toBe(true);
    expect(changesGrade(move('b', 'PENDING', { from: 10, to: 10 }))).toBe(false);
    expect(changesGrade(null)).toBe(false);
  });
});

describe('validateOptionalReason — classMoveBody reason, academics.schema.js', () => {
  it('lets an empty reason through, and holds a typed one to 3–500 after trim', () => {
    expect(validateOptionalReason('')).toBeNull();
    expect(validateOptionalReason('   ')).toBeNull();
    expect(validateOptionalReason(' ab ')).toEqual({ key: 'validation.leaveReason.short' });
    expect(validateOptionalReason('abc')).toBeNull();
    expect(validateOptionalReason('x'.repeat(501))).toEqual({ key: 'validation.leaveReason.long' });
  });
});
