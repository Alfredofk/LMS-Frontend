import React, { useState, useEffect, useMemo } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useT } from '../../i18n/LanguageContext';
import { apiErrorMessage } from '../../i18n/apiError';
import { isNotBuiltYet } from '../../services/apiClient';
import { coursesService } from '../../services/coursesService';
import { teacherService } from '../../services/teacherService';
import { buildSampleTeacherData } from './sampleTeacherData';
import { SampleDataBanner } from './components/SampleDataNotice';
import { 
  Users, 
  UserCheck, 
  AlertCircle, 
  BookOpen, 
  Calendar, 
  ArrowRight, 
  Clock,
  ChevronRight
} from 'lucide-react';
import Button from '../../components/ui/Button';

export const TeacherDashboard = () => {
  const { user, membership } = useAuth();
  const { showToast } = useOutletContext();
  const { t, lang } = useT();
  const navigate = useNavigate();

  const [dashboardData, setDashboardData] = useState(null);
  const [isSample, setIsSample] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  /*
    Three endpoints, none of which exists yet.

    `allSettled` rather than `all`, because *which* call failed is the whole
    question here. A 404 means the route has not been written — the backend
    mounts four namespaces and this screen calls three others — and that is not
    a fault anybody can act on. A 500 or a dead network is.

    So: every failure a 404 → sample data, labelled as such on screen. Anything
    else → the error panel, which is what it is for. This screen used to show
    that panel unconditionally, announcing "Terjadi Kesalahan" for a feature
    nobody had built yet.

    The day the routes land, the first branch stops being taken and the real
    numbers appear. Nothing here has to be undone.
  */
  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      setIsLoading(true);
      setError(null);

      const results = await Promise.allSettled([
        coursesService.list(),
        teacherService.stats(),
        teacherService.recentSubmissions(),
      ]);

      if (!isMounted) return;

      const failures = results.filter((r) => r.status === 'rejected').map((r) => r.reason);

      if (failures.length > 0) {
        const real = failures.find((err) => !isNotBuiltYet(err));
        if (real) {
          setError(apiErrorMessage(real, t, { NOT_FOUND: 'dash.teacher.loadFailed' }));
        } else {
          setIsSample(true);
        }
        setIsLoading(false);
        return;
      }

      const [courses, stats, submissions] = results.map((r) => r.value);

      setDashboardData({
        stats: {
          totalClasses: stats.totalClasses,
          totalStudents: stats.totalStudents,
          pendingGrading: stats.pendingGrading,
        },
        /* `schedule` is deliberately absent: no model records when a class
           meets, so the row that shows it stays hidden for real data rather
           than being filled with an invented time, which is what this file
           used to do to every class the server sent. */
        classes: courses.map((cls, index) => ({
          id: cls.id ?? `class-${index}`,
          name: cls.name,
          grade: cls.grade_level ?? null,
          studentsCount: Number.parseInt(cls.student_count, 10) || 0,
        })),
        recentSubmissions: submissions,
      });
      setIsLoading(false);
    };

    load();
    return () => {
      isMounted = false;
    };
  }, [t]);

  /* Built at render, not in the effect, so switching language re-phrases the
     relative times without re-requesting three endpoints. */
  const data = useMemo(
    () => (isSample ? buildSampleTeacherData(new Date(), t) : dashboardData),
    [isSample, dashboardData, t]
  );

  const schoolName = membership?.school?.name ?? null;

  const handleManageClass = (classId, className, grade) => {
    navigate(`/teacher/courses/${classId}`);
  };

  const handleGradeTask = (studentName, taskTitle) => {
    if (showToast) {
      showToast(t('dash.teacher.grading', { name: studentName, title: taskTitle }), 'success');
    }
  };

  /*
    Indonesian splits the day four ways where English splits it three, so the
    boundaries stay as they are and the two dictionaries decide what to call
    each slice — `dash.time.noon` and `dash.time.afternoon` both read
    "afternoon" in English, which is correct rather than lazy.
  */
  const greetingPart = () => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return t('dash.time.morning');
    if (hour >= 12 && hour < 15) return t('dash.time.noon');
    if (hour >= 15 && hour < 19) return t('dash.time.afternoon');
    return t('dash.time.evening');
  };

  const formattedDate = new Date().toLocaleDateString(
    lang === 'en' ? 'en-GB' : 'id-ID',
    { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }
  );

  // ==========================================
  // CONDITIONAL RENDERING: Loading Skeleton
  // ==========================================
  if (isLoading) {
    return (
      <div className="space-y-6 text-left animate-pulse">
        {/* Banner Skeleton */}
        <div className="space-y-2 select-none">
          <div className="h-8 bg-slate-200 rounded-lg w-2/3 md:w-1/3"></div>
          <div className="h-4 bg-slate-200 rounded-lg w-1/2 md:w-1/4"></div>
        </div>

        {/* 3 Stats cards skeleton row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {[1, 2, 3].map((idx) => (
            <div key={idx} className="bg-white border border-slate-100 rounded-2xl p-6 h-28 flex items-center justify-between shadow-sm">
              <div className="space-y-2.5 w-1/2">
                <div className="h-3 bg-slate-200 rounded w-3/4"></div>
                <div className="h-6 bg-slate-200 rounded w-1/2"></div>
              </div>
              <div className="w-12 h-12 rounded-xl bg-slate-200 shrink-0"></div>
            </div>
          ))}
        </div>

        {/* Two columns grid layout skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Main content grid classes */}
          <div className="lg:col-span-8 space-y-4">
            <div className="h-5 bg-slate-200 rounded w-1/4 mb-2"></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {[1, 2, 3, 4].map((idx) => (
                <div key={idx} className="bg-white border border-slate-100 rounded-2xl p-5 h-44 shadow-sm flex flex-col justify-between">
                  <div className="space-y-2">
                    <div className="h-4 bg-slate-200 rounded w-3/4"></div>
                    <div className="h-3.5 bg-slate-200 rounded w-1/2"></div>
                  </div>
                  <div className="h-9 bg-slate-200 rounded-xl w-full"></div>
                </div>
              ))}
            </div>
          </div>

          {/* Sidebar recent activity skeleton */}
          <div className="lg:col-span-4 bg-white border border-slate-100 rounded-2xl p-6 h-96 shadow-sm space-y-5">
            <div className="h-5 bg-slate-200 rounded w-1/2 pb-2"></div>
            <div className="space-y-4 pt-2">
              {[1, 2, 3].map((idx) => (
                <div key={idx} className="flex gap-3 items-start">
                  <div className="w-8 h-8 rounded-full bg-slate-200 shrink-0"></div>
                  <div className="space-y-2 w-full">
                    <div className="h-3.5 bg-slate-200 rounded w-3/4"></div>
                    <div className="h-3.5 bg-slate-200 rounded w-5/6"></div>
                    <div className="h-3 bg-slate-200 rounded w-1/3"></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    );
  }

  // ==========================================
  // CONDITIONAL RENDERING: Error State
  // ==========================================
  if (error) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-2xl flex items-center gap-3 text-red-700 text-sm font-semibold select-none text-left">
        <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
        <div>
          <p className="font-bold">{t('dash.error.title')}</p>
          <p className="text-xs text-red-600 font-medium mt-0.5">{error}</p>
        </div>
      </div>
    );
  }

  // ==========================================
  // CONDITIONAL RENDERING: Success Layout
  // ==========================================
  return (
    <div className="space-y-6 text-left">
      
      {/* 1. Header (Greeting and the calendar day) */}
      <div className="select-none text-left">
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight leading-tight">
          {t('dash.teacher.greeting', {
            part: greetingPart(),
            name: user?.fullName || t('dash.teacher.fallbackName'),
          })}
        </h1>
        {/* The school comes from the membership. `user.school` does not exist —
            the account object carries id, email, fullName and nothing more — so
            the old fallback "SMA Patroli Jaya" was shown to everybody, always. */}
        <p className="text-xs sm:text-sm text-slate-900 font-extrabold mt-1">
          {schoolName ? `${schoolName} · ` : ''}
          {formattedDate}
        </p>
      </div>

      {isSample && <SampleDataBanner />}

      {/* 2. Three Stats Cards Jajaran */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 select-none">
        
        {/* Total Kelas Card */}
        <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm flex items-center justify-between hover:shadow-md transition-shadow duration-200">
          <div className="space-y-1">
            <span className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">{t('dash.teacher.stat.classes')}</span>
            <h3 className="text-3xl font-extrabold text-slate-800">{data.stats.totalClasses}</h3>
          </div>
          <div className="w-12 h-12 rounded-xl bg-purple-50 text-brand flex items-center justify-center shrink-0">
            <Users className="w-5 h-5" />
          </div>
        </div>

        {/* Total Siswa Card */}
        <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm flex items-center justify-between hover:shadow-md transition-shadow duration-200">
          <div className="space-y-1">
            <span className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">{t('dash.teacher.stat.students')}</span>
            <h3 className="text-3xl font-extrabold text-slate-800">{data.stats.totalStudents}</h3>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <UserCheck className="w-5 h-5" />
          </div>
        </div>

        {/* Priority grading AlertCard */}
        <div className="bg-amber-50/50 border border-amber-100 rounded-2xl p-6 shadow-sm flex items-center justify-between hover:shadow-md transition-shadow duration-200">
          <div className="space-y-1">
            <span className="text-xs font-extrabold text-amber-600/80 uppercase tracking-wider">{t('dash.teacher.stat.pending')}</span>
            <h3 className="text-3xl font-extrabold text-amber-700">{data.stats.pendingGrading}</h3>
          </div>
          <div className="w-12 h-12 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
            <AlertCircle className="w-5 h-5 animate-pulse" />
          </div>
        </div>

      </div>

      {/* 3. Layout Columns Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Main Taught Classes List (Left - 8 columns) */}
        <div className="lg:col-span-8 space-y-4">
          <div className="flex items-center justify-between select-none">
            <h2 className="text-sm font-extrabold text-slate-500 uppercase tracking-wider">
              {t('dash.teacher.myClasses')}
            </h2>
            <button
              onClick={() => navigate('/teacher/create-assignment')}
              className="px-3 py-1.5 bg-brand hover:bg-brand-deep text-white text-[10px] font-extrabold rounded-lg transition-colors cursor-pointer shadow-sm focus:outline-none"
            >
              {t('dash.teacher.addTask')}
            </button>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {data.classes.map((cls) => (
              <div 
                key={cls.id} 
                className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow duration-200 flex flex-col justify-between space-y-4 select-none"
              >
                <div className="space-y-1.5 text-left">
                  <div className="flex justify-between items-start gap-1">
                    <span className="px-2 py-0.5 bg-purple-100 text-brand text-[9px] font-extrabold rounded-md uppercase">
                      {cls.grade ?? '—'}
                    </span>
                    <span className="text-[10px] text-slate-500 font-bold flex items-center gap-1">
                      <Users className="w-3.5 h-3.5" />
                      {t('dash.teacher.studentsCount', { n: cls.studentsCount })}
                    </span>
                  </div>
                  <h3 className="text-base font-extrabold text-slate-800 leading-snug">
                    {cls.name}
                  </h3>
                  {cls.schedule && (
                    <p className="text-[11px] text-slate-500 font-semibold flex items-center gap-1.5 pt-0.5">
                      <Calendar className="w-3.5 h-3.5 text-slate-300" />
                      {cls.schedule}
                    </p>
                  )}
                </div>

                <Button
                  onClick={() => handleManageClass(cls.id, cls.name, cls.grade)}
                  className="w-full py-2.5 rounded-xl font-bold bg-brand hover:bg-brand-deep text-white shadow-sm text-xs cursor-pointer flex items-center justify-center gap-1"
                >
                  {t('dash.teacher.manage')}
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>

        {/* Recent student submissions feed (Right - 4 columns) */}
        <div className="lg:col-span-4">
          <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow duration-200 space-y-5 h-full">
            <h2 className="text-sm font-extrabold text-slate-500 uppercase tracking-wider pb-1 select-none">
              {t('dash.teacher.recent')}
            </h2>
            
            {data.recentSubmissions.length === 0 ? (
              <div className="py-12 text-center border border-dashed border-slate-100 rounded-xl bg-slate-50/50">
                <p className="text-xs font-extrabold text-slate-500">{t('dash.teacher.recent.empty')}</p>
              </div>
            ) : (
              <div className="space-y-4 text-left select-none">
                {data.recentSubmissions.map((sub) => (
                  <div 
                    key={sub.id} 
                    onClick={() => handleGradeTask(sub.studentName, sub.assignmentTitle)}
                    className="flex gap-3 items-start group hover:bg-slate-50 p-2.5 rounded-xl border border-transparent hover:border-slate-100 transition-all cursor-pointer"
                  >
                    {/* Circle initials avatar placeholder */}
                    <div className="w-8 h-8 rounded-full bg-violet-100 text-brand flex items-center justify-center font-extrabold text-[10px] shrink-0">
                      {sub.studentName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                    </div>
                    
                    <div className="space-y-0.5 min-w-0 flex-1">
                      <p className="text-xs font-extrabold text-slate-800 leading-tight">
                        {sub.studentName} <span className="text-[10px] text-slate-500 font-semibold uppercase">({sub.grade})</span>
                      </p>
                      <p className="text-[10px] text-slate-500 font-bold truncate leading-relaxed group-hover:text-brand transition-colors" title={sub.assignmentTitle}>
                        {t('dash.teacher.submitted', { title: sub.assignmentTitle })}
                      </p>
                      <span className="text-[9px] text-slate-500 font-bold flex items-center gap-1 pt-0.5">
                        <Clock className="w-3 h-3 text-slate-300" />
                        {sub.time}
                      </span>
                    </div>

                    <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-brand transition-colors shrink-0 self-center" />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>

    </div>
  );
};

export default TeacherDashboard;
