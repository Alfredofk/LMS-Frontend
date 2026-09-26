import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  FileText, 
  Clock, 
  CheckCircle, 
  Award, 
  Search, 
  ChevronRight, 
  AlertTriangle 
} from 'lucide-react';
import { useT } from '../../i18n/LanguageContext';
import NotBuiltYet from '../../components/ui/NotBuiltYet';
import { api, isNotBuiltYet } from '../../services/apiClient';

/*
  `/api/assessment/student` does not exist — there is no model for an
  assignment or a submission in the schema — so the request 404s. The page then
  shows its heading and NotBuiltYet, not the tabs and an "all done" empty state,
  which would tell a student they have nothing due.
*/
export const AssessmentPage = () => {
  const { t, lang } = useT();
  const locale = lang === 'id' ? 'id-ID' : 'en-GB';
  const navigate = useNavigate();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notBuilt, setNotBuilt] = useState(false);
  const [activeTab, setActiveTab] = useState('active'); // 'active' | 'submitted' | 'graded'
  const [searchQuery, setSearchQuery] = useState('');

  const fetchTasks = async () => {
    setLoading(true);
    try {
      const data = await api.get('/assessment/student');
      setTasks(Array.isArray(data) ? data : []);
    } catch (err) {
      if (isNotBuiltYet(err)) setNotBuilt(true);
      else console.error('Fetch Student Assessments Error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  // Helpers to categorize tasks
  const getCategorizedTasks = () => {
    const now = new Date();
    
    const active = [];
    const overdue = [];
    const submitted = [];
    const graded = [];

    tasks.forEach(task => {
      const isSubmitted = task.submissionStatus === 'Terkumpul' || task.submissionStatus === 'Belum Dinilai' || task.submissionStatus === 'Sudah Dinilai';
      const isGraded = task.submissionStatus === 'Sudah Dinilai';
      const deadlineDate = new Date(task.deadline);
      const isPast = deadlineDate < now;

      if (isGraded) {
        graded.push(task);
      } else if (isSubmitted) {
        submitted.push(task);
      } else if (isPast) {
        overdue.push(task);
      } else {
        active.push(task);
      }
    });

    return { active, overdue, submitted, graded };
  };

  const { active, overdue, submitted, graded } = getCategorizedTasks();

  // Handle selected tab data source
  const getActiveList = () => {
    switch (activeTab) {
      case 'submitted':
        return submitted;
      case 'graded':
        return graded;
      case 'active':
      default:
        // Combine active & overdue in the main active tab
        return [...active, ...overdue];
    }
  };

  const activeList = getActiveList();

  const filteredTasks = activeList.filter(task => 
    task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    task.subjectName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatDate = (dateStr) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString(locale, {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateStr;
    }
  };

  const remainingTime = (deadlineStr) => {
    const diffMs = new Date(deadlineStr) - new Date();
    if (Number.isNaN(diffMs)) return '';
    if (diffMs < 0) return t('asm.overdue');

    const days = Math.floor(diffMs / 86400000);
    if (days > 0) return t('asm.remaining.days', { n: days });

    const hours = Math.floor(diffMs / 3600000);
    if (hours > 0) return t('asm.remaining.hours', { n: hours });

    return t('asm.remaining.minutes', { n: Math.floor(diffMs / 60000) });
  };

  const heading = (
    <div>
      <h1 className="text-xl sm:text-2xl font-extrabold text-slate-800 leading-tight">
        {t('asm.title')}
      </h1>
      <p className="text-xs text-slate-500 font-bold mt-1">
        {t('asm.subtitle')}
      </p>
    </div>
  );

  if (notBuilt) {
    return (
      <div className="flex-1 overflow-y-auto bg-slate-50 p-6 sm:p-8 font-sans flex flex-col">
        <div className="mb-8 select-none">{heading}</div>
        <NotBuiltYet />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 p-6 sm:p-8 font-sans flex flex-col">

      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 select-none">
        {heading}

        {/* Search Input */}
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder={t('asm.search')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white border border-slate-200 rounded-xl py-2.5 pl-9 pr-4 text-xs font-semibold text-slate-800 focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand transition-all shadow-sm"
          />
        </div>
      </div>

      {/* Tabs list filter */}
      <div className="flex border-b border-slate-200 mb-6 select-none">
        <button
          onClick={() => setActiveTab('active')}
          className={`px-4 py-3 text-xs font-extrabold border-b-2 transition-all cursor-pointer relative
            ${activeTab === 'active' 
              ? 'border-brand text-brand' 
              : 'border-transparent text-slate-500 hover:text-slate-600'
            }
          `}
        >
          {t('asm.tab.active')}
          {active.length > 0 && (
            <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-violet-100 text-brand text-[9px] font-extrabold">
              {active.length}
            </span>
          )}
          {overdue.length > 0 && (
            <span className="ml-1 px-1.5 py-0.5 rounded-full bg-red-100 text-red-600 text-[9px] font-extrabold">
              {overdue.length}!
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('submitted')}
          className={`px-4 py-3 text-xs font-extrabold border-b-2 transition-all cursor-pointer
            ${activeTab === 'submitted' 
              ? 'border-brand text-brand' 
              : 'border-transparent text-slate-500 hover:text-slate-600'
            }
          `}
        >
          {t('asm.tab.submitted')}
          {submitted.length > 0 && (
            <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[9px] font-extrabold">
              {submitted.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('graded')}
          className={`px-4 py-3 text-xs font-extrabold border-b-2 transition-all cursor-pointer
            ${activeTab === 'graded' 
              ? 'border-brand text-brand' 
              : 'border-transparent text-slate-500 hover:text-slate-600'
            }
          `}
        >
          {t('asm.tab.graded')}
          {graded.length > 0 && (
            <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-600 text-[9px] font-extrabold">
              {graded.length}
            </span>
          )}
        </button>
      </div>

      {/* Grid rendering list */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-white border border-slate-100 rounded-3xl p-5 shadow-sm animate-pulse flex items-center justify-between">
              <div className="space-y-2 flex-1">
                <div className="h-4 bg-slate-100 rounded w-1/4" />
                <div className="h-3 bg-slate-100 rounded w-1/2" />
              </div>
              <div className="w-8 h-8 bg-slate-100 rounded-full" />
            </div>
          ))}
        </div>
      ) : filteredTasks.length === 0 ? (
        <div className="bg-white border border-slate-100 rounded-3xl p-12 text-center shadow-sm select-none">
          <div className="w-16 h-16 bg-slate-50 text-slate-400 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <FileText className="w-8 h-8" />
          </div>
          <h3 className="text-xs font-extrabold text-slate-700">{t('asm.empty')}</h3>
          <p className="text-[10px] text-slate-500 font-bold mt-1">
            {searchQuery ? t('asm.emptySearch') : t('asm.emptyNone')}
          </p>
        </div>
      ) : (
        <div className="space-y-3.5">
          {filteredTasks.map((task) => {
            const isOverdue = new Date(task.deadline) < new Date() && task.submissionStatus === 'Belum Mengumpulkan';
            const isGraded = task.submissionStatus === 'Sudah Dinilai';
            const isSubmitted = task.submissionStatus === 'Terkumpul' || task.submissionStatus === 'Belum Dinilai';

            return (
              <div
                key={task.assessmentId}
                onClick={() => navigate(`/assignment/${task.assessmentId}`)}
                className={`
                  bg-white border hover:border-slate-300 rounded-3xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer relative group
                  ${isOverdue ? 'border-red-100 bg-red-50/5' : 'border-slate-100'}
                `}
              >
                {/* Left Side: Subject, Title, Deadline info */}
                <div className="flex items-start gap-4 min-w-0">
                  <div className={`
                    w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 shadow-sm
                    ${isOverdue ? 'bg-red-50 text-red-500' : isGraded ? 'bg-emerald-50 text-emerald-500' : 'bg-violet-50 text-brand'}
                  `}>
                    <FileText className="w-5 h-5" />
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center flex-wrap gap-2">
                      <span className="text-[9px] font-extrabold text-slate-500 uppercase tracking-wide">
                        {task.subjectName} ({task.subjectCode})
                      </span>
                      {/* XP Badge */}
                      <span className="px-1.5 py-0.5 bg-brand-tint text-brand text-[8px] font-extrabold rounded-md select-none">
                        +{task.xpReward} XP
                      </span>
                    </div>

                    <h3 className="text-xs sm:text-sm font-extrabold text-slate-800 mt-1 leading-tight group-hover:text-brand transition-colors truncate pr-4">
                      {task.title}
                    </h3>

                    {/* Deadline detail */}
                    <div className="flex items-center gap-4 mt-2 text-[10px] text-slate-500 font-bold select-none">
                      <div className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        <span>{t('asm.due', { date: formatDate(task.deadline) })}</span>
                      </div>
                      
                      {!isSubmitted && !isGraded && (
                        <div className={`flex items-center gap-1 font-extrabold
                          ${isOverdue ? 'text-red-500' : 'text-orange-500'}
                        `}>
                          {isOverdue ? (
                            <>
                              <AlertTriangle className="w-3.5 h-3.5" />
                              <span>{t('asm.overdue')}</span>
                            </>
                          ) : (
                            <span>{remainingTime(task.deadline)}</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right Side: Status badges & Grade Score circle */}
                <div className="flex items-center justify-end shrink-0 select-none">
                  {isGraded ? (
                    <div className="flex items-center gap-3 pr-2">
                      <div className="text-right">
                        <span className="text-[8px] text-slate-500 font-extrabold uppercase tracking-wider block">{t('asm.grade')}</span>
                        <span className="text-sm font-extrabold text-emerald-600 block">{task.grade} / 100</span>
                      </div>
                      <div className="w-10 h-10 rounded-full border-2 border-emerald-500 flex items-center justify-center text-emerald-600 text-xs font-extrabold bg-emerald-50/30">
                        {task.grade}
                      </div>
                    </div>
                  ) : isSubmitted ? (
                    <div className="px-3 py-1 bg-slate-50 border border-slate-100 text-slate-500 text-[10px] font-extrabold rounded-xl flex items-center gap-1">
                      <CheckCircle className="w-3.5 h-3.5 text-slate-400" />
                      {t('asm.grading')}
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-slate-500 group-hover:text-brand transition-colors pr-2">
                      <span className="text-[10px] font-extrabold">{t('asm.doIt')}</span>
                      <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AssessmentPage;
