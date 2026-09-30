import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarClock, Clock, School } from 'lucide-react';

import SelectField from '../../components/ui/SelectField';
import ScheduleDialog from './ScheduleDialog';
import { academicsService } from '../../services/academicsService';
import { sessionsService } from '../../services/sessionsService';
import { useT } from '../../i18n/LanguageContext';
import { subjectsErrorMessage, timetableErrorMessage } from '../../i18n/apiError';
import { ROLES } from '../../constants/roles';
import { defaultSlot, defaultSemesterOf, boardWritable } from './subjects';
import { dayName, weekOf } from './timetable';

/*
  The timetable, class by class (backend 7cdc46d; owner, 2026-09-30).

  The backend has no timetable for a class, only one per teaching assignment,
  so this reads the semester's board (`GET /academics/semesters/:id/class-subjects`)
  and then `GET /sessions/class-subjects/:id/schedule` for every ACTIVE subject of
  the chosen class — each on its own, so one failing leaves the rest on screen.

  The week is drawn Monday to Saturday, with Sunday only when a slot is on it.
  A subject without a slot, and one still waiting for approval, is listed below.
  Clicking a subject opens ScheduleDialog, where it is read and — while the year
  is ACTIVE and the semester OPEN, as for the board — changed.
*/
export const TimetableTab = ({ years, showToast, activeRole }) => {
  const { t, lang } = useT();
  const navigate = useNavigate();
  const today = new Date().toISOString().slice(0, 10);
  const usable = years ?? [];

  const [slot, setSlot] = useState(() => defaultSlot(years, today));
  const [answer, setAnswer] = useState({ semesterId: null, board: null, error: null });
  const [classId, setClassId] = useState(null);
  /* classSubjectId → { schedule } | { error } — an absent key is still loading. */
  const [schedules, setSchedules] = useState({});
  const [open, setOpen] = useState(null);

  const year = usable.find((entry) => entry.id === slot?.yearId) ?? null;
  const semesterId = slot?.semesterId ?? null;

  useEffect(() => {
    if (!semesterId) return;
    academicsService
      .subjectBoard(semesterId)
      .then((board) => setAnswer({ semesterId, board, error: null }))
      .catch((err) => setAnswer({ semesterId, board: null, error: subjectsErrorMessage(err, t) }));
  }, [semesterId, t]);

  const current = answer.semesterId === semesterId;
  const board = current ? answer.board : null;
  const error = current ? answer.error : null;
  const classes = board?.classes ?? [];
  /* The class on screen: the one picked if it is in this semester's year, else the first. */
  const boardClass = classes.find((entry) => entry.id === classId) ?? classes[0] ?? null;
  const active = (boardClass?.subjects ?? []).filter((row) => row.status === 'ACTIVE');
  const pending = (boardClass?.subjects ?? []).filter((row) => row.status === 'PENDING');
  const activeIds = active.map((row) => row.classSubjectId).join(',');

  /* Keyed on the ids as one string, so a re-render with the same subjects does not ask again. */
  useEffect(() => {
    for (const id of activeIds ? activeIds.split(',') : []) {
      sessionsService
        .schedule(id)
        .then((schedule) => setSchedules((prev) => ({ ...prev, [id]: { schedule } })))
        .catch((err) => setSchedules((prev) => ({ ...prev, [id]: { error: timetableErrorMessage(err, t) } })));
    }
  }, [activeIds, t]);

  const noSemester = (
    <div className="py-14 px-6 text-center border border-dashed border-slate-200 rounded-2xl bg-white">
      <CalendarClock className="w-9 h-9 text-slate-300 mx-auto" aria-hidden="true" />
      <h2 className="mt-2.5 text-sm font-extrabold text-slate-700">
        {year ? t('subjects.board.noSemester.titleOf', { label: year.label }) : t('subjects.board.noSemester.title')}
      </h2>
      <p className="mt-1.5 text-xs font-semibold text-slate-500 leading-relaxed max-w-sm mx-auto">{t('subjects.board.noSemester.body')}</p>
      <button
        type="button"
        onClick={() => navigate('/headmaster/classes')}
        className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand hover:bg-brand-deep text-white text-xs font-extrabold transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
      >
        <School className="w-4 h-4" aria-hidden="true" />
        {t('subjects.board.noSemester.go')}
      </button>
    </div>
  );

  if (!slot) return noSemester;

  const semester = board?.semester;
  const writable = semester && boardWritable(year?.status, semester.status);

  const loaded = active.map((row) => ({ row, state: schedules[row.classSubjectId] }));
  const withSlots = loaded
    .filter(({ state }) => state?.schedule?.slots?.length)
    .map(({ row, state }) => ({ row, slots: state.schedule.slots }));
  const week = weekOf(withSlots);
  const waiting = loaded.filter(({ state }) => !state || state.error || !state.schedule?.slots?.length);
  const noZone = loaded.some(({ state }) => state?.schedule && !state.schedule.timeZone);
  const openState = open ? schedules[open.classSubjectId]?.schedule : null;

  const subjectButton = (row, extra) => (
    <button
      type="button"
      onClick={() => setOpen(row)}
      className="w-full text-left rounded-xl border border-slate-200 bg-white hover:border-brand hover:bg-brand-tint px-3 py-2 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
    >
      {extra}
      <span className="block text-xs font-extrabold text-slate-800 break-words">
        <span className="tabular-nums text-slate-500">{row.subject.code}</span> · {row.subject.name}
      </span>
      <span className="block text-[11px] font-semibold text-slate-500 break-words">{row.teacher.fullName}</span>
    </button>
  );

  const loadingBox = <div className="h-48 bg-white border border-slate-100 rounded-2xl animate-pulse" aria-label={t('common.loading')} />;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-start gap-4">
        <div className="sm:w-64">
          <SelectField
            id="timetable-year"
            label={t('subjects.board.year')}
            value={slot.yearId}
            onChange={(e) => {
              const next = usable.find((entry) => entry.id === e.target.value);
              setSlot({ yearId: next.id, semesterId: defaultSemesterOf(next, today) });
            }}
          >
            {usable.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {t('subjects.board.yearOption', { label: entry.label, status: t(`subjects.board.yearStatus.${entry.status}`) })}
              </option>
            ))}
          </SelectField>
        </div>
        {(year?.semesters ?? []).length > 0 && (
          <div className="flex flex-col gap-1.5">
            <span id="timetable-semester-label" className="text-sm font-semibold text-slate-700 select-none">
              {t('subjects.board.semester')}
            </span>
            <div className="flex gap-2" role="group" aria-labelledby="timetable-semester-label">
              {(year?.semesters ?? []).map((entry) => {
                const on = entry.id === slot.semesterId;
                return (
                  <button
                    key={entry.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setSlot({ yearId: slot.yearId, semesterId: entry.id })}
                    className={`px-5 py-2.5 md:py-3 rounded-xl text-base font-bold border transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
                      on ? 'bg-brand text-white border-brand' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {t('classes.semester.name', { n: entry.ordinal })}
                  </button>
                );
              })}
            </div>
          </div>
        )}
        {classes.length > 0 && (
          <div className="sm:w-56">
            <SelectField
              id="timetable-class"
              label={t('timetable.class')}
              value={boardClass?.id ?? ''}
              onChange={(e) => setClassId(e.target.value)}
            >
              {classes.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.name}
                </option>
              ))}
            </SelectField>
          </div>
        )}
      </div>

      {!semesterId && noSemester}

      {semester && !writable && (
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs font-semibold text-slate-500">
          {t('subjects.board.readOnly')}
        </div>
      )}

      {noZone && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-800 leading-relaxed flex flex-wrap items-center gap-x-3 gap-y-2">
          <span>{t(activeRole === ROLES.PRINCIPAL ? 'timetable.noZone.principal' : 'timetable.noZone.vice')}</span>
          {activeRole === ROLES.PRINCIPAL && (
            <button
              type="button"
              onClick={() => navigate('/account')}
              className="px-3 py-1.5 rounded-lg bg-white border border-amber-200 text-amber-800 font-extrabold hover:bg-amber-100 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
            >
              {t('timetable.noZone.go')}
            </button>
          )}
        </div>
      )}

      {!semesterId ? null : error ? (
        <div className="p-4 bg-red-50 border-l-4 border-red-500 rounded-r-2xl text-sm text-red-700" role="alert">
          {error}
        </div>
      ) : board === null ? (
        loadingBox
      ) : classes.length === 0 ? (
        <div className="py-12 text-center border border-dashed border-slate-200 rounded-2xl bg-white">
          <School className="w-9 h-9 text-slate-300 mx-auto" aria-hidden="true" />
          <p className="mt-2.5 text-xs font-extrabold text-slate-500">{t('subjects.board.noClasses')}</p>
        </div>
      ) : active.length === 0 && pending.length === 0 ? (
        <div className="py-12 text-center border border-dashed border-slate-200 rounded-2xl bg-white">
          <Clock className="w-9 h-9 text-slate-300 mx-auto" aria-hidden="true" />
          <p className="mt-2.5 text-xs font-extrabold text-slate-500">{t('timetable.noSubjects', { className: boardClass.name })}</p>
        </div>
      ) : (
        <>
          <ul className={`grid grid-cols-1 sm:grid-cols-2 gap-3 ${week.length === 7 ? 'xl:grid-cols-7' : 'lg:grid-cols-3 xl:grid-cols-6'}`}>
            {week.map(({ day, items }) => (
              <li key={day} className="bg-white border border-slate-100 rounded-2xl p-3 shadow-sm space-y-2 min-w-0">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500">{dayName(day, lang)}</h3>
                {items.length === 0 ? (
                  <p className="text-[11px] font-semibold text-slate-500">{t('timetable.dayEmpty')}</p>
                ) : (
                  <ul className="space-y-1.5">
                    {items.map(({ row, slot: item }) => (
                      <li key={`${row.classSubjectId}-${item.start}`}>
                        {subjectButton(
                          row,
                          <span className="block text-[11px] font-extrabold text-brand tabular-nums">
                            {item.start}–{item.end}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>

          {(waiting.length > 0 || pending.length > 0) && (
            <section className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm space-y-2">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500">{t('timetable.unscheduled')}</h3>
              <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {waiting.map(({ row, state }) => (
                  <li key={row.classSubjectId}>
                    {!state ? (
                      <div className="h-14 bg-slate-50 rounded-xl animate-pulse" aria-label={t('common.loading')} />
                    ) : state.error ? (
                      <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[11px] font-semibold text-red-700" role="alert">
                        <span className="block font-extrabold">
                          {row.subject.code} · {row.subject.name}
                        </span>
                        {state.error}
                      </div>
                    ) : (
                      subjectButton(
                        row,
                        <span className="block text-[11px] font-extrabold text-amber-700">{t('timetable.notSet')}</span>
                      )
                    )}
                  </li>
                ))}
                {pending.map((row) => (
                  <li
                    key={row.classSubjectId}
                    className="rounded-xl border border-dashed border-slate-200 px-3 py-2"
                  >
                    <span className="block text-[11px] font-extrabold text-slate-500">{t('timetable.pending')}</span>
                    <span className="block text-xs font-bold text-slate-600 break-words">
                      <span className="tabular-nums">{row.subject.code}</span> · {row.subject.name}
                    </span>
                    <span className="block text-[11px] font-semibold text-slate-500 break-words">{row.teacher.fullName}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      {open && openState && semester && (
        <ScheduleDialog
          key={open.classSubjectId}
          row={open}
          boardClass={boardClass}
          semester={{ ...semester, startDate: year?.semesters?.find((entry) => entry.id === semester.id)?.startDate }}
          schedule={openState}
          others={withSlots.filter((entry) => entry.row.classSubjectId !== open.classSubjectId)}
          writable={writable}
          onClose={() => setOpen(null)}
          onSaved={(schedule) => {
            setSchedules((prev) => ({ ...prev, [open.classSubjectId]: { schedule } }));
            showToast(t('timetable.saved', { subject: open.subject.name, className: boardClass.name }), 'success');
          }}
        />
      )}
    </div>
  );
};

export default TimetableTab;
