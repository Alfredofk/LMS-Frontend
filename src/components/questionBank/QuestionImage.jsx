import React, { useEffect, useState } from 'react';
import { ImageOff } from 'lucide-react';

import { useT } from '../../i18n/LanguageContext';
import { assessmentService } from '../../services/assessmentService';

/*
  A question's image (backend ed46340). The route sits behind requireAuth, so a
  plain <img src> would carry no token: the bytes are fetched with it and shown
  from an object URL, revoked when the image leaves the page. A saved question's
  image is read through that question (`questionId`); a fresh upload, not yet
  held by any question, by its id alone (the uploader's own). An Assessment's copy
  of a question is read through the Assessment (`assessmentId`, backend 0bb4598):
  its staff may not see the bank question it came from.
*/
export const QuestionImage = ({ imageId, questionId = null, assessmentId = null, alt = '', className = '' }) => {
  const { t } = useT();
  /* What was read, and for which image: an answer for another id counts as none yet. */
  const [loaded, setLoaded] = useState(null);
  const wanted = `${assessmentId ?? ''}/${questionId ?? ''}/${imageId ?? ''}`;

  useEffect(() => {
    if (!imageId) return undefined;
    let made = null;
    let cancelled = false;
    assessmentService
      .imageBlob({ questionId, assessmentId, imageId })
      .then((blob) => {
        if (cancelled) return;
        made = URL.createObjectURL(blob);
        setLoaded({ for: wanted, url: made });
      })
      .catch(() => !cancelled && setLoaded({ for: wanted, failed: true }));
    return () => {
      cancelled = true;
      if (made) URL.revokeObjectURL(made);
    };
  }, [imageId, questionId, assessmentId, wanted]);

  if (!imageId) return null;
  const current = loaded?.for === wanted ? loaded : null;
  const url = current?.url ?? null;
  const failed = Boolean(current?.failed);
  if (failed) {
    return (
      <span className={`inline-flex items-center gap-1.5 rounded-xl bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-600 ${className}`}>
        <ImageOff className="w-4 h-4 shrink-0" aria-hidden="true" />
        {t('qbank.image.failed')}
      </span>
    );
  }
  if (!url) return <span className={`block h-24 w-32 rounded-xl bg-slate-100 animate-pulse ${className}`} aria-label={t('common.loading')} />;
  return <img src={url} alt={alt} className={`block max-w-full h-auto rounded-xl border border-slate-100 ${className}`} />;
};

export default QuestionImage;
