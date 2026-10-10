import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';

import Select from '../../components/ui/Select';
import { useT } from '../../i18n/LanguageContext';
import { assessmentErrorMessage } from '../../i18n/apiError';
import { academicsService } from '../../services/academicsService';
import { liveAssignments, openSemesterIds } from '../Dashboard/teacherHome';
import GradebookTable from './GradebookTable';
import { gradebookChoices, shownChoice } from './gradebook';

/*
  The teacher's gradebook (backend 5255842 gave scores; owner 2026-10-10): one
  class subject at a time (`?cs=`), chosen from every one they taught, the one
  taught now first; the table is GradebookTable, a column or a score opening that
  assessment's "Hasil" tab.

  No average and no total (owner's choice): the backend has no weights for Tugas,
  Kuis, UTS and UAS nor a report-card score yet, so any number made here would be
  read as one. "Unduh CSV" saves the table as shown, in the reader's language.

  The homeroom teacher and the leaders read the same table, per subject and read
  only, through GradebookReader.
*/

const card = 'bg-white border border-slate-100 rounded-2xl p-5 sm:p-6 shadow-sm';

export const TeacherGradebook = () => {
  const { t } = useT();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  /* undefined reading · { choices, liveIds } · { error } */
  const [teaching, setTeaching] = useState(undefined);

  useEffect(() => {
    let cancelled = false;
    Promise.all([academicsService.myClassSubjects(), academicsService.academicYears()])
      .then(([rows, years]) => {
        if (cancelled) return;
        const liveIds = new Set(liveAssignments(rows, openSemesterIds(years)).map((row) => row.id));
        setTeaching({ choices: gradebookChoices(rows), liveIds });
      })
      .catch((err) => !cancelled && setTeaching({ error: assessmentErrorMessage(err, t) }));
    return () => {
      cancelled = true;
    };
  }, [t]);

  const choices = teaching?.choices ?? [];
  const shownId = teaching && !teaching.error ? shownChoice(choices, searchParams.get('cs'), teaching.liveIds) : null;
  const shown = choices.find((row) => row.id === shownId) ?? null;

  /* An ended assignment (replaced, or the subject stopped) reads like the live one of its slot without its mark. */
  const optionLabel = (row) =>
    t(row.endedAt ? 'gradebook.optionEnded' : 'gradebook.option', {
      code: row.subject?.code ?? '',
      className: row.class?.name ?? '',
      n: row.semester?.ordinal ?? '',
      year: row.semester?.academicYear ?? '',
    });

  let body;
  if (teaching === undefined) {
    body = <div className="h-64 rounded-2xl bg-white border border-slate-100 animate-pulse" aria-busy="true" aria-label={t('common.loading')} />;
  } else if (teaching.error) {
    body = (
      <div className={`${card} flex flex-col items-center text-center gap-3 py-10`} role="alert">
        <AlertCircle className="w-8 h-8 text-rose-500" aria-hidden="true" />
        <p className="text-sm font-bold text-slate-700 max-w-sm">{teaching.error}</p>
      </div>
    );
  } else if (!shown) {
    body = <p className={`${card} text-sm font-semibold text-slate-600`}>{t('gradebook.noSubjects')}</p>;
  } else {
    body = (
      <GradebookTable
        key={shown.id}
        classSubjectId={shown.id}
        caption={optionLabel(shown)}
        fileName={`nilai-${shown.subject?.code ?? ''}-${shown.class?.name ?? ''}.csv`.replace(/\s+/g, '-')}
        onOpen={(assessment) => navigate(`/teacher/courses/${shown.id}/penilaian/${assessment.id}?tab=hasil`)}
      />
    );
  }

  return (
    <div className="space-y-6 text-left">
      <div className="space-y-1">
        <h1 className="text-3xl font-extrabold leading-tight tracking-tight text-slate-900">{t('teacherGradebook.title')}</h1>
        <p className="text-sm font-medium text-slate-500">{t('gradebook.intro')}</p>
      </div>

      {choices.length > 0 && (
        <Select
          id="gradebook-choice"
          className="w-full sm:w-80"
          aria-label={t('gradebook.pick')}
          value={shownId ?? ''}
          onChange={(e) => setSearchParams({ cs: e.target.value })}
        >
          {choices.map((row) => (
            <option key={row.id} value={row.id}>
              {optionLabel(row)}
            </option>
          ))}
        </Select>
      )}

      {body}
    </div>
  );
};

export default TeacherGradebook;
