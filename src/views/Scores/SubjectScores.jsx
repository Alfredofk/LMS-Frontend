import React, { Fragment, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, ChevronRight, RefreshCw } from 'lucide-react';

import { useAuth } from '../../context/AuthContext';
import { useSchoolZone } from '../../hooks/useSchoolToday';
import { useT } from '../../i18n/LanguageContext';
import { studentAssessmentErrorMessage } from '../../i18n/apiError';
import { formatNumber } from '../TeacherAssessment/results';
import { shortWhen, typeModeText } from '../TeacherAssessment/teacherAssessment';
import { readMyMenu } from '../StudentAssessment/readMyMenu';
import { afterRuleOf, belowKktpOf, scoredEntriesOf, whenOf } from '../StudentAssessment/studentMenu';
import { noteAssessmentTab } from '../StudentAssessment/assessmentBack';

/*
  A subject's "Nilai" tab on the student's subject page (/classroom/:id?tab=nilai;
  owner 2026-10-14, like the teacher's "Nilai" tab): what is marked or can no
  longer be answered - the score that counts once released, "Menunggu rilis",
  "Tidak mengumpulkan" - latest closed first (scoredEntriesOf). A row opens the
  outline, where the attempts, points per question and the teacher's comments are
  read. The sidebar's "Nilai" (/scores) is only a way in: the subjects as cards,
  each opening this tab. It used to list every subject's scores on one page.

  No average or final mark: the Final Grade is never a student's to read. A score
  under the KKTP is red, with "KKTP 75" above the list (backend 3814cf9: each
  entry carries the `kktp` it is counted with; owner 2026-10-19). Never a LATIHAN,
  which is not graded (scoredEntriesOf). Read from the semester's GET /assessments/mine (readMyMenu), as the "Penilaian"
  tab is; a 404 for the semester means none for this student.
*/

const card = 'bg-white border border-slate-100 rounded-2xl shadow-sm';

const WORD_TONE = {
  WAITING_FOR_RELEASE: 'text-slate-600',
  DID_NOT_SUBMIT: 'text-rose-700',
};

const ScoreRow = ({ entry, zone, onOpen }) => {
  const { t, lang } = useT();
  const { assessment } = entry;
  /* "ditutup" or "closes": one waiting for release may still be open (2026-10-12). */
  const when = whenOf(entry);
  const facts = [typeModeText(t, assessment), t(`smenu.when.${when.key}`, { when: shortWhen(when.instant, zone, lang) })];
  const below = belowKktpOf(entry);
  return (
    <li>
      <button
        type="button"
        onClick={() => onOpen(entry)}
        className="w-full text-left px-4 sm:px-5 py-3.5 flex items-center gap-3 hover:bg-slate-50 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand first:rounded-t-2xl last:rounded-b-2xl"
      >
        <span className="min-w-0 flex-1 space-y-0.5">
          <span className="block text-sm font-extrabold text-slate-900 break-words">{assessment.title}</span>
          {/* FactLine's look - grey, light slashes - in spans: a button takes no <p>. */}
          <span className="block text-xs font-semibold text-slate-500">
            {facts.map((part, i) => (
              <Fragment key={part}>
                {i > 0 && (
                  <>
                    {' '}
                    <span className="mx-1 text-slate-300" aria-hidden="true">
                      /
                    </span>{' '}
                  </>
                )}
                <span className="whitespace-nowrap">{part}</span>
              </Fragment>
            ))}
          </span>
        </span>
        {entry.status === 'RELEASED' && entry.score !== null ? (
          <span className="shrink-0 text-right">
            <span className={`block text-lg font-extrabold tabular-nums leading-tight ${below ? 'text-rose-600' : 'text-slate-900'}`}>
              {formatNumber(entry.score, lang)}
              {below && <span className="sr-only"> ({t('gradebook.kktp.below')})</span>}
            </span>
            {afterRuleOf(entry) && (
              <span className="block text-[11px] font-semibold text-slate-500 tabular-nums">
                {t('smenu.afterRule', { score: formatNumber(afterRuleOf(entry).score, lang) })}
              </span>
            )}
          </span>
        ) : (
          <span className={`shrink-0 text-xs font-bold ${WORD_TONE[entry.status] ?? 'text-slate-600'}`}>{t(`smenu.status.${entry.status}`)}</span>
        )}
        <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" aria-hidden="true" />
      </button>
    </li>
  );
};

/**
 * @param classSubjectId  the subject page's class subject
 * @param semesterId      its semester, the menu to read
 */
export const SubjectScores = ({ classSubjectId, semesterId }) => {
  const { t } = useT();
  const navigate = useNavigate();
  const zone = useSchoolZone();
  const { membership } = useAuth();
  const [attempt, setAttempt] = useState(0);
  const asked = `${semesterId}|${attempt}`;
  /* undefined reading · entries · { error } */
  const [read, setRead] = useState({ key: null, value: undefined });
  const value = read.key === asked ? read.value : undefined;

  useEffect(() => {
    let cancelled = false;
    readMyMenu(membership?.id, semesterId, { fresh: attempt > 0 })
      .then((menu) => !cancelled && setRead({ key: asked, value: scoredEntriesOf(menu.classes, classSubjectId) }))
      .catch((err) => {
        if (cancelled) return;
        setRead({ key: asked, value: err?.status === 404 ? [] : { error: studentAssessmentErrorMessage(err, t) } });
      });
    return () => {
      cancelled = true;
    };
  }, [asked, attempt, membership?.id, semesterId, classSubjectId, t]);

  if (value === undefined) {
    return <div className="h-48 rounded-2xl bg-white border border-slate-100 animate-pulse" aria-busy="true" aria-label={t('common.loading')} />;
  }
  if (value.error) {
    return (
      <div className={`${card} p-6 flex flex-col items-center text-center gap-3 py-8`} role="alert">
        <AlertCircle className="w-7 h-7 text-rose-500" aria-hidden="true" />
        <p className="text-sm font-bold text-slate-700 max-w-sm">{value.error}</p>
        <button
          type="button"
          onClick={() => setAttempt((n) => n + 1)}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold hover:bg-slate-200 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        >
          <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
          {t('att.error.retry')}
        </button>
      </div>
    );
  }

  /* One KKTP per subject: the reporting slot's, the same on every entry. */
  const kktp = value.find((entry) => typeof entry.kktp === 'number')?.kktp ?? null;

  return (
    <div className="space-y-3">
      <p className="text-xs font-medium text-slate-500 leading-relaxed">{t('scores.subtitle')}</p>
      {kktp !== null && value.length > 0 && <p className="text-xs font-semibold text-slate-500 tabular-nums">{t('scores.kktp', { kktp })}</p>}
      {value.length === 0 ? (
        <p className={`${card} p-5 text-sm font-semibold text-slate-600`}>{t('scores.noneYet')}</p>
      ) : (
        <ul className={`${card} divide-y divide-slate-100`}>
          {value.map((entry) => (
            <ScoreRow key={entry.assessment.id} entry={entry} zone={zone} onOpen={(picked) => {
                /* The navbar's arrow on the outline comes back to this tab. */
                noteAssessmentTab(picked.assessment.id, 'nilai');
                navigate(`/assessment/${picked.assessment.id}`);
              }}
            />
          ))}
        </ul>
      )}
    </div>
  );
};

export default SubjectScores;
