import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, CalendarCheck, ListTodo, Star, FileText } from 'lucide-react';

import { useAuth } from '../../context/AuthContext';
import { useT } from '../../i18n/LanguageContext';
import StatCard from './components/StatCard';
import NextHolidayCard from '../../components/holidays/NextHolidayCard';
import { attendanceService } from '../../services/attendanceService';
import { attendanceStat } from '../Attendance/attendance';
import TodaySessionsCard from '../Attendance/TodaySessionsCard';
import {
  ActiveAssessment,
  CourseProgress,
  SchoolAnnouncement,
} from './components/Widgets';

/*
  A student's home screen: the full layout, with nothing invented in it.

  Every card is here — four stat cards, today's activities, active assignments,
  subject progress, announcements — so the screen shows what it is for. None of
  them has a source yet: there is no model for a lesson, an assignment, a grade,
  a material or an announcement in the schema, and no route a student can read
  their own class from. So the stat cards read "—" and every widget renders its
  `notBuilt` state, the same "not available yet" the pages behind them show.

  It used to fill those cards with sample data under a banner. That stopped
  making sense once the pages one click away began saying "not available yet":
  the dashboard claimed three active assignments the Assessment page said did
  not exist.

  When an endpoint lands, feed its widget the payload and drop `notBuilt` from
  it — the widgets are presentational and take their data as props.

  Real on screen: the person's name and their school (`/users/me` through
  AuthContext), the next day off, today's meetings with the check-in button
  (`TodaySessionsCard`, `GET /sessions/mine`, backend 87f2670 — owner,
  2026-10-03; it took the place of "today's activities" and sits first since), and — first of the stat cards — their attendance
  rate (`GET /attendance/me`, backend deb95e8; owner, 2026-10-02), counted over
  confirmed meetings as on /attendance, where the card leads. No record yet, or a
  failed read, reads "—" with a line saying which — never a 0 nobody counted.

  Only one state is worth rendering. A member still waiting on approval never
  arrives here — `activeRolesOf` returns no roles for a membership that is not
  ACTIVE (constants/roles.js), and ProtectedRoute sends anybody with no usable
  role to /select-role.
*/

/*
  Indonesian divides the day four ways and English three, so a greeting is one
  whole sentence per key rather than a word slotted into a template. The two
  English afternoons are the same sentence on purpose.
*/
const greetingKeyFor = (hour) => {
  if (hour >= 5 && hour < 12) return 'dash.greeting.morning';
  if (hour >= 12 && hour < 15) return 'dash.greeting.midday';
  if (hour >= 15 && hour < 19) return 'dash.greeting.afternoon';
  return 'dash.greeting.evening';
};

const STATS = [
  { key: 'dash.stat.subjects', icon: BookOpen, iconBg: 'bg-brand-tint text-brand' },
  { key: 'dash.stat.todo', icon: ListTodo, iconBg: 'bg-amber-50 text-amber-500' },
  { key: 'dash.stat.avgScore', icon: Star, iconBg: 'bg-emerald-50 text-emerald-600' },
  { key: 'dash.stat.newMaterials', icon: FileText, iconBg: 'bg-rose-50 text-rose-500' },
];

export const StudentDashboard = () => {
  const { user, membership } = useAuth();
  const { t, lang } = useT();
  const navigate = useNavigate();

  /* undefined → reading; an array → read; null with `failed` → the read failed. */
  const [rows, setRows] = useState(undefined);
  const [failed, setFailed] = useState(false);
  /* Bumped by a check-in, so the rate card counts the new record. */
  const [recorded, setRecorded] = useState(0);
  useEffect(() => {
    let cancelled = false;
    attendanceService
      .mine()
      .then((list) => {
        if (cancelled) return;
        setRows(list);
        setFailed(false);
      })
      .catch(() => {
        if (cancelled) return;
        setRows(null);
        setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [recorded]);
  const attendance = attendanceStat(rows, failed);

  const name = user?.fullName || t('dash.greeting.fallback');
  const schoolName = membership?.school?.name ?? membership?.schoolName ?? '';

  const today = new Date().toLocaleDateString(lang === 'id' ? 'id-ID' : 'en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="space-y-6">
      <div className="select-none text-left">
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight leading-tight">
          {t(greetingKeyFor(new Date().getHours()), { name })}
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 font-bold mt-1">
          {schoolName ? `${schoolName} · ` : ''}
          {today}
        </p>
      </div>

      {/* First under the greeting (owner, 2026-10-03): check-in is the one thing here
          bound to the clock, and on a phone it sat below six cards, four of them
          "not available yet". It shows one meeting — on now, else next — and a day
          with none, or already over, folds to one line. */}
      <TodaySessionsCard focus onCheckedIn={() => setRecorded((n) => n + 1)} />

      {/* Real data, and so unmarked: the school's next day off (owner, 2026-09-29). */}
      <NextHolidayCard showLink />

      {/* The attendance card leads to /attendance; the other four have no onClick:
          an inert card, not a button that leads nowhere. Five cards leave a hole in
          two or three columns, so the one with real data spans: the full row in two
          columns, two of three in three — no hole at any width (owner, 2026-10-03). */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-5">
        <StatCard
          title={t('dash.stat.attendance')}
          value={attendance.value}
          subtext={attendance.lines.map((line) => t(line.key, line.vars)).join(' · ')}
          icon={CalendarCheck}
          iconBg="bg-brand-tint text-brand"
          onClick={() => navigate('/attendance')}
          className="sm:col-span-2 xl:col-span-1"
        />
        {STATS.map((stat) => (
          <StatCard
            key={stat.key}
            title={t(stat.key)}
            value="—"
            subtext={t('common.notBuilt.title')}
            icon={stat.icon}
            iconBg={stat.iconBg}
          />
        ))}
      </div>

      {/* Three cards since today's meetings moved to the top (owner, 2026-10-03): one
          row of three on a wide screen; two and a full-width third in between, so no
          row ends in a hole. The wrapper is a grid so the card still fills its height. */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        <ActiveAssessment notBuilt />
        <CourseProgress notBuilt />
        <div className="grid lg:col-span-2 xl:col-span-1">
          <SchoolAnnouncement notBuilt />
        </div>
      </div>
    </div>
  );
};

export default StudentDashboard;
