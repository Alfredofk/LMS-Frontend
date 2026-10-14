import React from 'react';

import { SubjectList } from '../Classroom/ClassroomPage';

/*
  The sidebar's "Nilai" for a student (/scores; owner 2026-10-14, as the
  teacher's "Buku Nilai"). It is a way in, not a page of its own: the subjects as
  "Kelas Saya" shows them, a semester at a time, each opening that subject's
  "Nilai" tab (SubjectScores, in ClassroomSubject). It used to list every
  subject's scores in one long page (2026-10-12), which the owner did not want.
*/
export const StudentScores = () => <SubjectList scores />;

export default StudentScores;
