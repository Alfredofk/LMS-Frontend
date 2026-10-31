import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CheckCheck, ChevronRight, School } from 'lucide-react';

import { useT } from '../../../i18n/LanguageContext';
import Button from '../../../components/ui/Button';
import { formatNumber } from '../../TeacherAssessment/results';
import { initialsOf } from '../../Homeroom/homeroomSummary';
import { barWidth, signalPath, signalView, slotsForCard } from '../teachingDashboard';
import { Bone, HomeCard, HomeEmpty, HomeError, Unfold } from './HomeCard';

/*
  "Kelas semester ini" on the teacher's dashboard (owner 2026-10-27, items B and
  C): one row per subject taught this semester, from `GET /dashboard/teaching`'s
  slots - its students placed now, materials completed of those possible and
  attendance at confirmed sessions - and the students needing support, opened in
  place, each signal leading to the subject page's tab with its evidence
  (signalView).

  The look since 2026-10-27 (the approved teacher mockup; the skill
  `.claude/skills/eduforid-design`), as "Kemajuan mapel" and "Ringkasan kelas": a row
  per subject with two bars and their numbers, and an amber chip counting the
  students needing support. Subjects with such students first, a subject with no
  students last, in words and without bars (slotsForCard). Text tabs: all, or only
  those with students needing support. A row opens in place.

  @param board      readTeachingDashboard's answer: undefined while reading, null
                    when it could not be read
  @param className  the grid placement
*/

const EASE = 'transition-[width] duration-1000 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none';

/* A labelled bar, filled one frame after it appears. */
const Metric = ({ label, value, percent, empty }) => {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(frame);
  }, []);
  if (empty) return <span className="block text-xs text-slate-500">{empty}</span>;
  return (
    <span className="block">
      <span className="flex justify-between gap-2 text-[11.5px] text-slate-500">
        {label}
        <b className="font-extrabold text-slate-700 tabular-nums">{value}</b>
      </span>
      <span className="block h-1.5 mt-1.5 rounded-full bg-slate-100 overflow-hidden" aria-hidden="true">
        <i className={`block h-full rounded-full ${percent >= 100 ? 'bg-emerald-600' : 'bg-brand'} ${EASE}`} style={{ width: `${shown ? barWidth(percent) : 0}%` }} />
      </span>
    </span>
  );
};

const SlotRow = ({ slot, thresholds, open, onToggle }) => {
  const { t, lang } = useT();
  const navigate = useNavigate();
  const { classSubject, content, attendance, studentsNeedingSupport: support = [] } = slot;
  const placed = slot.studentsPlacedNow ?? 0;

  return (
    <li className="border-b border-slate-100 last:border-0">
      <button
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        className={`group w-full grid grid-cols-[minmax(0,1fr)_auto_auto] lg:grid-cols-[minmax(0,1.4fr)_1fr_1fr_auto_auto] items-center gap-x-[18px] gap-y-2.5 px-2 py-3.5 text-left rounded-xl transition-colors cursor-pointer hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
          open ? 'bg-slate-50' : ''
        }`}
      >
        <span className="min-w-0">
          <b className="block text-sm font-bold text-slate-900 break-words">
            {classSubject.subject?.code && <span className="mr-1.5 text-[11px] text-brand">{classSubject.subject.code}</span>}
            {classSubject.subject?.name}
          </b>
          <span className="block text-xs text-slate-500">
            {classSubject.class?.name}{' '}
            <span className="mx-1 text-slate-300" aria-hidden="true">
              /
            </span>{' '}
            {placed ? t('teacherDash.slots.students', { n: placed }) : t('teacherDash.slots.noStudents')}
          </span>
        </span>
        <span className="col-span-3 row-start-2 lg:col-span-1 lg:row-start-auto">
          <Metric
            label={t('teacherDash.slots.content')}
            value={content?.possible ? `${content.percent}%` : ''}
            percent={content?.percent}
            empty={content?.possible ? null : t('teacherDash.slots.contentNone')}
          />
        </span>
        <span className="col-span-3 row-start-3 lg:col-span-1 lg:row-start-auto">
          <Metric
            label={t('teacherDash.slots.attendance')}
            value={attendance?.counted ? `${attendance.percent}%` : ''}
            percent={attendance?.percent}
            empty={attendance?.counted ? null : t('teacherDash.slots.attendanceNone')}
          />
        </span>
        {/* The count in words, as the Penilaian card's chips (owner, 2026-10-31, mockup
            dasbor-ringkasan.html item 11); none is still a quiet dash. */}
        <span
          className={`min-w-[26px] px-2 py-0.5 rounded-full text-xs text-center tabular-nums whitespace-nowrap row-start-1 col-start-2 lg:row-start-auto lg:col-start-auto ${
            support.length ? 'bg-amber-50 text-amber-700 font-extrabold' : 'text-slate-300 font-semibold'
          }`}
        >
          {support.length ? (
            t('teacherDash.slots.supportShort', { n: support.length })
          ) : (
            <>
              <span aria-hidden="true">-</span>
              <span className="sr-only">{t('teacherDash.slots.support', { n: 0 })}</span>
            </>
          )}
        </span>
        <ChevronRight
          className={`w-4 h-4 shrink-0 text-slate-400 transition-transform duration-300 row-start-1 col-start-3 lg:row-start-auto lg:col-start-auto ${open ? 'rotate-90' : ''}`}
          aria-hidden="true"
        />
      </button>

      <Unfold open={open}>
        <div className="px-2 pt-1 pb-4">
          {support.length > 0 ? (
            <>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{t('teacherDash.slots.supportTitle')}</p>
              <ul className="mt-2.5 space-y-2.5">
                {support.map((student) => (
                  <li key={student.studentProfileId} className="flex gap-3">
                    <span className="grid place-items-center w-[34px] h-[34px] rounded-full bg-brand-tint text-brand text-[11px] font-extrabold shrink-0">
                      {initialsOf(student.fullName)}
                    </span>
                    <div className="min-w-0">
                      <p className="text-[13px] font-bold text-slate-900 break-words">{student.fullName ?? '-'}</p>
                      <ul className="mt-0.5 space-y-0.5">
                        {student.signals.map((signal) => {
                          const view = signalView(signal, thresholds);
                          if (!view) return null;
                          const vars = view.number ? { ...view.vars, n: formatNumber(view.vars.n, lang) } : view.vars;
                          return (
                            <li key={signal.type} className="flex items-baseline gap-2 text-[12.5px] text-slate-600">
                              <span
                                className={`w-1.5 h-1.5 rounded-full shrink-0 -translate-y-px ${signal.type === 'BELOW_KKTP' ? 'bg-rose-600' : 'bg-amber-600'}`}
                                aria-hidden="true"
                              />
                              <Link
                                to={signalPath(classSubject.id, view.tab)}
                                className="hover:text-brand hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-brand rounded"
                              >
                                {t(view.key, vars)}
                              </Link>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="text-[13px] text-slate-500">{placed ? t('teacherDash.slots.supportNone') : t('teacherDash.slots.noStudentsBody')}</p>
          )}
          <div className="mt-3.5">
            <Button size="sm" variant="outline" onClick={() => navigate(`/teacher/courses/${classSubject.id}`)}>
              {t('teacherDash.slots.open')}
            </Button>
          </div>
        </div>
      </Unfold>
    </li>
  );
};

export const TeachingSlotsCard = ({ board, className = '' }) => {
  const { t } = useT();
  const [filter, setFilter] = useState('ALL');
  const [openId, setOpenId] = useState(null);
  const reading = board === undefined;
  const semester = board?.semester ?? null;

  const card = (body, sub = null) => (
    <HomeCard id="teacher-slots-heading" title={t('teacherDash.slots.title')} linkLabel={t('shell.myCourses')} linkTo="/teacher/courses" className={className}>
      {sub && <p className="-mt-3 mb-4 text-xs text-slate-500">{sub}</p>}
      {body}
    </HomeCard>
  );

  if (reading) {
    return card(
      <div aria-busy="true" className="space-y-4">
        {[0, 1, 2, 3].map((n) => (
          <div key={n} className="grid grid-cols-3 gap-4">
            <Bone className="h-8" />
            <Bone className="h-8" />
            <Bone className="h-8" />
          </div>
        ))}
      </div>
    );
  }
  if (board === null) return card(<HomeError message={t('teacherDash.slots.failed')} />);
  if (!semester) return card(<HomeEmpty icon={School} title={t('teacherDash.slots.noSemester')} />);
  const slots = slotsForCard(board.slots);
  if (slots.length === 0) return card(<HomeEmpty icon={School} title={t('teacherDash.slots.none')} />);

  const flagged = slots.filter((slot) => (slot.studentsNeedingSupport ?? []).length > 0);
  const shown = filter === 'SUPPORT' ? flagged : slots;
  const tabs = [
    ['ALL', t('teacherDash.slots.tab.all'), slots.length, false],
    ['SUPPORT', t('teacherDash.slots.tab.support'), flagged.length, flagged.length > 0],
  ];
  const sub = (
    <>
      {t('teacherDash.slots.semester', { n: semester.ordinal, year: semester.academicYear?.label })}{' '}
      <span className="mx-1 text-slate-300" aria-hidden="true">
        /
      </span>{' '}
      {t('homeroom.sum.subjects', { n: slots.length })}
    </>
  );

  return card(
    <>
      <div role="tablist" className="flex gap-0.5 mb-1.5 overflow-x-auto overflow-y-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden shadow-[inset_0_-1px_0_var(--color-slate-100)]">
        {tabs.map(([key, label, count, urgent]) => {
          const on = filter === key;
          return (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => {
                setFilter(key);
                setOpenId(null);
              }}
              className={`px-2.5 py-2 text-sm font-bold border-b-2 whitespace-nowrap transition-colors cursor-pointer rounded-t-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
                on ? 'text-brand border-brand' : 'text-slate-500 border-transparent hover:text-slate-700'
              }`}
            >
              {label}
              <span className={`ml-1.5 px-1.5 rounded-full text-[11px] ${urgent ? 'bg-amber-50 text-amber-700' : on ? 'bg-brand-tint text-brand' : 'bg-slate-100 text-slate-600'}`}>{count}</span>
            </button>
          );
        })}
      </div>
      {shown.length === 0 ? (
        <HomeEmpty icon={CheckCheck} title={t('teacherDash.slots.noneSupport')} body={t('homeroom.sum.none.signalBody')} />
      ) : (
        <ul>
          {shown.map((slot) => (
            <SlotRow
              key={slot.classSubject.id}
              slot={slot}
              thresholds={board.thresholds}
              open={openId === slot.classSubject.id}
              onToggle={() => setOpenId(openId === slot.classSubject.id ? null : slot.classSubject.id)}
            />
          ))}
        </ul>
      )}
    </>,
    sub
  );
};

export default TeachingSlotsCard;
