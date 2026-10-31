import React, { useCallback, useEffect, useState } from 'react';
import { useLocation, useOutletContext } from 'react-router-dom';

import NotBuiltYet from '../../components/ui/NotBuiltYet';
import FactLine from '../../components/ui/FactLine';
import { HomeError } from '../Dashboard/components/HomeCard';
import { currentYear } from '../Dashboard/setup';
import SubjectBoard from './SubjectBoard';
import TeachingQueue from './TeachingQueue';
import SubjectCatalog from './SubjectCatalog';
import TimetableTab from './TimetableTab';
import { academicsService } from '../../services/academicsService';
import { isNotBuiltYet } from '../../services/apiClient';
import { useAuth } from '../../context/AuthContext';
import { ROLES } from '../../constants/roles';
import { RowsLoading } from '../GoverningBody/bodyParts';
import { useT } from '../../i18n/LanguageContext';
import { subjectsErrorMessage } from '../../i18n/apiError';
import { SUBJECT_TABS, defaultSemesterOf, subjectsInUse } from './subjects';
import { notifyPendingChanged } from '../../hooks/usePendingCounts';

/*
  Subjects — the Principal's page (owner, 2026-09-26), backend `89d1fc1`,
  ticket 08. Four tabs:

  - **Board**: one semester, every class, who teaches what; the Principal can
    assign a teacher directly (SubjectBoard).
  - **Timetable**: one class's week, and each subject's weekly slots and
    meetings, set here (TimetableTab, backend 7cdc46d).
  - **Waiting**: teachers asking to teach a subject in a class, to approve
    (one or many) or reject with a reason (TeachingQueue).
  - **Catalog**: the national subjects and the school's local ones, where a
    local one is added (SubjectCatalog).

  What each needs is fetched once here — the years (for the board's semesters),
  the catalog (for the board's "assign" and the catalog tab) and the queue (for
  its count) — each on its own, so one failing leaves the others on screen. The
  teacher list is fetched only when "assign" is first opened.

  The teacher's side — asking to teach — is the next slice, on "My classes".
*/
export const SubjectsPage = () => {
  const { showToast } = useOutletContext();
  const { membership, activeRole } = useAuth();
  const { t } = useT();
  /* A Vice Principal never decides their own teaching (ticket 19): their own
     rows in the queue have no buttons, and they are not offered to themselves
     as the teacher to assign. The Principal is left as before. */
  const selfId = activeRole === ROLES.VICE_PRINCIPAL ? membership?.id ?? null : null;

  /* /schedule's "open the timetable" arrives with `state.tab` (owner, 2026-10-03). */
  const location = useLocation();
  const [tab, setTab] = useState(() => (SUBJECT_TABS.includes(location.state?.tab) ? location.state.tab : 'BOARD'));
  const [years, setYears] = useState(null);
  const [catalog, setCatalog] = useState(null);
  const [queue, setQueue] = useState(null);
  const [teachers, setTeachers] = useState(null);
  /* Every ACTIVE assignment, for the title's count; read again after the board changes one.
     An ended one keeps status ACTIVE with `endedAt` set, so it is left out. */
  const [assignments, setAssignments] = useState(null);
  const [errors, setErrors] = useState({});
  const [notBuilt, setNotBuilt] = useState(false);

  const fail = useCallback(
    (what) => (err) => {
      /* A backend from before 89d1fc1 answers the catch-all 404; a missing
         semester or class is a 404 too, with its own sentence. */
      if (isNotBuiltYet(err) && err?.message === 'Route not found') setNotBuilt(true);
      else setErrors((prev) => ({ ...prev, [what]: subjectsErrorMessage(err, t) }));
    },
    [t]
  );

  const loadQueue = useCallback(
    () =>
      academicsService
        .classSubjects('PENDING')
        .then((list) => {
          setQueue(list);
          setErrors((prev) => ({ ...prev, queue: null }));
        })
        .catch(fail('queue')),
    [fail]
  );

  const loadAssignments = useCallback(
    () =>
      academicsService
        .classSubjects('ACTIVE')
        .then(setAssignments)
        .catch(() => setAssignments(null)),
    []
  );

  useEffect(() => {
    academicsService.academicYears().then(setYears).catch(fail('years'));
    loadAssignments();
    academicsService.subjects().then(setCatalog).catch(fail('catalog'));
    loadQueue();
  }, [fail, loadQueue, loadAssignments]);

  const loadTeachers = () => {
    if (teachers !== null) return;
    academicsService
      .teachers()
      .then(setTeachers)
      .catch(() => setTeachers([]));
  };

  /* The slash line, as on the dashboards and Classes (owner, 2026-10-28): the school,
     the current year and semester, what is taught in it, and the subjects in use. */
  const today = new Date().toISOString().slice(0, 10);
  const year = years ? currentYear(years, today) : null;
  const semesterId = year ? defaultSemesterOf(year, today) : null;
  const semester = year?.semesters?.find((entry) => entry.id === semesterId) ?? null;
  const taught = assignments && semesterId ? assignments.filter((entry) => entry.semester?.id === semesterId && !entry.endedAt).length : null;
  const title = (
    <div className="select-none">
      <h1 className="text-3xl max-sm:text-2xl font-extrabold text-slate-900 tracking-tight leading-tight">{t('subjects.title')}</h1>
      <FactLine
        className="mt-2"
        facts={[
          membership?.school?.name ?? membership?.schoolName,
          year && (semester ? t('teacherDash.academicContext', { year: year.label, n: semester.ordinal }) : year.label),
          taught !== null && t('subjects.subtitle.taught', { n: taught }),
          catalog && t('subjects.subtitle.catalog', { n: subjectsInUse(catalog).length }),
        ]}
      />
    </div>
  );

  if (notBuilt) {
    return (
      <div className="space-y-6">
        {title}
        <NotBuiltYet />
      </div>
    );
  }

  const failed = (message) => <HomeError message={message} />;
  const loading = <RowsLoading />;

  const count = { PENDING: queue?.length ?? 0, CATALOG: catalog?.length ?? 0 };

  return (
    <div className="space-y-6">
      {title}

      {/* Text tabs with a counter, as on the dashboards (the skill's recipe); the
          waiting count stays amber while anything waits. */}
      <div role="tablist" aria-label={t('shell.subjects')} className="flex gap-0.5 select-none overflow-x-auto overflow-y-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden shadow-[inset_0_-1px_0_var(--color-slate-100)]">
        {SUBJECT_TABS.map((name) => {
          const isActive = tab === name;
          return (
            <button
              key={name}
              type="button"
              onClick={() => setTab(name)}
              role="tab"
              aria-selected={isActive}
              className={`px-2.5 py-2 text-sm font-bold border-b-2 whitespace-nowrap transition-colors cursor-pointer focus:outline-none focus-visible:text-brand ${
                isActive ? 'text-brand border-brand' : 'text-slate-500 border-transparent hover:text-slate-700'
              }`}
            >
              {t(`subjects.tab.${name}`)}
              {count[name] > 0 && (
                <span
                  className={`ml-1.5 px-1.5 rounded-full text-[11px] tabular-nums ${
                    name === 'PENDING' ? 'bg-amber-50 text-amber-700' : isActive ? 'bg-brand-tint text-brand' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {count[name]}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {tab === 'BOARD' &&
        (errors.years || errors.catalog
          ? failed(errors.years || errors.catalog)
          : years === null || catalog === null
            ? loading
            : (
              <SubjectBoard
                years={years}
                catalog={catalog}
                teachers={selfId && teachers ? teachers.filter((entry) => entry.membershipId !== selfId) : teachers}
                loadTeachers={loadTeachers}
                showToast={showToast}
                selfId={selfId}
                onChanged={loadAssignments}
              />
            ))}

      {tab === 'SCHEDULE' &&
        (errors.years
          ? failed(errors.years)
          : years === null
            ? loading
            : <TimetableTab years={years} showToast={showToast} activeRole={activeRole} />)}

      {tab === 'PENDING' && (
        <TeachingQueue
          requests={queue}
          error={errors.queue}
          onChanged={() => {
            loadQueue();
            loadAssignments();
            notifyPendingChanged();
          }}
          showToast={showToast}
          selfId={selfId}
        />
      )}

      {tab === 'CATALOG' &&
        (errors.catalog
          ? failed(errors.catalog)
          : catalog === null
            ? loading
            : (
              <SubjectCatalog
                subjects={catalog}
                showToast={showToast}
                onCreated={() => academicsService.subjects().then(setCatalog).catch(fail('catalog'))}
                onSaved={setCatalog}
              />
            ))}
    </div>
  );
};

export default SubjectsPage;
