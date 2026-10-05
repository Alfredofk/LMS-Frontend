import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useOutletContext, useSearchParams } from 'react-router-dom';
import { AlertCircle, BookOpen, BookPlus, CalendarClock, CalendarDays, ChevronRight, ClipboardCheck, Hourglass, Lock, RefreshCw, School } from 'lucide-react';

import { useT } from '../../i18n/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import { academicsService } from '../../services/academicsService';
import { subjectsErrorMessage } from '../../i18n/apiError';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import Select from '../../components/ui/Select';
import { formatDay } from '../Classes/format';
import { defaultSemesterId, matchesSearch, meetingWhen, progressOf } from '../Classroom/myClasses';
import { readMyTeaching, forgetMyTeaching } from './readMyTeaching';
import { semesterGroups, shownTeachingSemester, splitTeaching, teachingSemesters, unconfirmedCount } from './teaching';
import { openSemesterIds } from '../Dashboard/teacherHome';
import RequestSubjectDialog from './RequestSubjectDialog';

/*
  "Kelas Saya" for a teacher (owner, 2026-10-04: the teacher's screens are ours
  now; it replaced the teammate's sample-data page). Two tabs:

  - "Mata pelajaran": the subjects they teach or taught (ACTIVE, not ended), as cards
    a semester at a time, picked from the app's dropdown in a small toolbar - grouped
    as current, the open year's others and finished (a closed year), with the
    chosen one's state and count beside it (owner, 2026-10-05). The same
    card as a student's, plus what is still unconfirmed. A card opens
    /teacher/courses/:classSubjectId.
  - "Pengajuan": their requests waiting for the Principal, each withdrawable, then
    the history - rejected (with the Principal's reason), withdrawn, ended.

  "Ajukan mapel" opens RequestSubjectDialog. Everything comes from readMyTeaching
  (`?mine=true` + each live subject's meetings, kept a minute). The navbar's `?q=`
  narrows the cards. A Vice Principal teaching reads the same page.
*/

const card = 'bg-white border border-slate-100 rounded-2xl p-5 shadow-sm';
const cardGrid = 'grid grid-cols-[repeat(auto-fill,minmax(max(17.5rem,calc((100%-2rem)/3)),1fr))] gap-4';
const TABS = ['taught', 'requests'];

const TeachingCard = ({ entry, sessions, onOpen, closed = false }) => {
  const { t, lang } = useT();
  const progress = progressOf(sessions);
  const percent = progress?.total ? Math.round((progress.held / progress.total) * 100) : 0;
  /* A closed year's meetings can no longer be confirmed or held, so neither is said. */
  const owed = sessions && !closed ? unconfirmedCount(sessions) : 0;

  let line;
  if (closed) line = <span className="text-slate-500">{t('teach.card.yearClosed')}</span>;
  else if (progress === null) line = <span className="text-amber-700">{t('classroom.meetingsFailed')}</span>;
  else if (progress.total === 0) line = <span className="text-slate-500">{t('teach.noTimetable')}</span>;
  else if (progress.current) line = <span className="text-emerald-700">{t('classroom.now')}</span>;
  else if (progress.next) line = <span className="text-slate-600">{t('classroom.next', { when: meetingWhen(progress.next, lang) })}</span>;
  else line = <span className="text-slate-500">{t('classroom.done')}</span>;

  return (
    <button
      type="button"
      onClick={onOpen}
      className={`${card} group w-full text-left hover:shadow-md hover:border-brand/30 transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand flex flex-col gap-3`}
    >
      <span className="flex items-center gap-3">
        <span className="w-12 h-12 rounded-xl bg-brand-tint text-brand flex items-center justify-center shrink-0">
          <BookOpen className="w-6 h-6" aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          {entry.subject.code && (
            <span className="block text-[10px] font-extrabold uppercase tracking-wider text-brand leading-none">{entry.subject.code}</span>
          )}
          <span className="block mt-1 text-base font-extrabold text-slate-900 leading-tight break-words">{entry.subject.name}</span>
          <span className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-slate-500 min-w-0">
            <School className="w-3 h-3 shrink-0" aria-hidden="true" />
            <span className="break-words">{entry.class.name}</span>
          </span>
        </span>
        <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-brand shrink-0" aria-hidden="true" />
      </span>

      {progress?.total > 0 && (
        <span className="block space-y-1.5">
          <span className="flex items-center justify-between text-[11px] font-semibold text-slate-500 tabular-nums">
            <span>{t('classroom.progress', { held: progress.held, total: progress.total })}</span>
            <span>{percent}%</span>
          </span>
          <span className="block h-1.5 rounded-full bg-slate-100 overflow-hidden" aria-hidden="true">
            <span className="block h-full rounded-full bg-brand" style={{ width: `${percent}%` }} />
          </span>
        </span>
      )}

      {owed > 0 && (
        <span className="inline-flex w-fit items-center gap-1.5 px-2 py-1 rounded-lg bg-amber-50 text-amber-700 text-[11px] font-extrabold">
          <ClipboardCheck className="w-3.5 h-3.5" aria-hidden="true" />
          {t('teach.unconfirmed', { n: owed })}
        </span>
      )}

      <span className="mt-auto flex items-center gap-1.5 text-xs font-bold">
        <CalendarClock className="w-3.5 h-3.5 text-slate-400 shrink-0" aria-hidden="true" />
        {line}
      </span>
    </button>
  );
};

const STATUS_PILL = {
  PENDING: 'bg-amber-50 text-amber-700',
  REJECTED: 'bg-rose-50 text-rose-700',
  CANCELLED: 'bg-slate-100 text-slate-600',
  ENDED: 'bg-slate-100 text-slate-600',
};

const RequestRow = ({ entry, onWithdraw }) => {
  const { t, lang } = useT();
  const kind = entry.status === 'ACTIVE' ? 'ENDED' : entry.status;
  const when = entry.endedAt ?? entry.decidedAt ?? entry.requestedAt;
  return (
    <li className="py-3.5 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-extrabold text-slate-800 break-words">{entry.subject.name}</span>
          <span className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold ${STATUS_PILL[kind]}`}>{t(`teach.status.${kind}`)}</span>
        </span>
        <span className="block mt-0.5 text-[11px] font-semibold text-slate-500">
          {t('teach.requestLine', { className: entry.class.name, n: entry.semester.ordinal, year: entry.semester.academicYear })}
          {when ? `, ${formatDay(when, lang)}` : ''}
        </span>
        {(entry.rejectionReason || entry.endReason) && (
          <span className="block mt-1 text-[11px] font-semibold text-slate-600 leading-relaxed">
            {t('teach.reason', { reason: entry.rejectionReason ?? entry.endReason })}
          </span>
        )}
      </span>
      {onWithdraw && (
        <button
          type="button"
          onClick={() => onWithdraw(entry)}
          className="self-start sm:self-center shrink-0 px-3 py-1.5 rounded-lg text-xs font-extrabold text-rose-700 hover:bg-rose-50 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
        >
          {t('teach.withdraw')}
        </button>
      )}
    </li>
  );
};

export const TeacherCourses = () => {
  const { t } = useT();
  const navigate = useNavigate();
  const { showToast } = useOutletContext() ?? {};
  const { membership } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get('q') ?? '';
  const tab = TABS.includes(searchParams.get('tab')) ? searchParams.get('tab') : 'taught';

  const [data, setData] = useState(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [asking, setAsking] = useState(false);
  const [withdrawing, setWithdrawing] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    /* The years too: a closed year leaves its assignments ACTIVE (splitTeaching). */
    Promise.all([readMyTeaching(membership?.id, { fresh: attempt > 0 }), academicsService.academicYears()])
      .then(([answer, years]) => {
        if (cancelled) return;
        setData({ ...answer, openSemesters: openSemesterIds(years) });
        setFailed(false);
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [attempt, membership?.id]);

  const reload = () => {
    forgetMyTeaching();
    setAttempt((n) => n + 1);
  };

  /* Every semester the teacher taught in, a closed year's included (owner, 2026-10-05):
     the page opens on the current one and the picker goes back to earlier ones. The
     choice lives in `?semester=`, so Back from a subject returns to it. */
  const groups = useMemo(() => splitTeaching(data?.rows, data?.openSemesters), [data]);
  const semesters = useMemo(() => teachingSemesters(groups.taught, data?.openSemesters), [data, groups]);
  const current = useMemo(() => (data ? defaultSemesterId(groups.live, data.sessionsById) : null), [data, groups]);
  const shownSemester = shownTeachingSemester(semesters, searchParams.get('semester'), current);
  const shownSemesterInfo = semesters.find((semester) => semester.id === shownSemester) ?? null;
  const shownClosed = shownSemesterInfo?.open === false;
  const inSemester = groups.taught.filter((entry) => entry.semester?.id === shownSemester);
  const shownCount = inSemester.length;
  const taught = inSemester.filter((entry) => matchesSearch(entry, query));
  const semesterChoices = semesterGroups(semesters, current);

  const pickSemester = (id) => {
    const params = new URLSearchParams(searchParams);
    if (id === current) params.delete('semester');
    else params.set('semester', id);
    setSearchParams(params, { replace: true });
  };

  const setTab = (next) => {
    const params = new URLSearchParams(searchParams);
    if (next === 'taught') params.delete('tab');
    else params.set('tab', next);
    setSearchParams(params, { replace: true });
  };

  const withdraw = async () => {
    setBusy(true);
    try {
      await academicsService.cancelClassSubject(withdrawing.id);
      showToast?.(t('teach.withdrawn', { subject: withdrawing.subject.name }), 'success');
      setWithdrawing(null);
      reload();
    } catch (err) {
      showToast?.(subjectsErrorMessage(err, t), 'error');
      setWithdrawing(null);
      reload();
    } finally {
      setBusy(false);
    }
  };

  const requested = (created) => {
    setAsking(false);
    showToast?.(
      t(created?.status === 'ACTIVE' ? 'teach.request.doneActive' : 'teach.request.done', { subject: created?.subject?.name ?? '' }),
      'success'
    );
    if (created?.status !== 'ACTIVE') setTab('requests');
    reload();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div className="space-y-1 min-w-0">
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight leading-tight">{t('shell.myCourses')}</h1>
          <p className="text-sm text-slate-500 font-medium">{t('teach.subtitle')}</p>
        </div>
        <button
          type="button"
          onClick={() => setAsking(true)}
          className="self-start sm:self-auto shrink-0 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand text-white text-sm font-extrabold hover:bg-brand-deep cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
        >
          <BookPlus className="w-4 h-4" aria-hidden="true" />
          {t('teach.request.open')}
        </button>
      </div>

      <div role="tablist" aria-label={t('shell.myCourses')} className="flex gap-6 border-b border-slate-200">
        {TABS.map((key) => {
          const count = key === 'taught' ? shownCount : groups.waiting.length;
          return (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              onClick={() => setTab(key)}
              className={`inline-flex items-center gap-2 px-1 pb-3 -mb-px text-sm font-extrabold border-b-2 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand rounded-t ${
                tab === key ? 'border-brand text-brand' : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              {t(`teach.tab.${key}`)}
              {data && count > 0 && (
                <span className={`px-1.5 py-0.5 rounded-md text-[10px] tabular-nums ${key === 'requests' ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {failed && !data ? (
        <div className={`${card} flex flex-col items-center text-center gap-3 py-10`} role="alert">
          <AlertCircle className="w-8 h-8 text-rose-500" aria-hidden="true" />
          <p className="text-sm font-bold text-slate-700">{t('teach.failed')}</p>
          <button
            type="button"
            onClick={reload}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold hover:bg-slate-200 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
            {t('att.error.retry')}
          </button>
        </div>
      ) : !data ? (
        <div className={cardGrid} aria-busy="true" aria-label={t('common.loading')}>
          {[0, 1, 2].map((n) => (
            <div key={n} className="h-40 rounded-2xl bg-white border border-slate-100 animate-pulse" />
          ))}
        </div>
      ) : tab === 'taught' ? (
        groups.taught.length === 0 ? (
          <div className={`${card} flex flex-col items-center text-center gap-3 py-10`}>
            <span className="w-14 h-14 rounded-2xl bg-brand-tint text-brand flex items-center justify-center">
              <BookOpen className="w-7 h-7" aria-hidden="true" />
            </span>
            <p className="text-sm font-extrabold text-slate-800">{t('teach.empty.title')}</p>
            <p className="text-xs font-semibold text-slate-500 max-w-sm leading-relaxed">
              {t(groups.waiting.length ? 'teach.empty.waiting' : 'teach.empty.body', { n: groups.waiting.length })}
            </p>
          </div>
        ) : (
          <>
            {/* The semester toolbar (owner, 2026-10-05: a dropdown, polished): the app's one
                Select, grouped by state so no option needs a "(closed)" tail, and the
                chosen semester's state and subject count beside it. */}
            {semesters.length > 1 && (
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-2xl border border-slate-100 bg-white p-3.5 sm:p-4 shadow-sm">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <span className="w-10 h-10 rounded-xl bg-brand-tint text-brand flex items-center justify-center shrink-0">
                    <CalendarDays className="w-5 h-5" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1 sm:max-w-sm">
                    <span id="teach-semester-label" className="block text-[11px] font-bold text-slate-500">
                      {t('teach.semesterPick')}
                    </span>
                    <Select
                      id="teach-semester"
                      className="mt-1"
                      aria-label={t('teach.semesterPick')}
                      value={shownSemester ?? ''}
                      onChange={(e) => pickSemester(e.target.value)}
                    >
                      {semesterChoices.map((group) => (
                        <optgroup key={group.key} label={t(`teach.group.${group.key}`)}>
                          {group.semesters.map((semester) => (
                            <option key={semester.id} value={semester.id}>
                              {t('teach.option', { n: semester.ordinal, year: semester.academicYear })}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </Select>
                  </div>
                </div>
                <div className="flex items-center gap-2 sm:justify-end pl-[3.25rem] sm:pl-0">
                  {shownSemester === current ? (
                    <span className="px-2 py-1 rounded-lg bg-brand-tint text-brand text-[11px] font-extrabold">{t('teach.semester.current')}</span>
                  ) : shownClosed ? (
                    <span className="px-2 py-1 rounded-lg bg-slate-100 text-slate-600 text-[11px] font-extrabold">{t('teach.semester.closed')}</span>
                  ) : null}
                  <span className="text-xs font-semibold text-slate-600">{t('teach.subjectCount', { n: shownCount })}</span>
                </div>
              </div>
            )}
            {shownClosed && (
              <p className="flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-semibold text-slate-600 leading-relaxed">
                <Lock className="w-3.5 h-3.5 mt-0.5 shrink-0 text-slate-500" aria-hidden="true" />
                {t('teach.readOnly', { n: shownSemesterInfo?.ordinal, year: shownSemesterInfo?.academicYear })}
              </p>
            )}
            {taught.length === 0 ? (
              <p className={`${card} text-sm font-semibold text-slate-600 text-center py-8`}>{t('classroom.empty.search', { q: query.trim() })}</p>
            ) : (
              <div className={cardGrid}>
                {taught.map((entry) => (
                  <TeachingCard
                    key={entry.id}
                    entry={entry}
                    sessions={data.sessionsById[entry.id]}
                    closed={shownClosed}
                    onOpen={() => navigate(`/teacher/courses/${entry.id}`)}
                  />
                ))}
              </div>
            )}
          </>
        )
      ) : (
        <div className="space-y-5">
          <section className={card} aria-labelledby="teach-waiting">
            <h2 id="teach-waiting" className="flex items-center gap-2 text-sm font-extrabold text-slate-800">
              <Hourglass className="w-4 h-4 text-amber-600" aria-hidden="true" />
              {t('teach.waitingTitle')}
            </h2>
            {groups.waiting.length === 0 ? (
              <p className="mt-2 text-xs font-semibold text-slate-500">{t('teach.waitingNone')}</p>
            ) : (
              <ul className="mt-1 divide-y divide-slate-100">
                {groups.waiting.map((entry) => (
                  <RequestRow key={entry.id} entry={entry} onWithdraw={setWithdrawing} />
                ))}
              </ul>
            )}
          </section>
          {groups.past.length > 0 && (
            <section className={card} aria-labelledby="teach-history">
              <h2 id="teach-history" className="text-sm font-extrabold text-slate-800">{t('teach.historyTitle')}</h2>
              <ul className="mt-1 divide-y divide-slate-100">
                {groups.past.map((entry) => (
                  <RequestRow key={entry.id} entry={entry} />
                ))}
              </ul>
            </section>
          )}
        </div>
      )}

      {asking && <RequestSubjectDialog onClose={() => setAsking(false)} onRequested={requested} />}

      <ConfirmDialog
        open={Boolean(withdrawing)}
        tone="danger"
        icon={Hourglass}
        title={t('teach.withdrawTitle')}
        body={withdrawing ? t('teach.withdrawBody', { subject: withdrawing.subject.name, className: withdrawing.class.name }) : ''}
        confirmLabel={t('teach.withdraw')}
        cancelLabel={t('common.cancel')}
        busy={busy}
        onConfirm={withdraw}
        onCancel={() => setWithdrawing(null)}
      />
    </div>
  );
};

export default TeacherCourses;
