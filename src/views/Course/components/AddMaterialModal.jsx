import React, { useState, useEffect, useRef } from 'react';
import { X, BookOpen, FileUp } from 'lucide-react';
import Button from '../../../components/ui/Button';

export const AddMaterialModal = ({ isOpen, onClose, onSubmit, editingMaterial }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState(null);
  
  const fileInputRef = useRef(null);

  // Sync state if editingMaterial changes
  useEffect(() => {
    if (isOpen) {
      if (editingMaterial) {
        setTitle(editingMaterial.title || '');
        setDescription(editingMaterial.description || '');
        setFile(null);
      } else {
        setTitle('');
        setDescription('');
        setFile(null);
      }
    }
  }, [editingMaterial, isOpen]);

  if (!isOpen) return null;

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title) return;
    if (!editingMaterial && !file) return; // File is required only for new material

    if (onSubmit) {
      onSubmit({ title, description, file });
    }

    // Reset fields
    setTitle('');
    setDescription('');
    setFile(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop blur overlay */}
      <div 
        onClick={onClose}
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" 
      />

      {/* Modal Card container */}
      <div className="bg-white rounded-3xl w-full max-w-[500px] shadow-2xl relative z-10 border border-slate-100 transform transition-all p-6 sm:p-8 duration-150">
        {/* Header section */}
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100 select-none">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-violet-50 text-brand rounded-xl flex items-center justify-center">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-extrabold text-slate-900 leading-tight">
                {editingMaterial ? 'Edit Materi' : 'Tambah Materi'}
              </h3>
              <p className="text-[10px] text-slate-500 font-bold mt-0.5">
                {editingMaterial ? 'Perbarui modul pembelajaran Anda' : 'Unggah modul pembelajaran baru'}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer focus:outline-none"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4 text-left">
          <div className="space-y-1">
            <label htmlFor="title" className="text-xs font-extrabold text-slate-900 uppercase tracking-wider block">
              Judul Materi
            </label>
            <input
              id="title"
              type="text"
              placeholder="Masukkan judul materi..."
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-brand focus:ring-1 focus:ring-brand outline-none text-xs font-semibold placeholder-slate-400 transition-all bg-slate-50/50"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="desc" className="text-xs font-extrabold text-slate-900 uppercase tracking-wider block">
              Deskripsi / Catatan
            </label>
            <textarea
              id="desc"
              rows={3}
              placeholder="Tambahkan deskripsi materi atau petunjuk ringkas..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-brand focus:ring-1 focus:ring-brand outline-none text-xs font-semibold placeholder-slate-400 transition-all resize-none bg-slate-50/50"
            />
          </div>

          {/* File Upload Area */}
          <div className="space-y-1">
            <span className="text-xs font-extrabold text-slate-900 uppercase tracking-wider block">
              File Materi {editingMaterial ? '(Opsional)' : ''}
            </span>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              required={!editingMaterial}
              className="hidden"
              accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.zip"
            />
            
            <div 
              onClick={() => fileInputRef.current && fileInputRef.current.click()}
              className="border-2 border-dashed border-slate-200 hover:border-brand bg-slate-50/50 hover:bg-slate-50 rounded-2xl p-6 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-2 group select-none"
            >
              <div className="w-10 h-10 rounded-full bg-violet-50 text-brand group-hover:scale-110 transition-transform flex items-center justify-center">
                <FileUp className="w-5 h-5" />
              </div>
              
              {file ? (
                <div className="space-y-0.5">
                  <p className="text-xs font-extrabold text-slate-800 truncate max-w-[340px]">{file.name}</p>
                  <p className="text-[10px] text-slate-500 font-bold">{(file.size / (1024 * 1024)).toFixed(2)} MB</p>
                </div>
              ) : editingMaterial ? (
                <div className="space-y-0.5 text-center">
                  <p className="text-xs font-extrabold text-slate-700 truncate max-w-[340px]">File tersimpan: {editingMaterial.title}.pdf</p>
                  <p className="text-[9px] text-brand font-extrabold uppercase">Klik di sini untuk mengganti file (opsional)</p>
                </div>
              ) : (
                <div className="space-y-0.5">
                  <p className="text-xs font-extrabold text-slate-700">Pilih berkas dokumen Anda</p>
                  <p className="text-[9px] text-slate-500 font-bold uppercase">Format: PDF, Word, PPT, Excel, Zip (Maks. 20MB)</p>
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-3 pt-4 select-none">
            <button
              type="button"
              onClick={onClose}
              className="w-1/2 py-3 border border-slate-200 hover:bg-slate-50 text-slate-500 rounded-2xl justify-center font-extrabold text-xs transition-colors cursor-pointer outline-none focus:outline-none"
            >
              Batal
            </button>
            <Button
              type="submit"
              className="w-1/2 py-3 rounded-2xl justify-center font-extrabold text-xs shadow-lg shadow-brand/20 cursor-pointer"
            >
              {editingMaterial ? 'Simpan Perubahan' : 'Simpan'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddMaterialModal;
