import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { CalendarRange, Check, ChevronRight, Plus, School, Search, ShieldOff, Lock } from 'lucide-react';

import Button from '../../components/ui/Button';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import NotBuiltYet from '../../components/ui/NotBuiltYet';
import { AcademicYearForm, SemesterForm } from './components/PeriodForms';
import ClassForm from './components/ClassForm';
import ClassDetail from './components/ClassDetail';
import { academicsService } from '../../services/academicsService';
import { isNotBuiltYet } from '../../services/apiClient';
import { useAuth } from '../../context/AuthContext';
import { useT } from '../../i18n/LanguageContext';
import { academicsErrorMessage } from '../../i18n/apiError';
import { gradesFor } from '../../constants/schoolTypes';
import { formatDay } from './format';
import {
  YEAR_TABS,
  yearsInTab,
  defaultYearTab,
  tabOfYear,
  classesOfYear,
  yearSummary,
  gradesPresent,
  filterClasses,
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

  ## Why this page asks /users/me for itself

  The grade picker needs `school.schoolType` and `durationYears`, and a Principal
  arrives from sign-in carrying the thin membership that has neither — the same
  reason ProfilePage reads it once on mount, through a ref.

  ## Not here

  The homeroom teacher's own view of their classes, and choosing a class when
  releasing a student, are the next slice. Removing a student is `/api/members`.
*/

const SEMESTER_ORDINALS = [1, 2];

const YEAR_BADGE = {
  ACTIVE: 'bg-emerald-50 text-emerald-700',
  CLOSED: 'bg-slate-100 text-slate-500',
};

const SEMESTER_BADGE = {
  OPEN: 'bg-emerald-50 text-emerald-700',
  FINALIZING: 'bg-amber-50 text-amber-700',
  CLOSED: 'bg-slate-100 text-slate-500',
};

export const ClassesPage = () => {
  const { showToast } = useOutletContext();
  const { membership, refreshMe } = useAuth();
  const { t, lang } = useT();

  const asked = useRef(false);
  useEffect(() => {
    if (asked.current) return;
    asked.current = true;
    refreshMe().catch(() => {});
  }, [refreshMe]);

  const school = membership?.school ?? null;
  const grades = gradesFor(school?.schoolType, school?.durationYears);

  const [years, setYears] = useState(null);
  const [yearId, setYearId] = useState(null);
  const [classes, setClasses] = useState(null);
  const [selectedClassId, setSelectedClassId] = useState(null);

  const [denied, setDenied] = useState(false);
  const [notBuilt, setNotBuilt] = useState(false);
  const [error, setError] = useState(null);
  const [classesError, setClassesError] = useState(null);

  /* Which inline form is open: 'year', 'semester-1', 'semester-2', 'class', or null. */
  const [openForm, setOpenForm] = useState(null);
  const [closing, setClosing] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
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
  }, [fail]);

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
  }, [t]);

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
      showToast(academicsErrorMessage(err, t), 'error');
    } finally {
      setIsClosing(false);
      setClosing(false);
    }
  };

  const title = (
    <div className="select-none">
      <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight leading-tight">
        {t('classes.title')}
      </h1>
      <p className="text-xs sm:text-sm text-slate-500 font-bold mt-1">
        {school?.name ? t('classes.subtitle', { school: school.name }) : t('classes.subtitleNoSchool')}
      </p>
    </div>
  );

  if (denied) {
    return (
      <div className="space-y-6">
        {title}
        <div className="py-16 px-6 text-center border border-dashed border-slate-200 rounded-2xl bg-white">
          <div className="w-11 h-11 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center mx-auto">
            <ShieldOff className="w-5 h-5 text-slate-400" aria-hidden="true" />
          </div>
          <h2 className="mt-3.5 text-sm font-extrabold text-slate-700">{t('classes.denied.title')}</h2>
          <p className="mt-1.5 text-xs font-semibold text-slate-500 leading-relaxed max-w-sm mx-auto">
            {t('classes.denied.body')}
          </p>
        </div>
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
          onBack={() => setSelectedClassId(null)}
          onChanged={handleClassChanged}
          showToast={showToast}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {title}

      {error ? (
        <div className="p-4 bg-red-50 border-l-4 border-red-500 rounded-r-2xl text-sm text-red-700" role="alert">
          {error}
        </div>
      ) : years === null ? (
        <div className="space-y-4" aria-label={t('common.loading')}>
          <div className="h-36 bg-white border border-slate-100 rounded-2xl animate-pulse" />
          <div className="h-48 bg-white border border-slate-100 rounded-2xl animate-pulse" />
        </div>
      ) : years.length === 0 ? (
        /* An empty school starts here: nothing else on this page can exist
           before a year does. */
        <section className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-tint text-brand flex items-center justify-center shrink-0">
              <CalendarRange className="w-5 h-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-extrabold text-slate-800">{t('classes.year.firstTitle')}</h2>
              <p className="text-xs font-semibold text-slate-500 leading-relaxed mt-0.5">
                {t('classes.year.firstBody')}
              </p>
            </div>
          </div>
          <div className="max-w-xl">
            <AcademicYearForm onCreated={handleYearCreated} />
          </div>
        </section>
      ) : (
        <>
          {/* ---------------- the academic year ---------------- */}
          <section className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-2 text-slate-500">
                <CalendarRange className="w-4 h-4 shrink-0" aria-hidden="true" />
                <h2 className="text-[11px] font-bold uppercase tracking-wider">{t('classes.year.heading')}</h2>
              </div>
              {openForm !== 'year' && (
                <Button size="sm" variant="outline" className="shrink-0" onClick={() => setOpenForm('year')}>
                  <Plus className="w-4 h-4 mr-1" aria-hidden="true" />
                  {t('classes.year.new')}
                </Button>
              )}
            </div>

            {openForm === 'year' && (
              <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 max-w-xl">
                <AcademicYearForm onCreated={handleYearCreated} onCancel={() => setOpenForm(null)} />
              </div>
            )}

            {/* Tabs by status — the backend sends every year and filters none, so
                this is done here — then one card per year on the tab. */}
            <div className="border-b border-slate-100 flex gap-6 select-none overflow-x-auto">
              {YEAR_TABS.map((tab) => {
                const isActive = yearTab === tab;
                const count = yearsInTab(years, tab).length;
                return (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => selectTab(tab)}
                    aria-pressed={isActive}
                    className={`pb-3 text-sm font-extrabold transition-all border-b-2 cursor-pointer focus:outline-none focus-visible:text-brand flex items-center gap-2 shrink-0 whitespace-nowrap ${
                      isActive ? 'border-brand text-brand' : 'border-transparent text-slate-500 hover:text-slate-600'
                    }`}
                  >
                    {t(`classes.year.tab.${tab}`)}
                    <span
                      className={`px-1.5 py-0.5 rounded-md text-[10px] font-extrabold tabular-nums ${
                        isActive ? 'bg-brand-tint text-brand' : 'bg-slate-100 text-slate-500'
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
                  return (
                    <button
                      key={entry.id}
                      type="button"
                      aria-pressed={active}
                      onClick={() => selectYear(entry.id)}
                      className={`text-left rounded-2xl border p-4 space-y-1.5 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
                        active
                          ? 'border-brand ring-1 ring-brand bg-brand-tint/40'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className={`text-base font-extrabold tabular-nums ${active ? 'text-brand' : 'text-slate-800'}`}>
                          {entry.label}
                        </span>
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${YEAR_BADGE[entry.status] ?? YEAR_BADGE.CLOSED}`}>
                          {t(`classes.year.status.${entry.status}`)}
                        </span>
                      </span>
                      <span className="block text-xs font-semibold text-slate-500">
                        {t('classes.year.range', {
                          start: formatDay(entry.startDate, lang),
                          end: formatDay(entry.endDate, lang),
                        })}
                      </span>
                      <span className="block text-[11px] font-bold text-slate-600">
                        {classes === null
                          ? t('common.loading')
                          : t('classes.year.summary', summary)}
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
                  );
                })}
              </div>
            )}

            {year && (
              <div className="pt-4 border-t border-slate-100 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  {/* The dates are on the card above; this names the year the
                      semesters below belong to, the way the class section does. */}
                  <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    {t('classes.year.semestersIn', { label: year.label })}
                  </h3>
                  {yearOpen && (
                    <button
                      type="button"
                      onClick={() => setClosing(true)}
                      className="inline-flex items-center gap-1.5 self-start text-[11px] font-bold text-slate-500 hover:text-rose-600 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand rounded"
                    >
                      <Lock className="w-3.5 h-3.5" aria-hidden="true" />
                      {t('classes.year.close')}
                    </button>
                  )}
                </div>

                {!yearOpen && (
                  <p className="text-xs font-semibold text-slate-500">{t('classes.year.closedNote')}</p>
                )}

                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {SEMESTER_ORDINALS.map((ordinal) => {
                    const semester = year.semesters?.find((entry) => entry.ordinal === ordinal);
                    const formKey = `semester-${ordinal}`;
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
                              <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${SEMESTER_BADGE[status] ?? SEMESTER_BADGE.CLOSED}`}>
                                {t(`classes.semester.status.${status}`)}
                              </span>
                            );
                          })()}
                        </div>

                        {semester ? (
                          <p className="text-xs font-semibold text-slate-500">
                            {formatDay(semester.startDate, lang)} – {formatDay(semester.endDate, lang)}
                          </p>
                        ) : openForm === formKey ? (
                          <SemesterForm
                            year={year}
                            ordinal={ordinal}
                            onCreated={(updated) => handleSemesterCreated(updated, ordinal)}
                            onCancel={() => setOpenForm(null)}
                          />
                        ) : yearOpen ? (
                          <button
                            type="button"
                            onClick={() => setOpenForm(formKey)}
                            className="inline-flex items-center gap-1 text-xs font-bold text-brand hover:text-brand-deep cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand rounded"
                          >
                            <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                            {t('classes.semester.add', { n: ordinal })}
                          </button>
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
            <section className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-center gap-2 text-slate-500">
                  <School className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <h2 className="text-[11px] font-bold uppercase tracking-wider">
                    {t('classes.class.heading', { label: year.label })}
                  </h2>
                </div>
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
                <div className="flex flex-col lg:flex-row lg:items-center gap-3">
                  <div className="relative lg:w-80 shrink-0">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" aria-hidden="true" />
                    <input
                      type="search"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder={t('classes.class.search')}
                      aria-label={t('classes.class.search')}
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
                    />
                  </div>
                  {gradeChips.length > 1 && (
                    <div className="flex flex-wrap gap-2" role="group" aria-label={t('classes.class.grade.label')}>
                      {[null, ...gradeChips].map((level) => {
                        const on = grade === level;
                        return (
                          <button
                            key={level ?? 'all'}
                            type="button"
                            aria-pressed={on}
                            onClick={() => setGrade(level)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-extrabold border transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
                              on ? 'border-brand bg-brand-tint text-brand' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                            }`}
                          >
                            {level === null ? t('classes.class.grade.all') : t('classes.grade', { n: level })}
                          </button>
                        );
                      })}
                    </div>
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
                <div className="p-3 bg-red-50 border-l-4 border-red-500 rounded-r-xl text-xs text-red-700 font-semibold" role="alert">
                  {classesError}
                </div>
              ) : shownClasses === null ? (
                <div className="h-24 bg-slate-50 rounded-2xl animate-pulse" aria-label={t('common.loading')} />
              ) : yearClasses.length > 0 && shownClasses.length === 0 ? (
                <div className="py-8 text-center border border-dashed border-slate-200 rounded-2xl select-none">
                  <Search className="w-7 h-7 text-slate-300 mx-auto" aria-hidden="true" />
                  <p className="mt-2 text-xs font-extrabold text-slate-500">{t('classes.class.noMatch')}</p>
                </div>
              ) : shownClasses.length === 0 ? (
                <div className="py-10 text-center border border-dashed border-slate-200 rounded-2xl select-none">
                  <School className="w-8 h-8 text-slate-300 mx-auto" aria-hidden="true" />
                  <p className="mt-2 text-xs font-extrabold text-slate-500">{t('classes.class.empty')}</p>
                  <p className="mt-1 text-[11px] font-semibold text-slate-500 max-w-sm mx-auto leading-relaxed">
                    {t(yearOpen ? 'classes.class.emptyHint' : 'classes.class.emptyClosed')}
                  </p>
                </div>
              ) : (
                <ul className="divide-y divide-slate-100 -mx-2">
                  {shownClasses.map((entry) => (
                    <li key={entry.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedClassId(entry.id)}
                        className="w-full px-2 py-3 flex items-center justify-between gap-3 text-left rounded-xl hover:bg-slate-50 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                      >
                        <span className="min-w-0">
                          <span className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-extrabold text-slate-800 break-words">{entry.name}</span>
                            <span className="px-2 py-0.5 bg-brand-tint text-brand text-[10px] font-extrabold rounded-md">
                              {t('classes.grade', { n: entry.gradeLevel })}
                            </span>
                          </span>
                          <span className="block text-[11px] font-semibold text-slate-500 mt-0.5 break-words">
                            {t('classes.class.homeroomLine', {
                              name: entry.homeroomTeacher?.fullName ?? t('classes.detail.noHomeroom'),
                            })}
                            {' · '}
                            {t('classes.class.studentCount', { n: entry.studentCount ?? 0 })}
                          </span>
                        </span>
                        <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" aria-hidden="true" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
        </>
      )}

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
