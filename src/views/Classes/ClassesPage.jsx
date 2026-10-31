import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useOutletContext } from 'react-router-dom';
import { CalendarDays, Check, ChevronRight, Pencil, Plus, School, Search, ShieldOff, Lock, Trash2 } from 'lucide-react';

import Button from '../../components/ui/Button';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import NotBuiltYet from '../../components/ui/NotBuiltYet';
import FactLine from '../../components/ui/FactLine';
import { Bone, HomeEmpty, HomeError } from '../Dashboard/components/HomeCard';
import { Segments } from '../Admin/adminParts';
import { RowsLoading, SearchBox } from '../GoverningBody/bodyParts';
import { deadlinePassed, defaultSemesterOf } from '../Subjects/subjects';
import { localOf } from '../Attendance/attendance';
import { semesterTimeOf, deadlineSoonOf, spanWords } from './semesterTime';
import { AcademicYearForm, SemesterForm } from './components/PeriodForms';
import ClassForm from './components/ClassForm';
import ClassDetail from './components/ClassDetail';
import ClassSummary from '../Homeroom/ClassSummary.jsx';
import { academicsService } from '../../services/academicsService';
import { isNotBuiltYet } from '../../services/apiClient';
import { useAuth } from '../../context/AuthContext';
import { useT } from '../../i18n/LanguageContext';
import { academicsErrorMessage } from '../../i18n/apiError';
import { gradesFor } from '../../constants/schoolTypes';
import { ROLES } from '../../constants/roles';
import { formatDay } from './format';
import HomeroomNotes from '../Homeroom/HomeroomNotes';
import HomeroomPromotions from '../Homeroom/HomeroomPromotions';
import ClassReportCards from '../ReportCards/ClassReportCards';
import {
  YEAR_TABS,
  yearsInTab,
  defaultYearTab,
  tabOfYear,
  classesOfYear,
  yearSummary,
  gradesPresent,
  filterClasses,
  classGroupsOf,
} from './filters';

/*
  Classes, and the academic years that hold them — the Principal's half of
  ticket 07 (backend `36476f3`).

  This is what the whole join flow was waiting on. A STUDENT request is released
  by the homeroom teacher of a class at the grade asked for, and until a class
  existed nobody was that — so every student request sat in nobody's queue. A
  class is created here **with** its homeroom teacher, which is the moment those
  requests get a reviewer.

  The order is the backend's: a class belongs to an academic year, so the year
  comes first and an empty school sees the year form before anything else.
  Several years may be ACTIVE at once. Years sit on tabs by status — Active,
  Closed, All — as cards counting their classes and students; the Active tab and
  its newest year open first. The backend filters neither years nor classes
  beyond "one year", so every filter here runs on what already arrived
  (views/Classes/filters.js).

  ## A closed year is read-only

  CLOSED takes nothing new — no semester, no class, no change of homeroom — so
  those controls are not rendered for it, rather than offered and refused with a
  409. Everything in it stays readable.

  ## Correcting and deleting (backend `f669286`, owner 2026-09-26)

  An ACTIVE year's label and dates, an OPEN semester's dates and deadline, and a
  class's name and grade can be corrected — the same forms as creating, given
  `initial`. Deleting is for something made by mistake, so it is offered only
  where the page can see it is empty: a year with no semester and no class, a
  class with nobody in it. A semester is offered too, because whether anybody
  has asked to teach in it is not in the year's answer; the server refuses one
  that has, and that refusal is said. A closed year offers none of it.

  ## Why this page asks /users/me for itself

  The grade picker needs `school.schoolType` and `durationYears`, and a Principal
  arrives from sign-in carrying the thin membership that has neither — the same
  reason ProfilePage reads it once on mount, through a ref.

  ## Not here

  The homeroom teacher's own view of their classes, and choosing a class when
  releasing a student, are the next slice. Removing a student is `/api/members`.
*/

const SEMESTER_ORDINALS = [1, 2];

/* A card and its heading, as the dashboards' HomeCard draws them (owner, 2026-10-28). */
const SECTION = 'bg-white border border-slate-100 rounded-2xl p-6 max-sm:p-[18px] shadow-sm space-y-4 min-w-0';
const HEADING = 'text-base font-extrabold text-slate-900 tracking-tight';

const YEAR_BADGE = {
  ACTIVE: 'bg-emerald-50 text-emerald-700',
  CLOSED: 'bg-slate-100 text-slate-600',
};

const SEMESTER_BADGE = {
  OPEN: 'bg-emerald-50 text-emerald-700',
  FINALIZING: 'bg-amber-50 text-amber-700',
  CLOSED: 'bg-slate-100 text-slate-600',
};

/* The year's and a semester's state, in capitals at 11px like StateWord (owner, 2026-10-31: was 9px). */
const PILL = 'shrink-0 px-2 py-0.5 rounded-full text-[11px] font-bold uppercase leading-4 whitespace-nowrap';

/*
  Where a semester stands (owner, 2026-10-31, mockup item 2): a running one gets a
  thin bar with "Minggu ke-16 dari 23 / 7 minggu lagi", one not begun "Mulai 4 Jan
  2027 / 9 minggu lagi", one over nothing. Then its teaching sign-up deadline as a
  line with a calendar, amber from a week before it closes.
*/
const SemesterTime = ({ semester, today, open, t, lang }) => {
  const time = open ? semesterTimeOf(semester, today) : null;
  const deadline = semester.classSubjectRegistrationDeadline;
  const passed = Boolean(deadline) && deadlinePassed(semester);
  const soon = deadline && !passed && open ? deadlineSoonOf(semester, today) : null;
  const week = time?.phase === 'running' ? t('classes.semester.week', { week: time.week, weeks: time.weeks }) : '';
  return (
    <>
      {time?.phase === 'running' && (
        <div>
          <div className="h-2 mt-1 rounded-full bg-slate-100 overflow-hidden" role="img" aria-label={week}>
            <div className="h-full rounded-full bg-brand" style={{ width: `${Math.round(time.fraction * 100)}%` }} />
          </div>
          <FactLine
            size="xs"
            className="mt-1.5"
            facts={[week, time.left.unit === 'day' && time.left.n === 0 ? t('classes.semester.lastDay') : spanWords(time.left, t)]}
          />
        </div>
      )}
      {time?.phase === 'upcoming' && (
        <FactLine size="xs" facts={[t('classes.semester.startsOn', { date: formatDay(semester.startDate, lang) }), spanWords(time.startsIn, t)]} />
      )}
      {deadline && (
        <p className={`flex items-start gap-1.5 text-xs font-semibold ${soon !== null ? 'text-amber-700' : 'text-slate-500'}`}>
          <CalendarDays className="w-3.5 h-3.5 mt-px shrink-0" aria-hidden="true" />
          {passed
            ? t('classes.semester.deadlinePassedOn', { date: formatDay(deadline, lang) })
            : soon !== null
              ? t('classes.semester.deadlineSoon', { date: formatDay(deadline, lang), left: spanWords({ unit: 'day', n: soon }, t) })
              : t('classes.semester.deadlineOn', { date: formatDay(deadline, lang) })}
        </p>
      )}
    </>
  );
};

export const ClassesPage = () => {
  const { showToast } = useOutletContext();
  const { membership, refreshMe, activeRole } = useAuth();
  const { t, lang } = useT();

  const asked = useRef(false);
  useEffect(() => {
    if (asked.current) return;
    asked.current = true;
    refreshMe().catch(() => {});
  }, [refreshMe]);

  const school = membership?.school ?? null;
  const grades = gradesFor(school?.schoolType, school?.durationYears);
  /* The school's date today, for where a semester stands (the device's until /users/me says the zone). */
  const today = localOf(new Date(), school?.timeZone ?? null)?.date ?? '';

  const [years, setYears] = useState(null);
  const [yearId, setYearId] = useState(null);
  const [classes, setClasses] = useState(null);
  const location = useLocation();
  /* Coming back from a report card reopens its class (ClassReportCards passes it). */
  const [selectedClassId, setSelectedClassId] = useState(() => location.state?.classId ?? null);

  const [denied, setDenied] = useState(false);
  const [notBuilt, setNotBuilt] = useState(false);
  const [error, setError] = useState(null);
  const [classesError, setClassesError] = useState(null);
  /* "Coba lagi" after a failed read reads both lists again. */
  const [attempt, setAttempt] = useState(0);
  const retry = () => {
    setError(null);
    setClassesError(null);
    setAttempt((n) => n + 1);
  };

  /* Which inline form is open: 'year', 'semester-1', 'semester-2', 'class', or null. */
  const [openForm, setOpenForm] = useState(null);
  const [closing, setClosing] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  /* Which delete is being confirmed: { kind: 'year' | 'semester', item }. */
  const [deleting, setDeleting] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  /* Which years are on screen (YEAR_TABS), and the class filters. null until the
     years arrive, so the first tab can depend on what they are. */
  const [yearTab, setYearTab] = useState(null);
  const [query, setQuery] = useState('');
  const [grade, setGrade] = useState(null);

  const fail = useCallback(
    (err) => {
      if (err.status === 403) setDenied(true);
      else if (isNotBuiltYet(err)) setNotBuilt(true);
      else setError(academicsErrorMessage(err, t));
    },
    [t]
  );

  useEffect(() => {
    let cancelled = false;
    academicsService
      .academicYears()
      .then((list) => {
        if (cancelled) return;
        setYears(list);
        /* The ACTIVE tab and its newest year — the one being worked in — or every
           year when none is in use. */
        const tab = defaultYearTab(list);
        setYearTab((current) => current ?? tab);
        setYearId((current) => current ?? yearsInTab(list, tab)[0]?.id ?? null);
      })
      .catch((err) => !cancelled && fail(err));
    return () => {
      cancelled = true;
    };
  }, [fail, attempt]);

  /*
    Every class of every year, in ONE request. `GET /academics/classes` without a
    year answers the whole school to a Principal, each class naming its year — so
    the year cards can count their classes and students, and switching year is a
    filter rather than another request (generalLimiter counts every one).
  */
  useEffect(() => {
    let cancelled = false;
    academicsService
      .classes()
      .then((list) => !cancelled && setClasses(list))
      .catch((err) => !cancelled && setClassesError(academicsErrorMessage(err, t)));
    return () => {
      cancelled = true;
    };
  }, [t, attempt]);

  /*
    Nothing on this page may describe a year the reader cannot see selected. So
    the year on screen is looked up among the CARDS ON SCREEN, not among all
    years: a tab that does not hold it shows no year below, never a stale one.
  */
  const visibleYears = yearsInTab(years, yearTab);
  const year = visibleYears.find((entry) => entry.id === yearId) ?? null;
  const yearOpen = year?.status === 'ACTIVE';
  const yearClasses = classes === null ? null : classesOfYear(classes, year?.id);
  const shownClasses = yearClasses === null ? null : filterClasses(yearClasses, { query, grade });
  const gradeChips = yearClasses ? gradesPresent(yearClasses) : [];
  const filtering = query.trim() !== '' || grade !== null;

  /* Opening a year starts its classes unfiltered — a filter left over from
     another year would make this one look empty. */
  const selectYear = (id) => {
    setYearId(id);
    setQuery('');
    setGrade(null);
    setOpenForm((current) => (current === 'year' ? current : null));
  };

  const selectTab = (tab) => {
    setYearTab(tab);
    const onTab = yearsInTab(years, tab);
    if (!onTab.some((entry) => entry.id === yearId)) selectYear(onTab[0]?.id ?? null);
  };

  /* A year comes back whole after every change to it — semesters included — so
     it replaces the one held rather than being patched. */
  const putYear = (updated) => {
    if (!updated) return;
    setYears((prev) => {
      const rest = (prev ?? []).filter((entry) => entry.id !== updated.id);
      return [...rest, updated].sort((a, b) => String(b.startDate).localeCompare(String(a.startDate)));
    });
  };

  const handleYearCreated = (created) => {
    putYear(created);
    /* A new year is ACTIVE: show it where it lives, selected. */
    setYearTab(tabOfYear(created));
    selectYear(created?.id ?? null);
    setOpenForm(null);
    showToast(t('classes.year.created', { label: created?.label ?? '' }), 'success');
  };

  const handleSemesterCreated = (updated, ordinal) => {
    putYear(updated);
    setOpenForm(null);
    showToast(t('classes.semester.created', { n: ordinal }), 'success');
  };

  const handleClassCreated = (created) => {
    setClasses((prev) =>
      [...(prev ?? []), created].sort(
        (a, b) => a.gradeLevel - b.gradeLevel || a.name.localeCompare(b.name, 'id')
      )
    );
    /* The new class must be visible, whatever was being searched for. */
    setQuery('');
    setGrade(null);
    setOpenForm(null);
    showToast(t('classes.class.created', { name: created?.name ?? '' }), 'success');
  };

  const handleClassChanged = (updated) => {
    setClasses((prev) => (prev ?? []).map((entry) => (entry.id === updated?.id ? updated : entry)));
  };

  const handleYearSaved = (updated) => {
    putYear(updated);
    setOpenForm(null);
    showToast(t('classes.year.edit.done', { label: updated?.label ?? '' }), 'success');
  };

  const handleSemesterSaved = (updated, ordinal) => {
    putYear(updated);
    setOpenForm(null);
    showToast(t('classes.semester.edit.done', { n: ordinal }), 'success');
  };

  const handleClassDeleted = (gone) => {
    setClasses((prev) => (prev ?? []).filter((entry) => entry.id !== gone?.id));
    setSelectedClassId(null);
    showToast(t('classes.class.delete.done', { name: gone?.name ?? '' }), 'success');
  };

  const handleDelete = async () => {
    if (!deleting) return;
    setIsDeleting(true);
    try {
      if (deleting.kind === 'year') {
        await academicsService.deleteAcademicYear(deleting.item.id);
        const remaining = (years ?? []).filter((entry) => entry.id !== deleting.item.id);
        setYears(remaining);
        /* The next year on this tab takes its place, or none. */
        setYearId(yearsInTab(remaining, yearTab)[0]?.id ?? null);
        setOpenForm(null);
        showToast(t('classes.year.delete.done', { label: deleting.item.label }), 'success');
      } else {
        putYear(await academicsService.deleteSemester(deleting.item.id));
        setOpenForm(null);
        showToast(t('classes.semester.delete.done', { n: deleting.item.ordinal }), 'success');
      }
    } catch (err) {
      showToast(academicsErrorMessage(err, t), 'error');
    } finally {
      setIsDeleting(false);
      setDeleting(null);
    }
  };

  const handleClose = async () => {
    setIsClosing(true);
    try {
      putYear(await academicsService.closeAcademicYear(year.id));
      /* It leaves the ACTIVE tab; follow it, so it does not vanish from under the
         reader the moment they closed it. */
      setYearTab((current) => (current === 'ACTIVE' ? 'CLOSED' : current));
      setOpenForm(null);
      showToast(t('classes.year.closed', { label: year.label }), 'success');
    } catch (err) {
      showToast(academicsErrorMessage(err, t, lang), 'error');
    } finally {
      setIsClosing(false);
      setClosing(false);
    }
  };

  /* The greeting's slash line, as on the dashboards (owner, 2026-10-28): the school,
     the year on screen with its running semester, its classes and students. */
  const semester = year?.semesters?.find((entry) => entry.id === defaultSemesterOf(year, new Date().toISOString().slice(0, 10)));
  const summary = year && classes !== null ? yearSummary(year, classes) : null;
  const title = (
    <div className="select-none">
      <h1 className="text-3xl max-sm:text-2xl font-extrabold text-slate-900 tracking-tight leading-tight">
        {t('classes.title')}
      </h1>
      <FactLine
        className="mt-2"
        facts={[
          school?.name,
          year && (semester ? t('teacherDash.academicContext', { year: year.label, n: semester.ordinal }) : year.label),
          summary && t('classes.year.stat.classes', { n: summary.classes }),
          summary && t('classes.year.stat.students', { n: summary.students }),
        ]}
      />
    </div>
  );

  if (denied) {
    return (
      <div className="space-y-6">
        {title}
        <section className="bg-white border border-slate-100 rounded-2xl p-6 max-sm:p-[18px] shadow-sm">
          <HomeEmpty icon={ShieldOff} title={t('classes.denied.title')} body={t('classes.denied.body')} />
        </section>
      </div>
    );
  }

  if (notBuilt) {
    return (
      <div className="space-y-6">
        {title}
        <NotBuiltYet />
      </div>
    );
  }

  if (selectedClassId) {
    return (
      <div className="space-y-6">
        {title}
        <ClassDetail
          classId={selectedClassId}
          /* "Ringkasan kelas", which the Principal and Vice Principals read too (backend
             7ee7857; owner 2026-10-27: after the homeroom teacher's). */
          summary={<ClassSummary key={`sum-${selectedClassId}`} classId={selectedClassId} />}
          onBack={() => setSelectedClassId(null)}
          onChanged={handleClassChanged}
          onDeleted={handleClassDeleted}
          grades={grades}
          showToast={showToast}
          canRemove={activeRole === ROLES.PRINCIPAL}
        />
        {/* The homeroom teacher's notes, read only at the leaders' desk (backend 483be5a, owner 2026-10-18). */}
        <HomeroomNotes
          key={`notes-${selectedClassId}`}
          classId={selectedClassId}
          academicYearId={(classes ?? []).find((entry) => entry.id === selectedClassId)?.academicYear?.id ?? yearId}
        />
        {/* Its Semester 2 promotion outcomes, read only here too (backend 4dae152, owner 2026-10-22). */}
        <HomeroomPromotions
          key={`promo-${selectedClassId}`}
          classId={selectedClassId}
          academicYearId={(classes ?? []).find((entry) => entry.id === selectedClassId)?.academicYear?.id ?? yearId}
        />
        {/* The class's report cards, closed semesters first (backend 3a22f90, owner 2026-10-20). */}
        <ClassReportCards
          key={`rc-${selectedClassId}`}
          classId={selectedClassId}
          academicYearId={(classes ?? []).find((entry) => entry.id === selectedClassId)?.academicYear?.id ?? yearId}
          initialSemesterId={location.state?.classId === selectedClassId ? (location.state?.semesterId ?? null) : null}
          focus={location.state?.classId === selectedClassId && location.state?.focus === 'reportCards'}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {title}

      {error ? (
        <HomeError message={error} retryLabel={t('att.error.retry')} onRetry={retry} />
      ) : years === null ? (
        <RowsLoading rows={3} />
      ) : years.length === 0 ? (
        /* An empty school starts here: nothing else on this page can exist
           before a year does. */
        <section className={SECTION}>
          <div className="min-w-0">
            <h2 className={HEADING}>{t('classes.year.firstTitle')}</h2>
            <p className="text-xs font-semibold text-slate-500 leading-relaxed mt-0.5">
              {t('classes.year.firstBody')}
            </p>
          </div>
          <div className="max-w-xl">
            <AcademicYearForm years={years ?? []} onCreated={handleYearCreated} />
          </div>
        </section>
      ) : (
        <>
          {/* ---------------- the academic year ---------------- */}
          <section className={SECTION}>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <h2 className={HEADING}>{t('classes.year.heading')}</h2>
              {openForm !== 'year' && (
                <Button size="sm" variant="outline" className="shrink-0" onClick={() => setOpenForm('year')}>
                  <Plus className="w-4 h-4 mr-1" aria-hidden="true" />
                  {t('classes.year.new')}
                </Button>
              )}
            </div>

            {openForm === 'year' && (
              <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 max-w-xl">
                <AcademicYearForm years={years ?? []} onCreated={handleYearCreated} onCancel={() => setOpenForm(null)} />
              </div>
            )}

            {/* Tabs by status — the backend sends every year and filters none, so
                this is done here — then one card per year on the tab. */}
            {/* Text tabs with a counter, as on the dashboards (the skill's recipe). */}
            <div role="tablist" aria-label={t('classes.year.heading')} className="flex gap-0.5 select-none overflow-x-auto overflow-y-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden shadow-[inset_0_-1px_0_var(--color-slate-100)]">
              {YEAR_TABS.map((tab) => {
                const isActive = yearTab === tab;
                const count = yearsInTab(years, tab).length;
                return (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => selectTab(tab)}
                    role="tab"
                    aria-selected={isActive}
                    className={`px-2.5 py-2 text-sm font-bold border-b-2 whitespace-nowrap transition-colors cursor-pointer focus:outline-none focus-visible:text-brand ${
                      isActive ? 'text-brand border-brand' : 'text-slate-500 border-transparent hover:text-slate-700'
                    }`}
                  >
                    {t(`classes.year.tab.${tab}`)}
                    <span
                      className={`ml-1.5 px-1.5 rounded-full text-[11px] tabular-nums ${
                        isActive ? 'bg-brand-tint text-brand' : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            {visibleYears.length === 0 ? (
              <p className="py-4 text-xs font-semibold text-slate-500 leading-relaxed">
                {t(`classes.year.tabEmpty.${yearTab === 'CLOSED' ? 'CLOSED' : 'ACTIVE'}`)}
              </p>
            ) : (
              <div
                className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3"
                role="group"
                aria-label={t(`classes.year.tab.${yearTab}`)}
              >
                {visibleYears.map((entry) => {
                  const active = entry.id === year?.id;
                  const summary = yearSummary(entry, classes);
                  const editing = active && openForm === 'year-edit';
                  /* Only an empty year can go: no semester, no class. */
                  const deletable = classes !== null && summary.semesters === 0 && summary.classes === 0;
                  return (
                    <div
                      key={entry.id}
                      className={`rounded-2xl border transition-colors ${editing ? 'sm:col-span-2 xl:col-span-3' : ''} ${
                        active ? 'border-brand ring-1 ring-brand bg-brand-tint/40' : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <button
                        type="button"
                        aria-pressed={active}
                        onClick={() => selectYear(entry.id)}
                        className="w-full text-left p-4 pb-3 space-y-2 rounded-2xl cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                      >
                        <span className="flex items-center justify-between gap-2">
                          <span className={`text-base font-extrabold tabular-nums ${active ? 'text-brand' : 'text-slate-800'}`}>
                            {entry.label}
                          </span>
                          <span className={`${PILL} ${YEAR_BADGE[entry.status] ?? YEAR_BADGE.CLOSED}`}>
                            {t(`classes.year.status.${entry.status}`)}
                          </span>
                        </span>
                        <span className="block text-xs font-semibold text-slate-500">
                          {t('classes.year.range', {
                            start: formatDay(entry.startDate, lang),
                            end: formatDay(entry.endDate, lang),
                          })}
                        </span>
                        {/* The counts as eyebrow cells (owner, 2026-10-31, mockup item 1). */}
                        <span className="flex flex-wrap gap-x-6 gap-y-1 pt-1">
                          {[
                            ['semesters', summary.semesters],
                            ['classes', summary.classes],
                            ['students', summary.students],
                          ].map(([key, n]) => (
                            <span key={key}>
                              <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">{t(`classes.year.cell.${key}`)}</span>
                              {classes === null ? (
                                <Bone className="h-5 w-6 mt-1" />
                              ) : (
                                <span className="block text-lg font-extrabold text-slate-900 leading-tight tabular-nums">{n}</span>
                              )}
                            </span>
                          ))}
                        </span>
                        {/* Said in words as well as drawn: the colour alone is not
                            enough to tell which year the rest of the page is about. */}
                        {active && (
                          <span className="flex items-center gap-1 text-[11px] font-extrabold text-brand">
                            <Check className="w-3.5 h-3.5" aria-hidden="true" />
                            {t('classes.year.selected')}
                          </span>
                        )}
                      </button>

                      {/* The year's own actions sit on its own card, the way a
                          semester's do (owner, 2026-10-03: at the foot of the
                          section they read as belonging to the semesters). */}
                      {editing ? (
                        <div className="px-4 pb-4">
                          <div className="rounded-2xl border border-slate-200 bg-white p-4 max-w-xl">
                            <AcademicYearForm
                              key={entry.id}
                              initial={entry}
                              years={years ?? []}
                              onSaved={handleYearSaved}
                              onCancel={() => setOpenForm(null)}
                            />
                          </div>
                        </div>
                      ) : (
                        entry.status === 'ACTIVE' && (
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 pb-3 pt-2.5 border-t border-slate-200/70">
                            <button
                              type="button"
                              onClick={() => {
                                selectYear(entry.id);
                                setOpenForm('year-edit');
                              }}
                              className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-500 hover:text-brand transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand rounded"
                            >
                              <Pencil className="w-3 h-3" aria-hidden="true" />
                              {t('classes.year.edit.open')}
                            </button>
                            {deletable && (
                              <button
                                type="button"
                                onClick={() => {
                                  selectYear(entry.id);
                                  setDeleting({ kind: 'year', item: entry });
                                }}
                                className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-500 hover:text-rose-600 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand rounded"
                              >
                                <Trash2 className="w-3 h-3" aria-hidden="true" />
                                {t('classes.year.delete.open')}
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                selectYear(entry.id);
                                setClosing(true);
                              }}
                              className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700 hover:underline cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand rounded"
                            >
                              <Lock className="w-3 h-3" aria-hidden="true" />
                              {t('classes.year.close')}
                            </button>
                          </div>
                        )
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {year && (
              <div className="pt-4 border-t border-slate-100 space-y-3">
                {/* The dates are on the card above; this names the year the
                    semesters below belong to. The year's own Edit, Delete and Close
                    sit on its card (owner, 2026-10-03). */}
                <h3 className="text-sm font-extrabold text-slate-900">
                  {t('classes.year.semestersIn', { label: year.label })}
                </h3>

                {!yearOpen && (
                  <p className="text-xs font-semibold text-slate-500">{t('classes.year.closedNote')}</p>
                )}

                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {SEMESTER_ORDINALS.map((ordinal) => {
                    const semester = year.semesters?.find((entry) => entry.ordinal === ordinal);
                    const formKey = `semester-${ordinal}`;
                    /* A semester not made yet is a dashed box that makes it (owner, 2026-10-31). */
                    if (!semester && yearOpen && openForm !== formKey) {
                      return (
                        <li key={ordinal}>
                          <button
                            type="button"
                            onClick={() => setOpenForm(formKey)}
                            className="w-full h-full min-h-[84px] rounded-2xl border border-dashed border-slate-300 flex items-center justify-center gap-1.5 text-sm font-bold text-brand hover:bg-brand-tint/40 hover:border-brand/40 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                          >
                            <Plus className="w-4 h-4" aria-hidden="true" />
                            {t('classes.semester.add', { n: ordinal })}
                          </button>
                        </li>
                      );
                    }
                    return (
                      <li key={ordinal} className="rounded-2xl border border-slate-200 p-4 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-extrabold text-slate-800">
                            {t('classes.semester.name', { n: ordinal })}
                          </span>
                          {semester && (() => {
                            /* Closing a year leaves its semesters OPEN in the database —
                               semester close is not built in the backend yet — so a
                               closed year's semesters read as closed here, with the year. */
                            const status = yearOpen ? semester.status : 'CLOSED';
                            return (
                              <span className={`${PILL} ${SEMESTER_BADGE[status] ?? SEMESTER_BADGE.CLOSED}`}>
                                {t(`classes.semester.status.${status}`)}
                              </span>
                            );
                          })()}
                        </div>

                        {semester && openForm === `semester-edit-${ordinal}` ? (
                          <SemesterForm
                            key={semester.id}
                            year={year}
                            ordinal={ordinal}
                            initial={semester}
                            onSaved={(updated) => handleSemesterSaved(updated, ordinal)}
                            onCancel={() => setOpenForm(null)}
                          />
                        ) : semester ? (
                          <>
                            <p className="text-xs font-semibold text-slate-500">
                              {formatDay(semester.startDate, lang)} - {formatDay(semester.endDate, lang)}
                            </p>
                            <SemesterTime semester={semester} today={today} open={yearOpen} t={t} lang={lang} />
                            {/* An OPEN semester of an ACTIVE year only — the server's own rule. */}
                            {yearOpen && semester.status === 'OPEN' && (
                              <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1">
                                <button
                                  type="button"
                                  onClick={() => setOpenForm(`semester-edit-${ordinal}`)}
                                  className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-500 hover:text-brand transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand rounded"
                                >
                                  <Pencil className="w-3 h-3" aria-hidden="true" />
                                  {t('classes.semester.edit.open')}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setDeleting({ kind: 'semester', item: semester })}
                                  className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-500 hover:text-rose-600 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand rounded"
                                >
                                  <Trash2 className="w-3 h-3" aria-hidden="true" />
                                  {t('classes.semester.delete.open')}
                                </button>
                              </div>
                            )}
                          </>
                        ) : openForm === formKey ? (
                          <SemesterForm
                            year={year}
                            ordinal={ordinal}
                            onCreated={(updated) => handleSemesterCreated(updated, ordinal)}
                            onCancel={() => setOpenForm(null)}
                          />
                        ) : (
                          <p className="text-xs font-semibold text-slate-500">{t('classes.semester.none')}</p>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </section>

          {/* ---------------- its classes ---------------- */}
          {year && (
            <section className={SECTION}>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <h2 className={HEADING}>
                  {t('classes.class.heading', { label: year.label })}
                </h2>
                {yearOpen && openForm !== 'class' && (
                  <Button size="sm" className="shrink-0" onClick={() => setOpenForm('class')}>
                    <Plus className="w-4 h-4 mr-1" aria-hidden="true" />
                    {t('classes.class.new')}
                  </Button>
                )}
              </div>

              {openForm === 'class' && (
                <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
                  <ClassForm
                    year={year}
                    grades={grades}
                    onCreated={handleClassCreated}
                    onCancel={() => setOpenForm(null)}
                  />
                </div>
              )}

              {/* Filters, once there is something to filter. The grade chips
                  appear only when the year has more than one grade. */}
              {!classesError && yearClasses !== null && yearClasses.length > 0 && (
                <div className="flex flex-wrap items-center gap-3">
                  <SearchBox id="class-search" label={t('classes.class.search')} placeholder={t('classes.class.search')} value={query} onChange={setQuery} />
                  {gradeChips.length > 1 && (
                    /* Segments, as on Admin and Subjects (owner, 2026-10-31, mockup item 3). */
                    <Segments
                      label={t('classes.class.grade.label')}
                      options={['all', ...gradeChips]}
                      value={grade ?? 'all'}
                      onChange={(option) => setGrade(option === 'all' ? null : option)}
                      labelOf={(option) => (option === 'all' ? t('classes.class.grade.everyShort') : t('classes.grade', { n: option }))}
                    />
                  )}
                </div>
              )}

              {!classesError && filtering && shownClasses !== null && (
                <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-semibold text-slate-500" aria-live="polite">
                  <span>{t('classes.class.shown', { n: shownClasses.length, total: yearClasses.length })}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setQuery('');
                      setGrade(null);
                    }}
                    className="font-extrabold text-brand hover:text-brand-deep cursor-pointer focus:outline-none focus-visible:underline"
                  >
                    {t('classes.class.clearFilter')}
                  </button>
                </div>
              )}

              {classesError ? (
                <HomeError message={classesError} retryLabel={t('att.error.retry')} onRetry={retry} />
              ) : shownClasses === null ? (
                <div aria-busy="true" aria-label={t('common.loading')}>
                  {[0, 1, 2].map((n) => (
                    <div key={n} className="py-3">
                      <div className="h-3.5 w-24 animate-pulse bg-slate-100 rounded-[10px]" />
                      <div className="h-3 w-56 mt-2 animate-pulse bg-slate-100 rounded-[10px]" />
                    </div>
                  ))}
                </div>
              ) : yearClasses.length > 0 && shownClasses.length === 0 ? (
                <HomeEmpty icon={Search} title={t('classes.class.noMatch')} />
              ) : shownClasses.length === 0 ? (
                <HomeEmpty
                  icon={School}
                  title={t('classes.class.empty')}
                  body={t(yearOpen ? 'classes.class.emptyHint' : 'classes.class.emptyClosed')}
                />
              ) : (
                /* Grouped by grade once two are present, the student count at the right
                   (owner, 2026-10-31, mockup item 4). */
                <div className="-mx-2">
                  {classGroupsOf(shownClasses).map((group, index, groups) => (
                    <div key={group.grade}>
                      {groups.length > 1 && (
                        <div className={`flex flex-wrap items-baseline justify-between gap-x-3 px-2 pb-1.5 border-b border-slate-100 ${index > 0 ? 'mt-4' : ''}`}>
                          <h3 className="text-[13px] font-extrabold text-slate-700">{t('classes.grade', { n: group.grade })}</h3>
                          <FactLine
                            size="xs"
                            facts={[t('classes.year.stat.classes', { n: group.classes.length }), t('classes.class.count', { n: group.students })]}
                          />
                        </div>
                      )}
                      <ul>
                        {group.classes.map((entry) => (
                          <li key={entry.id} className="border-b border-slate-100 last:border-0">
                            <button
                              type="button"
                              onClick={() => setSelectedClassId(entry.id)}
                              className="group w-full px-2 py-3 flex items-center gap-3 text-left rounded-xl hover:bg-slate-50 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                            >
                              <span className="min-w-0 flex-1">
                                <span className="block text-sm font-bold text-slate-900 break-words">{entry.name}</span>
                                {entry.homeroomTeacher ? (
                                  <span className="block mt-0.5 text-xs font-semibold text-slate-500 break-words">
                                    {t('classes.class.homeroomLine', { name: entry.homeroomTeacher.fullName })}
                                  </span>
                                ) : (
                                  <span className="block mt-0.5 text-xs font-bold text-amber-700">{t('classes.class.noHomeroomLine')}</span>
                                )}
                              </span>
                              <span className="shrink-0 text-[13px] font-extrabold text-slate-700 tabular-nums">
                                {t('classes.class.count', { n: entry.studentCount ?? 0 })}
                              </span>
                              <ChevronRight className="w-4 h-4 text-slate-400 shrink-0 transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden="true" />
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}
        </>
      )}

      <ConfirmDialog
        open={deleting !== null}
        tone="danger"
        title={
          deleting?.kind === 'year'
            ? t('classes.year.delete.title', { label: deleting.item.label })
            : t('classes.semester.delete.title', { n: deleting?.item?.ordinal ?? '' })
        }
        body={
          deleting?.kind === 'year'
            ? t('classes.year.delete.body', { label: deleting.item.label })
            : t('classes.semester.delete.body', {
                n: deleting?.item?.ordinal ?? '',
                label: year?.label ?? '',
                start: deleting ? formatDay(deleting.item.startDate, lang) : '',
                end: deleting ? formatDay(deleting.item.endDate, lang) : '',
              })
        }
        confirmLabel={t(deleting?.kind === 'year' ? 'classes.year.delete.confirm' : 'classes.semester.delete.confirm')}
        cancelLabel={t('common.cancel')}
        busy={isDeleting}
        busyLabel={t('common.loading')}
        onConfirm={handleDelete}
        onCancel={() => setDeleting(null)}
      />

      <ConfirmDialog
        open={closing}
        tone="danger"
        title={t('classes.year.closeTitle', { label: year?.label ?? '' })}
        body={t('classes.year.closeBody')}
        confirmLabel={t('classes.year.close')}
        cancelLabel={t('common.cancel')}
        busy={isClosing}
        busyLabel={t('common.loading')}
        onConfirm={handleClose}
        onCancel={() => setClosing(false)}
      />
    </div>
  );
};

export default ClassesPage;
