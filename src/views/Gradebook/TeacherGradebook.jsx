import React from 'react';

import NotBuiltYet from '../../components/ui/NotBuiltYet';
import { useT } from '../../i18n/LanguageContext';

/*
  The teacher's gradebook. The backend has no assignment, submission or grade
  model yet, so the page says "not available yet" under its own heading, as the
  other screens without a route do.

  It used to be a full grading screen on invented data (sampleTeacherData.js, under
  a "sample data" banner). That file stopped providing what the screen read, so
  opening it crashed the whole app; the owner chose (2026-10-05) to drop the sample
  data rather than patch it. Build it again on the real contract when grading lands.
*/
export const TeacherGradebook = () => {
  const { t } = useT();

  return (
    <div className="space-y-6 text-left">
      <h1 className="text-3xl font-extrabold leading-tight tracking-tight text-slate-900">{t('teacherGradebook.title')}</h1>
      <NotBuiltYet />
    </div>
  );
};

export default TeacherGradebook;
