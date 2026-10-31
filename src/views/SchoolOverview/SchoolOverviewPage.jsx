import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart3, CalendarX, ChevronRight, Info, School } from 'lucide-react';

import { useT } from '../../i18n/LanguageContext';
import { dashboardService } from '../../services/dashboardService';
import { useSchoolZoneState } from '../../hooks/useSchoolToday';
import Select from '../../components/ui/Select';
import SubjectLabel from '../../components/ui/SubjectLabel';
import { Bone, HomeCard, HomeEmpty, HomeError } from '../Dashboard/components/HomeCard';
import { ChangeMark, FigureBar, FigureTile, SlashLine } from './FigureParts';
import { useCountedParts } from './useCountedParts';
import { FIGURES, SORTS, changeOf, isCounted, isEmptyRow, sortRows, valueOf, valueText } from './schoolOverview';

/*
  "Ringkasan Sekolah", /headmaster/overview - the Principal's and Vice Principal's
  view of the whole School (backend 1a1eed7, dashboard ticket 06; owner,
  2026-10-28). One read of `GET /dashboard/school`, again for another Semester.

  - The School's line as tiles, then two cards of rows, per Class and per Subject
    per grade level (owner, 2026-10-31, mockup dasbor-ringkasan.html items 6-10:
    the 7-column table and the phone's six-eyebrow cards went, as the gradebook's
    did). A row: the name and its students, attendance and material as two bars,
    the average at the right, an amber line only when students are below KKTP or
    have a signal; nobody placed is one grey line. "Urutkan" orders them
    (`SORTS`). No teacher is named anywhere: the backend names none.
  - A change against 7 days before beside each number, green when better and red
    when worse (`changeToneOf`); none until the rollup has a row a week old.
  - A Class opens its summary on the Classes page (`state.classId`).
  - A CLOSED Semester is the final picture: grades from the report cards, no
    change, which the page says.
*/

const NAME_OF = {
  classes: (row) => row.class.name,
  subjects: (row) => row.subject.name,
};

/* One card of rows with its "Urutkan" choice and what its counts mean. */
const OverviewRows = ({ id, title, note, kind, rows, onOpen }) => {
  const { t, lang } = useT();
  const [sortId, setSortId] = useState('name');
  const sort = SORTS.find((choice) => choice.id === sortId) ?? SORTS[0];
  const ordered = sortRows(rows, sort, NAME_OF[kind]);
  const keyOf = (row) => (kind === 'classes' ? row.class.id : `${row.subject.id}:${row.gradeLevel}`);

  const nameOf = (row) => (kind === 'classes' ? row.class.name : <SubjectLabel code={row.subject.code} name={row.subject.name} />);

  const lineOf = (row) => {
    const placed = valueOf(row, 'studentsPlacedNow');
    const count = isEmptyRow(row) ? t('overview.row.nobody') : placed !== null ? t('classes.class.count', { n: placed }) : null;
    return [kind === 'subjects' && t('classes.grade', { n: row.gradeLevel }), count].filter(Boolean);
  };

  /* A change keeps its place beside the number it belongs to. */
  const change = (row, key) =>
    changeOf(row, key) ? (
      <span className="ml-1">
        <ChangeMark figureKey={key} change={changeOf(row, key)} />
      </span>
    ) : null;

  const trouble = (row) =>
    ['belowKktp', 'withSignal']
      .filter((key) => valueOf(row, key) > 0)
      .map((key) => (
        <span key={key} className="whitespace-nowrap">
          {t(`overview.row.${key}`, { n: valueOf(row, key) })}
          {change(row, key)}
        </span>
      ));

  const bar = (row, key) => (
    <span className="block min-w-0">
      <span className="flex items-baseline justify-between gap-2 text-[11.5px] font-semibold text-slate-600">
        <span className="truncate">{t(`overview.fig.${key}`)}</span>
        <span className="shrink-0 tabular-nums">
          <b className="font-extrabold text-slate-800">{valueText(key, valueOf(row, key), lang)}</b>
          {change(row, key)}
        </span>
      </span>
      <FigureBar figureKey={key} value={valueOf(row, key)} className="mt-1" />
    </span>
  );

  const rowClass = `group block w-full py-3 px-2 text-left rounded-xl ${
    onOpen ? 'cursor-pointer hover:bg-slate-50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand' : ''
  }`;
  const chevron = onOpen ? (
    <ChevronRight className="w-4 h-4 text-slate-400 transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden="true" />
  ) : (
    <span aria-hidden="true" />
  );

  return (
    <section aria-labelledby={id} className="bg-white border border-slate-100 rounded-2xl p-6 max-sm:p-[18px] shadow-sm min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id={id} className="text-base font-extrabold text-slate-900 tracking-tight">
          {title}
        </h2>
        <div className="flex items-center gap-2">
          <label htmlFor={`${id}-sort`} className="text-xs font-semibold text-slate-500">
            {t('overview.sort.label')}
          </label>
          <Select id={`${id}-sort`} size="sm" value={sortId} onChange={(e) => setSortId(e.target.value)} className="w-56 max-sm:w-48">
            {SORTS.map((choice) => (
              <option key={choice.id} value={choice.id}>
                {t(`overview.sort.${choice.id}`)}
              </option>
            ))}
          </Select>
        </div>
      </div>
      <p className="mt-3 flex items-start gap-2 text-[13px] font-medium text-slate-600 leading-relaxed">
        <Info className="w-4 h-4 mt-0.5 shrink-0 text-slate-500" aria-hidden="true" />
        {note}
      </p>

      <ul className="mt-2 -mx-2 divide-y divide-slate-100">
        {ordered.map((row) => {
          const issues = trouble(row);
          /* Wide: name / two bars / average / arrow. A phone: the bars drop under the name. */
          const body = isEmptyRow(row) ? (
            <span className="grid grid-cols-[minmax(0,1fr)_1rem] items-center gap-4">
              <span className="min-w-0">
                <span className="block text-sm font-bold text-slate-900 break-words">{nameOf(row)}</span>
                <SlashLine parts={lineOf(row)} small />
              </span>
              {chevron}
            </span>
          ) : (
            <span className="grid grid-cols-[minmax(0,1fr)_auto_1rem] md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)_4.5rem_1rem] items-center gap-x-4 gap-y-2.5">
              <span className="min-w-0">
                <span className="block text-sm font-bold text-slate-900 break-words">{nameOf(row)}</span>
                <SlashLine parts={lineOf(row)} small />
                {issues.length > 0 && <span className="mt-0.5 flex flex-wrap gap-x-3 text-xs font-bold text-amber-700">{issues}</span>}
              </span>
              <span className="col-span-3 order-last grid grid-cols-2 gap-4 md:contents">
                {bar(row, 'attendance')}
                {bar(row, 'content')}
              </span>
              <span className="text-right">
                <b className="block text-base font-extrabold text-slate-900 tabular-nums">{valueText('averageGrade', valueOf(row, 'averageGrade'), lang)}</b>
                <span className="block text-[11px] font-semibold text-slate-500">
                  {t('overview.row.average')}
                  {change(row, 'averageGrade')}
                </span>
              </span>
              {chevron}
            </span>
          );
          return (
            <li key={keyOf(row)}>
              {onOpen ? (
                <button type="button" onClick={() => onOpen(row)} className={rowClass}>
                  {body}
                </button>
              ) : (
                <div className={rowClass}>{body}</div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
};

export const SchoolOverviewPage = () => {
  const { t } = useT();
  const navigate = useNavigate();
  const { zone } = useSchoolZoneState();
  /* undefined while reading, null when the read failed. */
  const [answer, setAnswer] = useState(undefined);
  const [semesterId, setSemesterId] = useState(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    dashboardService
      .school(semesterId)
      .then((found) => !cancelled && setAnswer(found))
      .catch(() => !cancelled && setAnswer(null));
    return () => {
      cancelled = true;
    };
  }, [semesterId, attempt]);

  const semester = answer?.semester ?? null;
  const counted = useCountedParts(answer, zone);
  const facts = [semester && t('teacherDash.academicContext', { year: semester.academicYear.label, n: semester.ordinal }), ...counted].filter(Boolean);
  const closed = semester?.status === 'CLOSED';

  const pick = (id) => {
    setAnswer(undefined);
    setSemesterId(id);
  };

  let body;
  if (answer === undefined) {
    body = (
      <div aria-busy="true" className="space-y-5">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          {FIGURES.map(({ key }) => (
            <Bone key={key} className="h-[74px]" />
          ))}
        </div>
        <Bone className="h-64 rounded-2xl" />
      </div>
    );
  } else if (answer === null) {
    body = (
      <HomeError
        message={t('overview.failed')}
        retryLabel={t('att.error.retry')}
        onRetry={() => {
          setAnswer(undefined);
          setAttempt((n) => n + 1);
        }}
      />
    );
  } else if (!semester) {
    body = (
      <HomeCard id="overview-none-title" title={t('overview.title')}>
        <HomeEmpty icon={CalendarX} title={t('overview.noSemester')} body={t('overview.noSemesterBody')} />
      </HomeCard>
    );
  } else if (!isCounted(answer) && !closed) {
    body = (
      <HomeCard id="overview-none-title" title={t('overview.title')}>
        <HomeEmpty icon={BarChart3} title={t('overview.notYet')} body={t('overview.notYetBody')} />
      </HomeCard>
    );
  } else {
    body = (
      <div className="space-y-5">
        {closed && <p className="rounded-xl bg-slate-100 px-3.5 py-2.5 text-[13px] text-slate-600">{t('overview.closedNote')}</p>}

        <section aria-labelledby="overview-school-title">
          <h2 id="overview-school-title" className="sr-only">
            {t('overview.school')}
          </h2>
          <dl className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
            {FIGURES.map(({ key }) => (
              <FigureTile key={key} row={answer.school} figureKey={key} />
            ))}
          </dl>
        </section>

        {answer.classes.length === 0 ? (
          <HomeCard id="overview-classes-title" title={t('overview.byClass')}>
            <HomeEmpty icon={School} title={t('overview.noClasses')} />
          </HomeCard>
        ) : (
          <OverviewRows
            id="overview-classes-title"
            title={t('overview.byClass')}
            note={t('overview.byClassNote')}
            kind="classes"
            rows={answer.classes}
            onOpen={(row) => navigate('/headmaster/classes', { state: { classId: row.class.id } })}
          />
        )}

        {answer.subjects.length === 0 ? (
          <HomeCard id="overview-subjects-title" title={t('overview.bySubject')}>
            <HomeEmpty icon={BarChart3} title={t('overview.noSubjects')} />
          </HomeCard>
        ) : (
          <OverviewRows id="overview-subjects-title" title={t('overview.bySubject')} note={t('overview.bySubjectNote')} kind="subjects" rows={answer.subjects} />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full text-left">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-3xl max-sm:text-2xl font-extrabold text-slate-900 tracking-tight leading-tight">{t('overview.title')}</h1>
          {facts.length > 0 && <SlashLine parts={facts} className="mt-2" />}
        </div>
        {answer?.semesters?.length > 1 && (
          <Select size="sm" value={semester?.id ?? ''} onChange={(e) => pick(e.target.value)} aria-label={t('overview.semester')} className="w-full sm:w-64">
            {answer.semesters.map((choice) => (
              <option key={choice.id} value={choice.id}>
                {t(choice.status === 'CLOSED' ? 'overview.semesterClosed' : 'grading.fin.semesterOption', { n: choice.ordinal, year: choice.academicYear.label })}
              </option>
            ))}
          </Select>
        )}
      </header>
      {body}
    </div>
  );
};

export default SchoolOverviewPage;
