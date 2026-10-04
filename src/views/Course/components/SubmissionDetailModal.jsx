import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  X, 
  FileText, 
  Download, 
  CheckCircle2, 
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck
} from 'lucide-react';
import { useT } from '../../../i18n/LanguageContext';

export const SubmissionDetailModal = ({
  submission,
  classSubject,
  onClose,
  onSaveScore,
  onPrev,
  onNext,
  isFirst,
  isLast,
  currentIndex,
  totalCount,
  onDownload,
  locale
}) => {
  const { t } = useT();
  const [scoreInput, setScoreInput] = useState(
    submission.score !== null && submission.score !== undefined ? String(submission.score) : ''
  );
  const [feedbackInput, setFeedbackInput] = useState(submission.feedback ?? '');
  const [gradingError, setGradingError] = useState(null);

  const handleSubmit = (e) => {
    e.preventDefault();
    const parsedScore = scoreInput.trim() === '' ? null : Number(scoreInput);
    if (parsedScore !== null && (isNaN(parsedScore) || parsedScore < 0 || parsedScore > 100)) {
      setGradingError(t('teacherCourses.submission.invalidScore'));
      return;
    }
    setGradingError(null);
    onSaveScore(submission.id, parsedScore, feedbackInput.trim() || null);
  };

  const isLate = submission.status === 'LATE';

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs select-none overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="submission-modal-title"
    >
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 max-w-2xl w-full p-6 sm:p-7 space-y-6 text-left relative my-8">
        
        {/* Modal Header */}
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="flex items-start gap-3.5 min-w-0">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-tint text-sm font-extrabold text-brand shadow-inner">
              {submission.studentName
                .split(' ')
                .map((part) => part[0])
                .join('')
                .slice(0, 2)
                .toUpperCase()}
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 id="submission-modal-title" className="text-base font-extrabold text-slate-900 truncate">
                  {submission.studentName}
                </h3>
                <span
                  className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-bold uppercase ${
                    isLate
                      ? 'bg-amber-50 text-amber-700 border border-amber-200/60'
                      : 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                  }`}
                >
                  {isLate
                    ? t('teacherCourses.submission.status.late')
                    : t('teacherCourses.submission.status.onTime')}
                </span>
              </div>
              <p className="text-xs font-semibold text-brand mt-0.5">
                {submission.assessmentTitle} · {classSubject.className}
              </p>
              <p className="text-[11px] font-medium text-slate-500 mt-0.5">
                {t('teacherCourses.submission.submittedAt')}:{' '}
                {new Date(submission.submittedAt).toLocaleString(locale, {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-50 hover:bg-slate-100 flex items-center justify-center text-slate-500 hover:text-slate-800 transition-colors cursor-pointer shrink-0"
            aria-label={t('teacherCourses.submission.close')}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body: Student Notes & Attachment */}
        <div className="space-y-4">
          {/* Student Notes */}
          <div className="space-y-1.5">
            <h4 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">
              {t('teacherCourses.submission.studentNotes')}
            </h4>
            <div className="bg-slate-50/80 border border-slate-200/70 rounded-xl p-3.5 text-xs text-slate-700 font-medium leading-relaxed">
              {submission.notes || (
                <span className="italic text-slate-500">
                  {t('teacherCourses.submission.noNotes')}
                </span>
              )}
            </div>
          </div>

          {/* Attachment File Card */}
          {submission.attachment && (
            <div className="space-y-1.5">
              <h4 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">
                {t('teacherCourses.submission.attachment')}
              </h4>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 bg-white border border-slate-200 rounded-xl shadow-xs">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-lg bg-purple-50 text-brand flex items-center justify-center shrink-0">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-extrabold text-slate-800 truncate">
                      {submission.attachment.name}
                    </p>
                    <p className="text-[10px] font-semibold text-slate-500">
                      {submission.attachment.size}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => onDownload(submission.attachment)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 hover:bg-purple-100 text-brand text-xs font-bold rounded-lg transition-colors cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>{t('teacherCourses.submission.download')}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Grading Form Section */}
          <form onSubmit={handleSubmit} className="space-y-4 pt-3 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <ClipboardCheck className="w-4 h-4 text-brand" />
                {t('teacherCourses.submission.gradingTitle')}
              </h4>
              <Link
                to={`/teacher/gradebook?classSubjectId=${classSubject.id}`}
                className="text-[11px] font-bold text-brand hover:underline inline-flex items-center gap-1"
              >
                <span>{t('teacherCourses.submission.openGradebook')}</span>
                <ExternalLink className="w-3 h-3" />
              </Link>
            </div>

            {gradingError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs font-semibold text-red-700">
                {gradingError}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-1 space-y-1.5">
                <label htmlFor="score-input" className="block text-xs font-extrabold text-slate-700">
                  {t('teacherCourses.submission.scoreLabel')}
                </label>
                <div className="relative">
                  <input
                    id="score-input"
                    type="number"
                    min="0"
                    max="100"
                    value={scoreInput}
                    onChange={(e) => setScoreInput(e.target.value)}
                    placeholder={t('teacherCourses.submission.scorePlaceholder')}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition-all"
                  />
                </div>
              </div>

              <div className="sm:col-span-2 space-y-1.5">
                <label htmlFor="feedback-input" className="block text-xs font-extrabold text-slate-700">
                  {t('teacherCourses.submission.feedbackLabel')}
                </label>
                <textarea
                  id="feedback-input"
                  rows="2"
                  value={feedbackInput}
                  onChange={(e) => setFeedbackInput(e.target.value)}
                  placeholder={t('teacherCourses.submission.feedbackPlaceholder')}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition-all placeholder:text-slate-400"
                />
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-brand hover:bg-brand-deep active:scale-95 text-white text-xs font-extrabold rounded-xl transition-all shadow-sm cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{t('teacherCourses.submission.saveScore')}</span>
              </button>
            </div>
          </form>
        </div>

        {/* Modal Footer: Prev / Next Navigation */}
        <div className="flex items-center justify-between border-t border-slate-100 pt-4 text-xs font-bold select-none">
          <button
            type="button"
            disabled={isFirst}
            onClick={onPrev}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-slate-600 hover:text-slate-900 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>{t('teacherCourses.submission.prev')}</span>
          </button>

          <span className="text-slate-500 font-medium">
            {currentIndex + 1} / {totalCount}
          </span>

          <button
            type="button"
            disabled={isLast}
            onClick={onNext}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-slate-600 hover:text-slate-900 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
          >
            <span>{t('teacherCourses.submission.next')}</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

      </div>
    </div>
  );
};

export default SubmissionDetailModal;
