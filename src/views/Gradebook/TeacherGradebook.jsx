import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Save, Filter, AlertCircle, CheckCircle, GraduationCap, BookOpen, Inbox, Download } from 'lucide-react';
import Button from '../../components/ui/Button';
import NotBuiltYet from '../../components/ui/NotBuiltYet';
import { isNotBuiltYet } from '../../services/apiClient';
import { coursesService } from '../../services/coursesService';
import { gradebookService } from '../../services/gradebookService';

export const TeacherGradebook = () => {
  const { showToast } = useOutletContext();

  // 1. Core State Management
  const [courses, setCourses] = useState([]);
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [assignments, setAssignments] = useState([]);
  const [students, setStudents] = useState([]);
  const [weights, setWeights] = useState({});
  const [pendingGrades, setPendingGrades] = useState([]);
  
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notBuilt, setNotBuilt] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Protests states
  const [isProtestsOpen, setIsProtestsOpen] = useState(false);
  const [protests, setProtests] = useState([]);
  const [protestsCount, setProtestsCount] = useState(0);
  const [filterRemedialOnly, setFilterRemedialOnly] = useState(false);

  // 2. Load Taught Courses on Mount
  useEffect(() => {
    let isMounted = true;
    
    /* The 401 branch that used to be here signed out people whose sessions were
       still alive — see the note in TeacherCourses.jsx. */
    const fetchCourses = async () => {
      setIsLoading(true);

      try {
        const data = await coursesService.list();
        if (!isMounted) return;

        setCourses(data);
        /* Loading stays on only when a course was picked: effect 3 below owns
           the rest of that load and clears it. */
        if (data.length > 0) setSelectedCourseId(data[0].id);
        else setIsLoading(false);
      } catch (err) {
        if (!isMounted) return;
        if (isNotBuiltYet(err)) setNotBuilt(true);
        else setError(err.message);
        setIsLoading(false);
      }
    };

    fetchCourses();
    return () => {
      isMounted = false;
    };
  }, []);

  /* Load the appeals list. Stays quiet on failure, as it did before: this is a
     badge count beside a button, not the page. */
  const fetchProtests = async () => {
    try {
      const data = await gradebookService.protests.forTeacher();
      setProtests(data);
      setProtestsCount(data.filter((p) => p.status === 'Pending').length);
    } catch (err) {
      if (!isNotBuiltYet(err)) console.error('Fetch protests failed:', err);
    }
  };

  useEffect(() => {
    fetchProtests();
  }, [selectedCourseId]);

  // 3. Load Gradebook Data when Selected Course changes
  useEffect(() => {
    if (!selectedCourseId) return;

    let isMounted = true;
    const fetchGradebook = async () => {
      setIsLoading(true);
      setError(null);
      setPendingGrades([]); // reset pending changes

      try {
        const data = await gradebookService.forCourse(selectedCourseId);
        if (!isMounted) return;

        setAssignments(data.assignments);
        setStudents(data.students);

        // Map initial weights
        const initialWeights = {};
        data.assignments.forEach((asm) => {
          initialWeights[asm.id] = asm.weight || 0;
        });
        setWeights(initialWeights);
      } catch (err) {
        if (!isMounted) return;
        if (isNotBuiltYet(err)) setNotBuilt(true);
        else setError(err.message || 'Gagal memuat data buku nilai dari server.');
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchGradebook();
    return () => {
      isMounted = false;
    };
  }, [selectedCourseId]);

  // Update weight values locally
  const handleWeightChange = (assignmentId, val) => {
    const numVal = val === '' ? '' : Math.max(0, parseInt(val) || 0);
    setWeights(prev => ({
      ...prev,
      [assignmentId]: numVal
    }));
  };

  // Update grade values locally
  const handleGradeChange = (studentId, assignmentId, val) => {
    const numVal = val === '' ? '' : Math.min(100, Math.max(0, parseInt(val) || 0));
    
    // Update local students list representation
    setStudents(prev =>
      prev.map(stu => {
        if (stu.id === studentId) {
          return {
            ...stu,
            grades: {
              ...stu.grades,
              [assignmentId]: numVal
            }
          };
        }
        return stu;
      })
    );

    // Collect pending updates
    setPendingGrades(prev => {
      const filtered = prev.filter(item => !(item.studentId === studentId && item.assignmentId === assignmentId));
      return [...filtered, { studentId, assignmentId, grade: numVal }];
    });
  };

  // Calculate dynamic weighted average for student
  const calculateFinalAverage = (student) => {
    let scoreSum = 0;
    assignments.forEach(asm => {
      const score = student.grades[asm.id] === null || student.grades[asm.id] === '' ? 0 : student.grades[asm.id];
      const weight = weights[asm.id] !== undefined ? weights[asm.id] : (asm.weight || 0);
      scoreSum += score * (weight / 100);
    });
    return Math.round(scoreSum);
  };

  // Save changes to database
  const handleSaveData = async () => {
    // Validate that the total sum of weights is equal to 100 if assignments exist
    if (assignments.length > 0) {
      const totalWeight = Object.values(weights).reduce((sum, w) => sum + (parseInt(w, 10) || 0), 0);
      if (totalWeight !== 100) {
        showToast(`Total bobot saat ini adalah ${totalWeight}%. Harus berjumlah tepat 100% sebelum disimpan.`, 'warning');
        return;
      }
    }

    try {
      setIsSaving(true);
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/gradebook/${selectedCourseId}/save`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          weights,
          grades: pendingGrades
        })
      });

      if (!response.ok) {
        throw new Error('Gagal menyimpan buku nilai ke database.');
      }

      showToast('Buku nilai berhasil disinkronisasikan secara permanen!', 'success');
      setPendingGrades([]);
      
      // Reload gradebook
      const responseReload = await fetch(`/api/gradebook/${selectedCourseId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (responseReload.ok) {
        const reloadData = await responseReload.json();
        setStudents(reloadData.students);
      }
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Review protest beslut handler
  /* Still a raw fetch, and still reading the wrong storage for a session
     without "Remember me". Deferred for the same reason as the handlers in
     CourseDetail: no 401 branch, a 404 endpoint, and no way to reach it.
     `gradebookService.protests.review` and `.save` are waiting. */
  const handleReviewProtest = async (protestId, decision, feedback) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/protests/${protestId}/review`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          status: decision,
          teacher_feedback: feedback
        })
      });

      if (!response.ok) {
        throw new Error('Gagal memproses keputusan sanggahan.');
      }

      showToast(`Sanggahan berhasil diulas: ${decision}`, 'success');
      
      // Refresh protests data
      await fetchProtests();
      
      // Reload gradebook
      const loadGradebookResponse = await fetch(`/api/gradebook/${selectedCourseId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (loadGradebookResponse.ok) {
        const data = await loadGradebookResponse.json();
        setAssignments(data.assignments);
        setStudents(data.students);
      }
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleExportCSV = () => {
    if (students.length === 0) return;
    
    const headers = ['Nama Siswa', 'NIS', 'Email', ...assignments.map(asm => asm.title), 'Nilai Akhir', 'Status'];
    const rows = students.map(student => {
      const finalAvg = calculateFinalAverage(student);
      const isPass = finalAvg >= 75;
      const assignmentGrades = assignments.map(asm => {
        const grade = student.grades[asm.id];
        return grade === null || grade === undefined ? 'Belum Dinilai' : grade;
      });
      return [
        student.name,
        student.nis || '-',
        student.email,
        ...assignmentGrades,
        finalAvg,
        isPass ? 'Lulus' : 'Remedial'
      ];
    });
    
    const csvContent = [headers, ...rows]
      .map(row => row.map(val => `"${val.toString().replace(/"/g, '""')}"`).join(','))
      .join('\n');
      
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    
    const courseName = courses.find(c => c.id === selectedCourseId)?.name || 'buku_nilai';
    const sanitizedCourseName = courseName.toLowerCase().replace(/[^a-z0-9]/g, '_');
    
    link.setAttribute('download', `buku_nilai_${sanitizedCourseName}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showToast('Ekspor buku nilai ke file CSV berhasil!', 'success');
  };

  // Sum of weights
  const totalWeight = Object.values(weights).reduce((sum, w) => sum + (parseInt(w, 10) || 0), 0);

  const displayedStudents = students.filter(student => {
    if (filterRemedialOnly) {
      const finalAvg = calculateFinalAverage(student);
      return finalAvg < 75;
    }
    return true;
  });

  if (isLoading) {
    return (
      <div className="space-y-6 text-left animate-pulse w-full select-none">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4">
          <div className="space-y-2">
            <div className="h-7 bg-slate-200 rounded-lg w-72"></div>
            <div className="h-4 bg-slate-200 rounded-lg w-48"></div>
          </div>
          <div className="h-10 bg-slate-200 rounded-xl w-36"></div>
        </div>
        <div className="h-10 bg-slate-200 rounded-xl w-48"></div>
        <div className="bg-white border border-slate-100 rounded-2xl p-6 h-48 shadow-sm"></div>
      </div>
    );
  }

  /* Neither the class list nor the marking sheet has a route yet. A grid of
     empty cells would invite somebody to type marks into nothing. */
  if (notBuilt) return <NotBuiltYet />;

  if (error) {
    return (
      <div className="p-6 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-700 text-sm font-semibold select-none text-left w-full">
        <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
        <div>
          <p className="font-bold">Terjadi Kesalahan</p>
          <p className="text-xs text-red-600 font-medium mt-0.5">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 text-left w-full">
      {/* 1. Header Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 select-none">
        <div className="space-y-1">
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight leading-tight flex items-center gap-2">
            <GraduationCap className="w-6 h-6 text-brand" />
            Buku Nilai (Gradebook)
          </h1>
          <p className="text-xs font-bold text-slate-500">
            {courses.find(c => c.id === selectedCourseId)?.name || 'Pilih Mata Pelajaran'} · {courses.find(c => c.id === selectedCourseId)?.grade_level || 'Semua Kelas'}
          </p>
        </div>

        <Button
          onClick={handleSaveData}
          disabled={isSaving || (pendingGrades.length === 0 && totalWeight === assignments.reduce((sum, a) => sum + (a.weight || 0), 0))}
          className="bg-brand hover:bg-brand-deep text-white py-2.5 px-5 rounded-xl font-bold shadow-md shadow-brand/10 cursor-pointer text-xs flex items-center justify-center gap-1.5 disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          {isSaving ? 'Menyimpan...' : 'Simpan Perubahan'}
        </Button>
      </div>

      {/* 2. Course Selection Dropdown & Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 select-none w-full">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500">
            <Filter className="w-4 h-4 text-slate-400" />
            <span>Pilih Kelas:</span>
          </div>
          <select
            value={selectedCourseId}
            onChange={(e) => setSelectedCourseId(e.target.value)}
            className="text-xs font-extrabold text-slate-800 border border-slate-200 rounded-xl px-3.5 py-2.5 bg-white focus:outline-none focus:border-brand transition-colors cursor-pointer shadow-sm mr-2"
          >
            {courses.map(course => (
              <option key={course.id} value={course.id}>
                {course.name} ({course.grade_level || 'Umum'})
              </option>
            ))}
          </select>

          {/* Remedial Filter Button */}
          <button
            onClick={() => setFilterRemedialOnly(!filterRemedialOnly)}
            className={`text-xs font-extrabold flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border transition-all cursor-pointer
              ${filterRemedialOnly 
                ? 'bg-red-50 border-red-200 text-red-600 hover:bg-red-100/60 shadow-sm' 
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-800 shadow-sm'
              }
            `}
          >
            <AlertCircle className="w-4 h-4" />
            {filterRemedialOnly ? 'Menampilkan: Remedial Saja' : 'Filter: Remedial Saja'}
          </button>

          {/* Export to CSV Button */}
          <button
            onClick={handleExportCSV}
            className="text-xs font-extrabold text-slate-600 hover:text-slate-800 flex items-center gap-1.5 bg-white border border-slate-200 px-3.5 py-2.5 rounded-xl transition-all cursor-pointer hover:bg-slate-50 shadow-sm"
          >
            <Download className="w-4 h-4 text-slate-400" />
            Ekspor CSV
          </button>
        </div>

        {/* Protests Inbox Button */}
        <button
          onClick={() => setIsProtestsOpen(true)}
          className="text-xs font-extrabold text-brand hover:text-brand-deep flex items-center gap-2 bg-purple-50 hover:bg-purple-100/70 border border-purple-200/50 px-3.5 py-2.5 rounded-xl transition-all cursor-pointer"
        >
          <Inbox className="w-4 h-4" />
          Kotak Sanggahan Nilai
          {protestsCount > 0 && (
            <span className="w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-extrabold flex items-center justify-center border border-white">
              {protestsCount}
            </span>
          )}
        </button>
      </div>

      {/* Weight Error Banner */}
      {assignments.length > 0 && totalWeight !== 100 && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-center gap-3 text-amber-800 text-xs font-semibold select-none text-left">
          <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />
          <div>
            Total bobot penugasan saat ini adalah <strong className="text-amber-900 font-extrabold">{totalWeight}%</strong>. 
            Bobot harus disesuaikan agar berjumlah tepat <strong className="text-amber-900 font-extrabold">100%</strong> untuk melakukan perhitungan nilai akhir yang akurat.
          </div>
        </div>
      )}

      {/* 3. Responsive Interactive Table */}
      {assignments.length === 0 ? (
        <div className="py-20 text-center border border-dashed border-slate-200 rounded-3xl bg-slate-50/20 select-none">
          <BookOpen className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-sm font-extrabold text-slate-500">Belum ada tugas dibuat</h3>
          <p className="text-xs text-slate-400 mt-1">Buat tugas baru terlebih dahulu di halaman kelas.</p>
        </div>
      ) : (
        <div className="bg-white border border-slate-100 rounded-3xl overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-300">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-100 text-xs font-extrabold text-slate-500 select-none">
                  <th className="p-4 pl-6 text-left w-48">Nama Siswa</th>
                  <th className="p-4 text-center w-36">NIS</th>
                  
                  {/* Dynamic Assignment Weight Headers */}
                  {assignments.map(asm => (
                    <th key={asm.id} className="p-4 text-center min-w-[120px] max-w-[160px]">
                      <div className="space-y-1">
                        <span className="truncate block" title={asm.title}>{asm.title}</span>
                        <div className="flex items-center justify-center gap-1">
                          <input
                            type="number"
                            value={weights[asm.id] !== undefined ? weights[asm.id] : ''}
                            onChange={(e) => handleWeightChange(asm.id, e.target.value)}
                            placeholder="0"
                            className="w-12 text-center text-[10px] font-extrabold border border-slate-200 rounded-md py-0.5 focus:outline-none focus:border-brand bg-white text-slate-800"
                          />
                          <span className="text-[10px] text-slate-400">%</span>
                        </div>
                      </div>
                    </th>
                  ))}
                  
                  <th className="p-4 text-center w-28 border-l border-slate-100">Nilai Akhir</th>
                  <th className="p-4 pl-6 text-left w-32">Status Kelulusan</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100 text-xs font-bold text-slate-700">
                {displayedStudents.map(student => {
                  const finalAvg = calculateFinalAverage(student);
                  const isPass = finalAvg >= 75; // KKM = 75

                  return (
                    <tr key={student.id} className="hover:bg-slate-50/20 transition-colors">
                      {/* Name */}
                      <td className="p-4 pl-6 text-left">
                        <div className="truncate max-w-[160px] font-extrabold text-slate-900" title={student.name}>
                          {student.name}
                        </div>
                        <span className="text-[10px] text-slate-400 font-semibold">{student.email}</span>
                      </td>

                      {/* NIS */}
                      <td className="p-4 text-center font-mono text-slate-500 select-none">
                        {student.nis || '—'}
                      </td>

                      {/* Dynamic Assignment Grade Input Cells */}
                      {assignments.map(asm => {
                        const gradeVal = student.grades[asm.id];
                        const isEdited = pendingGrades.some(p => p.studentId === student.id && p.assignmentId === asm.id);

                        return (
                          <td key={asm.id} className="p-4 text-center">
                            <input
                              type="number"
                              value={gradeVal === null ? '' : gradeVal}
                              onChange={(e) => handleGradeChange(student.id, asm.id, e.target.value)}
                              placeholder="Belum"
                              className={`w-16 text-center py-1.5 border rounded-xl focus:outline-none transition-all font-extrabold text-xs
                                ${isEdited 
                                  ? 'border-brand ring-2 ring-purple-100 bg-purple-50/10' 
                                  : gradeVal === null
                                    ? 'border-slate-200/80 bg-slate-50/30 text-slate-400'
                                    : 'border-slate-200/80 bg-white text-slate-800'
                                }
                              `}
                            />
                          </td>
                        );
                      })}

                      {/* Dynamic Weighted Average Total */}
                      <td className="p-4 text-center bg-slate-50/30 border-l border-slate-100">
                        <span className={`text-sm font-extrabold px-2 py-1 rounded-lg
                          ${isPass ? 'text-slate-800' : 'text-red-600 bg-red-50/30'}
                        `}>
                          {finalAvg}
                        </span>
                      </td>

                      {/* Status badge based on KKM (75) */}
                      <td className="p-4 pl-6 bg-slate-50/30">
                        {isPass ? (
                          <span className="px-2.5 py-0.5 bg-emerald-50 border border-emerald-100 text-emerald-600 text-[10px] font-extrabold rounded-md inline-flex items-center gap-1 uppercase select-none">
                            <CheckCircle className="w-3 h-3" />
                            Lulus
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 bg-red-50 border border-red-100 text-red-500 text-[10px] font-extrabold rounded-md inline-flex items-center gap-1 uppercase select-none">
                            <AlertCircle className="w-3 h-3 text-red-400" />
                            Remedial
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Review Protests Modal */}
      {isProtestsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm select-none">
          <div className="bg-white rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl border border-slate-100 flex flex-col max-h-[85vh] text-left">
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-base font-extrabold text-slate-900">
                  Kotak Masuk Sanggahan Nilai
                </h3>
                <p className="text-[11px] text-slate-400 font-semibold">
                  Tinjau dan proses sanggahan nilai yang diajukan oleh siswa.
                </p>
              </div>
              <button 
                onClick={() => setIsProtestsOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-50 text-slate-500 flex items-center justify-center hover:bg-slate-100 transition-colors focus:outline-none cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              {protests.length === 0 ? (
                <div className="py-12 text-center border border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
                  <Inbox className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-xs font-extrabold text-slate-500">Belum ada sanggahan masuk</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {protests.map(protest => (
                    <div 
                      key={protest.id} 
                      className="border border-slate-100 rounded-2xl p-4 space-y-3 transition-shadow hover:shadow-sm bg-white"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-extrabold text-slate-900">{protest.student_name}</span>
                            <span className="px-2 py-0.5 bg-slate-100 text-slate-500 text-[10px] font-extrabold rounded-md">{protest.grade_level}</span>
                          </div>
                          <span className="text-[10px] text-slate-400 font-bold block mt-0.5">{protest.assignment_title}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs font-extrabold">
                          <span className="text-slate-400">Nilai: {protest.original_grade}</span>
                          <span className="text-slate-300">→</span>
                          <span className="text-brand bg-purple-100/60 px-2 py-0.5 rounded-md">Harapan: {protest.requested_grade}</span>
                        </div>
                      </div>

                      <div className="bg-slate-50 rounded-xl p-3 text-xs font-semibold text-slate-600 leading-relaxed">
                        <span className="text-[10px] text-slate-400 block font-extrabold mb-1 select-none">Alasan Murid:</span>
                        "{protest.reason}"
                      </div>

                      {protest.status === 'Pending' ? (
                        <div className="pt-2 flex flex-col gap-3">
                          {/* Feedback comment box */}
                          <div className="space-y-1">
                            <span className="text-[10px] text-slate-400 block font-extrabold">Catatan Review Guru:</span>
                            <input
                              type="text"
                              id={`feedback-${protest.id}`}
                              placeholder="Tulis umpan balik guru di sini..."
                              className="w-full text-xs font-semibold border border-slate-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:border-brand transition-colors"
                            />
                          </div>

                          <div className="flex gap-2.5 justify-end">
                            <button
                              onClick={() => handleReviewProtest(protest.id, 'Ditolak', document.getElementById(`feedback-${protest.id}`)?.value)}
                              className="bg-red-50 hover:bg-red-100/60 border border-red-200/50 text-red-600 text-xs font-extrabold py-2 px-4 rounded-xl cursor-pointer"
                            >
                              Tolak Sanggahan
                            </button>
                            <button
                              onClick={() => handleReviewProtest(protest.id, 'Disetujui', document.getElementById(`feedback-${protest.id}`)?.value)}
                              className="bg-brand hover:bg-brand-deep text-white text-xs font-extrabold py-2 px-4 rounded-xl shadow-md shadow-brand/10 cursor-pointer"
                            >
                              Setujui Sanggahan
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-slate-500">
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold
                            ${protest.status === 'Disetujui' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}
                          `}>
                            Keputusan: {protest.status}
                          </span>
                          {protest.teacher_feedback && (
                            <span className="truncate max-w-sm italic">"{protest.teacher_feedback}"</span>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeacherGradebook;
