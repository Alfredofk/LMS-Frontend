import React, { useId, useRef, useState } from 'react';
import { ImagePlus, Loader2, X } from 'lucide-react';

import { useT } from '../../i18n/LanguageContext';
import { questionBankErrorMessage } from '../../i18n/apiError';
import { assessmentService } from '../../services/assessmentService';
import { imageFileError } from '../../views/QuestionBank/questionBank';
import QuestionImage from './QuestionImage';

/*
  An image for a question or one of its options (backend ed46340): uploaded the
  moment it is picked, then named by id when the question is saved (owner,
  2026-10-05). Removing it only drops the id from the draft - images are never
  deleted on the server, and a duplicate may share it.

  @param imageId     the id the draft holds, or null
  @param questionId  the saved question's id, to read an image it already holds
  @param assessmentId an assessment whose copy holds it (a copy edited in place,
                      backend 6380e3e), read through that assessment instead
  @param onChange    (imageId | null) => void
*/
export const ImagePicker = ({ imageId, questionId = null, assessmentId = null, onChange, disabled = false, label, compact = false }) => {
  const { t } = useT();
  const inputId = useId();
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  /* The ids uploaded here: read as the uploader's own until the question holds them. */
  const [fresh, setFresh] = useState(() => new Set());

  const pick = async (file) => {
    if (!file) return;
    const problem = imageFileError(file);
    if (problem) {
      setError(t(problem));
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const image = await assessmentService.uploadImage(file);
      if (image?.id) {
        setFresh((prev) => new Set(prev).add(image.id));
        onChange(image.id);
      }
    } catch (err) {
      setError(questionBankErrorMessage(err, t));
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-1.5">
      {imageId ? (
        <div className="relative inline-block max-w-full">
          <QuestionImage
            imageId={imageId}
            questionId={fresh.has(imageId) ? null : questionId}
            assessmentId={fresh.has(imageId) ? null : assessmentId}
            alt={label ?? ''}
            className={compact ? 'max-h-32' : 'max-h-64'}
          />
          <button
            type="button"
            onClick={() => onChange(null)}
            disabled={disabled}
            aria-label={t('qbank.image.remove')}
            className="absolute top-1.5 right-1.5 w-7 h-7 rounded-lg bg-slate-900/60 text-white shadow flex items-center justify-center cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      ) : (
        <>
          <input
            ref={inputRef}
            id={inputId}
            type="file"
            accept=".jpg,.jpeg,.png,image/jpeg,image/png"
            className="sr-only peer"
            disabled={disabled || busy}
            onChange={(e) => pick(e.target.files?.[0] ?? null)}
          />
          <label
            htmlFor={inputId}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-dashed border-slate-300 text-xs font-bold text-slate-600 hover:bg-slate-50 peer-focus-visible:ring-2 peer-focus-visible:ring-brand ${
              disabled || busy ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'
            }`}
          >
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" /> : <ImagePlus className="w-3.5 h-3.5" aria-hidden="true" />}
            {busy ? t('qbank.image.uploading') : label ?? t('qbank.image.add')}
          </label>
        </>
      )}
      {!compact && !imageId && <p className="text-[11px] font-medium text-slate-500">{t('qbank.image.hint')}</p>}
      {error && (
        <p className="text-xs font-semibold text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
};

export default ImagePicker;
