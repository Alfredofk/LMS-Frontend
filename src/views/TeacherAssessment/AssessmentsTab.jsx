import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, ClipboardList, Copy, Plus, RefreshCw } from 'lucide-react';

import { useT } from '../../i18n/LanguageContext';
import { assessmentErrorMessage } from '../../i18n/apiError';
import { assessmentService } from '../../services/assessmentService';
import AssessmentList from './AssessmentList';
import CopyFromDialog from './CopyFromDialog';

/*
  The "Penilaian" tab of a teacher's subject page (backend 0bb4598; owner
  2026-10-08): the slot's Assessments, drafts included, earliest window first
  (GET /assessments/class-subjects/:id), grouped by where they stand
  (AssessmentList, owner 2026-10-11). A row opens the assessment's own page;
  "Buat penilaian" opens a new one, and "Ambil dari penilaian lain" copies one in
  (CopyFromDialog), opening the draft made. Read only in a closed year.

  @param classSubjectId  the subject page's class subject
  @param readOnly        its year is closed
  @param semesterId      its semester, for a copy's window
  @param zone            the school's zone, for the windows
*/

const card = 'bg-white border border-slate-100 rounded-2xl p-5 shadow-sm';

export const AssessmentsTab = ({ classSubjectId, semesterId, readOnly = false, zone = null }) => {
  const { t } = useT();
  const navigate = useNavigate();
  /* undefined: reading · array · { error } */
  const [list, setList] = useState(undefined);
  const [attempt, setAttempt] = useState(0);
  const [copying, setCopying] = useState(false);

  useEffect(() => {
    let cancelled = false;
    assessmentService
      .listFor(classSubjectId)
      .then((rows) => !cancelled && setList(rows))
      .catch((err) => !cancelled && setList({ error: assessmentErrorMessage(err, t) }));
    return () => {
      cancelled = true;
    };
  }, [classSubjectId, attempt, t]);

  const base = `/teacher/courses/${classSubjectId}/penilaian`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-semibold text-slate-600 max-w-xl">{t('tasm.tab.intro')}</p>
        {!readOnly && (
          <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setCopying(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 text-sm font-bold hover:bg-slate-50 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            <Copy className="w-4 h-4" aria-hidden="true" />
            {t('tasm.from.open')}
          </button>
          <button
            type="button"
            onClick={() => navigate(`${base}/new`)}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-brand text-white text-sm font-extrabold hover:bg-brand-deep cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            {t('tasm.create')}
          </button>
          </div>
        )}
      </div>

      {list === undefined ? (
        <div className="h-28 rounded-2xl bg-white border border-slate-100 animate-pulse" aria-busy="true" aria-label={t('common.loading')} />
      ) : list.error ? (
        <div className={`${card} space-y-3`} role="alert">
          <p className="flex items-start gap-2 text-sm font-semibold text-rose-700">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
            {list.error}
          </p>
          <button
            type="button"
            onClick={() => setAttempt((n) => n + 1)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 text-xs font-bold hover:bg-slate-200 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
            {t('att.error.retry')}
          </button>
        </div>
      ) : list.length === 0 ? (
        <div className={`${card} flex flex-col items-center text-center gap-2 py-10`}>
          <ClipboardList className="w-8 h-8 text-slate-400" aria-hidden="true" />
          <p className="text-sm font-bold text-slate-700">{t('tasm.empty')}</p>
          <p className="text-xs font-semibold text-slate-500 max-w-sm">{t(readOnly ? 'tasm.emptyReadOnly' : 'tasm.emptyHint')}</p>
        </div>
      ) : (
        <AssessmentList assessments={list} zone={zone} onOpen={(assessment) => navigate(`${base}/${assessment.id}`)} />
      )}

      {copying && (
        <CopyFromDialog
          classSubjectId={classSubjectId}
          semesterId={semesterId}
          zone={zone}
          onClose={() => setCopying(false)}
          onCopied={(copies) => {
            setCopying(false);
            if (copies[0]) navigate(`${base}/${copies[0].id}`);
            else setAttempt((n) => n + 1);
          }}
        />
      )}
    </div>
  );
};

export default AssessmentsTab;
