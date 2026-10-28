import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ChevronRight, FileText } from 'lucide-react';

import FactLine from '../../components/ui/FactLine';
import { useT } from '../../i18n/LanguageContext';
import { apiErrorMessage, reportCardErrorMessage } from '../../i18n/apiError';
import { academicsService } from '../../services/academicsService';
import { gradingService } from '../../services/gradingService';
import { initialsOf } from '../../utils/names';
import { formatDay } from '../Classes/format';
import { formatNumber } from '../TeacherAssessment/results';
import { Bone, HomeEmpty, HomeError } from '../Dashboard/components/HomeCard';
import SemesterSegments from '../Subjects/SemesterSegments';
import { defaultReportSemesterOf, reportSummaryOf, sharedKktpOf } from './reportCards';

/*
  "Rapor" under a class's homeroom notes (owner, 2026-10-20; backend 3a22f90 /
  46c6173), for its homeroom teacher on /teacher/homeroom and the leaders on
  /headmaster/classes: its own semester choice, opening on the newest closed one,
  and the newest report card of each student closed in the class, by name - NISN,
  the date, and the version once there is more than one. A row opens ReportCardPage,
  which leads back here with the class and semester (`state.back`), so the host
  reopens the same class. A semester reopened (FINALIZING again) still lists its
  last versions, and says so.

  The look since 2026-10-28 (owner, mockup rapor.html): the semester is
  SemesterSegments, the heading's slash line "Semester 1 / 2 rapor"; a row is round
  initials, "NISN: ... / Tanggal: ... / Versi 2", and the card's average final grade
  on the right (red when under the KKTP every subject shares) with "1 mapel di
  bawah KKTP" under it when any (reportSummaryOf).

  @param classId          the class
  @param academicYearId   its year, for the semesters
  @param initialSemesterId the semester to open on, when coming back from a report card
  @param focus            scroll here once read ("Lihat rapor" on Finalisasi Nilai)
*/

const card = 'bg-white border border-slate-100 rounded-2xl p-6 max-sm:p-[18px] shadow-sm min-w-0 text-left';

export const ClassReportCards = ({ classId, academicYearId, initialSemesterId = null, focus = false }) => {
  const { t, lang } = useT();
  const navigate = useNavigate();
  const location = useLocation();
  const [year, setYear] = useState(undefined);
  const [semesterId, setSemesterId] = useState(null);
  /* undefined reading · the read · { error } */
  const [read, setRead] = useState(undefined);
  const [attempt, setAttempt] = useState(0);
  const sectionRef = useRef(null);
  const scrolled = useRef(false);

  useEffect(() => {
    let cancelled = false;
    const today = new Date().toISOString().slice(0, 10);
    academicsService
      .academicYears()
      .then((years) => {
        if (cancelled) return;
        const found = years.find((entry) => entry.id === academicYearId) ?? null;
        setYear(found);
        const known = found?.semesters?.some((semester) => semester.id === initialSemesterId);
        setSemesterId(known ? initialSemesterId : defaultReportSemesterOf(found, today));
      })
      .catch((err) => !cancelled && setYear({ error: apiErrorMessage(err, t) }));
    return () => {
      cancelled = true;
    };
  }, [academicYearId, initialSemesterId, t, attempt]);

  useEffect(() => {
    if (!semesterId) return undefined;
    let cancelled = false;
    gradingService
      .classReportCards(classId, semesterId)
      .then((answer) => !cancelled && setRead(answer))
      .catch((err) => !cancelled && setRead({ error: reportCardErrorMessage(err, t) }));
    return () => {
      cancelled = true;
    };
  }, [classId, semesterId, t, attempt]);

  /* Once, when the first read lands: the card is the last on the page. */
  useEffect(() => {
    if (!focus || scrolled.current || read === undefined) return;
    scrolled.current = true;
    sectionRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }, [focus, read]);

  const semesters = year && !year.error ? (year.semesters ?? []) : [];
  const shown = semesters.find((semester) => semester.id === semesterId) ?? null;
  const pick = (id) => {
    setRead(undefined);
    setSemesterId(id);
  };
  const retry = () => {
    if (year?.error) setYear(undefined);
    setRead(undefined);
    setAttempt((n) => n + 1);
  };
  const open = (id) => navigate(`/report-cards/${id}`, { state: { back: { to: location.pathname, state: { classId, semesterId } } } });

  const rows = read && !read.error ? (read.reportCards ?? []) : [];
  const facts = shown ? [t('classes.semester.name', { n: shown.ordinal }), read && !read.error ? t('rc.class.count', { n: rows.length }) : null] : [];

  const heading = (
    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
      <div className="min-w-0">
        <h3 id={`rc-${classId}`} className="text-base font-extrabold text-slate-900 tracking-tight">
          {t('rc.class.title')}
        </h3>
        {facts.length > 0 && <FactLine className="mt-0.5" facts={facts.filter(Boolean)} />}
      </div>
      {semesters.length > 1 && <SemesterSegments id={`rc-sem-${classId}`} semesters={semesters} value={semesterId} onChange={pick} hideLabel />}
    </div>
  );

  let body;
  if (year?.error) body = <HomeError message={year.error} retryLabel={t('att.error.retry')} onRetry={retry} />;
  else if (year !== undefined && !semesterId) body = <HomeEmpty icon={FileText} title={t('homeroom.notes.noSemester')} />;
  else if (read === undefined) {
    body = (
      <div aria-busy="true" aria-label={t('common.loading')}>
        {[0, 1].map((n) => (
          <div key={n} className="flex items-center gap-3 py-3">
            <Bone className="w-9 h-9 rounded-full shrink-0" />
            <span className="flex-1">
              <Bone className="h-3.5 w-1/3" />
              <Bone className="h-3 w-1/2 mt-2" />
            </span>
            <Bone className="h-6 w-10" />
          </div>
        ))}
      </div>
    );
  } else if (read.error) body = <HomeError message={read.error} retryLabel={t('att.error.retry')} onRetry={retry} />;
  else if (rows.length === 0) body = <HomeEmpty icon={FileText} title={t('rc.class.empty.title')} body={t('rc.class.empty.body')} />;
  else {
    body = (
      <>
        {read.semester?.status === 'FINALIZING' && (
          <p className="rounded-xl bg-amber-50 p-3.5 text-[13px] font-semibold text-amber-700" role="status">
            {t('rc.class.reopened')}
          </p>
        )}
        <ul>
          {rows.map((rc) => {
            const { average, below } = reportSummaryOf(rc);
            const kktp = sharedKktpOf(rc.subjects);
            const lowAverage = average !== null && kktp !== null && average < kktp;
            const lineFacts = [
              t('rc.class.nisn', { nisn: rc.student.nisn }),
              t('rc.class.dated', { date: formatDay(rc.reportDate, lang) }),
              (rc.versions?.length ?? 0) > 1 ? t('rc.version', { n: rc.version }) : null,
            ].filter(Boolean);
            return (
              <li key={rc.id} className="border-b border-slate-100 last:border-0">
                <button
                  type="button"
                  onClick={() => open(rc.id)}
                  className="w-full flex items-center gap-3 px-2 py-3 text-left cursor-pointer rounded-xl hover:bg-slate-50 transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                >
                  <span className="grid place-items-center w-9 h-9 shrink-0 rounded-full bg-brand-tint text-brand text-xs font-extrabold" aria-hidden="true">
                    {initialsOf(rc.student.fullName)}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-bold text-slate-900 break-words">{rc.student.fullName}</span>
                    <FactLine size="xs" facts={lineFacts} />
                  </span>
                  {average !== null && (
                    <span className="shrink-0 text-right">
                      <span className={`block text-lg font-extrabold tabular-nums leading-tight ${lowAverage ? 'text-rose-700' : 'text-slate-900'}`}>{formatNumber(average, lang)}</span>
                      {below > 0 && <span className="block text-[11px] font-bold text-rose-700">{t('rc.class.below', { n: below })}</span>}
                    </span>
                  )}
                  <ChevronRight className="w-4 h-4 shrink-0 text-slate-400" aria-hidden="true" />
                </button>
              </li>
            );
          })}
        </ul>
      </>
    );
  }

  return (
    <section ref={sectionRef} className={`${card} space-y-4 scroll-mt-4`} aria-labelledby={`rc-${classId}`}>
      {heading}
      {body}
    </section>
  );
};

export default ClassReportCards;
