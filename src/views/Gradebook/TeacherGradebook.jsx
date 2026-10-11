import React from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';

import TeacherCourses from '../Course/TeacherCourses';

/*
  The sidebar's "Buku Nilai" for a teacher (owner, 2026-10-11: one dropdown over
  every class subject was too much to read). It is a way in, not a page of its own:
  the subjects as "Kelas Saya" shows them, a semester at a time (TeacherCourses
  with `gradebook`), each opening that subject's "Nilai" tab, where the table is
  (GradebookTable, in TeacherClassSubjectDetail).

  No average and no total (owner, 2026-10-10): the backend has no weights for
  Tugas, Kuis, UTS and UAS nor a report-card score yet.

  An old link `?cs=<classSubjectId>` goes straight to that subject's tab. The
  homeroom teacher and the leaders read the same table through GradebookReader.
*/
export const TeacherGradebook = () => {
  const [searchParams] = useSearchParams();
  const asked = searchParams.get('cs');
  if (asked) return <Navigate to={`/teacher/courses/${encodeURIComponent(asked)}?tab=nilai`} replace />;
  return <TeacherCourses gradebook />;
};

export default TeacherGradebook;
