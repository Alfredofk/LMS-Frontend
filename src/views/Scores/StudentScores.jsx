import React, { Fragment, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AlertCircle, Award, ChevronRight, RefreshCw } from 'lucide-react';

import Select from '../../components/ui/Select';
import { useAuth } from '../../context/AuthContext';
import { useSchoolZone } from '../../hooks/useSchoolToday';
import { useT } from '../../i18n/LanguageContext';
import { studentAssessmentErrorMessage } from '../../i18n/apiError';
import { formatNumber } from '../TeacherAssessment/results';
import { shortWhen, typeModeText } from '../TeacherAssessment/teacherAssessment';
import { readMyMenu } from '../StudentAssessment/readMyMenu';
import { scoreCardsOf, whenOf } from '../StudentAssessment/studentMenu';

/*
  A student's scores (/scores, "Nilai"; backend 113ae37, owner 2026-10-12): one
  card per subject that has assessments in the semester, each listing what is
  marked or can no longer be answered - the score that counts once released,
  "Menunggu rilis", "Tidak mengumpulkan" - latest closed first (scoreCardsOf). A
  row opens the outline, where the attempts, points per question and the
  teacher's comments are read. No average or final mark: the backend has no
  weights yet (request #16), the same rule as the teacher's gradebook.

  Read from the semester's GET /assessments/mine (readMyMenu), the dropdown
  `?semester=`, none meaning the server's default. It replaced a page built on
  /gradebook/student/summary and /protests, routes that never existed - appeals
  went with it, having no backend.
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
  const facts = [
    typeModeText(t, assessment),
    t(`smenu.when.${when.key}`, { when: shortWhen(when.instant, zone, lang) }),
  ];
  return (
    <li>
      <button
        type="button"
        onClick={() => onOpen(entry)}
        className="w-full text-left px-4 sm:px-5 py-3.5 flex items-center gap-3 hover:bg-slate-50 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand last:rounded-b-2xl"
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
          <span className="shrink-0 text-lg font-extrabold text-slate-900 tabular-nums">{formatNumber(entry.score, lang)}</span>
        ) : (
          <span className={`shrink-0 text-xs font-bold ${WORD_TONE[entry.status] ?? 'text-slate-600'}`}>{t(`smenu.status.${entry.status}`)}</span>
        )}
        <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" aria-hidden="true" />
      </button>
    </li>
  );
};

export const StudentScores = () => {
  const { t } = useT();
  const navigate = useNavigate();
  const zone = useSchoolZone();
  const { membership } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const semesterParam = searchParams.get('semester');
  const [attempt, setAttempt] = useState(0);
  /* The answer to which read: data is undefined while the one asked for now is on its way. */
  const asked = `${semesterParam ?? ''}|${attempt}`;
  const [read, setRead] = useState({ key: null, data: undefined });
  /* undefined reading · menu · { error } */
  const data = read.key === asked ? read.data : undefined;

  useEffect(() => {
    let cancelled = false;
    readMyMenu(membership?.id, semesterParam, { fresh: attempt > 0 })
      .then((answer) => !cancelled && setRead({ key: asked, data: answer }))
      .catch((err) => {
        if (cancelled) return;
        // A semester in the address that is not theirs (an old link): fall back to the default.
        if (semesterParam && err?.status === 404) {
          setSearchParams({}, { replace: true });
          return;
        }
        setRead({ key: asked, data: { error: studentAssessmentErrorMessage(err, t) } });
      });
    return () => {
      cancelled = true;
    };
  }, [asked, attempt, membership?.id, semesterParam, t, setSearchParams]);

  const cards = useMemo(() => scoreCardsOf(data?.classes), [data]);

  const heading = <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight leading-tight">{t('shell.scores')}</h1>;

  if (data === undefined) {
    return (
      <div className="max-w-3xl space-y-6 text-left">
        {heading}
        <div className="h-64 rounded-2xl bg-white border border-slate-100 animate-pulse" aria-busy="true" aria-label={t('common.loading')} />
      </div>
    );
  }
  if (data.error) {
    return (
      <div className="max-w-3xl space-y-6 text-left">
        {heading}
        <div className={`${card} p-6 flex flex-col items-center text-center gap-3 py-10`} role="alert">
          <AlertCircle className="w-8 h-8 text-rose-500" aria-hidden="true" />
          <p className="text-sm font-bold text-slate-700 max-w-sm">{data.error}</p>
          <button
            type="button"
            onClick={() => setAttempt((n) => n + 1)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold hover:bg-slate-200 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
            {t('att.error.retry')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-6 text-left">
      <div className="space-y-1">
        {heading}
        <p className="text-sm text-slate-500 font-medium">{t('scores.subtitle')}</p>
      </div>

      {/* The same plain dropdown as "Kelas Saya" and Penilaian, newest first. */}
      {data.semesters.length > 0 && (
        <div className="flex">
          <Select
            id="scores-semester"
            className="w-full sm:w-64"
            aria-label={t('smenu.semester')}
            value={data.semester?.id ?? ''}
            onChange={(e) => setSearchParams({ semester: e.target.value })}
          >
            {data.semesters.map((semester) => (
              <option key={semester.id} value={semester.id}>
                {t('teach.option', { n: semester.ordinal, year: semester.academicYear })}
              </option>
            ))}
          </Select>
        </div>
      )}

      {cards.length === 0 ? (
        <div className={`${card} p-6 flex flex-col items-center text-center gap-3 py-10`}>
          <Award className="w-8 h-8 text-slate-400" aria-hidden="true" />
          <p className="text-sm font-semibold text-slate-600 max-w-sm">{t(data.semester ? 'smenu.emptySemester' : 'smenu.emptyNone')}</p>
        </div>
      ) : (
        <div className="space-y-5">
          {cards.map((group) => {
            const { subject } = group.classSubject;
            const headingId = `scores-${group.classSubject.id}`;
            return (
              <section key={group.classSubject.id} className={card} aria-labelledby={headingId}>
                {/* The code above the name, as on "Kelas Saya" and a subject's page. */}
                <div className="px-4 sm:px-5 pt-4 pb-3 flex flex-wrap items-end justify-between gap-2 border-b border-slate-100">
                  <div className="min-w-0">
                    {subject.code && <p className="text-[10px] font-extrabold uppercase tracking-wider text-brand leading-none">{subject.code}</p>}
                    <h2 id={headingId} className="mt-1 text-base font-extrabold text-slate-900 leading-tight break-words">
                      {subject.name}
                    </h2>
                  </div>
                  {!group.class.current && (
                    <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[11px] font-bold">{t('classroom.pastClass', { class: group.class.name })}</span>
                  )}
                </div>
                {group.entries.length === 0 ? (
                  <p className="px-4 sm:px-5 py-4 text-sm font-semibold text-slate-500">{t('scores.noneYet')}</p>
                ) : (
                  <ul className="divide-y divide-slate-100">
                    {group.entries.map((entry) => (
                      <ScoreRow key={entry.assessment.id} entry={entry} zone={zone} onOpen={(picked) => navigate(`/assessment/${picked.assessment.id}`)} />
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default StudentScores;
