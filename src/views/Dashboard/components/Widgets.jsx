import React from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  BookOpen, 
  ListTodo, 
  Clock, 
  Megaphone, 
  Calendar,
  AlertCircle,
  CheckCircle2,
  ChevronRight
} from 'lucide-react';

/**
 * 1. TodayActivities Widget
 */
export const TodayActivities = ({ showToast }) => {
  const handleAction = () => {
    if (showToast) {
      showToast('Halaman jadwal sedang dalam proses pengerjaan (On Progress).', 'info');
    }
  };

  return (
    <div className="bg-white border border-slate-100/60 rounded-2xl p-5 sm:p-6 shadow-sm flex flex-col justify-between text-left select-none hover:shadow-md transition-shadow duration-200">
      <div>
        <div className="flex items-center justify-between pb-5">
          <h3 className="text-sm font-extrabold text-slate-805 tracking-tight">
            Jadwal Harian Siswa
          </h3>
          <button 
            onClick={handleAction}
            className="text-xs text-[#7047EB] hover:underline font-extrabold cursor-pointer"
          >
            Lihat semua
          </button>
        </div>

        {/* Empty state container */}
        <div className="py-10 flex flex-col items-center justify-center text-center border border-dashed border-slate-100 rounded-xl bg-slate-50/50">
          <Calendar className="w-8 h-8 text-slate-400 mb-2" />
          <p className="text-xs font-black text-slate-700">
            Belum ada jadwal kelas hari ini.
          </p>
        </div>
      </div>
    </div>
  );
};

/**
 * 2. ActiveAssessment Widget (Live with Click Redirection)
 */
export const ActiveAssessment = ({ activeAssessments = [], isLoading }) => {
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div className="bg-white border border-slate-100/60 rounded-2xl p-6 shadow-sm animate-pulse h-[260px]">
        <div className="h-4 bg-slate-200 rounded w-1/3 mb-6"></div>
        <div className="space-y-4">
          <div className="h-10 bg-slate-150 rounded"></div>
          <div className="h-10 bg-slate-150 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-100/60 rounded-2xl p-5 sm:p-6 shadow-sm flex flex-col text-left select-none hover:shadow-md transition-shadow duration-200">
      <div className="flex items-center justify-between pb-4">
        <h3 className="text-sm font-extrabold text-slate-805 tracking-tight">
          Tugas Aktif (Active Assessment)
        </h3>
        <span className="text-[10px] bg-purple-50 text-[#7047EB] font-black px-2 py-0.5 rounded-md">
          {activeAssessments.length} tugas
        </span>
      </div>

      {activeAssessments.length === 0 ? (
        <div className="py-10 flex flex-col items-center justify-center text-center border border-dashed border-slate-150 rounded-xl bg-slate-50/50 flex-1">
          <ListTodo className="w-8 h-8 text-slate-400 mb-2" />
          <p className="text-xs font-black text-slate-700">
            Hebat! Tidak ada tugas aktif tersisa.
          </p>
        </div>
      ) : (
        <div className="space-y-3 overflow-y-auto max-h-[220px] pr-1">
          {activeAssessments.map((task) => {
            const daysLeft = Math.ceil((new Date(task.deadline) - new Date()) / (1000 * 60 * 60 * 24));
            return (
              <div
                key={task.id}
                onClick={() => navigate(`/assignment/${task.id}`)}
                className="group border border-slate-100 hover:border-purple-100 hover:bg-purple-50/10 p-3 rounded-xl flex items-center justify-between gap-3 cursor-pointer transition-all"
              >
                <div className="min-w-0">
                  <span className="text-[9px] font-black text-[#7047EB] uppercase tracking-wider block">
                    {task.subject_name}
                  </span>
                  <span className="text-xs font-extrabold text-slate-805 truncate block mt-0.5 group-hover:text-[#7047EB]">
                    {task.title}
                  </span>
                </div>
                
                <span className={`shrink-0 text-[9px] font-black px-2 py-0.5 rounded-md flex items-center gap-1
                  ${daysLeft <= 1 
                    ? 'bg-rose-50 text-rose-650 border border-rose-100' 
                    : 'bg-slate-50 text-slate-500'
                  }
                `}>
                  <Clock className="w-3 h-3" />
                  {daysLeft <= 0 ? 'Hari ini' : `${daysLeft} hari lagi`}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

/**
 * 3. CourseProgress Widget (Aligned with Pre-Thesis "Penyelesaian Tugas Kelas")
 */
export const CourseProgress = ({ courseProgress = [], isLoading }) => {
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div className="bg-white border border-slate-100/60 rounded-2xl p-6 shadow-sm animate-pulse h-[260px]">
        <div className="h-4 bg-slate-200 rounded w-1/3 mb-6"></div>
        <div className="space-y-4">
          <div className="h-8 bg-slate-150 rounded w-3/4"></div>
          <div className="h-8 bg-slate-150 rounded w-5/6"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-100/60 rounded-2xl p-5 sm:p-6 shadow-sm flex flex-col text-left select-none hover:shadow-md transition-shadow duration-200">
      <div className="flex items-center justify-between pb-4">
        <h3 className="text-sm font-extrabold text-slate-805 tracking-tight">
          Penyelesaian Tugas Kelas
        </h3>
        <button
          onClick={() => navigate('/scores')}
          className="text-xs text-[#7047EB] hover:underline font-extrabold cursor-pointer"
        >
          Buku Nilai
        </button>
      </div>

      {courseProgress.length === 0 ? (
        <div className="py-10 flex flex-col items-center justify-center text-center border border-dashed border-slate-150 rounded-xl bg-slate-50/50 flex-1">
          <BookOpen className="w-8 h-8 text-slate-400 mb-2" />
          <p className="text-xs font-black text-slate-700">
            Belum ada mata pelajaran terdaftar.
          </p>
        </div>
      ) : (
        <div className="space-y-4 overflow-y-auto max-h-[220px] pr-1">
          {courseProgress.map((course) => {
            const total = parseInt(course.total_tasks, 10);
            const submitted = parseInt(course.submitted_tasks, 10);
            const percent = total > 0 ? Math.round((submitted / total) * 100) : 100;
            
            return (
              <div key={course.class_subject_id} className="space-y-1.5">
                <div className="flex justify-between text-[11px] font-extrabold">
                  <span className="text-slate-800 truncate pr-4">
                    {course.subject_name}
                  </span>
                  <span className="text-slate-500 shrink-0">
                    {submitted}/{total} Selesai
                  </span>
                </div>
                
                {/* Progress bar */}
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-50">
                  <div 
                    className={`h-full rounded-full transition-all duration-300
                      ${percent === 100 ? 'bg-emerald-500' : 'bg-indigo-500'}
                    `}
                    style={{ width: `${percent}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

/**
 * 4. SchoolAnnouncement Widget (Live School Maklumat)
 */
export const SchoolAnnouncement = ({ announcements = [], isLoading }) => {
  if (isLoading) {
    return (
      <div className="bg-white border border-slate-100/60 rounded-2xl p-6 shadow-sm animate-pulse h-[260px]">
        <div className="h-4 bg-slate-200 rounded w-1/3 mb-6"></div>
        <div className="h-20 bg-slate-150 rounded"></div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-100/60 rounded-2xl p-5 sm:p-6 shadow-sm flex flex-col text-left select-none hover:shadow-md transition-shadow duration-200">
      <div className="flex items-center justify-between pb-4">
        <h3 className="text-sm font-extrabold text-slate-805 tracking-tight">
          Pengumuman Sekolah (Announcement)
        </h3>
      </div>

      {announcements.length === 0 ? (
        <div className="py-10 flex flex-col items-center justify-center text-center border border-dashed border-slate-150 rounded-xl bg-slate-50/50 flex-1">
          <Megaphone className="w-8 h-8 text-slate-400 mb-2" />
          <p className="text-xs font-black text-slate-700">
            Tidak ada pengumuman baru sekolah saat ini.
          </p>
        </div>
      ) : (
        <div className="space-y-3 overflow-y-auto max-h-[220px] pr-1">
          {announcements.map((ann, idx) => (
            <div 
              key={ann.id} 
              className={`border p-3.5 rounded-xl space-y-1.5 text-left
                ${idx === 0 
                  ? 'bg-purple-50/20 border-purple-100/60' 
                  : 'bg-white border-slate-100'
                }
              `}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-slate-850 truncate pr-2">
                  {ann.title}
                </span>
                <span className="text-[9px] text-slate-400 font-bold shrink-0">
                  {new Date(ann.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                </span>
              </div>
              <p className="text-[11px] font-semibold text-slate-600 leading-relaxed">
                {ann.content}
              </p>
              <div className="flex justify-end text-[9px] font-black text-[#7047EB]">
                — {ann.author_name || 'Kepala Sekolah'}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
