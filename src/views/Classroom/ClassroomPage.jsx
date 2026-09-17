import React, { useState, useEffect } from 'react';
import { useOutletContext, useParams, useNavigate, useLocation } from 'react-router-dom';
import ClassroomHeader from './components/ClassroomHeader';
import ClassroomTabs from './components/ClassroomTabs';
import MaterialContent from './components/MaterialContent';
import AssignmentContent from './components/AssignmentContent';
import MembersContent from './components/MembersContent';
import AttendanceContent from './components/AttendanceContent';
import MyCoursesCatalog from './components/MyCoursesCatalog';
import { BookOpen, ChevronLeft } from 'lucide-react';

export const ClassroomPage = () => {
  const { showToast } = useOutletContext();
  const { courseId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  // Initialize active tab from location state if navigation passed it (e.g. from dashboard click)
  const [activeTab, setActiveTab] = useState(location.state?.activeTab || 'materi');
  const [courses, setCourses] = useState([]);
  const [activeCourse, setActiveCourse] = useState(null);
  const [materials, setMaterials] = useState([]);
  const [assignments, setAssignments] = useState([]);
  
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // 1. Fetch all enrolled courses first
  useEffect(() => {
    let isMounted = true;
    const fetchCourses = async () => {
      try {
        setIsLoading(true);
        const token = localStorage.getItem('token');
        const response = await fetch('/api/courses', {
          headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
          throw new Error('Gagal memuat daftar mata pelajaran.');
        }

        const data = await response.json();
        if (isMounted) {
          setCourses(data);
          setIsLoading(false);
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message);
          setIsLoading(false);
        }
      }
    };

    fetchCourses();
    return () => {
      isMounted = false;
    };
  }, []);

  // 2. Fetch materials and assignments when courseId changes
  useEffect(() => {
    if (!courseId) return;

    let isMounted = true;
    const fetchCourseDetails = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const token = localStorage.getItem('token');
        
        // Fetch course info, materials, and assignments in parallel
        const [courseRes, materialsRes, assignmentsRes] = await Promise.all([
          fetch(`/api/courses/${courseId}`, { headers: { 'Authorization': `Bearer ${token}` } }),
          fetch(`/api/courses/${courseId}/materials`, { headers: { 'Authorization': `Bearer ${token}` } }),
          fetch(`/api/courses/${courseId}/assignments`, { headers: { 'Authorization': `Bearer ${token}` } })
        ]);

        if (!courseRes.ok || !materialsRes.ok || !assignmentsRes.ok) {
          throw new Error('Gagal mengambil data detail kelas.');
        }

        const courseData = await courseRes.json();
        const materialsData = await materialsRes.json();
        const assignmentsData = await assignmentsRes.json();

        if (isMounted) {
          setActiveCourse({
            id: courseData.id,
            name: courseData.name,
            code: courseData.code,
            className: courseData.grade_level || 'Umum',
            teacherId: courseData.teacher_id
          });
          setMaterials(materialsData);
          setAssignments(assignmentsData);
          setIsLoading(false);
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message);
          setIsLoading(false);
        }
      }
    };

    fetchCourseDetails();
    return () => {
      isMounted = false;
    };
  }, [courseId]);

  if (isLoading) {
    return (
      <div className="space-y-6 text-left animate-pulse select-none w-full">
        <div className="h-8 bg-slate-200 rounded w-1/4"></div>
        <div className="h-32 bg-white border border-slate-100 rounded-3xl"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-5 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-700 text-xs font-semibold select-none text-left w-full">
        <div>
          <p className="font-bold">Terjadi Kesalahan</p>
          <p className="text-red-650 font-medium mt-0.5">{error}</p>
        </div>
      </div>
    );
  }

  if (courses.length === 0) {
    return (
      <div className="py-20 flex flex-col items-center justify-center text-center bg-white border border-slate-100 rounded-2xl p-6 shadow-sm select-none w-full">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-12 h-12 text-slate-400 mb-3">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
        </svg>
        <p className="text-sm font-black text-slate-900">
          Belum ada mata pelajaran terdaftar.
        </p>
        <p className="text-xs text-slate-400 font-bold mt-1 max-w-sm leading-relaxed">
          Hubungi wali kelas atau guru pengajar Anda untuk mendaftarkan Anda ke kelas virtual.
        </p>
      </div>
    );
  }

  // Format dataset structures into components parameters
  const formattedSections = [
    {
      id: 'section-main',
      title: 'Materi & Penugasan Pelajaran',
      desc: 'Berikut adalah materi ajar dan tugas aktif untuk kelas ini.',
      date: 'Aktif',
      materials: materials,
      assignments: assignments
    }
  ];

  // Render view panel dynamically depending on active tab ID
  const renderTabContent = () => {
    switch (activeTab) {
      case 'materi':
        return <MaterialContent sections={formattedSections} showToast={showToast} />;
      case 'tugas':
        return <AssignmentContent sections={formattedSections} showToast={showToast} />;
      case 'presensi':
        return <AttendanceContent courseId={courseId} showToast={showToast} />;
      case 'anggota':
        return <MembersContent courseId={courseId} />;
      default:
        return <MaterialContent sections={formattedSections} showToast={showToast} />;
    }
  };

  // If no specific course selected, render My Courses Catalog Grid
  if (!courseId) {
    return (
      <MyCoursesCatalog 
        courses={courses} 
        isLoading={isLoading} 
        error={error} 
      />
    );
  }

  return (
    <div className="space-y-6 w-full">
      {/* Subject Capsule Switcher Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/classroom')}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-[#7047EB] bg-purple-50 hover:bg-purple-100/80 rounded-xl transition-colors cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Semua Kelas</span>
          </button>

          <div className="flex gap-2 p-1 bg-slate-100/80 rounded-xl border border-slate-200/20 select-none overflow-x-auto">
            {courses.map((course) => {
              const isSelected = String(course.id) === String(courseId);
              return (
                <button
                  key={course.id}
                  onClick={() => navigate(`/classroom/${course.id}`)}
                  className={`px-3.5 py-1.5 text-xs font-black rounded-lg transition-all cursor-pointer focus:outline-none shrink-0
                    ${isSelected
                      ? 'bg-[#7047EB] text-white shadow-sm'
                      : 'text-slate-650 hover:text-slate-900'
                    }
                  `}
                >
                  {course.name}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 1. Classroom Top Banner */}
      {activeCourse && <ClassroomHeader course={activeCourse} />}

      {/* 2. Horizontal Navigation Tabs */}
      <ClassroomTabs activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* 3. Render View Panel Content */}
      <div className="pt-2">
        {renderTabContent()}
      </div>
    </div>
  );
};

export default ClassroomPage;
