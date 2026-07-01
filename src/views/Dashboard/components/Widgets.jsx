import React from 'react';

/**
 * 1. TodayActivities Widget (Empty State)
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
          <h3 className="text-sm font-extrabold text-slate-800 tracking-tight">
            Today's Activities
          </h3>
          <button 
            onClick={handleAction}
            className="text-xs text-[#7047EB] hover:underline font-extrabold cursor-pointer"
          >
            See all
          </button>
        </div>

        {/* Empty state container */}
        <div className="py-10 flex flex-col items-center justify-center text-center border border-dashed border-slate-100 rounded-xl bg-slate-50/50">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8 text-slate-700 mb-2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
          </svg>
          <p className="text-xs font-black text-slate-900">
            Belum ada jadwal kelas hari ini.
          </p>
        </div>
      </div>
    </div>
  );
};

/**
 * 2. ActiveAssessment Widget (Empty State)
 */
export const ActiveAssessment = ({ showToast }) => {
  const handleAction = () => {
    if (showToast) {
      showToast('Halaman tugas sedang dalam proses pengerjaan (On Progress).', 'info');
    }
  };

  return (
    <div className="bg-white border border-slate-100/60 rounded-2xl p-5 sm:p-6 shadow-sm flex flex-col justify-between text-left select-none hover:shadow-md transition-shadow duration-200">
      <div>
        <div className="flex items-center justify-between pb-5">
          <h3 className="text-sm font-extrabold text-slate-800 tracking-tight">
            Active Assessment
          </h3>
          <button 
            onClick={handleAction}
            className="text-xs text-[#7047EB] hover:underline font-extrabold cursor-pointer"
          >
            See all
          </button>
        </div>

        {/* Empty state container */}
        <div className="py-12 flex flex-col items-center justify-center text-center border border-dashed border-slate-100 rounded-xl bg-slate-50/50">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8 text-slate-700 mb-2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.03 0 1.9.693 2.166 1.638m-7.377 12.408l9-9m-9 0l9 9" />
          </svg>
          <p className="text-xs font-black text-slate-900">
            Tidak ada tugas aktif saat ini.
          </p>
        </div>
      </div>
    </div>
  );
};

/**
 * 3. CourseProgress Widget (Empty State)
 */
export const CourseProgress = ({ showToast }) => {
  const handleAction = () => {
    if (showToast) {
      showToast('Halaman mata pelajaran sedang dalam proses pengerjaan (On Progress).', 'info');
    }
  };

  return (
    <div className="bg-white border border-slate-100/60 rounded-2xl p-5 sm:p-6 shadow-sm flex flex-col justify-between text-left select-none hover:shadow-md transition-shadow duration-200">
      <div>
        <div className="flex items-center justify-between pb-5">
          <h3 className="text-sm font-extrabold text-slate-800 tracking-tight">
            Your Courses & Progress
          </h3>
          <button 
            onClick={handleAction}
            className="text-xs text-[#7047EB] hover:underline font-extrabold cursor-pointer"
          >
            See all
          </button>
        </div>

        {/* Empty state container */}
        <div className="py-10 flex flex-col items-center justify-center text-center border border-dashed border-slate-100 rounded-xl bg-slate-50/50">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8 text-slate-700 mb-2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
          </svg>
          <p className="text-xs font-black text-slate-900">
            Belum ada mata pelajaran terdaftar.
          </p>
        </div>
      </div>
    </div>
  );
};

/**
 * 4. SchoolAnnouncement Widget (Empty State)
 */
export const SchoolAnnouncement = ({ showToast }) => {
  const handleAction = () => {
    if (showToast) {
      showToast('Halaman pengumuman sedang dalam proses pengerjaan (On Progress).', 'info');
    }
  };

  return (
    <div className="bg-white border border-slate-100/60 rounded-2xl p-5 sm:p-6 shadow-sm flex flex-col justify-between text-left select-none hover:shadow-md transition-shadow duration-200">
      <div>
        <div className="flex items-center justify-between pb-5">
          <h3 className="text-sm font-extrabold text-slate-800 tracking-tight">
            School Announcement
          </h3>
          <button 
            onClick={handleAction}
            className="text-xs text-[#7047EB] hover:underline font-extrabold cursor-pointer"
          >
            See all
          </button>
        </div>

        {/* Empty state container */}
        <div className="py-10 flex flex-col items-center justify-center text-center border border-dashed border-slate-100 rounded-xl bg-slate-50/50">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8 text-slate-700 mb-2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" />
          </svg>
          <p className="text-xs font-black text-slate-900">
            Belum ada pengumuman sekolah baru.
          </p>
        </div>
      </div>
    </div>
  );
};
