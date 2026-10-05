import React from 'react';

import NotBuiltYet from '../../components/ui/NotBuiltYet';
import { useT } from '../../i18n/LanguageContext';

/*
  A teacher setting an assignment (/teacher/create-assignment). The backend has no
  assignment model yet, so the page says "not available yet" under its heading.

  It used to be a full form posting to an endpoint that never existed, reachable by
  URL only. Owner, 2026-10-05: keep the route, drop the form. Build it on the real
  contract when assignments land, and link to it from the teacher's subject page.
*/
export const CreateAssignmentForm = () => {
  const { t } = useT();

  return (
    <div className="space-y-6 text-left">
      <h1 className="text-3xl font-extrabold leading-tight tracking-tight text-slate-900">{t('shell.title.createAssignment')}</h1>
      <NotBuiltYet />
    </div>
  );
};

export default CreateAssignmentForm;
