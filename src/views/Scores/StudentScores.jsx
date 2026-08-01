import React, { useState, useEffect } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { 
  GraduationCap, 
  Inbox, 
  ChevronDown, 
  ChevronUp, 
  BookOpen, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  ExternalLink,
  MessageSquare
} from 'lucide-react';

export const StudentScores = () => {
  const { showToast } = useOutletContext();
  const navigate = useNavigate();
  
  const [activeTab, setActiveTab] = useState('summary');
  const [courses, setCourses] = useState([]);
  const [protests, setProtests] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedCourseId, setExpandedCourseId] = useState(null);

  const fetchScoresData = async () => {
    try {
      setIsLoading(true);
      const token = localStorage.getItem('token');
      
      const [coursesRes, protestsRes] = await Promise.all([
        fetch('/api/gradebook/student/summary', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/protests/student', { headers: { 'Authorization': `Bearer ${token}` } })
      ]);

      if (coursesRes.ok) {
        setCourses(await coursesRes.json());
      }
      if (protestsRes.ok) {
        setProtests(await protestsRes.json());
      }
      
      setIsLoading(false);
    } catch (err) {
      console.error(err);
      showToast('Gagal memuat rekapitulasi nilai.', 'error');
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchScoresData();
  }, []);

  const toggleExpand = (courseId) => {
    setExpandedCourseId(prev => prev === courseId ? null : courseId);
  };

  if (isLoading) {
    return (
      <div className="space-y-6 text-left animate-pulse select-none w-full">
        <div className="h-8 bg-slate-200 rounded w-1/4"></div>
        <div className="h-32 bg-white border border-slate-100 rounded-3xl"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full text-left">
      
      {/* 1. Header Welcome */}
      <div className="space-y-1 select-none">
        <span className="px-2.5 py-1 bg-purple-100 text-[#7047EB] text-xs font-black rounded-lg uppercase">
          Portal Akademik
        </span>
        <h1 className="text-3xl font-black text-slate-900 tracking-tight leading-tight mt-2">
          Nilai & Sanggahan (Scores)
        </h1>
        <p className="text-sm text-slate-500 font-medium">
          Tinjau performa akademik Anda per-mata pelajaran dan ajukan banding atas nilai tugas Anda jika diperlukan.
        </p>
      </div>

      {/* 2. Navigation Tabs */}
      <div className="border-b border-slate-100 flex gap-6 select-none">
        <button
          onClick={() => setActiveTab('summary')}
          className={`pb-3 text-sm font-black transition-all flex items-center gap-2 border-b-2 focus:outline-none cursor-pointer
            ${activeTab === 'summary' 
              ? 'border-[#7047EB] text-[#7047EB]' 
              : 'border-transparent text-slate-400 hover:text-slate-600'
            }
          `}
        >
          <GraduationCap className="w-4 h-4" />
          Buku Nilai Saya
        </button>

        <button
          onClick={() => setActiveTab('protests')}
          className={`pb-3 text-sm font-black transition-all flex items-center gap-2 border-b-2 focus:outline-none cursor-pointer relative
            ${activeTab === 'protests' 
              ? 'border-[#7047EB] text-[#7047EB]' 
              : 'border-transparent text-slate-400 hover:text-slate-600'
            }
          `}
        >
          <Inbox className="w-4 h-4" />
          Kotak Sanggahan Saya
          {protests.filter(p => p.status === 'Pending').length > 0 && (
            <span className="ml-1.5 bg-amber-500 text-white font-black text-[9px] w-4.5 h-4.5 rounded-full flex items-center justify-center animate-pulse">
              {protests.filter(p => p.status === 'Pending').length}
            </span>
          )}
        </button>
      </div>

      {/* 3. Tab Contents */}
      <div className="pt-2">
        
        {/* Tab 1: Subject Summary Accordions */}
        {activeTab === 'summary' && (
          <div className="space-y-4">
            {courses.length === 0 ? (
              <div className="py-12 text-center bg-white border border-slate-100 rounded-3xl select-none">
                <p className="text-xs font-semibold text-slate-400">Anda belum terdaftar di kelas pelajaran apa pun.</p>
              </div>
            ) : (
              courses.map(course => {
                const isExpanded = expandedCourseId === course.class_subject_id;
                const isBelowKkm = course.averageGrade !== '—' && course.averageGrade < 70;
                
                return (
                  <div 
                    key={course.class_subject_id}
                    className="bg-white border border-slate-100 rounded-2xl overflow-hidden shadow-sm transition-all hover:border-slate-200"
                  >
                    {/* Header Row (Accordion Clickable) */}
                    <div 
                      onClick={() => toggleExpand(course.class_subject_id)}
                      className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer select-none"
                    >
                      <div className="flex items-center gap-3.5 text-left min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-purple-50 text-[#7047EB] flex items-center justify-center font-black text-sm shrink-0">
                          {course.subject_code.substring(0, 3)}
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-xs font-black text-slate-805 truncate">{course.subject_name}</h4>
                          <p className="text-[10px] text-slate-400 font-bold mt-0.5">Pengampu: {course.teacher_name || '—'}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3.5 self-start sm:self-center">
                        <div className="text-right">
                          <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Rerata Nilai</span>
                          <span className={`text-base font-black mt-0.5 inline-block px-2 py-0.5 rounded-lg
                            ${isBelowKkm 
                              ? 'bg-red-50 text-red-650' 
                              : course.averageGrade === '—' ? 'bg-slate-50 text-slate-400' : 'bg-emerald-50 text-emerald-650'
                            }
                          `}>
                            {course.averageGrade}
                          </span>
                        </div>
                        
                        {isExpanded ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
                      </div>
                    </div>

                    {/* KKM warning alert */}
                    {isExpanded && isBelowKkm && (
                      <div className="mx-5 mb-4 p-3 bg-red-50/70 border border-red-100 rounded-xl flex items-center gap-2.5 text-red-700 text-[11px] font-semibold text-left select-none animate-in fade-in slide-in-from-top-1 duration-150">
                        <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                        <span>Rata-rata nilai Anda saat ini di bawah batas KKM (70). Kami merekomendasikan untuk mengikuti remedial atau berdiskusi dengan guru.</span>
                      </div>
                    )}

                    {/* Accordion Child: Assignments Grade List */}
                    {isExpanded && (
                      <div className="border-t border-slate-50 p-5 bg-slate-50/10 text-left">
                        {course.assignments.length === 0 ? (
                          <p className="text-xs text-slate-400 font-bold italic py-2">Belum ada tugas pelajaran yang diterbitkan.</p>
                        ) : (
                          <div className="overflow-x-auto">
                            <table className="w-full text-xs font-medium text-slate-650">
                              <thead>
                                <tr className="border-b border-slate-100 text-slate-400 font-extrabold text-left">
                                  <th className="pb-2 font-black text-[10px] uppercase">Nama Tugas</th>
                                  <th className="pb-2 font-black text-[10px] uppercase">Batas Waktu</th>
                                  <th className="pb-2 font-black text-[10px] uppercase">Bobot</th>
                                  <th className="pb-2 font-black text-[10px] uppercase text-center">Status</th>
                                  <th className="pb-2 font-black text-[10px] uppercase text-center">Nilai Tugas</th>
                                  <th className="pb-2 text-right font-black text-[10px] uppercase">Aksi</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-50">
                                {course.assignments.map((item) => {
                                  const isGraded = item.grade !== null;
                                  return (
                                    <tr key={item.id} className="hover:bg-slate-50/30 transition-colors">
                                      <td className="py-3 font-extrabold text-slate-805">{item.title}</td>
                                      <td className="py-3 text-slate-450 font-semibold">{new Date(item.deadline).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}</td>
                                      <td className="py-3 text-slate-500 font-semibold">{item.weight}%</td>
                                      
                                      <td className="py-3 text-center">
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase
                                          ${item.status === 'completed' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}
                                        `}>
                                          {item.status === 'completed' ? 'Terkumpul' : 'Menunggu'}
                                        </span>
                                      </td>

                                      <td className="py-3 text-center font-black text-slate-800">
                                        {isGraded ? (
                                          <span className={`px-2 py-0.5 rounded-lg ${item.grade < 70 ? 'bg-red-50 text-red-650' : 'bg-slate-50'}`}>
                                            {item.grade}
                                          </span>
                                        ) : (
                                          <span className="text-slate-400 font-semibold">—</span>
                                        )}
                                      </td>

                                      <td className="py-3 text-right">
                                        {isGraded ? (
                                          <button
                                            onClick={() => navigate(`/assignment/${item.id}`)}
                                            className="px-2.5 py-1 bg-slate-50 hover:bg-[#7047EB] hover:text-white border border-slate-200/60 hover:border-transparent text-[10px] font-black rounded-lg cursor-pointer transition-all inline-flex items-center gap-1"
                                          >
                                            {item.protestStatus ? `Sanggahan ${item.protestStatus}` : 'Tinjau / Sanggah'}
                                            <ExternalLink className="w-3 h-3" />
                                          </button>
                                        ) : (
                                          <button
                                            onClick={() => navigate(`/assignment/${item.id}`)}
                                            className="px-2.5 py-1 bg-[#7047EB] hover:bg-[#5b35d5] text-white text-[10px] font-black rounded-lg cursor-pointer transition-colors"
                                          >
                                            Buka Tugas
                                          </button>
                                        )}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* Tab 2: Protests List History */}
        {activeTab === 'protests' && (
          <div className="space-y-4 text-left">
            {protests.length === 0 ? (
              <div className="py-12 text-center bg-white border border-slate-100 rounded-3xl select-none">
                <p className="text-xs font-semibold text-slate-400">Anda belum pernah mengajukan sanggahan nilai apa pun.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {protests.map(protest => (
                  <div 
                    key={protest.id}
                    className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm space-y-4 hover:shadow-md transition-shadow relative overflow-hidden text-left"
                  >
                    {/* Status corner badge */}
                    <span className={`absolute top-0 right-0 px-3.5 py-1 text-[9px] font-black uppercase rounded-bl-xl
                      ${protest.status === 'Pending' ? 'bg-amber-100 text-amber-700 animate-pulse' : protest.status === 'Disetujui' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}
                    `}>
                      {protest.status}
                    </span>

                    <div className="space-y-1">
                      <h4 className="text-xs font-black text-slate-805 pr-14 leading-tight">{protest.assignment_title}</h4>
                      <p className="text-[10px] text-slate-400 font-bold">Diajukan: {new Date(protest.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-4 bg-slate-50/50 border border-slate-100 rounded-xl p-3 select-none text-[11px] font-bold text-slate-500">
                      <div>
                        <span>Nilai Awal</span>
                        <span className="block text-slate-700 text-sm font-black mt-0.5">{protest.original_grade} / 100</span>
                      </div>
                      <div>
                        <span>Harapan Nilai</span>
                        <span className="block text-[#7047EB] text-sm font-black mt-0.5">{protest.requested_grade} / 100</span>
                      </div>
                    </div>

                    <div className="space-y-1 text-xs">
                      <span className="text-[10px] text-slate-400 font-black block uppercase tracking-wider select-none">Alasan Keberatan Anda</span>
                      <p className="text-slate-600 font-semibold leading-relaxed bg-slate-50/30 p-2.5 rounded-lg border border-slate-100/50">
                        "{protest.reason}"
                      </p>
                    </div>

                    {/* Teacher feedback box if processed */}
                    {protest.teacher_feedback && (
                      <div className="space-y-1 text-xs border-t border-dashed border-slate-100 pt-3">
                        <span className="text-[10px] text-slate-400 font-black block uppercase tracking-wider select-none flex items-center gap-1">
                          <MessageSquare className="w-3.5 h-3.5 text-[#7047EB]" />
                          Umpan Balik Guru
                        </span>
                        <p className="text-slate-700 font-semibold italic bg-purple-50/30 p-2.5 rounded-lg border border-purple-100/20 leading-relaxed">
                          "{protest.teacher_feedback}"
                        </p>
                      </div>
                    )}

                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </div>

    </div>
  );
};

export default StudentScores;
