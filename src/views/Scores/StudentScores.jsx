import React, { useState, useEffect } from 'react';
import { useNavigate, useOutletContext, useSearchParams } from 'react-router-dom';
import { 
  GraduationCap, 
  ChevronDown, 
  ChevronUp, 
  BookOpen, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  ExternalLink,
  MessageSquare,
  Search,
  User,
  School,
  Calendar,
  X,
  ArrowRight,
  Sparkles,
  HelpCircle,
  FileText,
  Send
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

// Circular Percentage Gauge Component
const CircularGauge = ({ percentage = 75, size = 56, strokeWidth = 5.5, color = '#7047EB' }) => {
  const radius = (size - strokeWidth * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const validPercentage = Math.min(100, Math.max(0, isNaN(percentage) ? 0 : Number(percentage)));
  const offset = circumference - (validPercentage / 100) * circumference;

  return (
    <div className="relative inline-flex items-center justify-center shrink-0" style={{ width: size, height: size }}>
      <svg className="w-full h-full -rotate-90" viewBox={`0 0 ${size} ${size}`}>
        {/* Track Background */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#F3EEFF"
          strokeWidth={strokeWidth}
        />
        {/* Progress Arc */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-700 ease-out"
        />
      </svg>
      <span className="absolute text-[11px] font-black text-slate-800 tracking-tight">
        {validPercentage}%
      </span>
    </div>
  );
};

export const StudentScores = () => {
  const { user } = useAuth();
  const { showToast } = useOutletContext();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Filter Tab: 'all' | 'ongoing' | 'completed'
  const [activeFilter, setActiveFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  
  // Data States
  const [courses, setCourses] = useState([]);
  const [protests, setProtests] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Interaction States
  const [selectedCourseId, setSelectedCourseId] = useState(null);
  const [isGradeScaleOpen, setIsGradeScaleOpen] = useState(false);
  
  // Protest Modal State
  const [isProtestModalOpen, setIsProtestModalOpen] = useState(false);
  const [selectedAssignmentForProtest, setSelectedAssignmentForProtest] = useState('');
  const [requestedGrade, setRequestedGrade] = useState('');
  const [protestReason, setProtestReason] = useState('');
  const [isSubmittingProtest, setIsSubmittingProtest] = useState(false);

  // Sync Search Query from URL Search Params
  useEffect(() => {
    const q = searchParams.get('q');
    if (q !== null && q !== searchQuery) {
      setSearchQuery(q);
    }
  }, [searchParams]);

  // Fetch Scores and Protests
  const fetchScoresData = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const token = localStorage.getItem('token');
      
      const [coursesRes, protestsRes] = await Promise.all([
        fetch('/api/gradebook/student/summary', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/protests/student', { headers: { 'Authorization': `Bearer ${token}` } })
      ]);

      if (!coursesRes.ok) {
        throw new Error('Gagal memuat rekapitulasi nilai.');
      }

      const coursesData = await coursesRes.json();
      setCourses(coursesData);

      if (protestsRes.ok) {
        const protestsData = await protestsRes.json();
        setProtests(protestsData);
      }
      
      setIsLoading(false);
    } catch (err) {
      console.error(err);
      setError(err.message);
      if (showToast) showToast('Gagal memuat data nilai.', 'error');
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchScoresData();
  }, []);

  // Helper: Determine Letter Grade & Score Text
  const getGradeDetails = (averageGrade) => {
    if (averageGrade === '—' || averageGrade === null || averageGrade === undefined || isNaN(averageGrade)) {
      return { letter: 'None', numeric: 75, text: '75 / 100', isAvailable: false };
    }
    const num = Math.round(Number(averageGrade));
    let letter = 'E';
    if (num >= 90) letter = 'A';
    else if (num >= 85) letter = 'A-';
    else if (num >= 80) letter = 'B+';
    else if (num >= 75) letter = 'B';
    else if (num >= 70) letter = 'B-';
    else if (num >= 65) letter = 'C+';
    else if (num >= 60) letter = 'C';
    else if (num >= 50) letter = 'D';

    return { letter, numeric: num, text: `${num} / 100`, isAvailable: true };
  };

  // Helper: Check if course is Completed vs Ongoing
  const isCourseCompleted = (course) => {
    if (!course.assignments || course.assignments.length === 0) {
      return course.averageGrade !== '—' && course.averageGrade !== null;
    }
    const allCompleted = course.assignments.every(a => a.status === 'completed' || a.grade !== null);
    return allCompleted && course.averageGrade !== '—';
  };

  // Filter Courses based on Tab & Search Query
  const filteredCourses = courses.filter(course => {
    const matchesSearch = 
      (course.subject_name && course.subject_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (course.subject_code && course.subject_code.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (course.teacher_name && course.teacher_name.toLowerCase().includes(searchQuery.toLowerCase()));

    if (!matchesSearch) return false;

    const completed = isCourseCompleted(course);
    if (activeFilter === 'ongoing') return !completed;
    if (activeFilter === 'completed') return completed;
    return true; // 'all'
  });

  // Active Selected Course for Right Detail Panel
  const selectedCourse = courses.find(c => String(c.class_subject_id) === String(selectedCourseId)) || null;

  // Grade Scale Reference Categories Data
  const gradeScaleReference = [
    { letter: 'A', range: '90 - 100', bg: 'bg-[#DCFCE7]', text: 'text-[#15803D]', border: 'border-[#BBF7D0]' },
    { letter: 'A-', range: '85 - 89', bg: 'bg-[#EBFBF2]', text: 'text-[#16A34A]', border: 'border-[#BBF7D0]' },
    { letter: 'B+', range: '80 - 84', bg: 'bg-[#E0F2FE]', text: 'text-[#0284C7]', border: 'border-[#BAE6FD]' },
    { letter: 'B', range: '75 - 79', bg: 'bg-[#EBF5FF]', text: 'text-[#2563EB]', border: 'border-[#BFDBFE]' },
    { letter: 'B-', range: '70 - 74', bg: 'bg-[#F0F7FF]', text: 'text-[#3B82F6]', border: 'border-[#DBEAFE]' },
    { letter: 'C+', range: '65 - 69', bg: 'bg-[#FEF9C3]', text: 'text-[#CA8A04]', border: 'border-[#FEF08A]' },
    { letter: 'C', range: '60 - 64', bg: 'bg-[#FFEDD5]', text: 'text-[#EA580C]', border: 'border-[#FED7AA]' },
    { letter: 'D', range: '50 - 59', bg: 'bg-[#FEE2E2]', text: 'text-[#DC2626]', border: 'border-[#FECACA]' },
    { letter: 'E', range: '< 49', bg: 'bg-[#FFE4E6]', text: 'text-[#E11D48]', border: 'border-[#FECDD3]' },
  ];

  // Open Score Protest Modal for the active course
  const handleOpenProtestModal = () => {
    if (!selectedCourse) return;
    const gradedAssignments = selectedCourse.assignments.filter(a => a.grade !== null);
    if (gradedAssignments.length > 0) {
      setSelectedAssignmentForProtest(gradedAssignments[0].id);
    } else if (selectedCourse.assignments.length > 0) {
      setSelectedAssignmentForProtest(selectedCourse.assignments[0].id);
    }
    setRequestedGrade('');
    setProtestReason('');
    setIsProtestModalOpen(true);
  };

  // Submit Protest
  const handleProtestSubmit = async (e) => {
    e.preventDefault();
    if (!selectedAssignmentForProtest || !protestReason || !requestedGrade) {
      if (showToast) showToast('Mohon lengkapi tugas, alasan, dan nilai harapan.', 'warning');
      return;
    }

    try {
      setIsSubmittingProtest(true);
      const token = localStorage.getItem('token');
      
      const targetAssignment = selectedCourse?.assignments.find(a => String(a.id) === String(selectedAssignmentForProtest));

      const response = await fetch('/api/protests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          submissionId: targetAssignment?.submissionId || targetAssignment?.id,
          assignmentId: targetAssignment?.id,
          reason: protestReason,
          requestedGrade: parseInt(requestedGrade, 10)
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Gagal mengirimkan sanggahan nilai.');
      }

      if (showToast) showToast('Sanggahan nilai berhasil dikirimkan!', 'success');
      setIsProtestModalOpen(false);
      setProtestReason('');
      setRequestedGrade('');
      await fetchScoresData();
    } catch (err) {
      if (showToast) showToast(err.message, 'error');
    } finally {
      setIsSubmittingProtest(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6 text-left select-none animate-pulse w-full">
        <div className="flex gap-3">
          {[1, 2, 3].map(idx => (
            <div key={idx} className="h-8 w-24 bg-slate-200 rounded-full" />
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map(idx => (
            <div key={idx} className="h-48 bg-white border border-slate-100 rounded-2xl p-5 shadow-sm" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-700 text-xs font-semibold select-none text-left w-full">
        <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
        <div>
          <p className="font-bold">Gagal memuat rekapitulasi nilai</p>
          <p className="text-red-600 font-medium mt-0.5">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full text-left select-none relative">
      
      {/* 1. Filter Pills Row & Mobile Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => setActiveFilter('all')}
            className={`px-5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer shadow-sm
              ${activeFilter === 'all'
                ? 'bg-[#7047EB] text-white shadow-purple-500/20'
                : 'border border-[#7047EB] text-[#7047EB] bg-white hover:bg-purple-50/50'
              }
            `}
          >
            All
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter('ongoing')}
            className={`px-5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer shadow-sm
              ${activeFilter === 'ongoing'
                ? 'bg-[#7047EB] text-white shadow-purple-500/20'
                : 'border border-[#7047EB] text-[#7047EB] bg-white hover:bg-purple-50/50'
              }
            `}
          >
            Ongoing
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter('completed')}
            className={`px-5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer shadow-sm
              ${activeFilter === 'completed'
                ? 'bg-[#7047EB] text-white shadow-purple-500/20'
                : 'border border-[#7047EB] text-[#7047EB] bg-white hover:bg-purple-50/50'
              }
            `}
          >
            Completed
          </button>
        </div>

        {/* Search Input for Mobile View */}
        <div className="relative md:hidden w-full">
          <Search className="w-4 h-4 text-[#7047EB] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setSearchParams(e.target.value ? { q: e.target.value } : {});
            }}
            placeholder="Cari mata pelajaran..."
            className="w-full bg-[#F1EEFF] text-slate-800 text-xs font-medium pl-10 pr-4 py-2 rounded-full focus:outline-none focus:ring-1 focus:ring-purple-400 placeholder:text-slate-400"
          />
        </div>
      </div>

      {/* 2. Main Content Layout: Grid + Right Detail Panel */}
      <div className={`grid gap-6 transition-all duration-300 ${selectedCourse ? 'grid-cols-1 lg:grid-cols-12' : 'grid-cols-1'}`}>
        
        {/* Left Side: Cards Grid + Bottom Grade Scale Reference */}
        <div className={`space-y-6 ${selectedCourse ? 'lg:col-span-8' : 'w-full'}`}>
          
          {filteredCourses.length === 0 ? (
            <div className="py-20 flex flex-col items-center justify-center text-center bg-white border border-slate-100 rounded-2xl p-6 shadow-sm">
              <BookOpen className="w-10 h-10 text-slate-300 mb-3" />
              <h3 className="text-sm font-bold text-slate-800">
                Tidak ada data nilai ditemukan.
              </h3>
              <p className="text-xs text-slate-400 font-medium mt-1 max-w-sm leading-relaxed">
                {searchQuery 
                  ? `Tidak ada hasil pencarian untuk "${searchQuery}". Coba kata kunci lain.` 
                  : 'Belum ada mata pelajaran terdaftar pada kategori ini.'}
              </p>
            </div>
          ) : (
            <div className={`grid gap-5 ${selectedCourse ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'}`}>
              {filteredCourses.map((course) => {
                const completed = isCourseCompleted(course);
                const gradeInfo = getGradeDetails(course.averageGrade);
                const isSelected = selectedCourseId === course.class_subject_id;
                const percentageVal = gradeInfo.isAvailable ? gradeInfo.numeric : 75;

                return (
                  <div
                    key={course.class_subject_id}
                    onClick={() => setSelectedCourseId(course.class_subject_id)}
                    className={`bg-white rounded-2xl p-5 shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer group relative flex flex-col justify-between
                      ${isSelected 
                        ? 'border-2 border-[#7047EB] ring-4 ring-purple-100/50 shadow-purple-100' 
                        : 'border border-slate-100 hover:border-purple-200'
                      }
                    `}
                  >
                    {/* Top Row: Status Badge & Illustration Badge */}
                    <div>
                      <div className="flex items-start justify-between">
                        <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full
                          ${completed 
                            ? 'bg-[#EBFBF2] text-[#059669]' 
                            : 'bg-[#EDE9FE] text-[#7047EB]'
                          }
                        `}>
                          {completed ? 'Completed' : 'Ongoing'}
                        </span>

                        {/* Subject Graphic Illustration Badge */}
                        <div className="w-9 h-9 rounded-xl bg-[#F5F2FF] flex items-center justify-center shrink-0 text-[#7047EB] shadow-inner -mt-1 -mr-1">
                          <svg className="w-5 h-5" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <rect x="4" y="6" width="20" height="22" rx="4" fill="#7047EB" fillOpacity="0.85" />
                            <rect x="8" y="3" width="12" height="5" rx="2" fill="#5C36DB" />
                            <path d="M10 14C12 14 12 20 14 20M10 17H14M16 14L20 20M20 14L16 20" stroke="white" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </div>
                      </div>

                      {/* Subject Name & Teacher */}
                      <div className="mt-1 pr-2">
                        <h3 className="text-sm font-bold text-slate-900 group-hover:text-[#7047EB] transition-colors truncate">
                          {course.subject_name}
                        </h3>
                        <p className="text-[11px] text-slate-400 font-medium mt-0.5 truncate">
                          {course.teacher_name || 'Guru Pengampu'}
                        </p>
                      </div>

                      {/* Middle Row: Circular Gauge & Letter Grade / Score */}
                      <div className="flex items-center gap-5 mt-4 py-1">
                        <CircularGauge 
                          percentage={percentageVal} 
                          size={54} 
                          strokeWidth={5} 
                          color={completed ? '#10B981' : '#7047EB'} 
                        />

                        <div className="space-y-0.5">
                          <span className="text-sm font-black text-slate-900 block leading-tight">
                            {gradeInfo.letter}
                          </span>
                          <span className="text-xs font-semibold text-slate-400 block">
                            {gradeInfo.text}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Bottom Row: View Detail Action Link */}
                    <div className="border-t border-slate-50 pt-3 mt-4 flex items-center justify-end">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedCourseId(course.class_subject_id);
                        }}
                        className="text-[11px] font-bold text-[#7047EB] hover:text-[#5833c9] flex items-center gap-1 group-hover:underline cursor-pointer"
                      >
                        <span>View Detail</span>
                        <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                      </button>
                    </div>

                  </div>
                );
              })}
            </div>
          )}

          {/* 3. Grade Scale Reference Collapsible Accordion Box */}
          <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden transition-all duration-200">
            {/* Header Accordion Bar */}
            <button
              type="button"
              onClick={() => setIsGradeScaleOpen(!isGradeScaleOpen)}
              className="w-full p-4.5 px-6 flex items-center justify-between text-left hover:bg-slate-50/50 transition-colors cursor-pointer select-none"
            >
              <span className="text-xs font-black text-slate-800 tracking-tight">
                Grade Scale Reference
              </span>
              <div className="w-6 h-6 rounded-full bg-slate-50 flex items-center justify-center text-slate-400">
                {isGradeScaleOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </div>
            </button>

            {/* Expanded Content */}
            {isGradeScaleOpen && (
              <div className="p-6 pt-2 border-t border-slate-50 bg-white">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 gap-3">
                  {gradeScaleReference.map((item) => (
                    <div
                      key={item.letter}
                      className={`p-3 rounded-xl border ${item.bg} ${item.border} flex items-center justify-between font-bold text-xs shadow-xs transition-transform hover:scale-[1.02]`}
                    >
                      <span className={`text-sm font-black ${item.text}`}>{item.letter}</span>
                      <span className={`text-xs font-extrabold ${item.text}`}>{item.range}</span>
                    </div>
                  ))}
                </div>

                <p className="text-[11px] text-slate-400 font-semibold text-center mt-4">
                  Final score is calculated automatically by the system.
                </p>
              </div>
            )}
          </div>

          {!isGradeScaleOpen && (
            <p className="text-[11px] text-slate-400 font-semibold text-center select-none pt-2">
              Final score is calculated automatically by the system.
            </p>
          )}

        </div>

        {/* Right Side: Selected Course Detail Panel */}
        {selectedCourse && (
          <div className="lg:col-span-4 bg-white border border-slate-100 rounded-2xl p-6 shadow-sm flex flex-col justify-between space-y-6 relative animate-in fade-in slide-in-from-right-2 duration-200">
            
            <div className="space-y-6">
              {/* Header: Close Button & Status Badge */}
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setSelectedCourseId(null)}
                  className="w-8 h-8 rounded-full bg-slate-50 hover:bg-slate-100 flex items-center justify-center text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                  title="Tutup Detail"
                >
                  <X className="w-4 h-4" />
                </button>

                <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full
                  ${isCourseCompleted(selectedCourse) 
                    ? 'bg-[#EBFBF2] text-[#059669]' 
                    : 'bg-[#EDE9FE] text-[#7047EB]'
                  }
                `}>
                  {isCourseCompleted(selectedCourse) ? 'Completed' : 'Ongoing'}
                </span>
              </div>

              {/* Subject Title & Gauge Card */}
              <div>
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-lg font-black text-slate-900 tracking-tight">
                      {selectedCourse.subject_name}
                    </h3>
                    <p className="text-xs font-semibold text-[#7047EB] mt-0.5">
                      {selectedCourse.subject_code}
                    </p>
                  </div>

                  {/* Graphic Illustration */}
                  <div className="w-12 h-12 rounded-2xl bg-[#F5F2FF] flex items-center justify-center shrink-0 text-[#7047EB] shadow-inner">
                    <svg className="w-7 h-7" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <rect x="4" y="6" width="20" height="22" rx="4" fill="#7047EB" fillOpacity="0.85" />
                      <rect x="8" y="3" width="12" height="5" rx="2" fill="#5C36DB" />
                      <path d="M10 14C12 14 12 20 14 20M10 17H14M16 14L20 20M20 14L16 20" stroke="white" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                </div>

                {/* Circular Gauge and Score */}
                <div className="flex items-center gap-5 mt-4 p-3 bg-slate-50/60 rounded-xl border border-slate-100/60">
                  <CircularGauge 
                    percentage={getGradeDetails(selectedCourse.averageGrade).isAvailable ? getGradeDetails(selectedCourse.averageGrade).numeric : 75} 
                    size={56} 
                    strokeWidth={5.5} 
                    color={isCourseCompleted(selectedCourse) ? '#10B981' : '#7047EB'} 
                  />

                  <div className="space-y-0.5">
                    <span className="text-base font-black text-slate-900 block leading-tight">
                      {getGradeDetails(selectedCourse.averageGrade).letter}
                    </span>
                    <span className="text-xs font-semibold text-slate-400 block">
                      {getGradeDetails(selectedCourse.averageGrade).text}
                    </span>
                  </div>
                </div>
              </div>

              {/* Course Meta Info */}
              <div className="space-y-2.5 text-xs font-semibold text-slate-600 bg-slate-50/50 p-4 rounded-xl border border-slate-100">
                <div className="flex items-center gap-2.5">
                  <User className="w-4 h-4 text-slate-400 shrink-0" />
                  <span className="text-slate-400 font-medium">Teacher:</span>
                  <span className="font-bold text-slate-800 truncate">{selectedCourse.teacher_name || 'Guru Pengampu'}</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <School className="w-4 h-4 text-slate-400 shrink-0" />
                  <span className="text-slate-400 font-medium">Class:</span>
                  <span className="font-bold text-slate-800">{user?.grade_level || 'XII IPA 2'}</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
                  <span className="text-slate-400 font-medium">Semester:</span>
                  <span className="font-bold text-slate-800">Odd Semester 2025/2026</span>
                </div>
              </div>

              {/* Score Overview List */}
              <div className="space-y-3">
                <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">
                  Score Overview
                </h4>

                <div className="space-y-2 text-xs">
                  {/* Assessment Summary / Individual Items */}
                  {selectedCourse.assignments && selectedCourse.assignments.length > 0 ? (
                    selectedCourse.assignments.map((assignment) => (
                      <div 
                        key={assignment.id}
                        onClick={() => navigate(`/assignment/${assignment.id}`)}
                        className="p-3 bg-white border border-slate-100 hover:border-purple-200 rounded-xl flex items-center justify-between transition-colors cursor-pointer group shadow-xs"
                      >
                        <div className="min-w-0 pr-2">
                          <p className="font-bold text-slate-800 group-hover:text-[#7047EB] transition-colors truncate">
                            {assignment.title}
                          </p>
                          <span className="text-[10px] text-slate-400 font-medium">
                            Bobot: {assignment.weight}%
                          </span>
                        </div>

                        <div className="text-right shrink-0">
                          {assignment.grade !== null ? (
                            <span className="text-xs font-black text-slate-900 bg-purple-50 px-2 py-0.5 rounded-lg text-[#7047EB]">
                              {assignment.grade}
                            </span>
                          ) : (
                            <span className="text-xs font-bold text-slate-400">—</span>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="py-4 text-center text-xs text-slate-400 font-medium bg-slate-50 rounded-xl">
                      Belum ada tugas atau ujian untuk kelas ini.
                    </div>
                  )}
                </div>
              </div>

            </div>

            {/* Red Score Protest Button */}
            <div className="pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={handleOpenProtestModal}
                className="w-full py-3 bg-[#E11D48] hover:bg-[#BE123C] active:scale-[0.99] text-white text-xs font-black rounded-xl transition-all shadow-md shadow-red-500/20 flex items-center justify-center gap-2 cursor-pointer"
              >
                <MessageSquare className="w-4 h-4" />
                <span>Score Protest</span>
              </button>
            </div>

          </div>
        )}

      </div>

      {/* 4. Score Protest Modal */}
      {isProtestModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs select-none animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl border border-slate-100 space-y-5 text-left relative animate-in zoom-in-95 duration-200">
            
            {/* Modal Header */}
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[10px] font-black tracking-wider uppercase bg-red-50 text-red-600 px-2.5 py-1 rounded-lg">
                  Pengajuan Sanggahan
                </span>
                <h3 className="text-lg font-black text-slate-900 mt-2">
                  Formulir Sanggahan Nilai
                </h3>
                <p className="text-xs text-slate-400 font-medium mt-0.5">
                  Pilih tugas dan sampaikan alasan sanggahan nilai kepada guru pengampu.
                </p>
              </div>

              <button
                onClick={() => setIsProtestModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-50 hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleProtestSubmit} className="space-y-4 text-xs font-semibold">
              
              {/* Select Assignment */}
              <div className="space-y-1.5">
                <label className="text-slate-700 font-bold block">
                  Pilih Tugas / Ujian
                </label>
                <select
                  value={selectedAssignmentForProtest}
                  onChange={(e) => setSelectedAssignmentForProtest(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-[#7047EB] focus:border-transparent transition-all"
                  required
                >
                  {selectedCourse?.assignments?.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.title} {a.grade !== null ? `(Nilai Saat Ini: ${a.grade})` : '(Belum dinilai)'}
                    </option>
                  ))}
                </select>
              </div>

              {/* Requested Score */}
              <div className="space-y-1.5">
                <label className="text-slate-700 font-bold block">
                  Harapan Nilai (Skala 0 - 100)
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={requestedGrade}
                  onChange={(e) => setRequestedGrade(e.target.value)}
                  placeholder="Contoh: 85"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-[#7047EB] focus:border-transparent transition-all"
                  required
                />
              </div>

              {/* Protest Reason */}
              <div className="space-y-1.5">
                <label className="text-slate-700 font-bold block">
                  Alasan Keberatan / Penjelasan
                </label>
                <textarea
                  rows="4"
                  value={protestReason}
                  onChange={(e) => setProtestReason(e.target.value)}
                  placeholder="Jelaskan secara sopan bagian mana yang Anda rasa perlu ditinjau ulang oleh guru..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-[#7047EB] focus:border-transparent transition-all placeholder:text-slate-400"
                  required
                />
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsProtestModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-700 hover:bg-slate-50 rounded-xl transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingProtest}
                  className="px-5 py-2.5 bg-[#E11D48] hover:bg-[#BE123C] active:scale-95 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-red-500/20 flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isSubmittingProtest ? (
                    <span>Mengirimkan...</span>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      <span>Kirim Sanggahan</span>
                    </>
                  )}
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

    </div>
  );
};

export default StudentScores;
