import React, { useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { 
  FileText, 
  Calendar, 
  Award, 
  Bold, 
  Italic, 
  List, 
  UploadCloud, 
  X, 
  ArrowLeft,
  ChevronDown
} from 'lucide-react';
import Button from '../../components/ui/Button';

export const CreateAssignmentForm = () => {
  const navigate = useNavigate();
  const { showToast } = useOutletContext();

  // Form input states
  const [title, setTitle] = useState('');
  const [type, setType] = useState('Tugas Mandiri');
  const [deadline, setDeadline] = useState('');
  const [xpReward, setXpReward] = useState('100');
  const [description, setDescription] = useState('');
  const [uploadedFiles, setUploadedFiles] = useState([]);

  const [isDragActive, setIsDragActive] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragActive(true);
    } else if (e.type === "dragleave") {
      setIsDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const files = Array.from(e.dataTransfer.files);
      setUploadedFiles(prev => [...prev, ...files.map(f => f.name)]);
      showToast(`Berhasil melampirkan ${files.length} file.`, 'success');
    }
  };

  const handleFileBrowse = (e) => {
    if (e.target.files && e.target.files[0]) {
      const files = Array.from(e.target.files);
      setUploadedFiles(prev => [...prev, ...files.map(f => f.name)]);
      showToast(`Berhasil melampirkan ${files.length} file.`, 'success');
    }
  };

  const removeFile = (fileName) => {
    setUploadedFiles(prev => prev.filter(f => f !== fileName));
    showToast('Lampiran dihapus.', 'info');
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim()) {
      showToast('Judul Tugas wajib diisi.', 'warning');
      return;
    }
    if (!deadline) {
      showToast('Tenggat waktu wajib ditentukan.', 'warning');
      return;
    }
    if (!description.trim()) {
      showToast('Instruksi deskripsi tugas wajib diisi.', 'warning');
      return;
    }

    setIsSubmitting(true);
    showToast('Menerbitkan tugas baru...', 'info');
    
    setTimeout(() => {
      alert("Tugas berhasil diterbitkan!");
      setIsSubmitting(false);
      navigate('/classroom/matematika-lanjut');
    }, 1500);
  };

  return (
    <div className="space-y-6 text-left max-w-4xl mx-auto w-full">
      
      {/* Back to Dashboard bar */}
      <div className="select-none text-left">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-xs font-black text-slate-400 hover:text-[#7047EB] transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          Kembali
        </button>
        <h1 className="text-xl sm:text-2xl font-black text-slate-905 tracking-tight leading-tight mt-2.5">
          Buat Tugas Baru
        </h1>
        <p className="text-xs text-slate-400 font-bold mt-0.5">
          Tentukan parameter tugas, tenggat, instruksi, dan poin XP untuk siswa.
        </p>
      </div>

      {/* Main Form container Card */}
      <div className="bg-white border border-slate-100 rounded-2xl p-6 sm:p-8 shadow-sm hover:shadow-md transition-shadow duration-200">
        <form onSubmit={handleSubmit} className="space-y-6">
          
          {/* Row 1: Title and Type */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            
            {/* Title Input */}
            <div className="md:col-span-2 space-y-1.5">
              <label className="text-xs font-black text-slate-700 flex items-center gap-1 select-none">
                Judul Tugas <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Contoh: Laporan Praktikum Asam Basa"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full text-xs font-semibold border border-slate-200 rounded-xl pl-4 pr-10 py-3 focus:outline-none focus:border-[#7047EB] transition-colors bg-white shadow-sm"
                />
                <FileText className="absolute right-3.5 top-3.5 w-4 h-4 text-slate-400" />
              </div>
            </div>

            {/* Type Selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-black text-slate-700 select-none">
                Tipe Tugas
              </label>
              <div className="relative">
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  className="w-full text-xs font-black text-slate-800 border border-slate-200 rounded-xl px-4 py-3 bg-white focus:outline-none focus:border-[#7047EB] transition-colors cursor-pointer appearance-none shadow-sm"
                >
                  <option value="Tugas Mandiri">Tugas Mandiri</option>
                  <option value="Kuis">Kuis / Ujian</option>
                  <option value="Laporan Praktikum">Laporan Praktikum</option>
                </select>
                <ChevronDown className="absolute right-3.5 top-4 w-4 h-4 text-slate-405 pointer-events-none" />
              </div>
            </div>

          </div>

          {/* Row 2: Deadline and Reward XP */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            
            {/* Datetime deadline picker */}
            <div className="space-y-1.5">
              <label className="text-xs font-black text-slate-700 flex items-center gap-1 select-none">
                Tenggat Waktu (Deadline) <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="datetime-local"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  className="w-full text-xs font-semibold border border-slate-200 rounded-xl pl-4 pr-4 py-3 focus:outline-none focus:border-[#7047EB] transition-colors bg-white shadow-sm"
                />
              </div>
            </div>

            {/* XP reward points */}
            <div className="space-y-1.5">
              <label className="text-xs font-black text-slate-700 flex items-center gap-1 select-none">
                Reward XP <span className="text-[10px] text-slate-400 font-semibold">(Gamifikasi)</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  max="1000"
                  value={xpReward}
                  onChange={(e) => setXpReward(e.target.value)}
                  className="w-full text-xs font-black text-slate-800 border border-slate-200 rounded-xl pl-4 pr-10 py-3 focus:outline-none focus:border-[#7047EB] transition-colors bg-white shadow-sm"
                />
                <Award className="absolute right-3.5 top-3.5 w-4 h-4 text-[#7047EB]" />
              </div>
            </div>

          </div>

          {/* Row 3: Rich Editor simulated toolbar & Textarea instructions */}
          <div className="space-y-1.5">
            <label className="text-xs font-black text-slate-700 flex items-center gap-1 select-none">
              Deskripsi Instruksi Tugas <span className="text-red-500">*</span>
            </label>
            
            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
              {/* Fake formatting toolbar */}
              <div className="bg-slate-50 border-b border-slate-200 px-3.5 py-2 flex items-center gap-1 select-none">
                <button
                  type="button"
                  onClick={() => showToast('Aksi Bold terpilih.', 'info')}
                  className="p-1.5 hover:bg-slate-200/60 rounded text-slate-700 transition-colors focus:outline-none cursor-pointer"
                  title="Tebalkan"
                >
                  <Bold className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => showToast('Aksi Italic terpilih.', 'info')}
                  className="p-1.5 hover:bg-slate-200/60 rounded text-slate-700 transition-colors focus:outline-none cursor-pointer"
                  title="Miringkan"
                >
                  <Italic className="w-3.5 h-3.5" />
                </button>
                <span className="w-px h-4 bg-slate-300 mx-1"></span>
                <button
                  type="button"
                  onClick={() => showToast('Aksi List terpilih.', 'info')}
                  className="p-1.5 hover:bg-slate-200/60 rounded text-slate-700 transition-colors focus:outline-none cursor-pointer"
                  title="Daftar Poin"
                >
                  <List className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Textarea editor */}
              <textarea
                rows={5}
                placeholder="Tuliskan instruksi tugas secara rinci dan langkah pengerjaannya di sini..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full text-xs font-semibold p-4 focus:outline-none bg-white transition-colors border-0"
              />
            </div>
          </div>

          {/* Row 4: Attachment Upload Area */}
          <div className="space-y-1.5">
            <label className="text-xs font-black text-slate-700 select-none">
              Lampiran Materi / Soal <span className="text-[10px] text-slate-400 font-semibold">(Opsional)</span>
            </label>
            
            {/* Drag & Drop dashed box */}
            <div 
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-xl p-6 text-center transition-all select-none relative cursor-pointer
                ${isDragActive 
                  ? 'border-[#7047EB] bg-purple-50/20' 
                  : 'border-slate-200 hover:border-slate-350 bg-slate-50/30'
                }
              `}
            >
              <input
                type="file"
                multiple
                id="file-upload"
                onChange={handleFileBrowse}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <div className="flex flex-col items-center justify-center space-y-1.5 pointer-events-none">
                <div className="w-10 h-10 rounded-full bg-purple-50 text-[#7047EB] flex items-center justify-center shadow-inner">
                  <UploadCloud className="w-5 h-5" />
                </div>
                <p className="text-xs font-black text-slate-800">
                  Tarik & lepas berkas Anda di sini, atau <span className="text-[#7047EB] hover:underline">Pilih berkas</span>
                </p>
                <p className="text-[10px] text-slate-400 font-bold">
                  PDF, DOCX, XLS, PPTX (Maksimal 10MB)
                </p>
              </div>
            </div>

            {/* List of uploaded files */}
            {uploadedFiles.length > 0 && (
              <div className="pt-2.5 space-y-1.5">
                {uploadedFiles.map((file, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-100 rounded-lg text-xs font-bold text-slate-800">
                    <span className="truncate">{file}</span>
                    <button
                      type="button"
                      onClick={() => removeFile(file)}
                      className="p-1 hover:bg-slate-200 rounded text-slate-450 hover:text-red-500 transition-colors focus:outline-none cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

          </div>

          {/* Form Actions */}
          <div className="flex justify-end items-center gap-3 pt-4 border-t border-slate-100 select-none">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => navigate(-1)}
              className="px-5 py-2.5 border border-slate-200 text-slate-500 hover:text-slate-700 hover:bg-slate-50 rounded-xl font-extrabold text-xs cursor-pointer focus:outline-none transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Batal
            </button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="bg-[#7047EB] hover:bg-[#5E3BD2] text-white py-2.5 px-5 rounded-xl font-bold shadow-md shadow-violet-500/10 cursor-pointer text-xs disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Menyimpan...' : 'Terbitkan Tugas'}
            </Button>
          </div>

        </form>
      </div>

    </div>
  );
};

export default CreateAssignmentForm;
