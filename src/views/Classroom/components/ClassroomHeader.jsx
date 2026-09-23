import React from 'react';
import { BookOpen, User, Calendar, MapPin } from 'lucide-react';

export const ClassroomHeader = ({ course }) => {
  if (!course) return null;

  return (
    <div className="bg-gradient-to-r from-brand to-brand-deep rounded-2xl p-6 sm:p-8 text-white shadow-md relative overflow-hidden select-none text-left">
      
      {/* Decorative abstract SVG overlay background */}
      <div className="absolute right-0 top-0 bottom-0 w-1/3 opacity-15 pointer-events-none hidden md:block">
        <svg viewBox="0 0 100 100" className="w-full h-full transform scale-150 translate-x-12 translate-y-4">
          <circle cx="50" cy="50" r="40" fill="none" stroke="white" strokeWidth="6" strokeDasharray="10 6" />
          <circle cx="50" cy="50" r="25" fill="none" stroke="white" strokeWidth="4" />
        </svg>
      </div>

      <div className="relative z-10 space-y-4">
        {/* Badges */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="px-2.5 py-0.5 bg-white/20 text-white text-[10px] font-extrabold rounded-md tracking-wider uppercase backdrop-blur-sm">
            {course.className}
          </span>
          <span className="px-2.5 py-0.5 bg-emerald-500/80 text-white text-[10px] font-extrabold rounded-md tracking-wider uppercase backdrop-blur-sm">
            Aktif
          </span>
        </div>

        {/* Subject Name */}
        <div className="space-y-1">
          {/* h2, not h1: the page owns that now, and this banner names one subject
              inside it. Two h1s on one page is what this was until ClassroomPage
              grew a title of its own — invisible while the sample data was empty,
              because this branch never rendered. */}
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            {course.name}
          </h2>
          <p className="text-xs sm:text-sm text-violet-100 font-semibold max-w-xl">
            Selamat datang di Ruang Kelas Virtual {course.name}. Temukan materi belajar, daftar tugas, dan diskusikan topik kelas bersama teman sekelas Anda.
          </p>
        </div>

        {/* Metadata Details Roster */}
        <div className="pt-2 border-t border-white/10 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-bold text-violet-50">
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-violet-200 shrink-0" />
            <div>
              <div className="text-[10px] text-violet-300 font-semibold">Guru Pengampu</div>
              <div>{course.teacher}</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-violet-200 shrink-0" />
            <div>
              <div className="text-[10px] text-violet-300 font-semibold">Jadwal Kelas</div>
              <div>{course.schedule}</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-violet-200 shrink-0" />
            <div>
              <div className="text-[10px] text-violet-300 font-semibold">Ruangan</div>
              <div>Lab Komputer A / Virtual</div>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
};

export default ClassroomHeader;
