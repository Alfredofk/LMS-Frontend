import React, { useState } from 'react';
import { useParams, useNavigate, useLocation, useOutletContext } from 'react-router-dom';
import { classroomData } from '../Classroom/classroomData';
import { 
  ChevronLeft, 
  UploadCloud, 
  FileText, 
  CheckCircle, 
  AlertCircle, 
  Clock, 
  Award,
  BookOpen,
  Trash2
} from 'lucide-react';
import Button from '../../components/ui/Button';
import { useT } from '../../i18n/LanguageContext';

export const AssignmentDetailPage = () => {
  const { assignmentId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { showToast } = useOutletContext();
  /*
    Only the not-found state below uses this. The rest of the page is still
    hardcoded Indonesian — it is outside the translated set, and CLAUDE.md says
    so. New code here is translated regardless; the old is not worth half-doing.
  */
  const { t } = useT();

  // Find dynamic assignment info based on course ID or fallback
  let activeAssignment = null;
  let activeCourse = null;
  
  for (const course of classroomData) {
    for (const section of course.sections) {
      const found = section.assignments.find(a => a.id === assignmentId);
      if (found) {
        activeAssignment = found;
        activeCourse = course;
        break;
      }
    }
    if (activeAssignment) break;
  }

  /*
    Not finding the assignment used to mean inventing one — a title, a deadline,
    an XP reward, a subject and a class, all written out and rendered as fact.
    And since `classroomData` is `[]`, that branch was the only one that ever
    ran, so this page showed the same fictional chemistry report to everybody
    who opened it. One of its values, "XII IPA 2", also broke the IPA/IPS ban in
    the backend's glossary.

    Now it says it could not find it. The early return has to wait until after
    the hooks below, which is why they take a safe default rather than being
    skipped.
  */

  // Track submission state
  const [status, setStatus] = useState(activeAssignment?.status ?? 'pending');
  const [attachedFile, setAttachedFile] = useState(null); // Simulated attached file
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!activeAssignment) {
    return (
      <div className="py-20 flex flex-col items-center justify-center text-center bg-white border border-slate-100 rounded-2xl p-6 shadow-sm">
        <div className="w-14 h-14 bg-slate-50 text-slate-400 rounded-2xl flex items-center justify-center mb-4">
          <FileText className="w-6 h-6" aria-hidden="true" />
        </div>
        <p className="text-sm font-extrabold text-slate-900">{t('assignment.notFound')}</p>
        <p className="text-xs text-slate-500 font-bold mt-1 max-w-sm leading-relaxed">
          {t('assignment.notFoundDetail')}
        </p>
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="mt-5 px-4 py-2 rounded-xl border border-slate-200 text-xs font-extrabold text-slate-600 hover:border-brand hover:text-brand transition-colors cursor-pointer"
        >
          {t('ann.back')}
        </button>
      </div>
    );
  }

  // Back navigation path helper
  const handleBack = () => {
    const courseId = location.state?.courseId || activeCourse.id;
    navigate(`/classroom/${courseId}`);
  };

  // Simulate file selection
  const handleSimulateFileSelect = () => {
    if (status === 'completed') return;
    setAttachedFile({
      name: '12_AndiRahmat_LaporanAsamBasa.pdf',
      size: '3.2 MB',
      progress: 60 // Fixed progress bar simulation at 60% as requested
    });
    showToast('File terpilih. Mengunggah draf tugas (60% selesai)...', 'info');
  };

  // Delete attached draf
  const handleDeleteFile = (e) => {
    e.stopPropagation();
    setAttachedFile(null);
    showToast('Draf file berhasil dihapus.', 'info');
  };

  // Submit task trigger
  const handleSubmitTask = () => {
    if (!attachedFile) {
      showToast('Silakan pilih atau unggah file tugas Anda terlebih dahulu.', 'warning');
      return;
    }

    setIsSubmitting(true);
    setTimeout(() => {
      setStatus('completed');
      setAttachedFile(prev => ({ ...prev, progress: 100 }));
      setIsSubmitting(false);
      showToast('Tugas berhasil dikirim! Anda meraih +' + activeAssignment.xpReward + ' XP.', 'success');
    }, 1000);
  };

  // Status Badge styling helper
  const renderStatusBadge = () => {
    if (status === 'completed') {
      return (
        <span className="px-2.5 py-0.5 bg-emerald-50 border border-emerald-100 text-emerald-600 text-[10px] font-extrabold rounded-md inline-flex items-center gap-1 uppercase select-none">
          <CheckCircle className="w-3 h-3" />
          Terkumpul
        </span>
      );
    }
    if (status === 'late') {
      return (
        <span className="px-2.5 py-0.5 bg-red-50 border border-red-100 text-red-500 text-[10px] font-extrabold rounded-md inline-flex items-center gap-1 uppercase select-none">
          <AlertCircle className="w-3 h-3" />
          Terlambat
        </span>
      );
    }
    return (
      <span className="px-2.5 py-0.5 bg-slate-100 border border-slate-200 text-slate-500 text-[10px] font-extrabold rounded-md inline-flex items-center gap-1 uppercase select-none">
        Belum Mengumpulkan
      </span>
    );
  };

  return (
    <div className="space-y-6 text-left">
      
      {/* Back button link */}
      <button 
        onClick={handleBack}
        className="flex items-center gap-1.5 text-xs font-extrabold text-slate-500 hover:text-slate-900 transition-colors select-none cursor-pointer focus:outline-none"
      >
        <ChevronLeft className="w-4 h-4 shrink-0" />
        Kembali ke Kelas
      </button>

      {/* Main Grid Wrapper */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        
        {/* ========================================== */}
        {/* LEFT COLUMN: Assignment details (2/3)      */}
        {/* ========================================== */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white border border-slate-100 rounded-2xl p-6 sm:p-8 shadow-sm hover:shadow-md transition-shadow duration-200 space-y-6">
            
            {/* Header info */}
            <div className="space-y-2 pb-5 border-b border-slate-100">
              <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight leading-tight">
                {activeAssignment.title}
              </h2>
              
              <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-slate-500">
                <div className="flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-slate-400 shrink-0" />
                  <span>Tenggat: {activeAssignment.deadline}</span>
                </div>
                <div className="flex items-center gap-1.5 text-brand">
                  <Award className="w-4 h-4 text-brand shrink-0" />
                  <span>Reward: +{activeAssignment.xpReward} XP</span>
                </div>
              </div>
            </div>

            {/* Description guidelines */}
            <div className="space-y-4 text-slate-600 text-xs sm:text-sm leading-relaxed">
              <p className="font-bold text-slate-800">
                Instruksi Praktikum & Ketentuan Laporan:
              </p>
              <p>
                Eksperimen praktikum bertujuan untuk menguji tingkat keasaman (pH) dari berbagai larutan kebutuhan rumah tangga sehari-hari (seperti air sabun, cuka dapur, larutan garam, dan sari jeruk nipis) menggunakan ekstrak kubis ungu sebagai indikator asam-basa alami.
              </p>
              <p>
                Silakan susun laporan praktikum ilmiah Anda dengan struktur formal sebagai berikut:
              </p>
              <ul className="list-decimal list-inside pl-2 space-y-2 font-medium">
                <li><strong className="text-slate-900">Tujuan Percobaan:</strong> Deskripsikan tujuan utama pengujian kadar pH larutan.</li>
                <li><strong className="text-slate-900">Alat dan Bahan:</strong> Rincikan daftar bahan larutan penguji dan porsi indikator kubis ungu.</li>
                <li><strong className="text-slate-900">Langkah Kerja:</strong> Deskripsikan alur pencampuran indikator kubis ungu ke larutan uji langkah demi langkah.</li>
                <li><strong className="text-slate-900">Tabel Pengamatan & Pembahasan:</strong> Catat perubahan warna indikator alami dan jelaskan alasannya berdasarkan teori asam-basa Arrhenius.</li>
                <li><strong className="text-slate-900">Kesimpulan:</strong> Tarik kesimpulan final mengenai pembagian sifat larutan yang diuji.</li>
              </ul>
              
              <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 space-y-2 mt-4 text-xs">
                <span className="font-extrabold text-slate-800 uppercase tracking-wider block">Format Pengumpulan Berkas:</span>
                <ul className="list-disc list-inside space-y-1 text-slate-500 font-semibold">
                  <li>Format file wajib dalam bentuk <strong className="text-red-500">PDF (.pdf)</strong>.</li>
                  <li>Ukuran berkas maksimum adalah <strong className="text-slate-800">10 MB</strong>.</li>
                  <li>Format nama berkas: <code className="bg-white border border-slate-200 px-1 py-0.5 rounded text-brand">NIS_NamaLengkap_LaporanAsamBasa.pdf</code>.</li>
                </ul>
              </div>
            </div>

            {/* Assessment rubric criteria */}
            <div className="pt-6 border-t border-slate-100 space-y-4">
              <h3 className="text-sm font-extrabold text-slate-900 tracking-tight flex items-center gap-1.5 select-none">
                <BookOpen className="w-4 h-4 text-brand shrink-0" />
                Kriteria Penilaian (Rubrik)
              </h3>
              
              <div className="border border-slate-100 rounded-xl overflow-hidden shadow-sm">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100 font-extrabold text-slate-800 select-none">
                      <th className="p-3.5 pl-4">Kriteria</th>
                      <th className="p-3.5">Bobot</th>
                      <th className="p-3.5 pr-4">Deskripsi Kompetensi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-500 font-semibold">
                    <tr className="hover:bg-slate-50/30">
                      <td className="p-3.5 pl-4 font-bold text-slate-800">Sistematika Laporan</td>
                      <td className="p-3.5 text-brand font-extrabold">30%</td>
                      <td className="p-3.5 pr-4 leading-normal">Kelengkapan susunan laporan (Judul, Tujuan, Metode, Pengamatan, Pembahasan, Kesimpulan).</td>
                    </tr>
                    <tr className="hover:bg-slate-50/30">
                      <td className="p-3.5 pl-4 font-bold text-slate-800">Analisis & Pembahasan</td>
                      <td className="p-3.5 text-brand font-extrabold">50%</td>
                      <td className="p-3.5 pr-4 leading-normal">Ketajaman analisis reaksi larutan, kesesuaian data perubahan warna, dan penerapan teori kimia.</td>
                    </tr>
                    <tr className="hover:bg-slate-50/30">
                      <td className="p-3.5 pl-4 font-bold text-slate-800">Kesimpulan & Sumber</td>
                      <td className="p-3.5 text-brand font-extrabold">20%</td>
                      <td className="p-3.5 pr-4 leading-normal">Ketepatan penarikan kesimpulan akhir beserta pencantuman rujukan referensi pustaka ilmiah.</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        </div>

        {/* ========================================== */}
        {/* RIGHT COLUMN: Submission panel (1/3)       */}
        {/* ========================================== */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow duration-200 space-y-6">
            
            <div className="space-y-3 pb-5 border-b border-slate-100">
              <h3 className="text-sm font-extrabold text-slate-900 tracking-tight select-none">
                Status Pengumpulan
              </h3>
              <div>
                {renderStatusBadge()}
              </div>
            </div>

            {/* Drag and Drop Container (simulated file selection on click) */}
            {status !== 'completed' && (
              <div 
                onClick={handleSimulateFileSelect}
                className="border-2 border-dashed border-slate-200 hover:border-brand bg-slate-50/30 hover:bg-violet-50/10 rounded-2xl p-6 text-center cursor-pointer transition-all group"
              >
                <div className="flex flex-col items-center justify-center gap-3">
                  <div className="w-12 h-12 bg-white rounded-xl shadow-sm border border-slate-100 flex items-center justify-center text-slate-400 group-hover:text-brand group-hover:shadow-md transition-all duration-200">
                    <UploadCloud className="w-6 h-6" />
                  </div>
                  
                  <div className="space-y-1">
                    <p className="text-xs font-extrabold text-slate-800">
                      Tarik & Lepas berkas di sini
                    </p>
                    <p className="text-[10px] text-slate-500 font-semibold">
                      atau <span className="text-brand underline">Klik untuk Mencari</span>
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Simulated file upload loader bar (60% on draf selection) */}
            {attachedFile && (
              <div className="border border-slate-100 rounded-2xl p-4 bg-slate-50/40 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="w-8 h-8 text-red-500 shrink-0" />
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-800 truncate" title={attachedFile.name}>
                        {attachedFile.name}
                      </div>
                      <div className="text-[10px] text-slate-500 font-bold">
                        {attachedFile.size}
                      </div>
                    </div>
                  </div>

                  {status !== 'completed' && (
                    <button 
                      onClick={handleDeleteFile}
                      className="p-1 hover:bg-slate-200 rounded-lg text-slate-500 hover:text-red-500 transition-colors cursor-pointer"
                      title="Hapus draf"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Progress bar container (60% loading draf, 100% completed) */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[10px] font-extrabold text-slate-800">
                    <span>
                      {attachedFile.progress === 100 ? 'Selesai diunggah' : 'Mengunggah berkas...'}
                    </span>
                    <span className="text-brand">
                      {attachedFile.progress}%
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-200/60 rounded-full overflow-hidden">
                    <div 
                      className="bg-brand h-full rounded-full transition-all duration-550"
                      style={{ width: `${attachedFile.progress}%` }}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Action buttons list */}
            <div className="space-y-2">
              <Button
                onClick={handleSubmitTask}
                disabled={status === 'completed' || isSubmitting}
                className="w-full py-3.5 rounded-xl shadow-md shadow-brand/20 cursor-pointer text-xs"
              >
                {isSubmitting ? 'Mengirim tugas...' : status === 'completed' ? 'Tugas Terkirim' : 'Kirim Tugas'}
              </Button>
              
              {status === 'completed' && (
                <button
                  onClick={() => {
                    setStatus('pending');
                    setAttachedFile(null);
                    showToast('Pengumpulan dibatalkan. Berkas diubah kembali ke draf.', 'info');
                  }}
                  className="w-full py-2.5 rounded-xl text-xs font-extrabold text-slate-500 hover:text-slate-800 border border-slate-200 bg-white hover:bg-slate-50 cursor-pointer transition-colors"
                >
                  Batalkan Pengiriman
                </button>
              )}
            </div>

          </div>
        </div>

      </div>

    </div>
  );
};

export default AssignmentDetailPage;
