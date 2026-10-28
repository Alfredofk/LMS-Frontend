import React, { useCallback, useEffect, useState } from 'react';
import { CalendarClock, CheckCheck, ChevronRight, Flag, RefreshCw, TrendingDown, Users } from 'lucide-react';

import { useT } from '../../i18n/LanguageContext';
import { dashboardService } from '../../services/dashboardService';
import { Bone, HomeEmpty, HomeError, Unfold } from '../Dashboard/components/HomeCard';
import { belowCountOf, classSignalView, filterCounts, initialsOf, studentsFor, waitingOf } from './homeroomSummary';

/*
  "Ringkasan kelas", first on an opened class of /teacher/homeroom (owner, 2026-10-27;
  the mockup approved that day, the skill `.claude/skills/eduforid-design`). One read,
  GET /api/dashboard/classes/:id (backend 7ee7857): the Class across the current
  Semester's Subjects.

  - Three numbers that are also the filters, then text-only tabs with the same counts.
  - A row per Student, those with a Support Signal first: attendance this Semester, how
    many Subjects are under the KKTP, how many assessments wait to be marked, how many
    signals. A row opens in place: the signals as sentences (homeroomSummary.js), the final
    grade per Subject against that Subject's own KKTP, the attendance counts.
  - A Class of another year answers nothing (semester null), and says so.
  - No "detail" button: the person dialog needs a membership id, and this read names a
    student profile only.
*/

const timeOf = (date, lang) => date.toLocaleTimeString(lang === 'en' ? 'en-GB' : 'id-ID', { hour: '2-digit', minute: '2-digit' });

export const ClassSummary = ({ classId }) => {
  const { t, lang } = useT();
  const number = useCallback(
    (n) => new Intl.NumberFormat(lang === 'en' ? 'en-GB' : 'id-ID', { maximumFractionDigits: 1 }).format(n),
    [lang]
  );

  /* undefined while reading, null when the read failed. */
  const [answer, setAnswer] = useState(undefined);
  const [readAt, setReadAt] = useState(null);
  const [attempt, setAttempt] = useState(0);
  const [filter, setFilter] = useState('ALL');
  const [openId, setOpenId] = useState(null);

  useEffect(() => {
    let cancelled = false;
    dashboardService
      .classSummary(classId)
      .then((read) => {
        if (cancelled) return;
        setAnswer(read);
        setReadAt(new Date());
      })
      .catch(() => !cancelled && setAnswer(null));
    return () => {
      cancelled = true;
    };
  }, [classId, attempt]);

  const reload = () => {
    setAnswer(undefined);
    setOpenId(null);
    setAttempt((n) => n + 1);
  };

  const semester = answer?.semester;
  const subjects = answer?.subjects ?? [];
  /* No class name here: the class's own card sits right above (ClassDetail's `summary`). */
  const facts = [
    semester ? t('dash.subjects.semester', { n: semester.ordinal, year: semester.academicYear?.label }) : answer?.class?.academicYear,
    semester && subjects.length > 0 ? t('homeroom.sum.subjects', { n: subjects.length }) : null,
  ].filter(Boolean);

  const heading = (
    <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
      <div className="min-w-0">
        <h2 id="homeroom-summary" className="text-base font-extrabold text-slate-900 tracking-tight">
          {t('homeroom.sum.title')}
        </h2>
        {facts.length > 0 && (
          <p className="mt-0.5 text-xs text-slate-500">
            {facts.map((fact, i) => (
              <React.Fragment key={fact}>
                {i > 0 && (
                  <>
                    {' '}
                    <span className="mx-1 text-slate-300" aria-hidden="true">
                      /
                    </span>{' '}
                  </>
                )}
                {fact}
              </React.Fragment>
            ))}
          </p>
        )}
      </div>
      {answer && readAt && (
        <span className="inline-flex items-center gap-2 text-[11.5px] text-slate-500">
          {t('homeroom.sum.readAt', { time: timeOf(readAt, lang) })}
          <button
            type="button"
            onClick={reload}
            className="inline-flex items-center gap-1 font-bold text-brand cursor-pointer rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
            {t('homeroom.sum.reload')}
          </button>
        </span>
      )}
    </div>
  );

  const frame = (body) => (
    <section aria-labelledby="homeroom-summary" className="bg-white border border-slate-100 rounded-2xl p-6 max-sm:p-[18px] shadow-sm text-left min-w-0">
      {heading}
      {body}
    </section>
  );

  if (answer === undefined) {
    return frame(
      <div aria-busy="true" aria-label={t('common.loading')}>
        <div className="grid grid-cols-3 gap-3 max-sm:gap-2 mb-4">
          {[0, 1, 2].map((n) => (
            <div key={n} className="rounded-[14px] border border-slate-100 bg-slate-50 p-4">
              <Bone className="h-3 w-3/5" />
              <Bone className="h-6 w-1/3 mt-2" />
            </div>
          ))}
        </div>
        {[0, 1, 2, 3].map((n) => (
          <div key={n} className="flex items-center gap-3.5 mt-3.5">
            <Bone className="w-[38px] h-[38px] rounded-full shrink-0" />
            <div className="flex-1">
              <Bone className="h-3.5 w-2/5" />
              <Bone className="h-3 w-3/5 mt-2" />
            </div>
          </div>
        ))}
      </div>
    );
  }
  if (answer === null) return frame(<HomeError message={t('homeroom.sum.failed')} retryLabel={t('att.error.retry')} onRetry={reload} />);
  if (!semester) return frame(<HomeEmpty icon={CalendarClock} title={t('homeroom.sum.pastTitle')} body={t('homeroom.sum.pastBody')} />);

  const students = answer.students ?? [];
  if (students.length === 0) return frame(<HomeEmpty icon={Users} title={t('homeroom.sum.noStudents')} body={t('homeroom.sum.noStudentsBody')} />);

  const counts = filterCounts(students);
  const shown = studentsFor(students, filter);
  const subjectById = new Map(subjects.map((entry) => [entry.classSubjectId, entry]));
  const choose = (key) => {
    setFilter(key);
    setOpenId(null);
  };

  const tiles = [
    { key: 'ALL', label: t('homeroom.sum.tile.all'), sub: t('homeroom.sum.tile.allSub'), icon: Users, tone: '' },
    { key: 'SIGNAL', label: t('homeroom.sum.tile.signal'), sub: t('homeroom.sum.tile.signalSub'), icon: Flag, tone: counts.SIGNAL ? 'text-amber-700' : '' },
    { key: 'BELOW', label: t('homeroom.sum.tile.below'), sub: t('homeroom.sum.tile.belowSub'), icon: TrendingDown, tone: counts.BELOW ? 'text-rose-600' : '' },
  ];

  return frame(
    <>
      <div className="grid grid-cols-3 gap-3 max-sm:gap-2 mb-4">
        {tiles.map((tile) => {
          const on = filter === tile.key;
          const Icon = tile.icon;
          return (
            <button
              key={tile.key}
              type="button"
              aria-pressed={on}
              onClick={() => choose(tile.key)}
              className={`text-left flex flex-col gap-1 rounded-[14px] border p-4 max-sm:p-3 transition-all duration-200 cursor-pointer hover:-translate-y-0.5 hover:shadow-md motion-reduce:hover:translate-y-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
                on ? 'border-brand bg-brand-tint' : 'border-slate-100 bg-slate-50 hover:border-brand/20'
              }`}
            >
              <span className="flex items-center justify-between gap-1.5 text-xs font-semibold text-slate-600">
                {tile.label}
                <Icon className="w-4 h-4 shrink-0 text-slate-400" aria-hidden="true" />
              </span>
              <span className={`mt-auto text-[26px] max-sm:text-[22px] font-extrabold tracking-tight leading-none tabular-nums ${tile.tone || 'text-slate-900'}`}>{counts[tile.key]}</span>
              {/* slate-600 on the chosen tile's purple tint: slate-500 measured 4.18:1 there. */}
              <small className={`min-h-[2lh] text-[11px] max-sm:hidden ${on ? 'text-slate-600' : 'text-slate-500'}`}>{tile.sub}</small>
            </button>
          );
        })}
      </div>

      <div role="tablist" className="flex gap-0.5 mb-1.5 overflow-x-auto overflow-y-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden shadow-[inset_0_-1px_0_var(--color-slate-100)]">
        {tiles.map((tile) => {
          const on = filter === tile.key;
          return (
            <button
              key={tile.key}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => choose(tile.key)}
              className={`px-2.5 py-2 text-sm font-bold border-b-2 whitespace-nowrap transition-colors cursor-pointer rounded-t-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
                on ? 'text-brand border-brand' : 'text-slate-500 border-transparent hover:text-slate-700'
              }`}
            >
              {t(`homeroom.sum.tab.${tile.key}`)}
              <span className={`ml-1.5 px-1.5 rounded-full text-[11px] ${on ? 'bg-brand-tint text-brand' : 'bg-slate-100 text-slate-600'}`}>{counts[tile.key]}</span>
            </button>
          );
        })}
      </div>

      {shown.length === 0 ? (
        <HomeEmpty
          icon={CheckCheck}
          title={t(filter === 'SIGNAL' ? 'homeroom.sum.none.signal' : 'homeroom.sum.none.below')}
          body={t(filter === 'SIGNAL' ? 'homeroom.sum.none.signalBody' : 'homeroom.sum.none.belowBody')}
        />
      ) : (
        <ul>
          {shown.map((student) => {
            const open = openId === student.studentProfileId;
            const below = belowCountOf(student);
            const waiting = waitingOf(student);
            const signals = student.signals ?? [];
            const percent = student.attendance?.percent;
            return (
              <li key={student.studentProfileId} className="border-b border-slate-100 last:border-0">
                <button
                  type="button"
                  aria-expanded={open}
                  onClick={() => setOpenId(open ? null : student.studentProfileId)}
                  className={`w-full flex items-center gap-3.5 px-2 py-3 text-left rounded-xl transition-colors cursor-pointer hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
                    open ? 'bg-slate-50' : ''
                  }`}
                >
                  <span className="grid place-items-center w-[38px] h-[38px] rounded-full bg-brand-tint text-brand text-xs font-extrabold shrink-0">
                    {initialsOf(student.fullName)}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-bold text-slate-900 break-words">{student.fullName}</span>
                    <span className="block text-xs text-slate-500">
                      <span className={below ? 'font-semibold text-rose-600' : ''}>
                        {below ? t('homeroom.sum.below', { n: below }) : t('homeroom.sum.allAbove')}
                      </span>
                      {waiting > 0 && (
                        <>
                          {' '}
                          <span className="mx-1 text-slate-300" aria-hidden="true">
                            /
                          </span>{' '}
                          {t('homeroom.sum.waiting', { n: waiting })}
                        </>
                      )}
                    </span>
                  </span>
                  <span className="w-[92px] max-sm:w-14 shrink-0 text-right">
                    <b className="text-[13px] font-extrabold text-slate-900 tabular-nums">{percent === null || percent === undefined ? '-' : `${percent}%`}</b>
                    <span className="block h-[5px] mt-1.5 rounded-full bg-slate-100 overflow-hidden max-sm:hidden" aria-hidden="true">
                      <i className="block h-full rounded-full bg-brand" style={{ width: `${Math.min(100, Math.max(0, percent ?? 0))}%` }} />
                    </span>
                    <span className="sr-only">{t('homeroom.sum.attendance')}</span>
                  </span>
                  <span
                    className={`min-w-[26px] px-2 py-0.5 rounded-full text-xs text-center shrink-0 tabular-nums ${
                      signals.length ? 'bg-amber-50 text-amber-700 font-extrabold' : 'text-slate-300 font-semibold'
                    }`}
                    title={t('homeroom.sum.signalCount', { n: signals.length })}
                  >
                    {signals.length || '-'}
                    <span className="sr-only"> {t('homeroom.sum.signalCount', { n: signals.length })}</span>
                  </span>
                  <ChevronRight className={`w-4 h-4 shrink-0 text-slate-400 transition-transform duration-300 ${open ? 'rotate-90' : ''}`} aria-hidden="true" />
                </button>

                <Unfold open={open}>
                  <div className="pl-[60px] max-sm:pl-2 pr-2 pt-1.5 pb-[18px] space-y-4">
                    {signals.length > 0 && (
                      <div>
                        <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">{t('homeroom.sum.signals')}</p>
                        <ul className="space-y-1.5">
                          {signals.map((signal, i) => {
                            const view = classSignalView(signal, answer.thresholds);
                            if (!view) return null;
                            const vars = view.number ? { ...view.vars, n: number(view.vars.n) } : view.vars;
                            return (
                              <li key={`${signal.type}-${signal.subject?.id ?? 'class'}-${i}`} className="flex items-baseline gap-2.5 text-[13px] text-slate-700">
                                <span
                                  className={`w-[7px] h-[7px] rounded-full shrink-0 -translate-y-px ${signal.type === 'BELOW_KKTP' ? 'bg-rose-600' : 'bg-amber-600'}`}
                                  aria-hidden="true"
                                />
                                <span>
                                  {signal.subject?.code && <em className="not-italic mr-1.5 text-[11px] font-bold text-brand">{signal.subject.code}</em>}
                                  {t(view.key, vars)}
                                </span>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    )}

                    <div>
                      <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">{t('homeroom.sum.grades')}</p>
                      <div className="grid grid-cols-[repeat(auto-fill,minmax(118px,1fr))] gap-2">
                        {(student.grades ?? []).map((entry) => {
                          const subject = subjectById.get(entry.classSubjectId);
                          return (
                            <div
                              key={entry.classSubjectId}
                              className={`rounded-xl px-3 py-2 border ${entry.belowKktp ? 'bg-rose-50 border-transparent' : 'border-slate-100'}`}
                              title={subject?.subject?.name}
                            >
                              <p className="text-[11px] font-bold text-brand">{subject?.subject?.code ?? '-'}</p>
                              <p className={`text-lg font-extrabold leading-tight tabular-nums ${entry.belowKktp ? 'text-rose-700' : 'text-slate-900'}`}>
                                {entry.finalGrade === null || entry.finalGrade === undefined ? '-' : number(entry.finalGrade)}
                              </p>
                              <p className="text-[10.5px] text-slate-500">
                                {subject?.kktp !== null && subject?.kktp !== undefined && t('homeroom.sum.kktp', { n: number(subject.kktp) })}
                                {entry.waiting > 0 && ` / ${t('homeroom.sum.waitingShort', { n: entry.waiting })}`}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">{t('homeroom.sum.attendance')}</p>
                      <div className="flex flex-wrap gap-x-6 gap-y-2">
                        {[
                          ['present', 'att.status.PRESENT'],
                          ['sick', 'att.status.SICK'],
                          ['excused', 'att.status.EXCUSED'],
                          ['absent', 'att.status.ABSENT'],
                        ].map(([field, key]) => (
                          <div key={field}>
                            <small className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">{t(key)}</small>
                            <b className="text-sm font-bold text-slate-900 tabular-nums">{student.attendance?.[field] ?? 0}</b>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </Unfold>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
};

export default ClassSummary;
