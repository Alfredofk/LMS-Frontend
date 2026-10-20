import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

import { useT } from '../../i18n/LanguageContext';
import { apiErrorMessage, reportCardErrorMessage } from '../../i18n/apiError';
import { academicsService } from '../../services/academicsService';
import { gradingService } from '../../services/gradingService';
import { formatDay } from '../Classes/format';
import { defaultReportSemesterOf } from './reportCards';

/*
  "Rapor" under a class's homeroom notes (owner, 2026-10-20; backend 3a22f90 /
  46c6173), for its homeroom teacher on /teacher/homeroom and the leaders on
  /headmaster/classes: its own semester choice, opening on the newest closed one,
  and the newest report card of each student closed in the class, by name - NISN,
  the date, and the version once there is more than one. A row opens ReportCardPage,
  which leads back here with the class and semester (`state.back`), so the host
  reopens the same class. A semester reopened (FINALIZING again) still lists its
  last versions, and says so.

  @param classId          the class
  @param academicYearId   its year, for the semesters
  @param initialSemesterId the semester to open on, when coming back from a report card
  @param focus            scroll here once read ("Lihat rapor" on Finalisasi Nilai)
*/

const card = 'bg-white border border-slate-100 rounded-2xl p-5 sm:p-6 shadow-sm';

export const ClassReportCards = ({ classId, academicYearId, initialSemesterId = null, focus = false }) => {
  const { t, lang } = useT();
  const navigate = useNavigate();
  const location = useLocation();
  const [year, setYear] = useState(undefined);
  const [semesterId, setSemesterId] = useState(null);
  /* undefined reading · the read · { error } */
  const [read, setRead] = useState(undefined);
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
  }, [academicYearId, initialSemesterId, t]);

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
  }, [classId, semesterId, t]);

  /* Once, when the first read lands: the card is the last on the page. */
  useEffect(() => {
    if (!focus || scrolled.current || read === undefined) return;
    scrolled.current = true;
    sectionRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }, [focus, read]);

  const semesters = year && !year.error ? (year.semesters ?? []) : [];
  const pick = (id) => {
    setRead(undefined);
    setSemesterId(id);
  };
  const open = (id) => navigate(`/report-cards/${id}`, { state: { back: { to: location.pathname, state: { classId, semesterId } } } });

  const heading = (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <h3 id={`rc-${classId}`} className="text-base font-extrabold text-slate-900">
        {t('rc.class.title')}
      </h3>
      {semesters.length > 1 && (
        <label className="flex items-center gap-2">
          <span className="sr-only">{t('homeroom.att.semester')}</span>
          <select
            value={semesterId ?? ''}
            onChange={(e) => pick(e.target.value)}
            className="w-full sm:w-44 rounded-xl border border-slate-200 bg-white py-2 px-3 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand cursor-pointer"
          >
            {semesters.map((semester) => (
              <option key={semester.id} value={semester.id}>
                {t('classes.semester.name', { n: semester.ordinal })}
              </option>
            ))}
          </select>
        </label>
      )}
    </div>
  );

  const rows = read && !read.error ? (read.reportCards ?? []) : [];
  let body;
  if (year?.error) body = <p className="text-sm font-semibold text-amber-700">{year.error}</p>;
  else if (year !== undefined && !semesterId) body = <p className="text-sm font-semibold text-slate-600">{t('homeroom.notes.noSemester')}</p>;
  else if (read === undefined) body = <div className="h-24 rounded-xl bg-slate-50 animate-pulse" aria-busy="true" aria-label={t('common.loading')} />;
  else if (read.error) body = <p className="text-sm font-semibold text-amber-700">{read.error}</p>;
  else if (rows.length === 0) body = <p className="text-sm font-semibold text-slate-600">{t('rc.class.none')}</p>;
  else {
    body = (
      <>
        <div className="space-y-1">
          <p className="text-xs font-semibold text-slate-500">{t('rc.class.count', { n: rows.length })}</p>
          {read.semester?.status === 'FINALIZING' && <p className="text-xs font-semibold text-amber-700">{t('rc.class.reopened')}</p>}
        </div>
        <ul className="divide-y divide-slate-100">
          {rows.map((rc) => (
            <li key={rc.id}>
              <button
                type="button"
                onClick={() => open(rc.id)}
                className="w-full flex items-center justify-between gap-3 py-2.5 text-left cursor-pointer rounded-lg hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              >
                <span className="min-w-0">
                  <span className="block text-sm font-bold text-slate-900 break-words">{rc.student.fullName}</span>
                  <span className="flex flex-wrap gap-x-4 text-xs font-semibold text-slate-500">
                    <span>{t('rc.fact.nisn')} {rc.student.nisn}</span>
                    <span>{t('rc.class.dated', { date: formatDay(rc.reportDate, lang) })}</span>
                    {(rc.versions?.length ?? 0) > 1 && <span>{t('rc.version', { n: rc.version })}</span>}
                  </span>
                </span>
                <ChevronRight className="w-4 h-4 shrink-0 text-slate-500" aria-hidden="true" />
              </button>
            </li>
          ))}
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
