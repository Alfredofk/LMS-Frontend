import { describe, it, expect } from 'vitest';

import { classSubjectsOf } from './homeroomSubjects.js';

/* A board as academics.service.js `subjectBoard` answers it. */
const subject = (classSubjectId, code, name, status = 'ACTIVE') => ({
  classSubjectId,
  status,
  subject: { id: `sub-${code}`, code, name },
  teacher: { membershipId: 'm1', fullName: 'Kevin' },
});
const board = {
  semester: { id: 'sem1', ordinal: 1, status: 'OPEN', academicYear: '2028/2029', classSubjectRegistrationDeadline: null },
  classes: [
    { id: 'c-ips', name: 'XI IPS', gradeLevel: 11, homeroomTeacher: null, subjects: [subject('cs1', 'EKO', 'Ekonomi'), subject('cs2', 'BIO', 'Biologi', 'PENDING'), subject('cs3', 'AGM', 'Pendidikan Agama')] },
    { id: 'c-ipa', name: 'XI IPA', gradeLevel: 11, homeroomTeacher: null, subjects: [subject('cs4', 'MTK', 'Matematika')] },
  ],
};

describe('classSubjectsOf — the subjects of one class that can have meetings', () => {
  it('keeps the ACTIVE ones of that class only, by name', () => {
    expect(classSubjectsOf(board, 'c-ips').map((row) => row.classSubjectId)).toEqual(['cs1', 'cs3']);
  });

  it('leaves out a PENDING request, which never had a timetable', () => {
    expect(classSubjectsOf(board, 'c-ips').some((row) => row.status === 'PENDING')).toBe(false);
  });

  it('answers nothing for a class not on the board, or no board', () => {
    expect(classSubjectsOf(board, 'c-other')).toEqual([]);
    expect(classSubjectsOf(null, 'c-ips')).toEqual([]);
  });
});
