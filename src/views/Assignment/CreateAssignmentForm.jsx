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
import { useT } from '../../i18n/LanguageContext';

export const CreateAssignmentForm = () => {
  const navigate = useNavigate();
  const { showToast } = useOutletContext();
  const { t } = useT();

  // Form input states
  const [title, setTitle] = useState('');
  const [type, setType] = useState('Tugas Mandiri');
  const [deadline, setDeadline] = useState('');
  const [xpReward, setXpReward] = useState('100');
  const [description, setDescription] = useState('');
  const [uploadedFiles, setUploadedFiles] = useState([]);

  const [isDragActive, setIsDragActive] = useState(false);
  /* No isSubmitting state: nothing is submitted. It used to drive a 1.5s
     fake delay before an alert that claimed success. */

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
      showToast(t('asg.attached', { n: files.length }), 'success');
    }
  };

  const handleFileBrowse = (e) => {
    if (e.target.files && e.target.files[0]) {
      const files = Array.from(e.target.files);
      setUploadedFiles(prev => [...prev, ...files.map(f => f.name)]);
      showToast(t('asg.attached', { n: files.length }), 'success');
    }
  };

  const removeFile = (fileName) => {
    setUploadedFiles(prev => prev.filter(f => f !== fileName));
    showToast(t('asg.removed'), 'info');
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim()) {
      showToast(t('asg.require.title'), 'warning');
      return;
    }
    if (!deadline) {
      showToast(t('asg.require.deadline'), 'warning');
      return;
    }
    if (!description.trim()) {
      showToast(t('asg.require.description'), 'warning');
      return;
    }

    /*
      Nothing is published. There is no endpoint to publish to — no
      Assignment model exists in the schema at all — and this used to hide
      that behind a setTimeout, an alert saying it had worked, and a walk to
      /classroom/matematika-lanjut, a course id nothing has ever served.

      Somebody would have written a real assignment into this form, been
      told it went out, and found nothing. Saying so plainly costs a feature
      nobody had.
    */
    showToast(t('common.notBuilt.title'), 'info');
  };

  return (
    <div className="space-y-6 text-left max-w-4xl mx-auto w-full">
      
      {/* Back to Dashboard bar */}
      <div className="select-none text-left">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-xs font-extrabold text-slate-400 hover:text-brand transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          {t('asg.back')}
        </button>
        <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight leading-tight mt-2.5">
          {t('asg.title')}
        </h1>
        <p className="text-xs text-slate-400 font-bold mt-0.5">
          {t('asg.subtitle')}
        </p>
      </div>

      {/* Main Form container Card */}
      <div className="bg-white border border-slate-100 rounded-2xl p-6 sm:p-8 shadow-sm hover:shadow-md transition-shadow duration-200">
        <form onSubmit={handleSubmit} className="space-y-6">
          
          {/* Row 1: Title and Type */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            
            {/* Title Input */}
            <div className="md:col-span-2 space-y-1.5">
              <label className="text-xs font-extrabold text-slate-700 flex items-center gap-1 select-none">
                {t('asg.field.title')} <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder={t('asg.field.title.hint')}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full text-xs font-semibold border border-slate-200 rounded-xl pl-4 pr-10 py-3 focus:outline-none focus:border-brand transition-colors bg-white shadow-sm"
                />
                <FileText className="absolute right-3.5 top-3.5 w-4 h-4 text-slate-400" />
              </div>
            </div>

            {/* Type Selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-extrabold text-slate-700 select-none">
                {t('asg.field.type')}
              </label>
              <div className="relative">
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  className="w-full text-xs font-extrabold text-slate-800 border border-slate-200 rounded-xl px-4 py-3 bg-white focus:outline-none focus:border-brand transition-colors cursor-pointer appearance-none shadow-sm"
                >
                  <option value="Tugas Mandiri">{t('asg.type.independent')}</option>
                  <option value="Kuis">{t('asg.type.quiz')}</option>
                  <option value="Laporan Praktikum">{t('asg.type.report')}</option>
                </select>
                <ChevronDown className="absolute right-3.5 top-4 w-4 h-4 text-slate-400 pointer-events-none" />
              </div>
            </div>

          </div>

          {/* Row 2: Deadline and Reward XP */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            
            {/* Datetime deadline picker */}
            <div className="space-y-1.5">
              <label className="text-xs font-extrabold text-slate-700 flex items-center gap-1 select-none">
                {t('asg.field.deadline')} <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="datetime-local"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  className="w-full text-xs font-semibold border border-slate-200 rounded-xl pl-4 pr-4 py-3 focus:outline-none focus:border-brand transition-colors bg-white shadow-sm"
                />
              </div>
            </div>

            {/* XP reward points */}
            <div className="space-y-1.5">
              <label className="text-xs font-extrabold text-slate-700 flex items-center gap-1 select-none">
                {t('asg.field.xp')} <span className="text-[10px] text-slate-400 font-semibold">{t('asg.field.xp.hint')}</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  max="1000"
                  value={xpReward}
                  onChange={(e) => setXpReward(e.target.value)}
                  className="w-full text-xs font-extrabold text-slate-800 border border-slate-200 rounded-xl pl-4 pr-10 py-3 focus:outline-none focus:border-brand transition-colors bg-white shadow-sm"
                />
                <Award className="absolute right-3.5 top-3.5 w-4 h-4 text-brand" />
              </div>
            </div>

          </div>

          {/* Row 3: Rich Editor simulated toolbar & Textarea instructions */}
          <div className="space-y-1.5">
            <label className="text-xs font-extrabold text-slate-700 flex items-center gap-1 select-none">
              {t('asg.field.description')} <span className="text-red-500">*</span>
            </label>
            
            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
              {/* Fake formatting toolbar */}
              <div className="bg-slate-50 border-b border-slate-200 px-3.5 py-2 flex items-center gap-1 select-none">
                <button
                  type="button"
                  onClick={() => showToast(t('asg.toolAction', { tool: t('asg.tool.bold') }), 'info')}
                  className="p-1.5 hover:bg-slate-200/60 rounded text-slate-700 transition-colors focus:outline-none cursor-pointer"
                  title={t('asg.tool.bold')}
                >
                  <Bold className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => showToast(t('asg.toolAction', { tool: t('asg.tool.italic') }), 'info')}
                  className="p-1.5 hover:bg-slate-200/60 rounded text-slate-700 transition-colors focus:outline-none cursor-pointer"
                  title={t('asg.tool.italic')}
                >
                  <Italic className="w-3.5 h-3.5" />
                </button>
                <span className="w-px h-4 bg-slate-300 mx-1"></span>
                <button
                  type="button"
                  onClick={() => showToast(t('asg.toolAction', { tool: t('asg.tool.list') }), 'info')}
                  className="p-1.5 hover:bg-slate-200/60 rounded text-slate-700 transition-colors focus:outline-none cursor-pointer"
                  title={t('asg.tool.list')}
                >
                  <List className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Textarea editor */}
              <textarea
                rows={5}
                placeholder={t('asg.field.description.hint')}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full text-xs font-semibold p-4 focus:outline-none bg-white transition-colors border-0"
              />
            </div>
          </div>

          {/* Row 4: Attachment Upload Area */}
          <div className="space-y-1.5">
            <label className="text-xs font-extrabold text-slate-700 select-none">
              {t('asg.field.attachment')} <span className="text-[10px] text-slate-400 font-semibold">{t('asg.field.attachment.hint')}</span>
            </label>
            
            {/* Drag & Drop dashed box */}
            <div 
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-xl p-6 text-center transition-all select-none relative cursor-pointer
                ${isDragActive 
                  ? 'border-brand bg-purple-50/20' 
                  : 'border-slate-200 hover:border-slate-300 bg-slate-50/30'
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
                <div className="w-10 h-10 rounded-full bg-purple-50 text-brand flex items-center justify-center shadow-inner">
                  <UploadCloud className="w-5 h-5" />
                </div>
                <p className="text-xs font-extrabold text-slate-800">
                  {t('asg.drop.prompt')}<span className="text-brand hover:underline">{t('asg.drop.browse')}</span>
                </p>
                <p className="text-[10px] text-slate-400 font-bold">
                  {t('asg.drop.limits')}
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
                      className="p-1 hover:bg-slate-200 rounded text-slate-400 hover:text-red-500 transition-colors focus:outline-none cursor-pointer"
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
              onClick={() => navigate(-1)}
              className="px-5 py-2.5 border border-slate-200 text-slate-500 hover:text-slate-700 hover:bg-slate-50 rounded-xl font-extrabold text-xs cursor-pointer focus:outline-none transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {t('asg.cancel')}
            </button>
            <Button
              type="submit"
              className="py-2.5 px-5 rounded-xl shadow-md shadow-brand/10 cursor-pointer text-xs disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {t('asg.submit')}
            </Button>
          </div>

        </form>
      </div>

    </div>
  );
};

export default CreateAssignmentForm;
