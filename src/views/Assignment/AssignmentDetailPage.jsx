import React from 'react';

import NotBuiltYet from '../../components/ui/NotBuiltYet';
import { useT } from '../../i18n/LanguageContext';

/*
  One assignment, for a student (/assignment/:id). The backend has no assignment or
  submission model yet, so the page says "not available yet" under its heading.

  It used to be a full assignment screen - a chemistry lab brief written into the
  JSX, looked up in classroomData.js, which was empty - so every visit showed its
  not-found state. Owner, 2026-10-05: keep the route (the assessment list, the
  dashboard widget and the scores page link here once rows exist) and drop the
  invented content. Build it on the real contract when assignments land.
*/
export const AssignmentDetailPage = () => {
  const { t } = useT();

  return (
    <div className="space-y-6 text-left">
      <h1 className="text-3xl font-extrabold leading-tight tracking-tight text-slate-900">{t('shell.title.assignment')}</h1>
      <NotBuiltYet />
    </div>
  );
};

export default AssignmentDetailPage;
