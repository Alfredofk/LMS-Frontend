import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useOutletContext } from 'react-router-dom';
import { 
  ArrowLeft, 
  BookOpen, 
  FileText, 
  Users, 
  Plus, 
  Calendar, 
  Clock, 
  X, 
  FileDown,
  Trash2
} from 'lucide-react';
import Button from '../../components/ui/Button';
import NotBuiltYet from '../../components/ui/NotBuiltYet';
import { isNotBuiltYet } from '../../services/apiClient';
import { coursesService } from '../../services/coursesService';
import StudentListTab from './components/StudentListTab';
import CreateTaskModal from './components/CreateTaskModal';
import AddMaterialModal from './components/AddMaterialModal';
import AttendanceManagement from './components/AttendanceManagement';

export const CourseDetail = () => {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const { showToast } = useOutletContext();

  // Tab state: 'materi', 'tugas', 'siswa'
  const [activeTab, setActiveTab] = useState('tugas');

  // Modal open/close states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isMaterialModalOpen, setIsMaterialModalOpen] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState(null);
  const [expandedMaterialId, setExpandedMaterialId] = useState(null);

  // Dynamic lists and loading states
  const [assignments, setAssignments] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notBuilt, setNotBuilt] = useState(false);

  // Course details state
  const [courseData, setCourseData] = useState({
    id: courseId,
    code: '',
    name: 'Memuat...',
    grade: '',
    /* No description column exists on Subject, so there is nothing to put here.
       It used to hold a fixed sentence naming "KelasKita", a brand this app
       does not use, shown under every class as though it were real. */
    description: null
  });

  useEffect(() => {
    let isMounted = true;

    /*
      Three requests, and `allSettled` rather than `all` so a failure can be told
      apart from the others: a 404 means the route has not been written, which is
      not a fault; anything else is.

      The 401 branch that used to sit here signed out people whose sessions were
      still alive — the full account of why is in TeacherCourses.jsx. apiClient
      refreshes once and replays, and ProtectedRoute owns the redirect.
    */
    const fetchCourseDetails = async () => {
      setIsLoading(true);
      setError(null);

      const results = await Promise.allSettled([
        coursesService.get(courseId),
        coursesService.assignments(courseId),
        coursesService.materials(courseId),
      ]);

      if (!isMounted) return;

      const failures = results.filter((r) => r.status === 'rejected').map((r) => r.reason);

      if (failures.length > 0) {
        const real = failures.find((err) => !isNotBuiltYet(err));
        if (real) setError(real.message || 'Gagal memuat data penugasan atau materi kelas.');
        else setNotBuilt(true);
        setIsLoading(false);
        return;
      }

      const [courseInfo, assignmentsData, materialsData] = results.map((r) => r.value);

      setCourseData({
        id: courseId,
        code: courseInfo.code,
        name: courseInfo.name,
        grade: courseInfo.grade_level,
        /* No Subject.description column exists, so there is nothing to show.
           This used to be a fixed sentence naming a brand this app does not
           use. */
        description: null,
      });
      setAssignments(assignmentsData);
      setMaterials(materialsData);
      setIsLoading(false);
    };

    if (courseId) {
      fetchCourseDetails();
    }

    return () => {
      isMounted = false;
    };
  }, [courseId]);

  /*
    The four handlers below still call `fetch` directly and still read
    `localStorage.getItem('token')` — which is the wrong store for a session
    without "Remember me". Left that way on purpose for now: none of them has the
    401 branch this slice removed, every endpoint they call answers 404, and no
    path through the UI reaches them, so changing them would add risk without
    changing anything anybody can see.

    `coursesService` already carries their replacements —
    `createAssignment`, `createMaterial`, `updateMaterial`, `removeMaterial`.
  */
  const handleCreateTask = async (taskData) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/courses/${courseId}/assignments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          title: taskData.title,
          description: taskData.description,
          deadline: taskData.deadline
        })
      });

      if (!response.ok) {
        throw new Error('Gagal menyimpan tugas baru ke database.');
      }

      const result = await response.json();
      setAssignments(prev => [result.assignment, ...prev]);
      if (showToast) showToast(`Tugas "${taskData.title}" berhasil disimpan secara permanen!`, 'success');
    } catch (err) {
      if (showToast) showToast(err.message, 'error');
    }
  };

  const handleSaveMaterial = async (materialData) => {
    if (editingMaterial) {
      try {
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/materials/${editingMaterial.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            title: materialData.title,
            description: materialData.description
          })
        });

        if (!response.ok) {
          throw new Error('Gagal memperbarui materi di database.');
        }

        const result = await response.json();
        
        setMaterials(prev =>
          prev.map(m => m.id === editingMaterial.id ? { 
            ...m, 
            title: result.material.title, 
            description: result.material.description 
          } : m)
        );

        if (showToast) showToast(`Materi "${materialData.title}" berhasil diperbarui!`, 'success');
        setEditingMaterial(null);
      } catch (err) {
        if (showToast) showToast(err.message, 'error');
      }
    } else {
      try {
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/courses/${courseId}/materials`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            title: materialData.title,
            description: materialData.description,
            size: materialData.file ? `${(materialData.file.size / (1024 * 1024)).toFixed(1)} MB` : '2.0 MB'
          })
        });

        if (!response.ok) {
          throw new Error('Gagal menyimpan materi baru ke database.');
        }

        const result = await response.json();
        const mappedNewMat = {
          ...result.material,
          date: new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
        };

        setMaterials(prev => [mappedNewMat, ...prev]);
        if (showToast) showToast(`Materi "${materialData.title}" berhasil diunggah secara permanen!`, 'success');
      } catch (err) {
        if (showToast) showToast(err.message, 'error');
      }
    }
  };

  const handleStartEditMaterial = (e, mat) => {
    e.stopPropagation();
    setEditingMaterial(mat);
    setIsMaterialModalOpen(true);
  };

  const handleDeleteMaterial = async (e, materialId, materialTitle) => {
    e.stopPropagation();
    if (!window.confirm(`Apakah Anda yakin ingin menghapus materi "${materialTitle}"?`)) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/materials/${materialId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Gagal menghapus materi dari database.');
      }

      setMaterials(prev => prev.filter(m => m.id !== materialId));
      if (showToast) showToast(`Materi "${materialTitle}" berhasil dihapus.`, 'success');
    } catch (err) {
      if (showToast) showToast(err.message, 'error');
    }
  };

  const handleDownloadMaterial = (e, materialTitle) => {
    e.stopPropagation();
    
    const cleanTitle = materialTitle.trim();
    const isVideo = cleanTitle.toLowerCase().endsWith('.mp4') || cleanTitle.toLowerCase().endsWith('.mkv') || cleanTitle.toLowerCase().endsWith('.avi');
    const isTxt = cleanTitle.toLowerCase().endsWith('.txt');
    
    let blob;
    let fileName = cleanTitle;
    
    if (isVideo) {
      const mp4Base64 = 'AAAAIGZ0eXBpc29tAAACAGlzb21tcDgxbXA0MgAAAAhmcmVlAAAAG21kYXQAAAGAMGF0b20gY29kZWQgbXA0IAAAAA1tb292AAAAbG12aGQAAAAA3ndHNN53RzQAAAPoAAAAKAABAAABAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACAAACNXRyYWsAAABcdGtoZAAAAADed0c03ndHNAAAAAEAAAAAAAABAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACAAAAABNlZGlhAAAAWG1kaGQAAAAA3ndHNN53RzQAAAPoAAAAKABVAAAAAAAxaGQ3dGhlMAAAAAAxYXBwbAAAAAAxYXBwbAAAAAAxYXBwbAAAAAAxYXBwbAAAAAAxYXBwbAAAAC1oZGxyAAAAAAAAAAB2aWRlAAAAAAAAAAAAAAAAVmlkZW9IYW5kbGVyAAAAAVxtaW5mAAAAEHZtYWhkAAAAAQAAAAAAACRkaW5mAAAAHGRyZWYAAAAAAAAAAQAAAAxtdXJsAAAAAAAAAAcAc3RjbyAAAAAAAAABAAAADAAAAGNvb2tpAAAAAA==';
      const byteCharacters = atob(mp4Base64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      blob = new Blob([byteArray], { type: 'video/mp4' });
      if (!fileName.toLowerCase().endsWith('.mp4')) {
        fileName += '.mp4';
      }
    } else if (isTxt) {
      blob = new Blob([`Materi pelajaran: ${cleanTitle}`], { type: 'text/plain' });
    } else {
      // Default to valid 1-page PDF binary document
      const pdfBase64 = 'JVBERi0xLjQKMSAwIG9iago8PAovVHlwZSAvQ2F0YWxvZwovUGFnZXMgMiAwIFIKPj4KZW5kb2JqCjIgMCBvYmoKPDwKL1R5cGUgL1BhZ2VzCi9LaWRzIFszIDAgUl0KL0NvdW50IDEKPj4KZW5kb2JqCjMgMCBvYmoKPDwKL1R5cGUgL1BhZ2UKL1BhcmVudCAyIDAgUgovTWVkaWFCb3ggWzAgMCA1OTUgODQyXQovQ29udGVudHMgNCAwIFIKL1Jlc291cmNlcyA8PAovRm9udCA8PAovRjEgPj4KPj4KPj4KZW5kb2JqCjQgMCBvYmoKPDwKL0xlbmd0aCA1MAo+PgpzdHJlYW0KQlQgL0YxIDEyIFRmIDUwIDcwMCBUZCAoRG9rdW1lbnQgTWF0ZXJpIEtsYXNLaXRhKSBUaiBFVCBlbmRzdHJlYW0KZW5kb2JqCjUgMCBvYmoKPDwKL1R5cGUgL0ZvbnQKL1N1YnR5cGUgL1R5cGUxCi9CYXNlRm9udCAvSGVsdmV0aWNhCj4+CmVuZG9iagp4cmVmCjAgNgowMDAwMDAwMDAwIDY1NTM1IGYgCjAwMDAwMDAwMDkgMDAwMDAgbiAKMDAwMDAwMDA1OCAwMDAwMCBuIAowMDAwMDAwMTE1IDAwMDAwIGYgCjAwMDAwMDAyNDIgMDAwMDAgbiAKMDAwMDAwMDM0MSAwMDAwMCBuIAp0cmFpbGVyCjw8Ci9TaXplIDYKL1Jvb3QgMSAwIFIKPj4Kc3RhcnR4cmVmCjQyOQolJUVPRg==';
      const byteCharacters = atob(pdfBase64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      blob = new Blob([byteArray], { type: 'application/pdf' });
      if (!fileName.toLowerCase().endsWith('.pdf')) {
        fileName += '.pdf';
      }
    }

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName.replace(/\s+/g, '_');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    if (showToast) showToast(`Mengunduh file: ${fileName}...`, 'success');
  };

  const handleToggleExpand = (matId) => {
    setExpandedMaterialId(prev => prev === matId ? null : matId);
  };

  if (isLoading) {
    return (
      <div className="space-y-6 text-left animate-pulse select-none">
        <div className="h-8 bg-slate-200 rounded w-1/4"></div>
        <div className="h-4 bg-slate-200 rounded w-1/3"></div>
        <div className="h-32 bg-white border border-slate-100 rounded-3xl"></div>
      </div>
    );
  }

  /* Nothing about this class can be shown, because nothing was answered — the
     tabs below would each be an empty room. */
  if (notBuilt) return <NotBuiltYet />;

  if (error) {
    return (
      <div className="p-5 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-700 text-xs font-semibold select-none text-left">
        <div>
          <p className="font-bold">Terjadi Kesalahan</p>
          <p className="text-red-600 font-medium mt-0.5">{error}</p>
        </div>
      </div>
    );
  }



  return (
    <div className="space-y-6 text-left">
      {/* Back button and Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 select-none">
        <div className="space-y-1">
          <button 
            onClick={() => navigate('/teacher/dashboard')}
            className="flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-brand transition-colors focus:outline-none mb-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Kembali ke Dasbor
          </button>
          <div className="flex items-center gap-3">
            <span className="px-2.5 py-1 bg-purple-100 text-brand text-xs font-extrabold rounded-lg uppercase">
              {courseData.grade}
            </span>
            <span className="text-xs text-slate-400 font-bold">
              {courseData.code}
            </span>
          </div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight leading-tight">
            {courseData.name}
          </h1>
          {courseData.description && (
            <p className="text-sm text-slate-500 max-w-2xl font-medium mt-1">
              {courseData.description}
            </p>
          )}
        </div>
      </div>

      {/* Tabs Layout */}
      <div className="border-b border-slate-100 flex gap-6 select-none">
        <button
          onClick={() => setActiveTab('materi')}
          className={`pb-3 text-sm font-extrabold transition-all flex items-center gap-2 border-b-2 focus:outline-none cursor-pointer
            ${activeTab === 'materi' 
              ? 'border-brand text-brand' 
              : 'border-transparent text-slate-400 hover:text-slate-600'
            }
          `}
        >
          <BookOpen className="w-4 h-4" />
          Materi
        </button>

        <button
          onClick={() => setActiveTab('tugas')}
          className={`pb-3 text-sm font-extrabold transition-all flex items-center gap-2 border-b-2 focus:outline-none cursor-pointer
            ${activeTab === 'tugas' 
              ? 'border-brand text-brand' 
              : 'border-transparent text-slate-400 hover:text-slate-600'
            }
          `}
        >
          <FileText className="w-4 h-4" />
          Tugas
        </button>

        <button
          onClick={() => setActiveTab('siswa')}
          className={`pb-3 text-sm font-extrabold transition-all flex items-center gap-2 border-b-2 focus:outline-none cursor-pointer
            ${activeTab === 'siswa' 
              ? 'border-brand text-brand' 
              : 'border-transparent text-slate-400 hover:text-slate-600'
            }
          `}
        >
          <Users className="w-4 h-4" />
          Siswa
        </button>

        <button
          onClick={() => setActiveTab('absensi')}
          className={`pb-3 text-sm font-extrabold transition-all flex items-center gap-2 border-b-2 focus:outline-none cursor-pointer
            ${activeTab === 'absensi' 
              ? 'border-brand text-brand' 
              : 'border-transparent text-slate-400 hover:text-slate-600'
            }
          `}
        >
          <Calendar className="w-4 h-4" />
          Absensi Kelas
        </button>
      </div>

      {/* Tab Contents */}
      <div className="pt-2">
        {/* TAB 1: MATERI */}
        {activeTab === 'materi' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center select-none">
              <h2 className="text-sm font-extrabold text-slate-500 uppercase tracking-wider">Modul & File Pembelajaran</h2>
              <button 
                onClick={() => setIsMaterialModalOpen(true)}
                className="px-3.5 py-2 bg-brand hover:bg-brand-deep text-white text-xs font-extrabold rounded-xl transition-colors cursor-pointer shadow-sm flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                Tambah Materi
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {materials.map((mat) => {
                const isExpanded = expandedMaterialId === mat.id;
                return (
                  <div 
                    key={mat.id} 
                    onClick={() => handleToggleExpand(mat.id)}
                    className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col gap-3 cursor-pointer select-none"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-purple-50 text-brand flex items-center justify-center shrink-0">
                          <BookOpen className="w-5 h-5" />
                        </div>
                        <div className="space-y-0.5 text-left">
                          <h4 className="text-sm font-extrabold text-slate-800 leading-snug">{mat.title}</h4>
                          <p className="text-[10px] text-slate-400 font-bold">
                            PDF · {mat.size} · {mat.date || 'Baru Saja'}
                          </p>
                        </div>
                      </div>
                      
                      <span className="text-[10px] text-brand font-extrabold uppercase bg-purple-50 px-2 py-0.5 rounded-md">
                        {isExpanded ? 'Tutup' : 'Detail'}
                      </span>
                    </div>

                    {isExpanded && (
                      <div 
                        onClick={(e) => e.stopPropagation()}
                        className="pt-2 border-t border-slate-50 space-y-3 text-left"
                      >
                        {mat.description ? (
                          <div className="space-y-1">
                            <p className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider">Catatan / Deskripsi</p>
                            <p className="text-xs text-slate-600 font-semibold leading-relaxed">{mat.description}</p>
                          </div>
                        ) : (
                          <p className="text-xs text-slate-400 italic font-semibold">Tidak ada deskripsi tambahan.</p>
                        )}

                        <div className="flex items-center justify-end gap-2 pt-1.5">
                          <button
                            onClick={(e) => handleDownloadMaterial(e, mat.title)}
                            className="px-3 py-2 bg-slate-50 hover:bg-violet-50 text-slate-600 hover:text-brand rounded-xl text-[11px] font-bold transition-all flex items-center gap-1.5 border border-slate-100 cursor-pointer"
                          >
                            <FileDown className="w-4 h-4" />
                            Unduh PDF
                          </button>

                          <button
                            onClick={(e) => handleStartEditMaterial(e, mat)}
                            className="px-3 py-2 bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-slate-800 rounded-xl text-[11px] font-bold transition-all flex items-center gap-1.5 border border-slate-100 cursor-pointer"
                          >
                            Edit
                          </button>

                          <button
                            onClick={(e) => handleDeleteMaterial(e, mat.id, mat.title)}
                            className="px-3 py-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl text-[11px] font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                            Hapus
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 2: TUGAS */}
        {activeTab === 'tugas' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center select-none">
              <h2 className="text-sm font-extrabold text-slate-500 uppercase tracking-wider">Daftar Penugasan Kelas</h2>
              <button
                onClick={() => setIsModalOpen(true)}
                className="px-3.5 py-2 bg-brand hover:bg-brand-deep text-white text-xs font-extrabold rounded-xl transition-colors cursor-pointer shadow-sm flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                Buat Tugas Baru
              </button>
            </div>

            <div className="space-y-4">
              {assignments.map((asm) => (
                <div key={asm.id} className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1.5 text-left">
                    <h3 className="text-base font-extrabold text-slate-800">{asm.title}</h3>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-400 font-bold">
                      <span className="flex items-center gap-1.5">
                        <Clock className="w-4 h-4 text-amber-500" />
                        Deadline: {new Date(asm.deadline).toLocaleString('id-ID', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Users className="w-4 h-4 text-brand" />
                        Mengumpulkan: {asm.submittedCount} / {asm.totalCount} Siswa
                      </span>
                    </div>
                  </div>

                  <div className="flex gap-2 shrink-0">
                    <Button 
                      onClick={() => navigate('/teacher/gradebook')}
                      className="py-2 px-4 rounded-xl font-bold bg-brand hover:bg-brand-deep text-white text-xs cursor-pointer"
                    >
                      Nilai Tugas
                    </Button>
                    <button 
                      onClick={() => showToast && showToast('Fitur hapus tugas segera hadir.', 'info')}
                      className="p-2.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all cursor-pointer"
                    >
                      <Trash2 className="w-4.5 h-4.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 3: SISWA */}
        {activeTab === 'siswa' && (
          <StudentListTab courseId={courseId} />
        )}

        {/* TAB 4: ABSENSI */}
        {activeTab === 'absensi' && (
          <AttendanceManagement courseId={courseId} showToast={showToast} />
        )}
      </div>

      {/* Reusable Task Creation Modal Dialog */}
      <CreateTaskModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleCreateTask}
      />

      {/* Reusable Material Upload Modal Dialog */}
      <AddMaterialModal
        isOpen={isMaterialModalOpen}
        onClose={() => {
          setIsMaterialModalOpen(false);
          setEditingMaterial(null);
        }}
        onSubmit={handleSaveMaterial}
        editingMaterial={editingMaterial}
      />
    </div>
  );
};

export default CourseDetail;
