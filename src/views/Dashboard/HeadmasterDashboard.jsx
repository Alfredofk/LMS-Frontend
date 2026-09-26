import React, { useState, useEffect } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { useT } from '../../i18n/LanguageContext';
import { api, isNotBuiltYet } from '../../services/apiClient';
import { apiErrorMessage } from '../../i18n/apiError';
import NotBuiltYet from '../../components/ui/NotBuiltYet';
import { academicsService } from '../../services/academicsService';
import { membersService } from '../../services/membersService';
import SetupChecklist from './components/SetupChecklist';
import { currentYear } from './setup';
import { ROLES } from '../../constants/roles';
import {
  Users,
  GraduationCap,
  BookOpen,
  Plus,
  Trash2,
  School,
  X,
  Megaphone,
  Library,
  ArrowRight,
} from 'lucide-react';

/*
  The Principal's dashboard. Its numbers are real since 2026-09-26 (owner):
  they used to come from `/headmaster/stats`, a route never written, and showed
  labelled sample numbers; and its "Manage classes & subjects" tab asked
  `/api/courses` and `/api/headmaster/teachers` — never written either — and
  offered to create a "course" in a way the backend has no idea of.

  Now one read of each of four things feeds both the setup checklist and the
  cards, each on its own so one failing costs only what needs it:

    years       GET /academics/academic-years   — which year is current
    classes     GET /academics/classes          — classes and students placed, this year
    members     GET /members?status=ACTIVE      — teachers and students by role
    assignments GET /academics/class-subjects?status=ACTIVE — who teaches what

  The subjects tab is a summary of the real Subjects page, with a way there;
  its two extra numbers (waiting, catalog) are read when it is first opened.
  Announcements: the backend has no module for them yet, so `GET /announcements`
  404s and the tab says so with NotBuiltYet and no Add button — rather than "no
  announcements published", and a form whose every submit would fail.
*/

const soft = (promise) => promise.catch(() => null);

export const HeadmasterDashboard = () => {
  const { showToast } = useOutletContext();
  const navigate = useNavigate();
  const { t, lang } = useT();

  // Navigation active tab: 'dashboard', 'courses' (subjects), 'announcements'.
  const [activeTab, setActiveTab] = useState('dashboard');

  /* The four reads; null until answered, and null again if one failed. */
  const [overview, setOverview] = useState(null);
  /* The subjects tab's own two numbers. */
  const [subjectsExtra, setSubjectsExtra] = useState(null);

  // Lists
  const [announcements, setAnnouncements] = useState([]);

  // Loading states
  const [isLoadingList, setIsLoadingList] = useState(false);
  const [announcementsNotBuilt, setAnnouncementsNotBuilt] = useState(false);

  // Modals Open/Close States
  const [isAnnouncementModalOpen, setIsAnnouncementModalOpen] = useState(false);

  // Modal Form Inputs
  const [announcementForm, setAnnouncementForm] = useState({ title: '', content: '' });

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      soft(academicsService.academicYears()),
      soft(academicsService.classes()),
      soft(membersService.list({ status: 'ACTIVE' })),
      soft(academicsService.classSubjects('ACTIVE')),
    ]).then(([years, classes, members, assignments]) => {
      if (!cancelled) setOverview({ years, classes, members, assignments });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  /* Once, the first time the subjects tab is opened. */
  useEffect(() => {
    if (activeTab !== 'courses' || subjectsExtra) return;
    let cancelled = false;
    Promise.all([soft(academicsService.classSubjects('PENDING')), soft(academicsService.subjects())]).then(
      ([pending, catalog]) => {
        if (!cancelled) setSubjectsExtra({ pending, catalog });
      }
    );
    return () => {
      cancelled = true;
    };
  }, [activeTab, subjectsExtra]);

  const today = new Date().toISOString().slice(0, 10);
  const year = overview?.years ? currentYear(overview.years, today) : null;
  const semesterIds = new Set((year?.semesters ?? []).map((semester) => semester.id));
  const withRole = (role) => overview?.members?.filter((member) => member.roles.includes(role)) ?? null;
  const teachers = withRole(ROLES.TEACHER);
  const students = withRole(ROLES.STUDENT);
  const classesNow = overview?.classes && year ? overview.classes.filter((entry) => entry.academicYear?.id === year.id) : null;
  const assignmentsNow = overview?.assignments
    ? overview.assignments.filter((entry) => semesterIds.has(entry.semester?.id))
    : null;

  /* The checklist reads the same four answers; teachers are the members holding TEACHER. */
  const checklistData = overview && {
    years: overview.years,
    classes: overview.classes,
    teachers,
    assignments: overview.assignments,
  };

  /* A number, or a dash when its read failed — never a zero it did not count. */
  const shown = (list) => (list ? list.length : '—');

  /*
    Announcements: still unanswered by the backend. Through `api`, not a raw
    fetch: an error envelope's `error` is an object ({ code, message }), and the
    raw path handed it to `new Error()`, so a failed save toasted
    "[object Object]". `api` throws an ApiError whose code apiErrorMessage reads.
  */
  const annErrorMessage = (err, fallbackKey) => (err?.code ? apiErrorMessage(err, t) : t(fallbackKey));

  const fetchTabData = async () => {
    setIsLoadingList(true);
    try {
      if (activeTab === 'announcements') {
        const data = await api.get('/announcements');
        setAnnouncements(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      if (isNotBuiltYet(err)) setAnnouncementsNotBuilt(true);
      else console.error(err);
    } finally {
      setIsLoadingList(false);
    }
  };

  /* Once per tab switch — the fetch reads the tab itself. */
  useEffect(() => {
    if (activeTab === 'announcements') {
      fetchTabData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // --- ANNOUNCEMENT CRUD HANDLERS ---
  const handleCreateAnnouncement = async (e) => {
    e.preventDefault();
    try {
      const data = await api.post('/announcements', announcementForm);

      if (data?.message) showToast(data.message, 'success');
      setAnnouncementForm({ title: '', content: '' });
      setIsAnnouncementModalOpen(false);
      fetchTabData();
    } catch (err) {
      showToast(annErrorMessage(err, 'principal.ann.addFailed'), 'error');
    }
  };

  const handleDeleteAnnouncement = async (id, title) => {
    if (!window.confirm(t('principal.ann.confirmDelete', { name: title }))) return;
    try {
      const data = await api.del(`/announcements/${encodeURIComponent(id)}`);

      if (data?.message) showToast(data.message, 'success');
      fetchTabData();
    } catch (err) {
      showToast(annErrorMessage(err, 'principal.ann.deleteFailed'), 'error');
    }
  };

  return (
    <div className="space-y-6 w-full text-left">
      
      {/* 1. Header welcome */}
      <div className="space-y-1 select-none">
        <span className="px-2.5 py-1 bg-purple-100 text-brand text-xs font-extrabold rounded-lg uppercase">
          {t('dash.principal.badge')}
        </span>
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight leading-tight mt-2">
          {t('dash.principal.title')}
        </h1>
        <p className="text-sm text-slate-500 font-medium">
          {t('dash.principal.subtitle')}
        </p>
      </div>

      {/* Real data, unlike the stat cards below: what the school still needs
          before it can teach anybody, in order (owner, 2026-09-26). Above the
          tabs so it is seen whichever tab is open. */}
      <SetupChecklist data={checklistData} />

      {/* The School Code sat here, then sat here smaller, and now does not sit
          here at all. It is reference data used in a burst and then left alone,
          while this screen is where the daily work happens — and My Profile is
          one click away from every signed-in screen, twice over. */}

      {/* 2. Navigation tabs row */}
      {/*
        The five tabs need 778px. A 375px phone gives this row 343px, so two of
        them sat past the right edge, and reaching them meant dragging the whole
        page sideways: <main> is overflow-y-auto, and CSS resolves the other axis
        to auto with it, so the heading and every card slid along with the tabs.
        Now only the strip moves.

        Scrolling rather than wrapping: the bar stays one line, which is what the
        active underline reads against. On desktop the row is 960px for 778px of
        tabs, so nothing overflows and nothing scrolls — measured identical after
        the change, down to each tab's x position.
      */}
      <div className="border-b border-slate-100 flex gap-6 select-none overflow-x-auto">
        {[
          { id: 'dashboard', label: t('dash.principal.tab.dashboard'), icon: School },
          { id: 'courses', label: t('dash.principal.tab.courses'), icon: BookOpen },
          { id: 'announcements', label: t('dash.principal.tab.announcements'), icon: Megaphone }
        ].map((tab) => {
          const TabIcon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`pb-3 text-sm font-extrabold transition-all flex items-center gap-2 border-b-2 focus:outline-none cursor-pointer shrink-0 whitespace-nowrap
                ${isActive 
                  ? 'border-brand text-brand' 
                  : 'border-transparent text-slate-500 hover:text-slate-600'
                }
              `}
            >
              <TabIcon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* 3. Render content based on active tab */}
      <div className="pt-2">

        {/* Tab 1: Dashboard overview — every number counted, for the current year. */}
        {activeTab === 'dashboard' && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 select-none">
            {[
              { label: t('dash.principal.stat.teachers'), value: shown(teachers), to: '/headmaster/members', Icon: Users, tint: 'bg-purple-50 text-brand' },
              { label: t('dash.principal.stat.students'), value: shown(students), to: '/headmaster/members', Icon: GraduationCap, tint: 'bg-emerald-50 text-emerald-600' },
              {
                label: year ? t('dash.principal.stat.classesIn', { label: year.label }) : t('dash.principal.stat.classes'),
                value: shown(classesNow),
                to: '/headmaster/classes',
                Icon: School,
                tint: 'bg-blue-50 text-blue-600',
              },
            ].map(({ label, value, to, Icon: icon, tint }) => {
              const StatIcon = icon;
              return (
              <button
                key={to + label}
                type="button"
                onClick={() => navigate(to)}
                className="text-left bg-white border border-slate-100 rounded-2xl p-6 shadow-sm hover:shadow-md hover:border-slate-200 transition-all cursor-pointer flex items-center justify-between gap-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              >
                <span className="min-w-0">
                  <span className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">{label}</span>
                  <span className="block text-3xl font-extrabold text-slate-800 mt-1 tabular-nums">
                    {overview ? value : <span className="inline-block w-10 h-8 bg-slate-100 rounded-lg animate-pulse align-middle" aria-label={t('common.loading')} />}
                  </span>
                </span>
                <span className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${tint}`}>
                  <StatIcon className="w-6 h-6" aria-hidden="true" />
                </span>
              </button>
              );
            })}
          </div>
        )}

        {/* Tab 2: Subjects — a summary of the real page (ticket 08), not a second copy of it. */}
        {activeTab === 'courses' && (
          <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm space-y-5">
            <div className="flex items-start gap-3">
              <span className="w-10 h-10 rounded-xl bg-brand-tint text-brand flex items-center justify-center shrink-0">
                <Library className="w-5 h-5" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <h2 className="text-sm font-extrabold text-slate-900">{t('dash.principal.subjects.title')}</h2>
                <p className="text-xs font-semibold text-slate-500 leading-relaxed mt-0.5">
                  {year ? t('dash.principal.subjects.body', { label: year.label }) : t('dash.principal.subjects.noYear')}
                </p>
              </div>
            </div>
            <dl className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { term: t('dash.principal.subjects.active'), value: overview ? shown(assignmentsNow) : null },
                { term: t('dash.principal.subjects.pending'), value: subjectsExtra ? shown(subjectsExtra.pending) : null },
                {
                  term: t('dash.principal.subjects.catalog'),
                  value: subjectsExtra
                    ? subjectsExtra.catalog
                      ? t('dash.principal.subjects.catalogValue', {
                          n: subjectsExtra.catalog.length,
                          local: subjectsExtra.catalog.filter((subject) => !subject.national).length,
                        })
                      : '—'
                    : null,
                },
              ].map(({ term, value }) => (
                <div key={term} className="rounded-xl border border-slate-100 px-4 py-3">
                  <dt className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">{term}</dt>
                  <dd className="text-xl font-extrabold text-slate-800 mt-1 tabular-nums">
                    {value ?? <span className="inline-block w-10 h-6 bg-slate-100 rounded-lg animate-pulse align-middle" aria-label={t('common.loading')} />}
                  </dd>
                </div>
              ))}
            </dl>
            <button
              type="button"
              onClick={() => navigate('/headmaster/subjects')}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand hover:bg-brand-deep text-white text-xs font-extrabold transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
            >
              {t('dash.principal.subjects.open')}
              <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </div>
        )}
        {/* Tab 5: Manage Announcements */}
        {activeTab === 'announcements' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center select-none">
              <h3 className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">{t('principal.ann.title')}</h3>
              {!announcementsNotBuilt && (
              <button
                onClick={() => setIsAnnouncementModalOpen(true)}
                className="px-4 py-2 bg-brand hover:bg-brand-deep text-white text-xs font-extrabold rounded-xl transition-colors cursor-pointer flex items-center gap-1.5 shadow-sm"
              >
                <Plus className="w-4 h-4" />
                {t('principal.ann.add')}
              </button>
              )}
            </div>

            {isLoadingList ? (
              <div className="h-40 bg-white border border-slate-100 rounded-2xl animate-pulse"></div>
            ) : announcementsNotBuilt ? (
              <NotBuiltYet />
            ) : (
              <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm overflow-x-auto">
                {announcements.length === 0 ? (
                  <p className="text-xs text-slate-500 font-bold italic py-4 text-center">{t('principal.ann.empty')}</p>
                ) : (
                  <table className="w-full min-w-max text-xs font-medium text-slate-600">
                    <thead>
                      <tr className="border-b border-slate-100 text-slate-500 font-extrabold text-left">
                        <th className="pb-3 font-extrabold text-[10px] uppercase">{t('principal.ann.th.title')}</th>
                        <th className="pb-3 font-extrabold text-[10px] uppercase">{t('principal.ann.th.content')}</th>
                        <th className="pb-3 font-extrabold text-[10px] uppercase">{t('principal.ann.th.author')}</th>
                        <th className="pb-3 font-extrabold text-[10px] uppercase">{t('principal.ann.th.date')}</th>
                        <th className="pb-3 text-right font-extrabold text-[10px] uppercase">{t('principal.th.action')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {announcements.map((row) => (
                        <tr key={row.id} className="hover:bg-slate-50/20 transition-colors">
                          <td className="py-3.5 font-extrabold text-slate-900 pr-4">{row.title}</td>
                          <td className="py-3.5 text-slate-500 font-semibold max-w-sm truncate pr-4">{row.content}</td>
                          <td className="py-3.5 text-slate-500 font-bold">{row.author_name || t('principal.ann.defaultAuthor')}</td>
                          <td className="py-3.5 text-slate-500 font-bold">
                            {new Date(row.created_at).toLocaleDateString(lang === 'en' ? 'en-GB' : 'id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </td>
                          <td className="py-3.5 text-right">
                            <button
                              onClick={() => handleDeleteAnnouncement(row.id, row.title)}
                              className="p-1.5 hover:bg-red-50 text-slate-500 hover:text-red-600 rounded-lg transition-colors cursor-pointer"
                              title={t('principal.ann.delete')}
                            >
                              <Trash2 className="w-4.5 h-4.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>
        )}

      </div>

      {/* --- ANNOUNCEMENT CREATION MODAL DIALOG --- */}
      {isAnnouncementModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={handleCreateAnnouncement} className="bg-white rounded-3xl max-w-md w-full shadow-2xl overflow-hidden border border-slate-100">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center select-none">
              <h3 className="text-sm font-extrabold text-slate-900">{t('principal.modal.ann.title')}</h3>
              <button type="button" onClick={() => setIsAnnouncementModalOpen(false)} className="p-1 hover:bg-slate-50 text-slate-500 hover:text-slate-900 rounded-lg cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-4 text-left">
              <div className="space-y-1">
                <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">{t('principal.modal.ann.heading')}</label>
                <input
                  type="text"
                  required
                  placeholder={t('principal.modal.ann.heading.hint')}
                  value={announcementForm.title}
                  onChange={(e) => setAnnouncementForm(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full text-xs font-semibold border border-slate-200 rounded-xl p-3 focus:outline-none focus:border-brand transition-colors"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">{t('principal.modal.ann.body')}</label>
                <textarea
                  required
                  rows="5"
                  placeholder={t('principal.modal.ann.body.hint')}
                  value={announcementForm.content}
                  onChange={(e) => setAnnouncementForm(prev => ({ ...prev, content: e.target.value }))}
                  className="w-full text-xs font-semibold border border-slate-200 rounded-xl p-3 focus:outline-none focus:border-brand transition-colors resize-none"
                />
              </div>
            </div>

            <div className="p-6 border-t border-slate-100 flex justify-end gap-2 select-none">
              <button type="button" onClick={() => setIsAnnouncementModalOpen(false)} className="px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-50 rounded-lg cursor-pointer">{t('principal.common.cancel')}</button>
              <button type="submit" className="px-5 py-2 bg-brand hover:bg-brand-deep text-white text-xs font-extrabold rounded-xl cursor-pointer">{t('principal.modal.ann.submit')}</button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
};

export default HeadmasterDashboard;
