import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Check, CheckCheck, ChevronRight, GraduationCap, LogOut, MonitorPlay, School, UserPlus, Users } from 'lucide-react';

import { useT } from '../../i18n/LanguageContext';
import { academicsService } from '../../services/academicsService';
import { membersService } from '../../services/membersService';
import SetupChecklist from './components/SetupChecklist';
import StatCard from './components/StatCard';
import AwaitingConfirmationCard from './components/AwaitingConfirmationCard';
import MarkingByTeacherCard from './components/MarkingByTeacherCard';
import SchoolOverviewCard from './components/SchoolOverviewCard';
import { Bone, HomeCard, HomeEmpty } from './components/HomeCard';
import { currentYear, setupSteps } from './setup';
import { defaultSemesterOf } from '../Subjects/subjects';
import { ROLES } from '../../constants/roles';
import { useAuth } from '../../context/AuthContext';
import { usePendingCounts } from '../../hooks/usePendingCounts';

/*
  The Principal's dashboard. Its numbers are real since 2026-09-26 (owner):
  they used to come from `/headmaster/stats`, a route never written, and showed
  labelled sample numbers.

  One read of each of six things, each on its own so one failing costs only what
  needs it:

    years       GET /academics/academic-years   - which year is current
    classes     GET /academics/classes          - classes and students placed, this year
    members     GET /members?status=ACTIVE      - teachers and students by role
    assignments GET /academics/class-subjects?status=ACTIVE  - who teaches what
    waiting     GET /academics/class-subjects?status=PENDING - teaching asked, not decided
    catalog     GET /academics/subjects         - the subjects in use

  `desk="vice"` is the Vice Principal's home, /vice/dashboard (owner,
  2026-09-29): every read above is open to them (backend `89a5666`), so only
  the words change, the announcements card is left out, and the checklist offers
  no button for the two steps that are the Principal's hands; of what waits, a
  Vice Principal decides teaching requests only.

  One page since 2026-10-27 (owner approved the Principal mockup; the skill
  `.claude/skills/eduforid-design`): the tabs Ringkasan / Mata Pelajaran /
  Pengumuman went. Four stat cards (a fourth, "Mapel diajar"); "Perlu tindakan"
  beside "Persiapan sekolah"; "Pertemuan menunggu guru" beside the subjects card;
  and a small "Pengumuman" card saying it is not available yet - the backend has
  no module for announcements, and the old tab's list, form and delete were built
  on a guessed contract (`author_name`, `created_at`), so they went with it.

  Since 2026-10-31 (owner, mockup dasbor-ringkasan.html items 1-5): the Kelas card
  says whether every class has a homeroom teacher, not the year again; with
  nothing waiting and every setup step done, "Perlu tindakan" and "Persiapan
  sekolah" are one short "Semua beres" card; the subjects card went (its numbers
  are on the "Mapel diajar" card and in "Perlu tindakan"), so "Pertemuan menunggu
  guru" sits beside "Penilaian per guru".
*/

/* The same four-way split of the day as the student's and teacher's dashboards. */
const greetingKeyFor = (hour) => {
  if (hour >= 5 && hour < 12) return 'dash.greeting.morning';
  if (hour >= 12 && hour < 15) return 'dash.greeting.midday';
  if (hour >= 15 && hour < 19) return 'dash.greeting.afternoon';
  return 'dash.greeting.evening';
};

const soft = (promise) => promise.catch(() => null);

/* Each row of "Perlu tindakan": its icon and its colour while something waits. */
const NEED_TONE = {
  join: { icon: UserPlus, tone: 'bg-amber-50 text-amber-700' },
  leave: { icon: LogOut, tone: 'bg-amber-50 text-amber-700' },
  teaching: { icon: MonitorPlay, tone: 'bg-brand-tint text-brand' },
};

export const HeadmasterDashboard = ({ desk = 'principal' }) => {
  const isVice = desk === 'vice';
  const navigate = useNavigate();
  const { t, lang } = useT();
  const { user, membership, activeRole } = useAuth();
  const pending = usePendingCounts(activeRole);

  /* The six reads; null until answered, and each null again if it failed. */
  const [overview, setOverview] = useState(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      soft(academicsService.academicYears()),
      soft(academicsService.classes()),
      soft(membersService.list({ status: 'ACTIVE' })),
      soft(academicsService.classSubjects('ACTIVE')),
      soft(academicsService.classSubjects('PENDING')),
      soft(academicsService.subjects()),
    ]).then(([years, classes, members, assignments, waiting, catalog]) => {
      if (!cancelled) setOverview({ years, classes, members, assignments, waiting, catalog });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const year = overview?.years ? currentYear(overview.years, today) : null;
  const semesterId = year ? defaultSemesterOf(year, today) : null;
  const semester = year?.semesters?.find((entry) => entry.id === semesterId) ?? null;
  const schoolName = membership?.school?.name ?? membership?.schoolName ?? '';
  const todayLabel = now.toLocaleDateString(lang === 'en' ? 'en-GB' : 'id-ID', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
  const yearLine = year ? (semester ? t('teacherDash.academicContext', { year: year.label, n: semester.ordinal }) : year.label) : null;
  const semesterIds = new Set((year?.semesters ?? []).map((entry) => entry.id));
  const withRole = (role) => overview?.members?.filter((member) => member.roles.includes(role)) ?? null;
  const teachers = withRole(ROLES.TEACHER);
  const students = withRole(ROLES.STUDENT);
  const classesNow = overview?.classes && year ? overview.classes.filter((entry) => entry.academicYear?.id === year.id) : null;
  /* The cards' second lines: homeroom teachers and students placed, this year. */
  const homerooms = classesNow ? new Set(classesNow.map((entry) => entry.homeroomTeacher?.membershipId).filter(Boolean)).size : null;
  const withoutHomeroom = classesNow ? classesNow.filter((entry) => !entry.homeroomTeacher).length : null;
  const placed = classesNow ? classesNow.reduce((sum, entry) => sum + (entry.studentCount ?? 0), 0) : null;
  /* An ended assignment keeps status ACTIVE with `endedAt` set (a replaced teacher's row): not taught now. */
  const assignmentsNow = overview?.assignments ? overview.assignments.filter((entry) => semesterIds.has(entry.semester?.id) && !entry.endedAt) : null;

  /* undefined while reading, null when the read failed (usePendingCounts). A Vice
     Principal decides teaching requests only. */
  const needs = [
    !isVice && { key: 'join', n: pending.joinRequests, to: '/join-requests' },
    !isVice && { key: 'leave', n: pending.leaveRequests, to: '/headmaster/members', tab: 'LEAVE' },
    { key: 'teaching', n: pending.teachingRequests, to: '/headmaster/subjects', tab: 'PENDING' },
  ].filter(Boolean);

  /* The checklist reads the same answers; teachers are the members holding TEACHER. */
  const checklistData = overview && {
    years: overview.years,
    classes: overview.classes,
    teachers,
    assignments: overview.assignments,
  };

  /* Everything settled: nothing waits (each count read and 0) and every setup step is done. */
  const setup = checklistData && !Object.values(checklistData).every((value) => value === null) ? setupSteps({ ...checklistData, today }) : null;
  const allClear = needs.every((item) => item.n === 0) && Boolean(setup) && setup.total > 0 && setup.done === setup.total;

  /* A number, or a dash when its read failed - never a zero it did not count. */
  const count = (list) => (overview ? (list ? String(list.length) : '-') : '…');
  const facts = [schoolName, yearLine, todayLabel].filter(Boolean);

  return (
    <div className="space-y-6 w-full text-left">
      <header className="select-none">
        <h1 className="text-3xl max-sm:text-2xl font-extrabold text-slate-900 tracking-tight leading-tight">
          {t(greetingKeyFor(now.getHours()), { name: user?.fullName || t(isVice ? 'dash.vice.fallback' : 'dash.principal.fallback') })}
        </h1>
        <p className="mt-2 text-sm font-medium text-slate-500">
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
              <span className="whitespace-nowrap">{fact}</span>
            </React.Fragment>
          ))}
        </p>
      </header>

      {/* Each card opens where it is counted (owner, 2026-10-03: Members on the matching tab). */}
      <section aria-label={t('teacherDash.stats.label')} className="grid grid-cols-2 gap-5 max-sm:gap-3 lg:grid-cols-4">
        <StatCard
          title={t('dash.principal.stat.teachers')}
          value={count(teachers)}
          subtext={homerooms !== null ? t('dash.principal.stat.teachers.note', { n: homerooms }) : ''}
          icon={Users}
          onClick={() => navigate('/headmaster/members', { state: { tab: 'TEACHER' } })}
        />
        <StatCard
          title={t('dash.principal.stat.students')}
          value={count(students)}
          subtext={placed !== null ? t('dash.principal.stat.students.note', { n: placed }) : ''}
          icon={GraduationCap}
          onClick={() => navigate('/headmaster/members', { state: { tab: 'STUDENT' } })}
        />
        <StatCard
          title={t('dash.principal.stat.classes')}
          value={count(classesNow)}
          subtext={
            withoutHomeroom === null || !classesNow.length ? (
              ''
            ) : withoutHomeroom > 0 ? (
              <span className="font-bold text-amber-700">{t('dash.principal.stat.classes.noHomeroom', { n: withoutHomeroom })}</span>
            ) : (
              t('dash.principal.stat.classes.allHomeroom')
            )
          }
          icon={School}
          onClick={() => navigate('/headmaster/classes')}
        />
        <StatCard
          title={t('dash.principal.stat.subjects')}
          value={count(assignmentsNow)}
          subtext={overview?.waiting ? t('dash.principal.stat.subjects.note', { n: overview.waiting.length }) : ''}
          icon={BookOpen}
          onClick={() => navigate('/headmaster/subjects')}
        />
      </section>

      {/* The School's numbers from the nightly rollup (backend 1a1eed7; owner, 2026-10-28). */}
      <SchoolOverviewCard />

      {allClear ? (
        <HomeCard id="all-clear-title" title={t('dash.principal.allClear.title')}>
          <div className="-mt-1.5 divide-y divide-slate-100">
            <div className="flex items-start gap-3 py-2.5">
              <span className="grid place-items-center w-[22px] h-[22px] rounded-full bg-emerald-50 text-emerald-700 shrink-0" aria-hidden="true">
                <Check className="w-3 h-3" strokeWidth={3} />
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-[13.5px] font-semibold text-slate-700">{t('dash.principal.needs.none')}</span>
                <span className="block text-xs text-slate-500">{t(isVice ? 'dash.principal.needs.noneBodyVice' : 'dash.principal.needs.noneBody')}</span>
              </span>
            </div>
            <SetupChecklist data={checklistData} desk={desk} asLine />
          </div>
        </HomeCard>
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <HomeCard id="needs-action-title" title={t('dash.principal.needs.title')}>
            {needs.every((item) => item.n === 0) ? (
              <HomeEmpty icon={CheckCheck} title={t('dash.principal.needs.none')} body={t(isVice ? 'dash.principal.needs.noneBodyVice' : 'dash.principal.needs.noneBody')} />
            ) : (
              <ul className="divide-y divide-slate-100">
                {needs.map(({ key, n, to, tab }) => {
                  const { icon: Icon, tone } = NEED_TONE[key];
                  const waits = Number(n) > 0;
                  return (
                    <li key={key}>
                      <button
                        type="button"
                        onClick={() => navigate(to, tab ? { state: { tab } } : undefined)}
                        className="group w-full flex items-center gap-3.5 px-2 py-3 text-left rounded-xl hover:bg-slate-50 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                      >
                        <span className={`grid place-items-center w-9 h-9 rounded-full shrink-0 ${waits ? tone : 'bg-slate-100 text-slate-500'}`}>
                          <Icon className="w-4 h-4" aria-hidden="true" />
                        </span>
                        <span className="flex-1 min-w-0">
                          <span className="block text-sm font-bold text-slate-900">{t(`dash.principal.needs.${key}`)}</span>
                          <span className="block text-xs text-slate-500">{t(`dash.principal.needs.${key}.hint`)}</span>
                        </span>
                        {n === undefined ? (
                          <Bone className="w-7 h-5 rounded-full" />
                        ) : (
                          <span
                            className={`min-w-[26px] px-2 py-0.5 rounded-full text-xs text-center tabular-nums ${
                              waits ? `${tone} font-extrabold` : 'text-slate-300 font-semibold'
                            }`}
                          >
                            {n === null ? '-' : n || '-'}
                          </span>
                        )}
                        <ChevronRight className="w-4 h-4 shrink-0 text-slate-400 transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden="true" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </HomeCard>

          {/* What the school still needs before it can teach anybody, in order (owner, 2026-09-26). */}
          <SetupChecklist data={checklistData} desk={desk} />
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Meetings waiting for their teacher's answer (backend 7cdc46d). */}
        <AwaitingConfirmationCard />

        {/* Each teacher's marking and release totals (backend 0eefba2; owner, 2026-10-28). */}
        <MarkingByTeacherCard />
      </div>

      {!isVice && (
        <section aria-labelledby="ann-title" className="bg-white border border-slate-100 rounded-2xl p-6 max-sm:p-[18px] shadow-sm">
          <div className="flex flex-wrap items-baseline justify-between gap-2 mb-2">
            <h2 id="ann-title" className="text-base font-extrabold text-slate-900 tracking-tight">
              {t('dash.principal.ann.title')}
            </h2>
            <span className="px-2 py-0.5 rounded-full bg-slate-100 text-[11px] font-semibold text-slate-600">{t('common.notBuilt.title')}</span>
          </div>
          <p className="text-[13px] text-slate-500">{t('dash.principal.ann.soon')}</p>
        </section>
      )}
    </div>
  );
};

export default HeadmasterDashboard;
