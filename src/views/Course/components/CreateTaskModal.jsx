import React, { useState } from 'react';
import { X, FileText, Calendar } from 'lucide-react';
import Button from '../../../components/ui/Button';

export const CreateTaskModal = ({ isOpen, onClose, onSubmit }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [deadline, setDeadline] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title || !description || !deadline) return;

    if (onSubmit) {
      onSubmit({ title, description, deadline });
    }

    // Reset fields
    setTitle('');
    setDescription('');
    setDeadline('');
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
      <div className="bg-white rounded-3xl w-full max-w-[500px] shadow-2xl relative z-10 border border-slate-100 transform transition-all p-6 sm:p-8 animate-in fade-in zoom-in-95 duration-150">
        {/* Header section */}
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100 select-none">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-violet-50 text-[#7047EB] rounded-xl flex items-center justify-center">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900 leading-tight">Buat Tugas Baru</h3>
              <p className="text-[10px] text-slate-400 font-bold mt-0.5">Tambahkan penugasan untuk kelas ini</p>
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
            <label htmlFor="title" className="text-xs font-black text-slate-900 uppercase tracking-wider block">
              Judul Tugas
            </label>
            <input
              id="title"
              type="text"
              placeholder="Masukkan judul tugas..."
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-[#7047EB] focus:ring-1 focus:ring-[#7047EB] outline-none text-xs font-semibold placeholder-slate-400 transition-all bg-slate-50/50"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="desc" className="text-xs font-black text-slate-900 uppercase tracking-wider block">
              Deskripsi / Instruksi
            </label>
            <textarea
              id="desc"
              rows={4}
              placeholder="Jelaskan instruksi pengerjaan tugas secara rinci..."
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-[#7047EB] focus:ring-1 focus:ring-[#7047EB] outline-none text-xs font-semibold placeholder-slate-400 transition-all resize-none bg-slate-50/50"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="deadline" className="text-xs font-black text-slate-900 uppercase tracking-wider block flex items-center gap-1">
              <Calendar className="w-4 h-4 text-[#7047EB]" />
              Batas Waktu (Deadline)
            </label>
            <input
              id="deadline"
              type="datetime-local"
              required
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-[#7047EB] focus:ring-1 focus:ring-[#7047EB] outline-none text-xs font-semibold transition-all bg-slate-50/50"
            />
          </div>

          <div className="flex gap-3 pt-4 select-none">
            <button
              type="button"
              onClick={onClose}
              className="w-1/2 py-3 border border-slate-200 hover:bg-slate-50 text-slate-500 rounded-2xl justify-center font-black text-xs transition-colors cursor-pointer outline-none focus:outline-none"
            >
              Batal
            </button>
            <Button
              type="submit"
              className="w-1/2 py-3 rounded-2xl justify-center font-black text-xs bg-[#7047EB] hover:bg-[#5E3BD2] text-white shadow-lg shadow-[#7047EB]/20 cursor-pointer"
            >
              Buat Tugas
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateTaskModal;
