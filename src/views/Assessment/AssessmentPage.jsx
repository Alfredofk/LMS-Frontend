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

export const AssessmentPage = () => {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('active'); // 'active' | 'submitted' | 'graded'
  const [searchQuery, setSearchQuery] = useState('');

  const fetchTasks = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const res = await fetch('/api/assessment/student', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setTasks(data);
      }
    } catch (err) {
      console.error('Fetch Student Assessments Error:', err);
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
      return date.toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (e) {
      return dateStr;
    }
  };

  const formatRemainingTime = (deadlineStr) => {
    try {
      const diffMs = new Date(deadlineStr) - new Date();
      if (diffMs < 0) return 'Terlewat';

      const diffDays = Math.floor(diffMs / 86400000);
      if (diffDays > 0) return `${diffDays} hari lagi`;

      const diffHours = Math.floor(diffMs / 3600000);
      if (diffHours > 0) return `${diffHours} jam lagi`;

      const diffMins = Math.floor(diffMs / 60000);
      return `${diffMins} menit lagi`;
    } catch (e) {
      return '';
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 p-6 sm:p-8 font-sans flex flex-col">
      
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 select-none">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-800 leading-tight">
            Pusat Penugasan (Assessment)
          </h1>
          <p className="text-xs text-slate-400 font-bold mt-1">
            Pantau dan kerjakan seluruh tugas sekolah Anda di satu tempat
          </p>
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Cari tugas..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white border border-slate-200 rounded-xl py-2.5 pl-9 pr-4 text-xs font-semibold text-slate-800 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all shadow-sm"
          />
        </div>
      </div>

      {/* Tabs list filter */}
      <div className="flex border-b border-slate-150 mb-6 select-none">
        <button
          onClick={() => setActiveTab('active')}
          className={`px-4 py-3 text-xs font-black border-b-2 transition-all cursor-pointer relative
            ${activeTab === 'active' 
              ? 'border-[#7047EB] text-[#7047EB]' 
              : 'border-transparent text-slate-400 hover:text-slate-600'
            }
          `}
        >
          Tugas Aktif
          {active.length > 0 && (
            <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-violet-100 text-[#7047EB] text-[9px] font-extrabold">
              {active.length}
            </span>
          )}
          {overdue.length > 0 && (
            <span className="ml-1 px-1.5 py-0.5 rounded-full bg-red-100 text-red-650 text-[9px] font-extrabold">
              {overdue.length}!
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('submitted')}
          className={`px-4 py-3 text-xs font-black border-b-2 transition-all cursor-pointer
            ${activeTab === 'submitted' 
              ? 'border-[#7047EB] text-[#7047EB]' 
              : 'border-transparent text-slate-400 hover:text-slate-600'
            }
          `}
        >
          Terkumpul
          {submitted.length > 0 && (
            <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[9px] font-extrabold">
              {submitted.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('graded')}
          className={`px-4 py-3 text-xs font-black border-b-2 transition-all cursor-pointer
            ${activeTab === 'graded' 
              ? 'border-[#7047EB] text-[#7047EB]' 
              : 'border-transparent text-slate-400 hover:text-slate-600'
            }
          `}
        >
          Sudah Dinilai
          {graded.length > 0 && (
            <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-650 text-[9px] font-extrabold">
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
        <div className="bg-white border border-slate-150 rounded-3xl p-12 text-center shadow-sm select-none">
          <div className="w-16 h-16 bg-slate-50 text-slate-400 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <FileText className="w-8 h-8" />
          </div>
          <h3 className="text-xs font-black text-slate-700">Tidak ada tugas</h3>
          <p className="text-[10px] text-slate-400 font-bold mt-1">
            {searchQuery ? 'Tidak ada hasil tugas yang cocok.' : 'Daftar penugasan di tab ini kosong.'}
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
                  bg-white border hover:border-slate-350 rounded-3xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer relative group
                  ${isOverdue ? 'border-red-100 bg-red-50/5' : 'border-slate-100'}
                `}
              >
                {/* Left Side: Subject, Title, Deadline info */}
                <div className="flex items-start gap-4 min-w-0">
                  <div className={`
                    w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 shadow-sm
                    ${isOverdue ? 'bg-red-50 text-red-500' : isGraded ? 'bg-emerald-50 text-emerald-500' : 'bg-violet-50 text-[#7047EB]'}
                  `}>
                    <FileText className="w-5 h-5" />
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center flex-wrap gap-2">
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-wide">
                        {task.subjectName} ({task.subjectCode})
                      </span>
                      {/* XP Badge */}
                      <span className="px-1.5 py-0.5 bg-[#F1EEFF] text-[#7047EB] text-[8px] font-black rounded-md select-none">
                        +{task.xpReward} XP
                      </span>
                    </div>

                    <h3 className="text-xs sm:text-sm font-black text-slate-805 mt-1 leading-tight group-hover:text-violet-650 transition-colors truncate pr-4">
                      {task.title}
                    </h3>

                    {/* Deadline detail */}
                    <div className="flex items-center gap-4 mt-2 text-[10px] text-slate-400 font-bold select-none">
                      <div className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        <span>Tenggat: {formatDate(task.deadline)}</span>
                      </div>
                      
                      {!isSubmitted && !isGraded && (
                        <div className={`flex items-center gap-1 font-extrabold
                          ${isOverdue ? 'text-red-500' : 'text-orange-500'}
                        `}>
                          {isOverdue ? (
                            <>
                              <AlertTriangle className="w-3.5 h-3.5" />
                              <span>Terlewat</span>
                            </>
                          ) : (
                            <span>{formatRemainingTime(task.deadline)}</span>
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
                        <span className="text-[8px] text-slate-400 font-black uppercase tracking-wider block">Nilai</span>
                        <span className="text-sm font-black text-emerald-600 block">{task.grade} / 100</span>
                      </div>
                      <div className="w-10 h-10 rounded-full border-2 border-emerald-500 flex items-center justify-center text-emerald-600 text-xs font-black bg-emerald-50/30">
                        {task.grade}
                      </div>
                    </div>
                  ) : isSubmitted ? (
                    <div className="px-3 py-1 bg-slate-50 border border-slate-100 text-slate-500 text-[10px] font-black rounded-xl flex items-center gap-1">
                      <CheckCircle className="w-3.5 h-3.5 text-slate-400" />
                      Proses Penilaian
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-slate-400 group-hover:text-[#7047EB] transition-colors pr-2">
                      <span className="text-[10px] font-black">Kerjakan</span>
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
