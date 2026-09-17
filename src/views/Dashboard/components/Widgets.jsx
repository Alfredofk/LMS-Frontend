import React from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  BookOpen, 
  ListTodo, 
  Megaphone, 
  Calendar
} from 'lucide-react';

/**
 * 1. TodayActivities Widget
 */
export const TodayActivities = ({ activities = [], isLoading }) => {
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm animate-pulse min-h-[260px]">
        <div className="h-4 bg-slate-200 rounded w-1/3 mb-6"></div>
        <div className="space-y-4">
          <div className="h-10 bg-slate-100 rounded-xl"></div>
          <div className="h-10 bg-slate-100 rounded-xl"></div>
          <div className="h-10 bg-slate-100 rounded-xl"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm flex flex-col justify-between text-left select-none hover:shadow-md transition-shadow duration-200">
      <div>
        <div className="flex items-center justify-between pb-4">
          <h3 className="text-sm font-bold text-slate-800 tracking-tight">
            Today`s Activities
          </h3>
          <button 
            onClick={() => navigate('/schedule')}
            className="text-xs text-[#7047EB] hover:underline font-semibold cursor-pointer"
          >
            See all
          </button>
        </div>

        {activities.length === 0 ? (
          <div className="py-10 flex flex-col items-center justify-center text-center border border-dashed border-slate-100 rounded-xl bg-slate-50/40">
            <Calendar className="w-7 h-7 text-slate-350 mb-2" />
            <p className="text-xs font-semibold text-slate-600">
              Belum ada jadwal kegiatan hari ini.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {activities.map((act, index) => (
              <div key={act.id || index} className="flex items-center gap-4">
                {/* Time block */}
                <div className="w-16 shrink-0 text-left">
                  <div className="text-xs font-bold text-slate-800 leading-tight">
                    {act.startTime ? act.startTime.substring(0, 5) : '07:00'}
                  </div>
                  <div className="text-[11px] font-medium text-slate-400 leading-tight mt-0.5">
                    {act.endTime ? act.endTime.substring(0, 5) : '08:30'}
                  </div>
                </div>

                {/* Divider Line */}
                <div className="w-px h-7 bg-slate-100 shrink-0" />

                {/* Subject & Instructor/Room Info */}
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold text-slate-900 truncate">
                    {act.subjectName || act.subject_name || act.title}
                  </div>
                  <div className="text-[11px] font-medium text-slate-400 truncate mt-0.5">
                    {act.room ? `${act.room} · ` : ''}{act.teacherName || act.teacher_name || 'Guru'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * 2. ActiveAssessment Widget (With Status Dots, Badges, and Urgency Alert)
 */
export const ActiveAssessment = ({ activeAssessments = [], isLoading }) => {
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm animate-pulse min-h-[260px]">
        <div className="h-4 bg-slate-200 rounded w-1/3 mb-6"></div>
        <div className="space-y-4">
          <div className="h-10 bg-slate-100 rounded-xl"></div>
          <div className="h-10 bg-slate-100 rounded-xl"></div>
        </div>
      </div>
    );
  }

  // Find if there is an urgent task (deadline within 1 day)
  const urgentTask = activeAssessments.find(task => {
    const diffDays = Math.ceil((new Date(task.deadline) - new Date()) / (1000 * 60 * 60 * 24));
    return diffDays <= 1;
  });

  return (
    <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm flex flex-col justify-between text-left select-none hover:shadow-md transition-shadow duration-200">
      <div>
        <div className="flex items-center justify-between pb-4">
          <h3 className="text-sm font-bold text-slate-800 tracking-tight">
            Active Assessment
          </h3>
          <button
            onClick={() => navigate('/assessment')}
            className="text-xs text-[#7047EB] hover:underline font-semibold cursor-pointer"
          >
            See all
          </button>
        </div>

        {activeAssessments.length === 0 ? (
          <div className="py-10 flex flex-col items-center justify-center text-center border border-dashed border-slate-100 rounded-xl bg-slate-50/40">
            <ListTodo className="w-7 h-7 text-slate-350 mb-2" />
            <p className="text-xs font-semibold text-slate-600">
              Tidak ada tugas aktif tersisa.
            </p>
          </div>
        ) : (
          <div className="space-y-3.5">
            {activeAssessments.slice(0, 3).map((task, idx) => {
              const daysLeft = Math.ceil((new Date(task.deadline) - new Date()) / (1000 * 60 * 60 * 24));
              const deadlineDate = new Date(task.deadline);
              const formattedDate = !isNaN(deadlineDate) 
                ? deadlineDate.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }) 
                : 'Segera';

              // Dot & Badge color logic
              let dotColor = 'bg-emerald-500';
              let badgeClass = 'bg-[#EBFBF2] text-[#059669]';
              let badgeLabel = formattedDate;

              if (daysLeft <= 1 || idx === 0) {
                dotColor = 'bg-rose-500';
                badgeClass = 'bg-[#FEECEC] text-[#EF4444]';
                badgeLabel = daysLeft <= 1 ? 'Segera' : formattedDate;
              } else if (daysLeft <= 3 || idx === 1) {
                dotColor = 'bg-amber-500';
                badgeClass = 'bg-[#FEF5E7] text-[#D97706]';
                badgeLabel = formattedDate;
              }

              const dueText = daysLeft <= 0 
                ? 'dikumpul hari ini' 
                : daysLeft === 1 
                  ? 'dikumpul besok' 
                  : `dikumpul ${formattedDate.toLowerCase()}`;

              return (
                <div
                  key={task.id}
                  onClick={() => navigate(`/assignment/${task.id}`)}
                  className="flex items-center justify-between gap-3 cursor-pointer group hover:opacity-85 transition-opacity"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${dotColor}`} />
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-800 truncate group-hover:text-[#7047EB] transition-colors">
                        {task.title}
                      </div>
                      <div className="text-[11px] text-slate-400 font-medium truncate mt-0.5">
                        {task.subject_name || 'Mata Pelajaran'} · {dueText}
                      </div>
                    </div>
                  </div>

                  <span className={`shrink-0 text-[10px] font-semibold px-2.5 py-0.5 rounded-full ${badgeClass}`}>
                    {badgeLabel}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Urgent Warning Banner at Bottom */}
      {urgentTask && (
        <div className="bg-[#FFF0F0] border border-[#FFE0E0] rounded-xl p-3 mt-4 text-left">
          <div className="text-xs font-semibold text-rose-600 leading-tight">
            Tugas "{urgentTask.title}" deadline {Math.ceil((new Date(urgentTask.deadline) - new Date()) / (1000 * 60 * 60 * 24)) <= 0 ? 'hari ini' : 'besok'}!
          </div>
          <div className="text-[11px] text-rose-500 font-normal mt-0.5">
            Segera kumpulkan sebelum 23:59!
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * 3. CourseProgress Widget ("Your Courses & Progress")
 */
export const CourseProgress = ({ courseProgress = [], isLoading }) => {
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm animate-pulse min-h-[260px]">
        <div className="h-4 bg-slate-200 rounded w-1/3 mb-6"></div>
        <div className="space-y-4">
          <div className="h-10 bg-slate-100 rounded-xl"></div>
          <div className="h-10 bg-slate-100 rounded-xl"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm flex flex-col justify-between text-left select-none hover:shadow-md transition-shadow duration-200">
      <div>
        <div className="flex items-center justify-between pb-4">
          <h3 className="text-sm font-bold text-slate-800 tracking-tight">
            Your Courses & Progress
          </h3>
          <button
            onClick={() => navigate('/classroom')}
            className="text-xs text-[#7047EB] hover:underline font-semibold cursor-pointer"
          >
            See all
          </button>
        </div>

        {courseProgress.length === 0 ? (
          <div className="py-10 flex flex-col items-center justify-center text-center border border-dashed border-slate-100 rounded-xl bg-slate-50/40">
            <BookOpen className="w-7 h-7 text-slate-350 mb-2" />
            <p className="text-xs font-semibold text-slate-600">
              Belum ada mata pelajaran terdaftar.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {courseProgress.slice(0, 4).map((course) => {
              const total = parseInt(course.total_tasks || 0, 10);
              const submitted = parseInt(course.submitted_tasks || 0, 10);
              const percent = total > 0 ? Math.round((submitted / total) * 100) : (course.progress || 0);

              return (
                <div key={course.class_subject_id || course.id} className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Thumbnail square icon */}
                    <div className="w-9 h-9 rounded-xl bg-[#EDF3FF] text-[#4F46E5] flex items-center justify-center shrink-0">
                      <BookOpen className="w-4 h-4 opacity-80" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-900 truncate">
                        {course.subject_name || course.name}
                      </div>
                      <div className="text-[11px] text-slate-400 font-medium truncate mt-0.5">
                        {course.teacher_name || course.teacher || 'Guru Pengampu'}
                      </div>
                    </div>
                  </div>

                  {/* Progress info & bar */}
                  <div className="shrink-0 text-right">
                    <span className="text-xs font-bold text-slate-800">
                      {percent}/100%
                    </span>
                    <div className="w-24 sm:w-28 h-1 bg-slate-100 rounded-full overflow-hidden mt-1">
                      <div
                        className="h-full bg-[#7047EB] rounded-full transition-all duration-300"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * 4. SchoolAnnouncement Widget
 */
export const SchoolAnnouncement = ({ announcements = [], isLoading }) => {
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm animate-pulse min-h-[260px]">
        <div className="h-4 bg-slate-200 rounded w-1/3 mb-6"></div>
        <div className="h-20 bg-slate-100 rounded-xl mb-3"></div>
        <div className="h-10 bg-slate-100 rounded-xl"></div>
      </div>
    );
  }

  const formatTimeAgo = (dateStr) => {
    try {
      const diffMs = new Date() - new Date(dateStr);
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      if (diffDays <= 0) return 'Hari ini';
      return `${diffDays} hari lalu`;
    } catch (e) {
      return 'Baru saja';
    }
  };

  return (
    <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm flex flex-col justify-between text-left select-none hover:shadow-md transition-shadow duration-200">
      <div>
        <div className="flex items-center justify-between pb-4">
          <h3 className="text-sm font-bold text-slate-800 tracking-tight">
            School Announcement
          </h3>
          <button
            onClick={() => navigate('/announcements')}
            className="text-xs text-[#7047EB] hover:underline font-semibold cursor-pointer"
          >
            See all
          </button>
        </div>

        {announcements.length === 0 ? (
          <div className="py-10 flex flex-col items-center justify-center text-center border border-dashed border-slate-100 rounded-xl bg-slate-50/40">
            <Megaphone className="w-7 h-7 text-slate-350 mb-2" />
            <p className="text-xs font-semibold text-slate-600">
              Tidak ada pengumuman baru sekolah saat ini.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {announcements.slice(0, 3).map((ann, idx) => {
              // Highlight the first announcement with light blue background
              if (idx === 0) {
                return (
                  <div 
                    key={ann.id} 
                    className="bg-[#EFF6FF] border border-[#DBEAFE] rounded-xl p-3.5 space-y-1 text-left"
                  >
                    <div className="text-xs font-bold text-blue-700 leading-tight">
                      {ann.title}
                    </div>
                    <p className="text-[11px] text-blue-600/90 leading-relaxed font-normal">
                      {ann.content}
                    </p>
                    <div className="text-[9px] text-blue-400 font-medium pt-0.5">
                      {formatTimeAgo(ann.created_at)} · {ann.author_name || 'Kesiswaan'}
                    </div>
                  </div>
                );
              }

              return (
                <div key={ann.id} className="space-y-0.5 text-left pt-1">
                  <div className="text-xs font-bold text-slate-800 leading-tight">
                    {ann.title}
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed font-normal line-clamp-1">
                    {ann.content}
                  </p>
                  <div className="text-[9px] text-slate-400 font-medium">
                    {formatTimeAgo(ann.created_at)} · {ann.author_name || 'Kesiswaan'}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
