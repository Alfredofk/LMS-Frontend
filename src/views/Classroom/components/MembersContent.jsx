import React from 'react';
import { useAuth } from '../../../context/AuthContext';
import { User, Users } from 'lucide-react';

export const MembersContent = () => {
  const { user } = useAuth();
  const activeStudentName = user?.name || 'Andi Rahmat';

  const teacher = {
    name: 'Ibu Sari Rahma, S.Pd',
    role: 'Guru Pengampu / Wali Kelas',
    avatar: 'SR'
  };

  const classmates = [
    { name: 'Siti Rahma', status: 'Siswa' },
    { name: 'Budi Santoso', status: 'Siswa' },
    { name: 'Ratna Sari', status: 'Siswa' },
    { name: activeStudentName, status: 'Siswa', isSelf: true },
    { name: 'Fajar Utama', status: 'Siswa' }
  ];

  return (
    <div className="space-y-6 text-left select-none">
      
      {/* 1. Guru Pengampu card */}
      <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm">
        <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider pb-4 border-b border-slate-100 mb-4 flex items-center gap-1.5">
          <User className="w-4 h-4 text-violet-500" />
          Guru Pengampu
        </h3>
        
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-violet-100 text-violet-700 flex items-center justify-center font-black text-sm shrink-0 shadow-inner">
            {teacher.avatar}
          </div>
          <div>
            <div className="text-xs font-black text-slate-900">
              {teacher.name}
            </div>
            <div className="text-[10px] text-slate-400 font-bold">
              {teacher.role}
            </div>
          </div>
        </div>
      </div>

      {/* 2. Classmates roster card */}
      <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm">
        <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider pb-4 border-b border-slate-100 mb-4 flex items-center gap-1.5">
          <Users className="w-4 h-4 text-violet-500" />
          Daftar Siswa ({classmates.length})
        </h3>
        
        <div className="divide-y divide-slate-100/50">
          {classmates.map((student, idx) => {
            const initials = student.name
              .split(' ')
              .map(n => n[0])
              .join('')
              .substring(0, 2)
              .toUpperCase();

            return (
              <div 
                key={idx}
                className={`flex items-center justify-between py-3 first:pt-0 last:pb-0
                  ${student.isSelf ? 'bg-purple-50/40 -mx-6 px-6 border-y border-purple-100/40' : ''}
                `}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 shadow-inner
                    ${student.isSelf 
                      ? 'bg-violet-650 text-white' 
                      : 'bg-slate-100 text-slate-650'
                    }
                  `}>
                    {initials}
                  </div>
                  <div>
                    <span className={`text-xs tracking-wide
                      ${student.isSelf ? 'font-black text-slate-900' : 'font-bold text-slate-700'}
                    `}>
                      {student.name}
                    </span>
                    {student.isSelf && (
                      <span className="ml-2 px-1.5 py-0.2 bg-violet-600 text-white text-[8px] font-black rounded-md uppercase">
                        Anda
                      </span>
                    )}
                  </div>
                </div>

                <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                  {student.status}
                </span>

              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
};

export default MembersContent;
