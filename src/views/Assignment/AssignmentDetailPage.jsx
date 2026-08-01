import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation, useOutletContext } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { 
  ChevronLeft, 
  UploadCloud, 
  FileText, 
  CheckCircle, 
  AlertCircle, 
  Clock, 
  Award,
  BookOpen,
  Trash2,
  Inbox
} from 'lucide-react';
import Button from '../../components/ui/Button';

export const AssignmentDetailPage = () => {
  const { assignmentId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { showToast } = useOutletContext();
  const { user } = useAuth();
  const isStudent = user?.role === 'student';

  const [assignment, setAssignment] = useState(null);
  const [submission, setSubmission] = useState(null);
  const [protest, setProtest] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Upload state
  const [attachedFile, setAttachedFile] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Protest Modal State
  const [isProtestModalOpen, setIsProtestModalOpen] = useState(false);
  const [protestReason, setProtestReason] = useState('');
  const [requestedGrade, setRequestedGrade] = useState('');
  const [isSubmittingProtest, setIsSubmittingProtest] = useState(false);

  const fetchDetails = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/assignments/${assignmentId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) {
        throw new Error('Gagal memuat detail tugas dari server.');
      }

      const data = await response.json();
      setAssignment(data.assignment);
      setSubmission(data.submission);
      setProtest(data.protest);
      
      if (data.submission) {
        setAttachedFile({
          name: data.submission.file_name,
          size: '2.4 MB',
          progress: 100
        });
      } else {
        setAttachedFile(null);
      }
      setIsLoading(false);
    } catch (err) {
      setError(err.message);
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (assignmentId) {
      fetchDetails();
    }
  }, [assignmentId]);

  const handleBack = () => {
    const courseId = location.state?.courseId || assignment?.class_subject_id || '1';
    if (user?.role === 'teacher') {
      navigate(`/teacher/courses/${courseId}`);
    } else {
      navigate(`/classroom/${courseId}`);
    }
  };

  const handleSimulateFileSelect = () => {
    if (submission) return;
    setAttachedFile({
      name: `Tugas_${user?.name?.replace(/\s+/g, '') || 'Siswa'}_limit_trig.pdf`,
      size: '2.4 MB',
      progress: 60
    });
    showToast('Berkas terpilih. Mengunggah draf tugas...', 'info');
    setTimeout(() => {
      setAttachedFile(prev => prev ? { ...prev, progress: 100 } : null);
    }, 800);
  };

  const handleDeleteFile = (e) => {
    e.stopPropagation();
    setAttachedFile(null);
    showToast('Draf file berhasil dihapus.', 'info');
  };

  const handleSubmitTask = async () => {
    if (!attachedFile || attachedFile.progress < 100) {
      showToast('Silakan pilih atau unggah file tugas Anda terlebih dahulu.', 'warning');
      return;
    }

    try {
      setIsSubmitting(true);
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/assignments/${assignmentId}/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          fileName: attachedFile.name
        })
      });

      if (!response.ok) {
        throw new Error('Gagal mengirimkan tugas ke server.');
      }

      const result = await response.json();
      showToast(result.message, 'success');
      await fetchDetails();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelSubmission = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/assignments/${assignmentId}/cancel`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) {
        throw new Error('Gagal membatalkan pengiriman tugas.');
      }

      showToast('Pengumpulan tugas berhasil dibatalkan.', 'info');
      await fetchDetails();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleProtestSubmit = async (e) => {
    e.preventDefault();
    if (!protestReason || !requestedGrade) {
      showToast('Alasan dan nilai harapan wajib diisi.', 'warning');
      return;
    }

    try {
      setIsSubmittingProtest(true);
      const token = localStorage.getItem('token');
      const response = await fetch('/api/protests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          submissionId: submission.id,
          reason: protestReason,
          requestedGrade: parseInt(requestedGrade, 10)
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Gagal mengirimkan sanggahan nilai.');
      }

      showToast('Sanggahan nilai berhasil dikirimkan!', 'success');
      setIsProtestModalOpen(false);
      setProtestReason('');
      setRequestedGrade('');
      await fetchDetails();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setIsSubmittingProtest(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6 text-left animate-pulse select-none w-full">
        <div className="h-8 bg-slate-200 rounded w-1/4"></div>
        <div className="h-4 bg-slate-200 rounded w-1/3"></div>
        <div className="h-32 bg-white border border-slate-100 rounded-3xl"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-5 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-700 text-xs font-semibold select-none text-left w-full">
        <div>
          <p className="font-bold">Terjadi Kesalahan</p>
          <p className="text-red-600 font-medium mt-0.5">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 text-left w-full">
      <button 
        onClick={handleBack}
        className="flex items-center gap-1.5 text-xs font-black text-slate-500 hover:text-slate-900 transition-colors select-none cursor-pointer focus:outline-none"
      >
        <ChevronLeft className="w-4 h-4 shrink-0" />
        Kembali ke Kelas
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* LEFT COLUMN: Assignment details */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white border border-slate-100 rounded-2xl p-6 sm:p-8 shadow-sm hover:shadow-md transition-shadow duration-200 space-y-6">
            <div className="space-y-2 pb-5 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 bg-purple-100 text-[#7047EB] text-[10px] font-black rounded-md uppercase">
                  {assignment.class_name}
                </span>
                <span className="text-[10px] text-slate-400 font-bold">
                  {assignment.subject_code} · {assignment.subject_name}
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight leading-tight">
                {assignment.title}
              </h2>
              
              <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-slate-400">
                <div className="flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-slate-400 shrink-0" />
                  <span>Tenggat: {new Date(assignment.deadline).toLocaleString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })} WIB</span>
                </div>
                <div className="flex items-center gap-1.5 text-[#7047EB]">
                  <Award className="w-4 h-4 text-[#7047EB] shrink-0" />
                  <span>Reward: +{assignment.xp_reward} XP</span>
                </div>
              </div>
            </div>

            <div className="space-y-4 text-slate-600 text-xs sm:text-sm leading-relaxed">
              <p className="font-bold text-slate-800">
                Instruksi & Deskripsi Penugasan:
              </p>
              <p className="whitespace-pre-line">{assignment.description}</p>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Submission panel */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow duration-200 space-y-6">
            <div className="space-y-3 pb-5 border-b border-slate-100">
              <h3 className="text-sm font-extrabold text-slate-800 tracking-tight select-none">
                Status Pengumpulan
              </h3>
              <div>
                {!submission ? (
                  <span className="px-2.5 py-0.5 bg-slate-100 border border-slate-200 text-slate-500 text-[10px] font-black rounded-md inline-flex items-center gap-1 uppercase select-none">
                    Belum Mengumpulkan
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 bg-emerald-50 border border-emerald-100 text-emerald-600 text-[10px] font-black rounded-md inline-flex items-center gap-1 uppercase select-none">
                    <CheckCircle className="w-3 h-3" />
                    Terkumpul
                  </span>
                )}
              </div>
            </div>

            {/* Drag and Drop Container */}
            {!submission && isStudent && (
              <div 
                onClick={handleSimulateFileSelect}
                className="border-2 border-dashed border-slate-200 hover:border-[#7047EB] bg-slate-50/30 hover:bg-violet-50/10 rounded-2xl p-6 text-center cursor-pointer transition-all group"
              >
                <div className="flex flex-col items-center justify-center gap-3">
                  <div className="w-12 h-12 bg-white rounded-xl shadow-sm border border-slate-100 flex items-center justify-center text-slate-400 group-hover:text-[#7047EB] group-hover:shadow-md transition-all duration-200">
                    <UploadCloud className="w-6 h-6" />
                  </div>
                  
                  <div className="space-y-1">
                    <p className="text-xs font-black text-slate-800">
                      Pilih berkas tugas (.pdf)
                    </p>
                    <p className="text-[10px] text-slate-400 font-semibold">
                      atau <span className="text-[#7047EB] underline">Klik untuk Mencari</span>
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Attached file display */}
            {attachedFile && (
              <div className="border border-slate-100 rounded-2xl p-4 bg-slate-50/40 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="w-8 h-8 text-red-550 shrink-0" />
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-800 truncate" title={attachedFile.name}>
                        {attachedFile.name}
                      </div>
                      <div className="text-[10px] text-slate-400 font-bold">
                        {attachedFile.size}
                      </div>
                    </div>
                  </div>

                  {!submission && isStudent && (
                    <button 
                      onClick={handleDeleteFile}
                      className="p-1 hover:bg-slate-200 rounded-lg text-slate-400 hover:text-red-550 transition-colors cursor-pointer"
                      title="Hapus berkas"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[10px] font-black text-slate-800">
                    <span>
                      {attachedFile.progress === 100 ? 'Selesai diunggah' : 'Mengunggah...'}
                    </span>
                    <span className="text-[#7047EB]">
                      {attachedFile.progress}%
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-200/60 rounded-full overflow-hidden">
                    <div 
                      className="bg-[#7047EB] h-full rounded-full transition-all duration-300"
                      style={{ width: `${attachedFile.progress}%` }}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Action buttons */}
            {isStudent && (
              <div className="space-y-2">
                <Button
                  onClick={handleSubmitTask}
                  disabled={!!submission || isSubmitting || !attachedFile}
                  className="w-full py-3.5 rounded-xl font-bold bg-[#7047EB] hover:bg-[#5E3BD2] text-white shadow-md shadow-violet-500/20 cursor-pointer text-xs disabled:opacity-50"
                >
                  {isSubmitting ? 'Mengirim tugas...' : submission ? 'Tugas Terkirim' : 'Kirim Tugas'}
                </Button>
                
                {submission && submission.grade === null && (
                  <button
                    onClick={handleCancelSubmission}
                    className="w-full py-2.5 rounded-xl text-xs font-black text-slate-500 hover:text-slate-800 border border-slate-200 bg-white hover:bg-slate-50 cursor-pointer transition-colors"
                  >
                    Batalkan Pengiriman
                  </button>
                )}
              </div>
            )}

            {/* Grade Display Panel */}
            {submission && submission.grade !== null && (
              <div className="border-t border-slate-100 pt-5 space-y-4 text-left">
                <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">
                  Hasil Penilaian
                </h4>
                <div className="bg-purple-50/40 border border-purple-200/30 rounded-2xl p-4 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-slate-400 block font-black leading-none mb-1">Nilai Tugas</span>
                    <span className="text-2xl font-black text-[#7047EB]">{submission.grade} / 100</span>
                  </div>
                  <div className="w-10 h-10 rounded-full bg-white shadow-sm border border-slate-100 flex items-center justify-center text-[#7047EB]">
                    <Award className="w-5 h-5" />
                  </div>
                </div>

                {submission.feedback && (
                  <div className="bg-slate-50 rounded-xl p-3 text-xs font-semibold text-slate-600 leading-relaxed">
                    <span className="text-[10px] text-slate-400 block font-black mb-1">Umpan Balik Guru:</span>
                    "{submission.feedback}"
                  </div>
                )}

                {/* Protest Button Trigger */}
                {isStudent && !protest && (
                  <button
                    onClick={() => setIsProtestModalOpen(true)}
                    className="w-full py-2.5 rounded-xl text-xs font-black text-[#7047EB] hover:text-[#5E3BD2] border border-purple-200/50 bg-purple-50/30 hover:bg-purple-50 transition-colors cursor-pointer"
                  >
                    Ajukan Protes Nilai
                  </button>
                )}

                {/* Protest status box if exists */}
                {protest && (
                  <div className="border border-slate-100 rounded-2xl p-3.5 space-y-2 bg-white text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-black text-slate-800 flex items-center gap-1">
                        <Inbox className="w-3.5 h-3.5 text-[#7047EB]" />
                        Banding Nilai
                      </span>
                      <span className={`px-2 py-0.5 rounded-md text-[9px] font-black
                        ${protest.status === 'Pending' ? 'bg-amber-100 text-amber-700' : protest.status === 'Disetujui' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}
                      `}>
                        {protest.status}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-550 font-semibold space-y-1">
                      <p><strong>Harapan:</strong> {protest.requested_grade} / 100</p>
                      <p><strong>Alasan:</strong> "{protest.reason}"</p>
                      {protest.teacher_feedback && (
                        <p className="border-t border-slate-100 pt-1.5 mt-1.5 text-slate-600">
                          <strong>Komentar Guru:</strong> "{protest.teacher_feedback}"
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Appeal/Protest Modal */}
      {isProtestModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm select-none">
          <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl border border-slate-100 text-left animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-base font-extrabold text-slate-900">
                  Ajukan Sanggahan Nilai
                </h3>
                <p className="text-[10px] text-slate-400 font-semibold">
                  Isi argumen keberatan atas penilaian guru beserta nilai harapan Anda.
                </p>
              </div>
              <button 
                onClick={() => setIsProtestModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-50 text-slate-500 flex items-center justify-center hover:bg-slate-100 transition-colors focus:outline-none cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleProtestSubmit} className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-black text-slate-700">
                  Nilai yang Diharapkan (0 - 100)
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  required
                  placeholder="95"
                  value={requestedGrade}
                  onChange={(e) => setRequestedGrade(e.target.value)}
                  className="w-full text-xs font-semibold border border-slate-200 rounded-xl px-3.5 py-3 focus:outline-none focus:border-[#7047EB] bg-white transition-colors shadow-sm"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-black text-slate-700">
                  Alasan Sanggahan / Keberatan
                </label>
                <textarea
                  rows="4"
                  required
                  placeholder="Tuliskan argumen ilmiah atau rincian perbaikan tugas Anda di sini..."
                  value={protestReason}
                  onChange={(e) => setProtestReason(e.target.value)}
                  className="w-full text-xs font-semibold border border-slate-200 rounded-xl px-3.5 py-3 focus:outline-none focus:border-[#7047EB] bg-white transition-colors shadow-sm resize-none"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsProtestModalOpen(false)}
                  className="px-4 py-2.5 border border-slate-200 rounded-xl text-xs font-black text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <Button
                  type="submit"
                  disabled={isSubmittingProtest}
                  className="bg-[#7047EB] hover:bg-[#5E3BD2] text-white py-2.5 px-5 rounded-xl font-bold shadow-md shadow-violet-500/10 cursor-pointer text-xs"
                >
                  {isSubmittingProtest ? 'Mengirim...' : 'Kirim Sanggahan'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AssignmentDetailPage;
