import React, { Fragment, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AlertCircle, ChevronRight, ClipboardList, RefreshCw, UserRound } from 'lucide-react';

import Select from '../../components/ui/Select';
import { useAuth } from '../../context/AuthContext';
import { useSchoolZone } from '../../hooks/useSchoolToday';
import { useT } from '../../i18n/LanguageContext';
import { studentAssessmentErrorMessage } from '../../i18n/apiError';
import { shortWhen } from '../TeacherAssessment/teacherAssessment';
import { readMyClasses } from '../Classroom/readMyClasses';
import { readMyMenu } from '../StudentAssessment/readMyMenu';
import { byClassSubject, cardOf } from '../StudentAssessment/studentMenu';

/*
  A student's assessments (/assessment; backend 113ae37, ticket 07; owner
  2026-10-12): a card per subject that has any this semester, in the look of
  "Kelas Saya", each saying what matters most - "2 perlu dikerjakan, ditutup 14
  Okt 23:59", else what is coming, else all done - and under it the total and the
  rest. A card opens that subject's "Penilaian" tab (/classroom/:id?tab=penilaian),
  where the assessments are listed. One GET /assessments/mine per semester
  (readMyMenu); the dropdown is `?semester=`, none meaning the server's default.
  The teacher's name comes from "Kelas Saya"'s read, which the menu does not carry.
*/

const card = 'bg-white border border-slate-100 rounded-2xl p-5 shadow-sm';
const cardGrid = 'grid grid-cols-[repeat(auto-fill,minmax(max(17.5rem,calc((100%-2rem)/3)),1fr))] gap-4';

const LEAD_TONE = {
  TODO: 'text-brand',
  UPCOMING: 'text-slate-600',
  ALL_DONE: 'text-emerald-700',
};

const SubjectCard = ({ group, teacherName, zone, onOpen }) => {
  const { t, lang } = useT();
  const { subject } = group.classSubject;
  const { total, lead, rest } = cardOf(group.entries);
  const leadText =
    lead.key === 'ALL_DONE'
      ? t('smenu.allDone')
      : `${t(`smenu.count.${lead.key}`, { n: lead.n })}, ${t(`smenu.when.${lead.when.key}`, { when: shortWhen(lead.when.instant, zone, lang) })}`;
  const counts = [t('smenu.count.total', { n: total }), ...rest.map((part) => t(`smenu.count.${part.key}`, { n: part.n }))];

  return (
    <button
      type="button"
      onClick={onOpen}
      className={`${card} group w-full text-left hover:shadow-md hover:border-brand/30 transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand flex flex-col gap-3`}
    >
      {/* Code above the name, as on "Kelas Saya". */}
      <span className="flex items-center gap-3">
        <span className="min-w-0 flex-1">
          {subject.code && <span className="block text-[10px] font-extrabold uppercase tracking-wider text-brand leading-none">{subject.code}</span>}
          <span className="block mt-1 text-base font-extrabold text-slate-900 leading-tight break-words">{subject.name}</span>
          {teacherName && (
            <span className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-slate-500 min-w-0">
              <UserRound className="w-3 h-3 shrink-0" aria-hidden="true" />
              <span className="truncate">{teacherName}</span>
            </span>
          )}
        </span>
        <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-brand shrink-0" aria-hidden="true" />
      </span>

      {!group.class.current && (
        <span className="flex">
          <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[11px] font-bold">{t('classroom.pastClass', { class: group.class.name })}</span>
        </span>
      )}

      {/* mt-auto: on the card's floor whatever sits above it, so a row of cards lines up. */}
      <span className="mt-auto block space-y-1">
        <span className={`flex items-start gap-1.5 text-xs font-bold ${LEAD_TONE[lead.key]}`}>
          <ClipboardList className="w-3.5 h-3.5 mt-px text-slate-400 shrink-0" aria-hidden="true" />
          {leadText}
        </span>
        <span className="block text-[11px] font-semibold text-slate-500">
          {counts.map((part, i) => (
            <Fragment key={part}>
              {i > 0 && (
                <>
                  {' '}
                  <span className="mx-1 text-slate-300" aria-hidden="true">
                    /
                  </span>{' '}
                </>
              )}
              <span className="whitespace-nowrap">{part}</span>
            </Fragment>
          ))}
        </span>
      </span>
    </button>
  );
};

export const AssessmentPage = () => {
  const { t } = useT();
  const navigate = useNavigate();
  const zone = useSchoolZone();
  const { membership } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const semesterParam = searchParams.get('semester');
  const [attempt, setAttempt] = useState(0);
  /* The answer to which read: data is undefined while the one asked for now is on its way. */
  const asked = `${semesterParam ?? ''}|${attempt}`;
  const [read, setRead] = useState({ key: null, data: undefined });
  /* undefined reading · menu · { error } */
  const data = read.key === asked ? read.data : undefined;
  /* Teachers' names by class subject, from "Kelas Saya"'s read; empty when it fails. */
  const [teachers, setTeachers] = useState(() => new Map());

  useEffect(() => {
    let cancelled = false;
    readMyMenu(membership?.id, semesterParam, { fresh: attempt > 0 })
      .then((answer) => !cancelled && setRead({ key: asked, data: answer }))
      .catch((err) => {
        if (cancelled) return;
        // A semester in the address that is not theirs (an old link): fall back to the default.
        if (semesterParam && err?.status === 404) {
          setSearchParams({}, { replace: true });
          return;
        }
        setRead({ key: asked, data: { error: studentAssessmentErrorMessage(err, t) } });
      });
    return () => {
      cancelled = true;
    };
  }, [asked, attempt, membership?.id, semesterParam, t, setSearchParams]);

  useEffect(() => {
    let cancelled = false;
    readMyClasses(membership?.id)
      .then((answer) => !cancelled && setTeachers(new Map(answer.classSubjects.map((row) => [row.id, row.teacher?.fullName ?? null]))))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [membership?.id]);

  const groups = useMemo(() => byClassSubject(data?.classes), [data]);

  const heading = <h1 className="text-3xl max-sm:text-2xl font-extrabold text-slate-900 tracking-tight leading-tight">{t('shell.assessment')}</h1>;

  if (data === undefined) {
    return (
      <div className="space-y-6">
        {heading}
        <div className={cardGrid} aria-busy="true" aria-label={t('common.loading')}>
          {[0, 1, 2].map((n) => (
            <div key={n} className="h-40 rounded-2xl bg-white border border-slate-100 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }
  if (data.error) {
    return (
      <div className="space-y-6">
        {heading}
        <div className={`${card} flex flex-col items-center text-center gap-3 py-10`} role="alert">
          <AlertCircle className="w-8 h-8 text-rose-500" aria-hidden="true" />
          <p className="text-sm font-bold text-slate-700 max-w-sm">{data.error}</p>
          <button
            type="button"
            onClick={() => setAttempt((n) => n + 1)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold hover:bg-slate-200 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
            {t('att.error.retry')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {heading}

      {/* The same plain dropdown as "Kelas Saya", on the left, newest first. */}
      {data.semesters.length > 0 && (
        <div className="flex">
          <Select
            id="smenu-semester"
            className="w-full sm:w-64"
            aria-label={t('smenu.semester')}
            value={data.semester?.id ?? ''}
            onChange={(e) => setSearchParams({ semester: e.target.value })}
          >
            {data.semesters.map((semester) => (
              <option key={semester.id} value={semester.id}>
                {t('teach.option', { n: semester.ordinal, year: semester.academicYear })}
              </option>
            ))}
          </Select>
        </div>
      )}

      {groups.length === 0 ? (
        <div className={`${card} flex flex-col items-center text-center gap-3 py-10`}>
          <ClipboardList className="w-8 h-8 text-slate-400" aria-hidden="true" />
          <p className="text-sm font-semibold text-slate-600 max-w-sm">{t(data.semester ? 'smenu.emptySemester' : 'smenu.emptyNone')}</p>
        </div>
      ) : (
        <div className={cardGrid}>
          {groups.map((group) => (
            <SubjectCard
              key={group.classSubject.id}
              group={group}
              teacherName={teachers.get(group.classSubject.id) ?? null}
              zone={zone}
              onOpen={() => navigate(`/classroom/${group.classSubject.id}?tab=penilaian`)}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default AssessmentPage;
