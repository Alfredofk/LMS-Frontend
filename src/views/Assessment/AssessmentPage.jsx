import React from 'react';

import NotBuiltYet from '../../components/ui/NotBuiltYet';
import { useT } from '../../i18n/LanguageContext';

/*
  A student's assessments (/assessment). The backend has the teachers' side
  (ticket 02, /api/assessments, staff only) but no student routes yet - ticket
  03 - so the page says "not available yet" under its heading.

  It used to be a full list - tabs, search, countdowns, grades - read from
  `/api/assessment/student`, a route that never existed, in a shape nobody had
  agreed. Owner, 2026-10-08: keep the route (the sidebar and the dashboard
  widget link here), drop the guessed contract. Build it on ticket 03's real
  routes; the teacher pages in views/TeacherAssessment show the view shapes.
*/
export const AssessmentPage = () => {
  const { t } = useT();

  return (
    <div className="space-y-6 text-left">
      <h1 className="text-3xl font-extrabold leading-tight tracking-tight text-slate-900">{t('shell.assessment')}</h1>
      <NotBuiltYet />
    </div>
  );
};

export default AssessmentPage;
