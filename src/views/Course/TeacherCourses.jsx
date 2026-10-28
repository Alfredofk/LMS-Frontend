import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useOutletContext, useSearchParams } from 'react-router-dom';
import { BookOpen, BookPlus, ChevronRight, Hourglass, Lock, Search } from 'lucide-react';

import { useT } from '../../i18n/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import { academicsService } from '../../services/academicsService';
import { subjectsErrorMessage } from '../../i18n/apiError';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import Select from '../../components/ui/Select';
import EmptyCard from '../../components/ui/EmptyCard';
import FactLine from '../../components/ui/FactLine';
import { HomeError } from '../Dashboard/components/HomeCard';
import { readTeachingDashboard } from '../Dashboard/teachingDashboard';
import { waitingInSlot } from '../TeacherAssessment/markingQueue';
import { formatDay } from '../Classes/format';
import { defaultSemesterId, matchesSearch, meetingWhen, progressOf } from '../Classroom/myClasses';
import { readMyTeaching, forgetMyTeaching } from './readMyTeaching';
import { shownTeachingSemester, splitTeaching, teachingSemesters, unconfirmedCount } from './teaching';
import { openSemesterIds } from '../Dashboard/teacherHome';
import RequestSubjectDialog from './RequestSubjectDialog';

/*
  "Kelas Saya" for a teacher (owner, 2026-10-04: the teacher's screens are ours
  now; it replaced the teammate's sample-data page). Two tabs:

  - "Mata pelajaran": the subjects they teach or taught (ACTIVE, not ended), as cards
    a semester at a time, picked from a plain dropdown, newest first (owner,
    2026-10-05). The same card as a student's, plus what is still unconfirmed. A card opens
    /teacher/courses/:classSubjectId.
  - "Pengajuan": their requests waiting for the Principal, each withdrawable, then
    the history - rejected (with the Principal's reason), withdrawn, ended.

  "Ajukan mapel" opens RequestSubjectDialog. Everything comes from readMyTeaching
  (`?mine=true` + each live subject's meetings, kept a minute). The navbar's `?q=`
  narrows the cards. A Vice Principal teaching reads the same page.

  `gradebook` (owner, 2026-10-11): the sidebar's "Buku Nilai" - the same cards and
  semester dropdown under its own title, no requests; a card opens the subject's
  "Nilai" tab (/teacher/courses/:id?tab=nilai).

  The look since 2026-10-28 (the mockup the owner reviewed): the slash line, the
  dashboards' text tabs, a card in the dashboards' frame with the class as grey text,
  what waits as one amber line - meetings unconfirmed, and assessments waiting to be
  marked or released (`waitingInSlot` over the teaching dashboard's queue) - and the
  next meeting on the card's floor; the dashboards' failed and empty states.
*/

const card = 'bg-white border border-slate-100 rounded-2xl p-6 max-sm:p-[18px] shadow-sm min-w-0';
const cardGrid = 'grid grid-cols-[repeat(auto-fill,minmax(max(17.5rem,calc((100%-2rem)/3)),1fr))] gap-4';
const TABS = ['taught', 'requests'];

const TeachingCard = ({ entry, sessions, waiting = 0, onOpen, closed = false }) => {
  const { t, lang } = useT();
  const progress = progressOf(sessions);
  const percent = progress?.total ? Math.round((progress.held / progress.total) * 100) : 0;
  /* A closed year's meetings can no longer be confirmed or held, so neither is said. */
  const owed = sessions && !closed ? unconfirmedCount(sessions) : 0;

  let line;
  if (closed) line = <span className="text-slate-500">{t('teach.card.yearClosed')}</span>;
  else if (progress === null) line = <span className="text-amber-700">{t('classroom.meetingsFailed')}</span>;
  else if (progress.total === 0) line = t('teach.noTimetable');
  else if (progress.current) line = <span className="font-bold text-emerald-700">{t('classroom.now')}</span>;
  else if (progress.next) line = t('classroom.next', { when: meetingWhen(progress.next, lang) });
  else line = t('classroom.done');
  /* What waits on the teacher, as words on one amber line (the reviewed mockup). */
  const todo = [owed > 0 && t('teach.unconfirmed', { n: owed }), !closed && waiting > 0 && t('teach.card.waiting', { n: waiting })].filter(Boolean);

  return (
    <button
      type="button"
      onClick={onOpen}
      className={`${card} group w-full text-left hover:shadow-md hover:-translate-y-0.5 motion-reduce:hover:translate-y-0 transition-all duration-200 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand flex flex-col gap-3`}
    >
      {/* No icon tile (owner, 2026-10-07): the code above the name already says "subject". */}
      <span className="flex items-start gap-3">
        <span className="min-w-0 flex-1">
          {entry.subject.code && (
            <span className="block text-[10px] font-extrabold uppercase tracking-wider text-brand leading-none">{entry.subject.code}</span>
          )}
          <span className="block mt-1 text-base font-extrabold text-slate-900 leading-tight break-words">{entry.subject.name}</span>
          <span className="block mt-1 text-xs font-semibold text-slate-500 break-words">{entry.class.name}</span>
        </span>
        <ChevronRight className="w-4 h-4 mt-1 text-slate-400 shrink-0 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-brand" aria-hidden="true" />
      </span>

      {progress?.total > 0 && (
        <span className="block">
          <span className="flex items-baseline justify-between gap-2 text-[12.5px] text-slate-500 tabular-nums">
            <span>{t('classroom.progress', { held: progress.held, total: progress.total })}</span>
            <span className="shrink-0 text-sm font-extrabold text-slate-700">{percent}%</span>
          </span>
          <span className="block mt-1.5 h-2 rounded-full bg-slate-100 overflow-hidden" aria-hidden="true">
            <span className="block h-full rounded-full bg-brand" style={{ width: `${percent}%` }} />
          </span>
        </span>
      )}

      {todo.length > 0 && (
        <span className="flex flex-wrap items-baseline text-[12.5px] font-bold text-amber-700">
          {todo.map((part, i) => (
            <React.Fragment key={part}>
              {i > 0 && (
                <span className="mx-1.5 font-medium text-slate-300" aria-hidden="true">
                  /
                </span>
              )}
              <span>{part}</span>
            </React.Fragment>
          ))}
        </span>
      )}

      {/* mt-auto: on the card's floor whatever sits above it, so a row of cards lines up. */}
      <span className="mt-auto block pt-2.5 border-t border-slate-100 text-[12.5px] font-semibold text-slate-600">{line}</span>
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
        <FactLine
          size="xs"
          wrap
          className="mt-0.5"
          facts={[entry.class.name, `${t('classes.semester.name', { n: entry.semester.ordinal })} ${entry.semester.academicYear}`, when && formatDay(when, lang)]}
        />
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

export const TeacherCourses = ({ gradebook = false }) => {
  const { t } = useT();
  const navigate = useNavigate();
  const { showToast } = useOutletContext() ?? {};
  const { membership } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get('q') ?? '';
  const tab = !gradebook && TABS.includes(searchParams.get('tab')) ? searchParams.get('tab') : 'taught';

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

  /* Assessments waiting per slot, from the teaching dashboard's queue (kept a minute,
     shared with the sidebar); none when it cannot be read. */
  const [queue, setQueue] = useState(null);
  useEffect(() => {
    let cancelled = false;
    readTeachingDashboard(membership?.id)
      .then((answer) => !cancelled && setQueue(answer?.queue ?? null))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [membership?.id]);

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
        <div className="min-w-0">
          <h1 className="text-3xl max-sm:text-2xl font-extrabold text-slate-900 tracking-tight leading-tight">{t(gradebook ? 'teacherGradebook.title' : 'shell.myCourses')}</h1>
          {gradebook ? (
            <p className="mt-1 text-sm text-slate-500 font-medium">{t('gradebook.pickIntro')}</p>
          ) : (
            /* The slash line (the reviewed mockup): school / the semester shown / subjects in it. */
            <FactLine
              className="mt-2"
              facts={[
                membership?.school?.name ?? membership?.schoolName,
                shownSemesterInfo && t('teacherDash.academicContext', { year: shownSemesterInfo.academicYear, n: shownSemesterInfo.ordinal }),
                data && t('subjects.subtitle.taught', { n: shownCount }),
              ]}
            />
          )}
        </div>
        {!gradebook && (
          <button
            type="button"
            onClick={() => setAsking(true)}
            className="self-start sm:self-auto shrink-0 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand text-white text-sm font-extrabold hover:bg-brand-deep cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
          >
            <BookPlus className="w-4 h-4" aria-hidden="true" />
            {t('teach.request.open')}
          </button>
        )}
      </div>

      {!gradebook && (
        <div role="tablist" aria-label={t('shell.myCourses')} className="flex gap-0.5 overflow-x-auto overflow-y-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden shadow-[inset_0_-1px_0_var(--color-slate-100)]">
          {TABS.map((key) => {
            const count = key === 'taught' ? shownCount : groups.waiting.length;
            return (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={tab === key}
                onClick={() => setTab(key)}
                className={`shrink-0 whitespace-nowrap px-2.5 py-2 text-sm font-bold border-b-2 transition-colors cursor-pointer focus:outline-none focus-visible:text-brand ${
                  tab === key ? 'text-brand border-brand' : 'text-slate-500 border-transparent hover:text-slate-700'
                }`}
              >
                {t(`teach.tab.${key}`)}
                {data && count > 0 && (
                  <span className={`ml-1.5 px-1.5 rounded-full text-[11px] tabular-nums ${key === 'requests' ? 'bg-amber-50 text-amber-700' : tab === key ? 'bg-brand-tint text-brand' : 'bg-slate-100 text-slate-600'}`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {failed && !data ? (
        <HomeError message={t('teach.failed')} retryLabel={t('att.error.retry')} onRetry={reload} />
      ) : !data ? (
        <div className={cardGrid} aria-busy="true" aria-label={t('common.loading')}>
          {[0, 1, 2].map((n) => (
            <div key={n} className="h-40 rounded-2xl bg-white border border-slate-100 animate-pulse" />
          ))}
        </div>
      ) : tab === 'taught' ? (
        groups.taught.length === 0 ? (
          <EmptyCard
            icon={BookOpen}
            title={t('teach.empty.title')}
            body={t(groups.waiting.length ? 'teach.empty.waiting' : 'teach.empty.body', { n: groups.waiting.length })}
          />
        ) : (
          <>
            {/* A plain dropdown, newest first (owner, 2026-10-05: the toolbar with groups
                and badges was too busy). */}
            {semesters.length > 0 && (
              <div className="flex">
                <Select
                  id="teach-semester"
                  className="w-full sm:w-64"
                  aria-label={t('teach.semesterPick')}
                  value={shownSemester ?? ''}
                  onChange={(e) => pickSemester(e.target.value)}
                >
                  {semesters.map((semester) => (
                    <option key={semester.id} value={semester.id}>
                      {t('teach.option', { n: semester.ordinal, year: semester.academicYear })}
                    </option>
                  ))}
                </Select>
              </div>
            )}
            {shownClosed && (
              <p className="flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-semibold text-slate-600 leading-relaxed">
                <Lock className="w-3.5 h-3.5 mt-0.5 shrink-0 text-slate-500" aria-hidden="true" />
                {t('teach.readOnly', { n: shownSemesterInfo?.ordinal, year: shownSemesterInfo?.academicYear })}
              </p>
            )}
            {taught.length === 0 ? (
              <EmptyCard icon={Search} title={t('classroom.empty.search', { q: query.trim() })} />
            ) : (
              <div className={cardGrid}>
                {taught.map((entry) => (
                  <TeachingCard
                    key={entry.id}
                    entry={entry}
                    sessions={data.sessionsById[entry.id]}
                    waiting={waitingInSlot(queue, entry.id)}
                    closed={shownClosed}
                    onOpen={() => navigate(gradebook ? `/teacher/courses/${entry.id}?tab=nilai` : `/teacher/courses/${entry.id}`)}
                  />
                ))}
              </div>
            )}
          </>
        )
      ) : (
        <div className="space-y-5">
          <section className={card} aria-labelledby="teach-waiting">
            {/* A heading is words, no icon (the reviewed mockup). */}
            <h2 id="teach-waiting" className="text-base font-extrabold text-slate-900 tracking-tight">
              {t('teach.waitingTitle')}
            </h2>
            {groups.waiting.length === 0 ? (
              <p className="mt-1.5 text-[13px] text-slate-500">{t('teach.waitingNone')}</p>
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
              <h2 id="teach-history" className="text-base font-extrabold text-slate-900 tracking-tight">{t('teach.historyTitle')}</h2>
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
