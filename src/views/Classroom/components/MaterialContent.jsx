import React from 'react';
import { FileText, Video, Download, Eye } from 'lucide-react';

export const MaterialContent = ({ sections, showToast }) => {
  const handleAction = (action, fileName) => {
    if (showToast) {
      const verb = action === 'download' ? 'Mengunduh' : 'Membuka';
      showToast(`${verb} berkas "${fileName}"...`, 'success');
    }
  };

  if (!sections || sections.length === 0) {
    return (
      <div className="py-10 text-center bg-white border border-slate-100 rounded-2xl p-6 shadow-sm select-none">
        <p className="text-xs font-semibold text-slate-500">Tidak ada materi belajar untuk mata pelajaran ini.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 text-left select-none">
      {sections.map((session) => (
        <div 
          key={session.id}
          className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow duration-200"
        >
          {/* Header block */}
          <div className="space-y-1.5 pb-4 border-b border-slate-100">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
              <h3 className="text-sm font-extrabold text-slate-800 tracking-tight">
                {session.title}
              </h3>
              <span className="text-[10px] text-slate-400 font-bold bg-slate-50 border border-slate-100 px-2 py-0.5 rounded-md self-start sm:self-auto">
                Dipublikasikan: {session.date}
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium leading-relaxed">
              {session.desc}
            </p>
          </div>

          {/* Attachments Section */}
          <div className="pt-4 space-y-3">
            <h4 className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">
              Lampiran Pembelajaran
            </h4>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {(session.materials || []).map((file, idx) => {
                const isPdf = file.type === 'pdf';
                const fileName = file.title || file.name || 'Lampiran Berkas';
                
                return (
                  <div 
                    key={idx}
                    className="flex items-center justify-between p-3.5 rounded-xl border border-slate-100/60 bg-slate-50/30 hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0 pr-2">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-sm
                        ${isPdf ? 'bg-red-50 text-red-500' : 'bg-blue-50 text-blue-500'}
                      `}>
                        {isPdf ? <FileText className="w-4 h-4" /> : <Video className="w-4 h-4" />}
                      </div>
                      
                      <div className="min-w-0 text-left">
                        <div className="text-xs font-extrabold text-slate-800 truncate" title={fileName}>
                          {fileName}
                        </div>
                        <div className="text-[10px] text-slate-400 font-bold">
                          {file.size}
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 shrink-0">
                      <button 
                        onClick={() => handleAction('view', fileName)}
                        className="p-1.5 hover:bg-slate-100 text-slate-500 hover:text-slate-900 rounded-lg transition-colors cursor-pointer"
                        title="Lihat Berkas"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleAction('download', fileName)}
                        className="p-1.5 hover:bg-slate-100 text-slate-500 hover:text-slate-900 rounded-lg transition-colors cursor-pointer"
                        title="Unduh Berkas"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                    </div>

                  </div>
                );
              })}
            </div>
          </div>

        </div>
      ))}
    </div>
  );
};

export default MaterialContent;
