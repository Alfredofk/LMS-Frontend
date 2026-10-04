import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle, BookOpen, RefreshCw, X } from 'lucide-react';

import { useT } from '../../i18n/LanguageContext';
import { apiErrorMessage } from '../../i18n/apiError';
import { contentService } from '../../services/contentService';
import ContentItem from './ContentItem';
import { useContentTracker } from './contentTracking';

/*
  A meeting's content in a panel from the right (owner, 2026-10-03): wide on a
  desktop, the whole screen on a phone, so a long text or a video has room.

  Opened from a meeting on the Principal's timetable (`staff`: drafts are shown
  there too, marked as such). A student reads a meeting's content on its own page
  since 2026-10-04 (views/Classroom/ClassroomMeeting.jsx; owner: the panel felt
  too small). Read only: adding and publishing content is the teacher's. Each
  item is ContentItem.jsx.

  Escape closes this panel alone. It listens on window in the capture phase and
  stops the key there, so the dialog it may sit on (the timetable's) does not
  close with it.

  ## A student's learning events

  Were a student to open it, what they do would be sent to `POST /tracking/events`
  (contentTracking.js, tracker.js), as on the meeting's page; staff never are.

  @param sessionId  the meeting
  @param heading    { subject, lines: string[] } already translated, for the top
*/

export const SessionContentDrawer = ({ sessionId, heading, staff = false, onClose }) => {
  const { t } = useT();
  /* For a student only; staff (the timetable's) read without being tracked. */
  const tracker = useContentTracker(!staff);
  const closeRef = useRef(null);
  const openerRef = useRef(null);
  /* undefined: reading · { contents } · { error, gone } */
  const [state, setState] = useState(undefined);
  const [fileError, setFileError] = useState(null);

  /* Bumped by "Try again"; the read below runs once per value. */
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    contentService
      .listForSession(sessionId)
      .then((answer) => !cancelled && setState({ contents: answer?.contents ?? [] }))
      .catch((err) => !cancelled && setState({ error: apiErrorMessage(err, t), gone: err?.status === 404 }));
    return () => {
      cancelled = true;
    };
  }, [sessionId, t, attempt]);

  const load = () => {
    setState(undefined);
    setAttempt((n) => n + 1);
  };

  /* The caller's onClose may be a new function each render; the listener below is
     set once, so it reads the latest through a ref. */
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    openerRef.current = document.activeElement;
    closeRef.current?.focus();
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopPropagation();
      onCloseRef.current();
    };
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      if (openerRef.current?.isConnected) openerRef.current.focus();
    };
  }, []);

  return createPortal(
    <div className="fixed inset-0 z-[55] flex justify-end bg-slate-900/40 backdrop-blur-[2px]" onClick={onClose}>
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="content-drawer-title"
        onClick={(e) => e.stopPropagation()}
        className="animate-slide-in h-full w-full sm:max-w-lg bg-canvas shadow-2xl flex flex-col text-left"
      >
        <header className="bg-white border-b border-slate-100 px-5 py-4 flex items-start gap-3">
          <span className="w-10 h-10 rounded-xl bg-brand text-white flex items-center justify-center shrink-0">
            <BookOpen className="w-5 h-5" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{t('content.title')}</p>
            <h2 id="content-drawer-title" className="text-base font-extrabold text-slate-900 break-words">
              {heading?.subject}
            </h2>
            {heading?.lines?.length > 0 && (
              <p className="mt-1 flex flex-wrap gap-1.5 text-[10px] font-bold">
                {heading.lines.filter(Boolean).map((line) => (
                  <span key={line} className="px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600">
                    {line}
                  </span>
                ))}
              </p>
            )}
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label={t('common.close')}
            className="w-9 h-9 -mr-1 rounded-xl text-slate-500 hover:bg-slate-100 flex items-center justify-center shrink-0 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            <X className="w-4.5 h-4.5" aria-hidden="true" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto overscroll-contain p-5 space-y-3">
          {fileError && (
            <p className="p-3 rounded-xl bg-rose-50 text-rose-700 text-xs font-semibold" role="alert">
              {fileError}
            </p>
          )}

          {state === undefined ? (
            <div className="space-y-3" aria-label={t('common.loading')}>
              {[0, 1].map((n) => (
                <div key={n} className="h-28 rounded-2xl bg-white border border-slate-100 animate-pulse" />
              ))}
            </div>
          ) : state.error ? (
            <div className="rounded-2xl bg-white border border-slate-100 p-5 space-y-3" role="alert">
              <p className="flex items-start gap-2 text-xs font-extrabold text-rose-700">
                <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
                {state.gone ? t('content.error.gone') : state.error}
              </p>
              {!state.gone && (
                <button
                  type="button"
                  onClick={load}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-extrabold text-brand bg-brand-tint hover:bg-brand hover:text-white rounded-xl transition-all cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
                  {t('att.error.retry')}
                </button>
              )}
            </div>
          ) : state.contents.length === 0 ? (
            <div className="rounded-2xl bg-white border border-dashed border-slate-200 py-12 px-6 text-center">
              <BookOpen className="w-9 h-9 text-slate-300 mx-auto" aria-hidden="true" />
              <p className="mt-2.5 text-xs font-extrabold text-slate-600">{t('content.empty')}</p>
            </div>
          ) : (
            <ul className="space-y-3">
              {state.contents.map((item) => (
                <ContentItem key={item.id} item={item} staff={staff} tracker={tracker} onFileError={setFileError} />
              ))}
            </ul>
          )}

          {tracker && state?.contents?.length > 0 && (
            <p className="pt-1 text-[11px] font-medium text-slate-500 leading-relaxed">{t('content.trackingNote')}</p>
          )}
        </div>
      </aside>
    </div>,
    document.body
  );
};

export default SessionContentDrawer;
