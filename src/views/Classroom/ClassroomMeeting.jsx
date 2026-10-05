import React, { useCallback, useEffect, useState } from 'react';
import { AlertCircle, BookOpen, CalendarClock, CheckCircle2, ChevronLeft, ChevronRight, ClipboardCheck, FileText, Link2, Loader2, MapPin, PlayCircle, RefreshCw, Type } from 'lucide-react';

import ContentItem from '../../components/content/ContentItem';
import { useContentTracker } from '../../components/content/contentTracking';
import InfoChips from '../../components/ui/InfoChips';
import { useT } from '../../i18n/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import { apiErrorMessage, checkInErrorMessage, isStaleCheckIn } from '../../i18n/apiError';
import { contentService } from '../../services/contentService';
import { sessionsService } from '../../services/sessionsService';
import { attendanceService } from '../../services/attendanceService';
import { localOf } from '../Attendance/attendance';
import { PositionError, readPosition, rowState, withCheckIn } from '../Attendance/checkIn';
import { SessionStatusLine } from '../Attendance/TodaySessionsCard';
import { meetingState, meetingWhen } from './myClasses';
import { firstUndone, isTracked, materialState, mergeProgress, progressById, progressSummary } from './materialProgress';

/*
  One meeting, inside its subject's page (owner, 2026-10-04, after BINUSMAYA's
  session view): the meeting and its materials in one card on the left, "what
  to do" on the right - on a phone, between the meeting and its materials.

  - Materials: `GET /content/sessions/:id`, each a ContentItem; what the student
    does with them is tracked (contentTracking.js) and a line says so.
  - What to do: the student's attendance for it. On the meeting's own day the
    row comes from `GET /sessions/mine?date=` - it carries `canCheckIn` - and the
    check-in is taken right here, as on today's card (checkIn.js, the same
    refusals); any other day it is the subject's attendance row. Then the
    materials the teacher shared, each with the student's own progress - done,
    in progress, or not yet - and how many are done (materialProgress.js, backend
    b0f3307; owner 2026-10-05). The tracker's answers tick a material at once; a
    meeting whose every material is done says so beside its title.
  - One material at a time under "Materi" (owner, 2026-10-05): the one picked in
    "what to do", with previous / next under it. It opens on the first not yet
    done (firstUndone), chosen once when the list arrives.

  Keyed on the meeting by its parent, so another meeting starts a fresh tracker
  and the last one's events are sent on the way out.

  @param meeting     a session from the subject's list (sessionView, with `local`)
  @param attendance  the student's row for it, null for none, undefined while reading, false when unread
  @param onAttendance(row) a check-in was taken
*/

const card = 'bg-white border border-slate-100 rounded-2xl p-5 shadow-sm';
const TONE = { PRESENT: 'emerald', SICK: 'amber', EXCUSED: 'sky', ABSENT: 'rose' };
const TYPE_ICON = { VIDEO: PlayCircle, TEXT: Type, LINK: Link2, FILE: FileText };

const CheckIn = ({ meeting, attendance, onAttendance }) => {
  const { t, lang } = useT();
  const { membership } = useAuth();
  const zone = membership?.school?.timeZone ?? null;
  const today = zone ? localOf(new Date(), zone)?.date : null;
  const isToday = meeting.status === 'SCHEDULED' && meeting.local?.date === today;

  /* The day as /sessions/mine answers it, for `canCheckIn`; only on the meeting's own day. */
  const [day, setDay] = useState(null);
  const [busy, setBusy] = useState(null);
  const [notice, setNotice] = useState(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!isToday) return undefined;
    let cancelled = false;
    sessionsService
      .mine({ date: today })
      .then((answer) => !cancelled && setDay(answer))
      .catch(() => !cancelled && setDay(false));
    return () => {
      cancelled = true;
    };
  }, [isToday, today, attempt]);

  const row = day ? day.sessions?.find((entry) => entry.id === meeting.id) ?? null : null;

  const checkIn = async () => {
    if (busy || !row) return;
    setNotice(null);
    setBusy('locating');
    try {
      const position = await readPosition();
      setBusy('sending');
      const answer = await attendanceService.checkIn(row.id, position);
      const taken = answer?.attendance;
      if (taken) {
        setDay((current) => withCheckIn(current, row.id, taken));
        onAttendance?.({ ...taken, session: { id: row.id, number: row.number, confirmed: false, status: 'SCHEDULED' } });
      }
      const at = taken?.checkedInAt ? localOf(taken.checkedInAt, zone) : null;
      const lines = [t('checkin.done', { time: at?.time ?? '' })];
      if (taken?.late) lines.push(t('checkin.done.late'));
      if (taken?.outsideSchool) lines.push(t('checkin.done.outside'));
      setNotice({ tone: 'ok', lines });
    } catch (err) {
      setNotice({
        tone: 'error',
        lines: [err instanceof PositionError ? t(`checkin.position.${err.reason}`) : checkInErrorMessage(err, t)],
      });
      if (isStaleCheckIn(err)) setAttempt((n) => n + 1);
    } finally {
      setBusy(null);
    }
  };

  let body;
  if (isToday && day === null) {
    body = <span className="block h-5 w-36 rounded-md bg-slate-100 animate-pulse" />;
  } else if (isToday && row) {
    const state = rowState(row, { hasLocation: membership?.school?.hasLocation, className: membership?.student?.class?.name });
    const checkedAt = row.attendance?.checkedInAt ? localOf(row.attendance.checkedInAt, zone) : null;
    body = (
      <div className="space-y-2.5">
        <SessionStatusLine state={state} session={row} checkedAt={checkedAt} t={t} />
        {state === 'open' && (
          <button
            type="button"
            onClick={checkIn}
            disabled={Boolean(busy)}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-brand text-white text-sm font-extrabold hover:bg-brand-deep disabled:opacity-60 disabled:cursor-wait cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <MapPin className="w-4 h-4" aria-hidden="true" />}
            {busy ? t(`checkin.step.${busy}`) : t('checkin.action')}
          </button>
        )}
      </div>
    );
  } else {
    const state = attendance === false ? null : meetingState(meeting, attendance);
    const upcoming = meeting.status === 'SCHEDULED' && new Date(meeting.startsAt) > new Date();
    /* Over and gone (owner, 2026-10-04): said in words, so a past meeting does not read as still to come. */
    const ended = meeting.status === 'SCHEDULED' && meeting.endsAt && new Date(meeting.endsAt) <= new Date();
    body = (
      <div className="space-y-1.5">
        {state && (
          <InfoChips
            size="xs"
            items={[
              {
                label: t(state.key),
                tone: meeting.status === 'CANCELLED' ? 'rose' : state.status ? TONE[state.status] : 'slate',
              },
              state.status && !state.final && { label: t('classroom.pendingConfirm') },
            ]}
          />
        )}
        {upcoming && (
          <p className="text-[11px] font-semibold text-slate-500">
            {t('meeting.checkInOpens', { when: meetingWhen(meeting, lang, { weekday: 'long' }) })}
          </p>
        )}
        {ended && (
          <p className="text-[11px] font-semibold text-slate-500">
            {t(attendance === null ? 'meeting.endedNoRecord' : 'meeting.ended', { when: meetingWhen(meeting, lang, { weekday: 'long', withEnd: true }) })}
          </p>
        )}
        {attendance === false && <p className="text-[11px] font-semibold text-amber-700">{t('classroom.attFailed')}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="flex items-center gap-2 text-sm font-extrabold text-slate-800">
        <ClipboardCheck className="w-4 h-4 text-brand" aria-hidden="true" />
        {t('meeting.attendance')}
      </p>
      {body}
      {notice && (
        <div
          role={notice.tone === 'error' ? 'alert' : 'status'}
          className={`rounded-xl px-3 py-2 text-[11px] font-semibold ${
            notice.tone === 'error' ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'
          }`}
        >
          {notice.lines.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
      )}
    </div>
  );
};

export const ClassroomMeeting = ({ meeting, attendance, onAttendance }) => {
  const { t, lang } = useT();
  /* The material shown under "Materi"; set when the list arrives, then by the student. */
  const [selected, setSelected] = useState(null);

  /* The student's progress per material: from the list, then what each event's answer adds. */
  const [progress, setProgress] = useState({});
  const onProgress = useCallback(
    (id, update) => setProgress((prev) => ({ ...prev, [id]: mergeProgress(prev[id], update, new Date().toISOString()) })),
    []
  );
  const tracker = useContentTracker(true, onProgress);

  /* undefined: reading · { contents } · { error, gone } */
  const [content, setContent] = useState(undefined);
  const [attempt, setAttempt] = useState(0);
  const [fileError, setFileError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    contentService
      .listForSession(meeting.id)
      .then((answer) => {
        if (cancelled) return;
        const contents = answer?.contents ?? [];
        const byId = progressById(contents);
        setContent({ contents });
        setProgress(byId);
        setSelected(firstUndone(contents, byId));
      })
      .catch((err) => !cancelled && setContent({ error: apiErrorMessage(err, t), gone: err?.status === 404 }));
    return () => {
      cancelled = true;
    };
  }, [meeting.id, t, attempt]);

  const count = content?.contents?.length;
  const tracked = isTracked(content?.contents);
  const summary = progressSummary(content?.contents, progress);
  const allDone = tracked && summary.total > 0 && summary.done === summary.total;

  /* A material picked in "what to do": scrolled to and ringed for a moment (owner, 2026-10-04). */
  const [highlighted, setHighlighted] = useState(null);
  useEffect(() => {
    if (!highlighted) return undefined;
    const timer = setTimeout(() => setHighlighted(null), 1800);
    return () => clearTimeout(timer);
  }, [highlighted]);
  const goToContent = (id) => {
    setSelected(id);
    setHighlighted(id);
    /* After the swap has rendered, so the material scrolled to is the new one. */
    requestAnimationFrame(() =>
      document.getElementById(`content-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    );
  };

  const contents = content?.contents ?? [];
  const shownIndex = Math.max(0, contents.findIndex((item) => item.id === selected));
  const shown = contents[shownIndex] ?? null;
  const stateOf = (item) => (tracked ? materialState(progress[item.id]) : null);

  return (
    /* On a wide screen the meeting and its materials read as one card, with "what to
       do" beside it from its top (owner, 2026-10-04). On a phone they are two cards
       with "what to do" between them: which meeting, then the check-in, which is
       bound to the clock, then the materials, however long. Three grid children, so
       the order changes without rendering anything twice. */
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_18rem] gap-5 lg:gap-y-0 items-start">
      <div className={`${card} sm:p-6 min-w-0 lg:self-stretch lg:col-start-1 lg:row-start-1 lg:rounded-b-none lg:border-b-0 lg:pb-0 lg:[clip-path:inset(-1rem_-1rem_0_-1rem)]`}>
        <div className="space-y-2">
          <h2 className="flex flex-wrap items-center gap-2 text-xl font-extrabold text-slate-900 tracking-tight">
            {t('meeting.title', { n: meeting.number })}
            {allDone && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 text-xs font-extrabold tracking-normal">
                <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                {t('meeting.done')}
              </span>
            )}
          </h2>
          <p className="flex items-center gap-2 text-sm sm:text-base font-bold text-slate-700 tabular-nums">
            <CalendarClock className="w-4 h-4 sm:w-5 sm:h-5 text-brand shrink-0" aria-hidden="true" />
            {meetingWhen(meeting, lang, { withEnd: true, weekday: 'long' })}
          </p>
          {meeting.topic && (
            <p className="text-sm font-semibold text-slate-600">{t('classroom.topic', { topic: meeting.topic })}</p>
          )}
          {meeting.status === 'CANCELLED' && (
            <p className="text-sm font-semibold text-rose-700">{t(`timetable.session.cancelled.${meeting.cancelReason ?? 'OTHER'}`)}</p>
          )}
        </div>
      </div>

      <aside className="lg:col-start-2 lg:row-start-1 lg:row-span-2 lg:sticky lg:top-0 rounded-2xl bg-brand text-white p-5 shadow-sm space-y-4">
        <h3 className="text-base font-extrabold">{t('meeting.todo')}</h3>
        <div className="rounded-xl bg-white text-slate-800 p-4">
          <CheckIn meeting={meeting} attendance={attendance} onAttendance={onAttendance} />
        </div>
        {/* The materials, each a button to its place under "Materi", ticked when done
            (owner, 2026-10-05). */}
        <div className="rounded-xl bg-white text-slate-800 p-4 space-y-2.5">
          <p className="flex items-center gap-2 text-sm font-extrabold">
            <FileText className="w-4 h-4 text-brand shrink-0" aria-hidden="true" />
            {count === undefined ? (
              <span className="block h-4 w-24 rounded bg-slate-100 animate-pulse" />
            ) : count > 0 ? (
              tracked ? t('meeting.materialsDone', { done: summary.done, n: summary.total }) : t('meeting.materialsCount', { n: count })
            ) : (
              <span className="text-slate-500 font-semibold">{t('meeting.materialsNone')}</span>
            )}
          </p>
          {count > 0 && tracked && (
            <div
              className="h-1.5 rounded-full bg-slate-100 overflow-hidden"
              role="meter"
              aria-label={t('meeting.materialsDone', { done: summary.done, n: summary.total })}
              aria-valuemin={0}
              aria-valuemax={summary.total}
              aria-valuenow={summary.done}
            >
              <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${(summary.done / summary.total) * 100}%` }} />
            </div>
          )}
          {count > 0 && (
            <ul className="space-y-1">
              {content.contents.map((item) => {
                const state = stateOf(item);
                const current = shown?.id === item.id;
                const Icon = state === 'done' ? CheckCircle2 : TYPE_ICON[item.type] ?? FileText;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => goToContent(item.id)}
                      aria-label={t('meeting.goToMaterial', { title: item.title })}
                      aria-current={current ? 'true' : undefined}
                      className={`w-full flex items-center gap-2.5 rounded-lg px-2 py-2 -mx-2 text-left hover:bg-brand-tint focus:outline-none focus-visible:ring-2 focus-visible:ring-brand cursor-pointer group ${
                        current ? 'bg-brand-tint ring-1 ring-brand/30' : ''
                      }`}
                    >
                      <span
                        className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                          state === 'done'
                            ? 'bg-emerald-50 text-emerald-600'
                            : 'bg-slate-100 text-slate-600 group-hover:bg-white group-hover:text-brand'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5" aria-hidden="true" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-xs font-bold text-slate-800 break-words leading-snug">{item.title}</span>
                        {/* slate-600 on the tinted row: slate-500 on brand-tint measured 4.18:1 (2026-10-05). */}
                        <span
                          className={`flex flex-wrap items-center gap-x-1.5 text-[10px] font-semibold group-hover:text-slate-600 ${
                            current ? 'text-slate-600' : 'text-slate-500'
                          }`}
                        >
                          {t(`content.type.${item.type}`)}
                          {state === 'done' && <span className="font-extrabold text-emerald-700">{t('content.state.done')}</span>}
                          {state === 'opened' && <span className="font-extrabold text-amber-700">{t('content.state.opened')}</span>}
                        </span>
                      </span>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-brand shrink-0" aria-hidden="true" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </aside>

      <div className={`${card} sm:p-6 min-w-0 lg:self-stretch lg:col-start-1 lg:row-start-2 lg:rounded-t-none lg:border-t-0 lg:pt-0 lg:[clip-path:inset(0_-1rem_-1rem_-1rem)]`}>
        <section className="lg:mt-5 lg:pt-5 lg:border-t lg:border-slate-100 space-y-3">
          <h3 className="text-base font-extrabold text-slate-800">{t('classroom.materials')}</h3>

          {fileError && (
            <p className="p-3 rounded-xl bg-rose-50 text-rose-700 text-xs font-semibold" role="alert">
              {fileError}
            </p>
          )}

          {content === undefined ? (
            <div className="space-y-3" aria-busy="true" aria-label={t('common.loading')}>
              {[0, 1].map((n) => (
                <div key={n} className="h-28 rounded-2xl bg-slate-100 animate-pulse" />
              ))}
            </div>
          ) : content.error ? (
            <div className="space-y-3" role="alert">
              <p className="flex items-start gap-2 text-sm font-extrabold text-rose-700">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                {content.gone ? t('content.error.gone') : content.error}
              </p>
              {!content.gone && (
                <button
                  type="button"
                  onClick={() => {
                    setContent(undefined);
                    setAttempt((n) => n + 1);
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-extrabold text-brand bg-brand-tint hover:bg-brand hover:text-white rounded-xl transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                >
                  <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
                  {t('att.error.retry')}
                </button>
              )}
            </div>
          ) : content.contents.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 py-10 px-6 text-center">
              <BookOpen className="w-9 h-9 text-slate-300 mx-auto" aria-hidden="true" />
              <p className="mt-2.5 text-sm font-extrabold text-slate-600">{t('content.empty')}</p>
            </div>
          ) : (
            <>
              {shown && (
                <ul>
                  <ContentItem
                    key={shown.id}
                    item={shown}
                    tracker={tracker}
                    onFileError={setFileError}
                    highlighted={highlighted === shown.id}
                    state={stateOf(shown) !== 'new' ? stateOf(shown) : null}
                  />
                </ul>
              )}
              {contents.length > 1 && (
                <nav className="flex items-center justify-between gap-2" aria-label={t('classroom.materials')}>
                  <button
                    type="button"
                    disabled={shownIndex === 0}
                    onClick={() => goToContent(contents[shownIndex - 1].id)}
                    className="inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-slate-100 text-xs font-extrabold text-slate-700 hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" aria-hidden="true" />
                    {t('meeting.prevMaterial')}
                  </button>
                  <span className="text-[11px] font-bold text-slate-500 tabular-nums">
                    {t('meeting.materialPosition', { i: shownIndex + 1, n: contents.length })}
                  </span>
                  <button
                    type="button"
                    disabled={shownIndex === contents.length - 1}
                    onClick={() => goToContent(contents[shownIndex + 1].id)}
                    className="inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-brand-tint text-xs font-extrabold text-brand hover:bg-brand hover:text-white disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                  >
                    {t('meeting.nextMaterial')}
                    <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                </nav>
              )}
              {tracker && <p className="text-[11px] font-medium text-slate-500 leading-relaxed">{t('content.trackingNote')}</p>}
            </>
          )}
        </section>
      </div>

    </div>
  );
};

export default ClassroomMeeting;
