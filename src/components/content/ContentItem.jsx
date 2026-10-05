import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckCircle2,
  Download,
  ExternalLink,
  FileImage,
  FileText,
  Link2,
  Loader2,
  PlayCircle,
  Presentation,
  Type,
} from 'lucide-react';

import { useT } from '../../i18n/LanguageContext';
import { apiErrorMessage } from '../../i18n/apiError';
import { contentService } from '../../services/contentService';
import { downloadFile, openFileInNewTab } from '../../utils/openFile';
import { loadYouTubeApi } from '../../utils/youtubeApi';
import { fileSize, hostOf, isImage, isWebLink, opensInTab, youtubeEmbed } from './contentView';
import { readingMs } from './tracker';

/*
  One Content of a meeting, read only: a file to open or download (an image
  previewed), a YouTube video embedded, a text, a link. Shared by the meeting's
  page for a student (views/Classroom/ClassroomMeeting.jsx) and the drawer staff
  open from the timetable (SessionContentDrawer.jsx).

  Given a `tracker` (contentTracking.js), it reports what a student does with it
  - the rules are in tracker.js. Without one it reports nothing.

  `state` ('done' · 'opened', views/Classroom/materialProgress.js) puts the
  student's own progress on the card as a badge (owner, 2026-10-05); absent for
  staff and for a material never opened.
*/

const VIDEO_POLL_MS = 2_000;

/*
  Calls `onSeen` once, the first time half of `ref`'s element is on screen - or,
  for one taller than the screen, once it fills half of it.
*/
function useSeenOnce(ref, onSeen) {
  useEffect(() => {
    const el = ref.current;
    if (!el || !onSeen || typeof IntersectionObserver === 'undefined') return undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        const seen = entries.some(
          (entry) =>
            entry.isIntersecting &&
            (entry.intersectionRatio >= 0.5 || entry.intersectionRect.height >= window.innerHeight / 2)
        );
        if (seen) {
          observer.disconnect();
          onSeen();
        }
      },
      { threshold: [0, 0.01, 0.02, 0.05, 0.1, 0.25, 0.5] }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref, onSeen]);
}

/*
  A TEXT read to its end: its end on screen, once the text has been on screen
  for `readingMs` in all (tracker.js). Counted in half-second steps while any of
  it shows.
*/
function useReadToEnd(textRef, endRef, html, onRead) {
  useEffect(() => {
    const text = textRef.current;
    const end = endRef.current;
    if (!text || !end || !onRead || typeof IntersectionObserver === 'undefined') return undefined;
    const need = readingMs(html);
    let showing = false;
    let endSeen = false;
    let shown = 0;
    let done = false;
    const textObserver = new IntersectionObserver((entries) => {
      showing = entries[entries.length - 1].isIntersecting;
    });
    const endObserver = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) endSeen = true;
    });
    textObserver.observe(text);
    endObserver.observe(end);
    const timer = setInterval(() => {
      if (done || !showing) return;
      shown += 500;
      if (endSeen && shown >= need) {
        done = true;
        onRead();
      }
    }, 500);
    return () => {
      clearInterval(timer);
      textObserver.disconnect();
      endObserver.disconnect();
    };
  }, [textRef, endRef, html, onRead]);
}

/* A YouTube player's position, reported while it plays and when it stops. */
function useYouTubeProgress(iframeRef, onPosition) {
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe || !onPosition) return undefined;
    let cancelled = false;
    let player = null;
    let poll = null;
    const report = () => {
      try {
        if (player?.getDuration) onPosition(player.getCurrentTime(), player.getDuration());
      } catch {
        /* The player went away with the drawer. */
      }
    };
    loadYouTubeApi()
      .then((YT) => {
        if (cancelled) return;
        player = new YT.Player(iframe, {
          events: {
            onStateChange: (event) => {
              clearInterval(poll);
              poll = null;
              if (event.data === YT.PlayerState.PLAYING) poll = setInterval(report, VIDEO_POLL_MS);
              else report();
            },
          },
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      clearInterval(poll);
      report();
    };
  }, [iframeRef, onPosition]);
}

const FILE_ICON = { pdf: FileText, docx: FileText, pptx: Presentation, jpg: FileImage, png: FileImage };
const TYPE_ICON = { VIDEO: PlayCircle, TEXT: Type, LINK: Link2 };

/* An image file, fetched with the token and shown from an object URL. */
const ImagePreview = ({ contentId, alt, onFetched }) => {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    let made = null;
    let cancelled = false;
    contentService
      .file(contentId)
      .then((blob) => {
        if (cancelled) return;
        made = URL.createObjectURL(blob);
        setUrl(made);
        onFetched?.();
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      if (made) URL.revokeObjectURL(made);
    };
  }, [contentId, onFetched]);
  if (!url) return <div className="aspect-video rounded-xl bg-slate-100 animate-pulse" aria-hidden="true" />;
  return <img src={url} alt={alt} className="w-full max-h-80 object-contain rounded-xl bg-slate-50 border border-slate-100" />;
};

export const ContentItem = ({ item, staff, tracker, onFileError, highlighted = false, actions = null, state = null }) => {
  const { t, lang } = useT();
  const [opening, setOpening] = useState(false);
  const { type, payload } = item;
  const itemRef = useRef(null);
  const textRef = useRef(null);
  const endRef = useRef(null);
  const iframeRef = useRef(null);

  /* What this item reports, when a student reads it (tracker.js); nothing otherwise. */
  const id = item.id;
  const onSeen = useMemo(() => (tracker && type !== 'FILE' ? () => tracker.opened(id) : null), [tracker, type, id]);
  const onRead = useMemo(() => (tracker && type === 'TEXT' ? () => tracker.readToEnd(id) : null), [tracker, type, id]);
  const onPosition = useMemo(
    () => (tracker ? (position, duration) => tracker.video(id, position, duration) : null),
    [tracker, id]
  );
  /* The server completes a FILE when a student fetches it (tracking.record.js). */
  const onFetched = useMemo(() => (tracker && type === 'FILE' ? () => tracker.fileFetched(id) : null), [tracker, type, id]);
  useSeenOnce(itemRef, onSeen);
  useReadToEnd(textRef, endRef, payload?.html, onRead);
  const Icon = type === 'FILE' ? FILE_ICON[payload?.fileType] ?? FileText : TYPE_ICON[type] ?? FileText;

  const openFile = async () => {
    setOpening(true);
    try {
      if (opensInTab(payload.fileType)) await openFileInNewTab(() => contentService.file(item.id));
      else await downloadFile(() => contentService.file(item.id), payload.fileName);
      onFetched?.();
    } catch (err) {
      onFileError(apiErrorMessage(err, t));
    } finally {
      setOpening(false);
    }
  };

  const embed = type === 'VIDEO' ? youtubeEmbed(payload, tracker ? { origin: window.location.origin } : undefined) : null;
  const link = type === 'LINK' || (type === 'VIDEO' && !embed) ? payload?.url : null;
  useYouTubeProgress(iframeRef, embed ? onPosition : null);

  const followLink = () => {
    if (!tracker) return;
    tracker.linkClicked(id);
    tracker.flush().catch(() => {});
  };

  return (
    <li
      ref={itemRef}
      id={`content-${item.id}`}
      className={`scroll-mt-6 rounded-2xl border bg-white p-4 space-y-3 transition-shadow duration-500 ${
        highlighted ? 'border-brand ring-2 ring-brand/30' : 'border-slate-100'
      }`}
    >
      <div className="flex items-start gap-3">
        <span className="w-9 h-9 rounded-xl bg-brand-tint text-brand flex items-center justify-center shrink-0">
          <Icon className="w-4.5 h-4.5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-sm font-extrabold text-slate-800 break-words">{item.title}</h3>
            {state === 'done' && (
              <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 text-[10px] font-extrabold">
                <CheckCircle2 className="w-3 h-3" aria-hidden="true" />
                {t('content.state.done')}
              </span>
            )}
            {state === 'opened' && (
              <span className="shrink-0 px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 text-[10px] font-extrabold">
                {t('content.state.opened')}
              </span>
            )}
          </div>
          <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] font-bold">
            <span className="px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600">{t(`content.type.${type}`)}</span>
            {type === 'FILE' && payload?.fileType && (
              <span className="px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600 uppercase">{payload.fileType}</span>
            )}
            {type === 'FILE' && payload?.size != null && (
              <span className="px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600 tabular-nums">{fileSize(payload.size, lang)}</span>
            )}
            {staff && !item.published && (
              <span className="px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-700">{t('content.draft')}</span>
            )}
          </p>
        </div>
      </div>

      {type === 'FILE' && isImage(payload?.fileType) && <ImagePreview contentId={item.id} alt={item.title} onFetched={onFetched} />}

      {type === 'FILE' && (
        <button
          type="button"
          onClick={openFile}
          disabled={opening}
          className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-700 hover:bg-slate-50 cursor-pointer disabled:opacity-60 disabled:cursor-wait focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        >
          {opening ? (
            <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
          ) : opensInTab(payload?.fileType) ? (
            <ExternalLink className="w-4 h-4" aria-hidden="true" />
          ) : (
            <Download className="w-4 h-4" aria-hidden="true" />
          )}
          <span className="truncate">
            {t(opensInTab(payload?.fileType) ? 'content.file.open' : 'content.file.download', { name: payload?.fileName ?? '' })}
          </span>
        </button>
      )}

      {embed && (
        <div className="aspect-video w-full overflow-hidden rounded-xl bg-slate-900">
          <iframe
            ref={iframeRef}
            src={embed}
            title={item.title}
            className="w-full h-full"
            loading="lazy"
            allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
          />
        </div>
      )}

      {type === 'TEXT' && (
        /* Sanitised by the server before it was stored (content.service.js
           TEXT_RULES: a short tag list, https only, links opened away). */
        <div ref={textRef}>
          <div className="content-html text-sm text-slate-700" dangerouslySetInnerHTML={{ __html: payload?.html ?? '' }} />
          <div ref={endRef} className="h-px" aria-hidden="true" />
        </div>
      )}

      {link &&
        (isWebLink(link) ? (
          <a
            href={link}
            target="_blank"
            rel="noopener noreferrer"
            onClick={followLink}
            onAuxClick={followLink}
            className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-brand-tint hover:border-brand/30 text-sm font-bold text-brand transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            <ExternalLink className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span className="truncate">{hostOf(link)}</span>
          </a>
        ) : (
          <p className="text-xs font-semibold text-slate-500 break-all">{link}</p>
        ))}

      {/* The teacher's own tools for this item (TeacherMeeting): publish, edit, move, delete. */}
      {actions && <div className="flex flex-wrap items-center gap-1.5 pt-3 border-t border-slate-100">{actions}</div>}
    </li>
  );
};

export default ContentItem;
