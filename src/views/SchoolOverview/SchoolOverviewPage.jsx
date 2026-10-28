import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowDown, ArrowUp, BarChart3, CalendarX, ChevronRight, School } from 'lucide-react';

import { useT } from '../../i18n/LanguageContext';
import { dashboardService } from '../../services/dashboardService';
import { useSchoolZoneState } from '../../hooks/useSchoolToday';
import Select from '../../components/ui/Select';
import SubjectLabel from '../../components/ui/SubjectLabel';
import { Bone, FactCell, HomeCard, HomeEmpty, HomeError } from '../Dashboard/components/HomeCard';
import { ChangeMark, FigureTile, SlashLine } from './FigureParts';
import { useCountedParts } from './useCountedParts';
import { FIGURES, changeOf, firstDirOf, isCounted, sortRows, valueOf, valueText } from './schoolOverview';

/*
  "Ringkasan Sekolah", /headmaster/overview - the Principal's and Vice Principal's
  view of the whole School (backend 1a1eed7, dashboard ticket 06; owner,
  2026-10-28). One read of `GET /dashboard/school`, again for another Semester.

  - The School's line as tiles, then two tables, per Class and per Subject per
    grade level, each sortable by a column (grade then name first); on a phone a
    card per row. No teacher is named anywhere: the backend names none.
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

/* One sortable table, and the same rows as cards on a phone. */
const OverviewTable = ({ kind, rows, onOpen }) => {
  const { t, lang } = useT();
  const [sort, setSort] = useState({ key: 'name', dir: 'asc' });
  const ordered = sortRows(rows, sort, NAME_OF[kind]);

  const press = (key) =>
    setSort((now) => (now.key === key ? { key, dir: now.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: firstDirOf(key) }));

  const nameCell = (row) =>
    kind === 'classes' ? (
      <span className="font-bold text-slate-900">{row.class.name}</span>
    ) : (
      <span className="font-bold text-slate-900">
        <SubjectLabel code={row.subject.code} name={row.subject.name} />
        <span className="block text-xs font-medium text-slate-500">{t('classes.grade', { n: row.gradeLevel })}</span>
      </span>
    );

  const header = (key, label, alignRight) => {
    const active = sort.key === key;
    const Arrow = sort.dir === 'asc' ? ArrowUp : ArrowDown;
    return (
      <th
        key={key}
        scope="col"
        aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
        className={`px-3 py-2.5 align-bottom ${alignRight ? 'text-right' : 'text-left'}`}
      >
        <button
          type="button"
          onClick={() => press(key)}
          className={`inline-flex items-center gap-1 text-xs font-bold cursor-pointer rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
            active ? 'text-slate-900' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          {label}
          {active && <Arrow className="w-3.5 h-3.5" aria-hidden="true" />}
        </button>
      </th>
    );
  };

  const figureCell = (row, key) => (
    <td key={key} className="px-3 py-3 text-right tabular-nums whitespace-nowrap">
      <span className="font-semibold text-slate-900">{valueText(key, valueOf(row, key), lang)}</span>
      {changeOf(row, key) ? (
        <span className="ml-1.5">
          <ChangeMark figureKey={key} change={changeOf(row, key)} />
        </span>
      ) : null}
    </td>
  );

  const keyOf = (row) => (kind === 'classes' ? row.class.id : `${row.subject.id}:${row.gradeLevel}`);

  return (
    <>
      {/* Wide: the table. */}
      <div className="max-md:hidden -mx-2 overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100">
              {header('name', t(kind === 'classes' ? 'overview.col.class' : 'overview.col.subject'), false)}
              {FIGURES.map(({ key }) => header(key, t(`overview.fig.${key}`), true))}
              {onOpen && <th scope="col" className="w-8" aria-hidden="true" />}
            </tr>
          </thead>
          <tbody>
            {ordered.map((row) => (
              <tr
                key={keyOf(row)}
                onClick={onOpen ? () => onOpen(row) : undefined}
                className={`border-b border-slate-100 last:border-0 ${onOpen ? 'group cursor-pointer hover:bg-slate-50 transition-colors' : ''}`}
              >
                <th scope="row" className="px-3 py-3 text-left font-normal">
                  {onOpen ? (
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        onOpen(row);
                      }}
                      className="text-left cursor-pointer rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                    >
                      {nameCell(row)}
                    </button>
                  ) : (
                    nameCell(row)
                  )}
                </th>
                {FIGURES.map(({ key }) => figureCell(row, key))}
                {onOpen && (
                  <td className="pr-3 text-right">
                    <ChevronRight className="w-4 h-4 inline text-slate-400 transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden="true" />
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* A phone: a card per row, in the same order. */}
      <ul className="md:hidden space-y-2.5">
        {ordered.map((row) => {
          const body = (
            <>
              <div className="flex items-center justify-between gap-2 mb-2.5">
                <span className="text-sm">{nameCell(row)}</span>
                {onOpen && <ChevronRight className="w-4 h-4 shrink-0 text-slate-400" aria-hidden="true" />}
              </div>
              <dl className="grid grid-cols-3 gap-x-3 gap-y-2.5">
                {FIGURES.map(({ key }) => (
                  <FactCell key={key} label={t(`overview.fig.${key}`)}>
                    <span className="tabular-nums">{valueText(key, valueOf(row, key), lang)}</span>{' '}
                    <ChangeMark figureKey={key} change={changeOf(row, key)} />
                  </FactCell>
                ))}
              </dl>
            </>
          );
          return (
            <li key={keyOf(row)}>
              {onOpen ? (
                <button
                  type="button"
                  onClick={() => onOpen(row)}
                  className="w-full text-left rounded-xl border border-slate-100 p-3.5 cursor-pointer hover:bg-slate-50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                >
                  {body}
                </button>
              ) : (
                <div className="rounded-xl border border-slate-100 p-3.5">{body}</div>
              )}
            </li>
          );
        })}
      </ul>
    </>
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

        <HomeCard id="overview-classes-title" title={t('overview.byClass')}>
          {answer.classes.length === 0 ? (
            <HomeEmpty icon={School} title={t('overview.noClasses')} />
          ) : (
            <>
              <OverviewTable kind="classes" rows={answer.classes} onOpen={(row) => navigate('/headmaster/classes', { state: { classId: row.class.id } })} />
              <p className="mt-3 text-xs text-slate-500 leading-relaxed">{t('overview.byClassNote')}</p>
            </>
          )}
        </HomeCard>

        <HomeCard id="overview-subjects-title" title={t('overview.bySubject')}>
          {answer.subjects.length === 0 ? (
            <HomeEmpty icon={BarChart3} title={t('overview.noSubjects')} />
          ) : (
            <>
              <OverviewTable kind="subjects" rows={answer.subjects} />
              <p className="mt-3 text-xs text-slate-500 leading-relaxed">{t('overview.bySubjectNote')}</p>
            </>
          )}
        </HomeCard>
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
