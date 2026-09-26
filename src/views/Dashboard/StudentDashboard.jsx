import React from 'react';
import { BookOpen, ListTodo, Star, FileText } from 'lucide-react';

import { useAuth } from '../../context/AuthContext';
import { useT } from '../../i18n/LanguageContext';
import StatCard from './components/StatCard';
import {
  TodayActivities,
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

  Two things on screen are real: the person's name and their school, both from
  `/users/me` through AuthContext.

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

      {/* No onClick: an inert card, not a button that leads nowhere. */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TodayActivities notBuilt />
        <ActiveAssessment notBuilt />
        <CourseProgress notBuilt />
        <SchoolAnnouncement notBuilt />
      </div>
    </div>
  );
};

export default StudentDashboard;
