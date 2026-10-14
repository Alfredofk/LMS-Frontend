import React, { Fragment, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, ChevronRight, RefreshCw } from 'lucide-react';

import { useAuth } from '../../context/AuthContext';
import { useSchoolZone } from '../../hooks/useSchoolToday';
import { useT } from '../../i18n/LanguageContext';
import { studentAssessmentErrorMessage } from '../../i18n/apiError';
import { formatNumber } from '../TeacherAssessment/results';
import { shortWhen, typeModeText } from '../TeacherAssessment/teacherAssessment';
import { readMyMenu } from './readMyMenu';
import { noteAssessmentTab } from './assessmentBack';
import { canRetry, entriesOf, pathOf, sectionsOf, whenOf, wordOf } from './studentMenu';

/*
  A subject's "Penilaian" tab on the student's subject page (/classroom/:id?tab=penilaian;
  backend 113ae37, owner 2026-10-12): the subject's assessments from the semester's
  menu (readMyMenu), under Perlu dikerjakan / Akan datang / Selesai. A row opens the
  outline - or, with an attempt running, the attempt itself. Starting stays on the
  outline, where the integrity notice and the attempts are read first. A class the
  student left is read the same way; its outlines open with nothing to start.

  The menu answers only the semesters one of the student's placements overlaps, so
  a 404 for this semester means it has none for them: said as no assessments.
*/

const card = 'bg-white border border-slate-100 rounded-2xl shadow-sm';

/* The word at a row's end, and its colour. */
const WORD_TONE = {
  NOT_STARTED: 'text-brand',
  IN_PROGRESS: 'text-sky-700',
  VOIDED: 'text-amber-700',
  LATE: 'text-amber-700',
  WAITING_FOR_RELEASE: 'text-slate-600',
  DID_NOT_SUBMIT: 'text-rose-700',
  CANCELLED: 'text-rose-700',
};

const Row = ({ entry, zone, onOpen }) => {
  const { t, lang } = useT();
  const { assessment } = entry;
  const word = wordOf(entry);
  const when = whenOf(entry);
  const exception = assessment.exception;
  const facts = [
    typeModeText(t, assessment),
    t(`smenu.when.${when.key}`, { when: shortWhen(when.instant, zone, lang) }),
    exception ? t(exception.remedial ? 'tasm.results.remedial' : exception.makeUp ? 'smenu.makeUp' : 'smenu.extraAttempts') : null,
  ].filter(Boolean);

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
        <span className="shrink-0 text-right">
          {entry.status === 'RELEASED' && entry.score !== null && (
            <span className="block text-base font-extrabold text-slate-900 tabular-nums leading-tight">{formatNumber(entry.score, lang)}</span>
          )}
          {word && <span className={`block text-xs font-bold ${WORD_TONE[word]}`}>{t(`smenu.status.${word}`)}</span>}
          {canRetry(entry) && <span className="block text-[11px] font-semibold text-brand">{t('smenu.retry')}</span>}
        </span>
        <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" aria-hidden="true" />
      </button>
    </li>
  );
};

/**
 * @param classSubjectId  the subject page's class subject
 * @param semesterId      its semester, the menu to read
 */
export const SubjectAssessments = ({ classSubjectId, semesterId }) => {
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
      .then((menu) => !cancelled && setRead({ key: asked, value: entriesOf(menu.classes, classSubjectId) }))
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

  const sections = sectionsOf(value);
  if (sections.length === 0) return <p className={`${card} p-5 text-sm font-semibold text-slate-600`}>{t('smenu.emptySubject')}</p>;

  return (
    <div className="space-y-5">
      {sections.map((section) => (
        <section key={section.key} className="space-y-2" aria-labelledby={`smenu-${section.key}`}>
          <h3 id={`smenu-${section.key}`} className="flex items-baseline gap-2 text-sm font-extrabold text-slate-900">
            {t(`smenu.section.${section.key}`)}
            <span className="text-xs font-semibold text-slate-500 tabular-nums">{section.entries.length}</span>
          </h3>
          <ul className={`${card} divide-y divide-slate-100`}>
            {section.entries.map((entry) => (
              <Row key={entry.assessment.id} entry={entry} zone={zone} onOpen={(picked) => {
                  noteAssessmentTab(picked.assessment.id, 'penilaian');
                  navigate(pathOf(picked));
                }}
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
};

export default SubjectAssessments;
