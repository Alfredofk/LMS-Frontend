import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { User, Users } from 'lucide-react';

export const MembersContent = ({ courseId }) => {
  const { user } = useAuth();
  
  const [teacher, setTeacher] = useState(null);
  const [classmates, setClassmates] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!courseId) return;

    let isMounted = true;
    const fetchMembers = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/courses/${courseId}/members`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
          throw new Error('Gagal mengambil daftar anggota kelas.');
        }

        const data = await response.json();
        if (isMounted) {
          setTeacher(data.teacher);
          setClassmates(data.classmates);
          setIsLoading(false);
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message);
          setIsLoading(false);
        }
      }
    };

    fetchMembers();
    return () => {
      isMounted = false;
    };
  }, [courseId]);

  if (isLoading) {
    return (
      <div className="space-y-6 text-left animate-pulse select-none w-full">
        <div className="bg-white border border-slate-100 rounded-2xl p-6 h-28"></div>
        <div className="bg-white border border-slate-100 rounded-2xl p-6 h-48"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-100 text-red-700 text-xs font-semibold rounded-2xl w-full">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-6 text-left select-none w-full">
      
      {/* 1. Guru Pengampu card */}
      {teacher && (
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
                {teacher.role} · NIP. {teacher.nip}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. Classmates roster card */}
      <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm">
        <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider pb-4 border-b border-slate-100 mb-4 flex items-center gap-1.5">
          <Users className="w-4 h-4 text-violet-500" />
          Daftar Siswa ({classmates.length})
        </h3>
        
        {classmates.length === 0 ? (
          <p className="text-xs font-bold text-slate-400 py-2">Belum ada siswa terdaftar di mata pelajaran ini.</p>
        ) : (
          <div className="divide-y divide-slate-100/50">
            {classmates.map((student) => {
              const isSelf = student.id === user?.id;
              const initials = student.name
                .split(' ')
                .map(n => n[0])
                .join('')
                .substring(0, 2)
                .toUpperCase();

              return (
                <div 
                  key={student.id}
                  className={`flex items-center justify-between py-3 first:pt-0 last:pb-0
                    ${isSelf ? 'bg-purple-50/40 -mx-6 px-6 border-y border-purple-100/40' : ''}
                  `}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 shadow-inner
                      ${isSelf 
                        ? 'bg-violet-650 text-white' 
                        : 'bg-slate-100 text-slate-650'
                      }
                    `}>
                      {initials}
                    </div>
                    <div>
                      <span className={`text-xs tracking-wide
                        ${isSelf ? 'font-black text-slate-900' : 'font-bold text-slate-700'}
                      `}>
                        {student.name}
                      </span>
                      {isSelf && (
                        <span className="ml-2 px-1.5 py-0.2 bg-violet-650 text-white text-[8px] font-black rounded-md uppercase">
                          Anda
                        </span>
                      )}
                      <div className="text-[9px] text-slate-400 font-semibold mt-0.5">
                        NIS: {student.nis || '—'} · {student.email}
                      </div>
                    </div>
                  </div>

                  <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                    {student.status}
                  </span>

                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
};

export default MembersContent;
