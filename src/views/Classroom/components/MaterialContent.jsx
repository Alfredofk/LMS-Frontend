import React from 'react';
import { FileText, Video, Download, Eye } from 'lucide-react';

export const MaterialContent = ({ sections, showToast }) => {
  const handleAction = (action, fileName) => {
    const cleanTitle = fileName.trim();
    const isVideo = cleanTitle.toLowerCase().endsWith('.mp4') || cleanTitle.toLowerCase().endsWith('.mkv') || cleanTitle.toLowerCase().endsWith('.avi');
    const isTxt = cleanTitle.toLowerCase().endsWith('.txt');
    
    let blob;
    let finalFileName = cleanTitle;
    
    if (isVideo) {
      const mp4Base64 = 'AAAAIGZ0eXBpc29tAAACAGlzb21tcDgxbXA0MgAAAAhmcmVlAAAAG21kYXQAAAGAMGF0b20gY29kZWQgbXA0IAAAAA1tb292AAAAbG12aGQAAAAA3ndHNN53RzQAAAPoAAAAKAABAAABAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACAAACNXRyYWsAAABcdGtoZAAAAADed0c03ndHNAAAAAEAAAAAAAABAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACAAAAABNlZGlhAAAAWG1kaGQAAAAA3ndHNN53RzQAAAPoAAAAKABVAAAAAAAxaGQ3dGhlMAAAAAAxYXBwbAAAAAAxYXBwbAAAAAAxYXBwbAAAAAAxYXBwbAAAAAAxYXBwbAAAAC1oZGxyAAAAAAAAAAB2aWRlAAAAAAAAAAAAAAAAVmlkZW9IYW5kbGVyAAAAAVxtaW5mAAAAEHZtYWhkAAAAAQAAAAAAACRkaW5mAAAAHGRyZWYAAAAAAAAAAQAAAAxtdXJsAAAAAAAAAAcAc3RjbyAAAAAAAAABAAAADAAAAGNvb2tpAAAAAA==';
      const byteCharacters = atob(mp4Base64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      blob = new Blob([byteArray], { type: 'video/mp4' });
      if (!finalFileName.toLowerCase().endsWith('.mp4')) {
        finalFileName += '.mp4';
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
      if (!finalFileName.toLowerCase().endsWith('.pdf')) {
        finalFileName += '.pdf';
      }
    }

    const url = URL.createObjectURL(blob);

    if (action === 'download') {
      const link = document.createElement('a');
      link.href = url;
      link.download = finalFileName.replace(/\s+/g, '_');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      if (showToast) showToast(`Mengunduh berkas: ${finalFileName}...`, 'success');
    } else {
      // View action
      window.open(url, '_blank');
      if (showToast) showToast(`Membuka berkas: ${finalFileName}...`, 'success');
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
              <h3 className="text-sm font-extrabold text-slate-805 tracking-tight">
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
            <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-wider">
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
                        <div className="text-xs font-black text-slate-805 truncate" title={fileName}>
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
