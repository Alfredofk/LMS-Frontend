import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ClipboardCheck, Download } from 'lucide-react';

import Button from '../../components/ui/Button';
import FactLine from '../../components/ui/FactLine';
import { useSchoolZoneState } from '../../hooks/useSchoolToday';
import { useT } from '../../i18n/LanguageContext';
import { assessmentErrorMessage } from '../../i18n/apiError';
import { assessmentService } from '../../services/assessmentService';
import { gradingService } from '../../services/gradingService';
import { downloadFile } from '../../utils/openFile';
import { initialsOf } from '../../utils/names';
import { localOf } from '../Attendance/attendance';
import { HomeEmpty, HomeError } from '../Dashboard/components/HomeCard';
import { formatSchoolDay } from '../QuestionBank/questionBank';
import { formatNumber } from '../TeacherAssessment/results';
import { GRADE_TYPES, belowKktp, finalNotes, gradebookColumns, gradebookCsv, gradebookRows, gradebookSummary, rowCounts } from './gradebook';

/*
  One class subject's gradebook, all from one recap read (gradebook.js), with
  "Unduh CSV". Since 2026-10-28 (owner, mockup nilai-guru.html, choice B: the
  table "read as piled up") it is a card of rows, one per student, not a
  students x assessments table: the name, a grey line of counts ("4 nilai masuk
  / 1 perlu dinilai", rowCounts) and the final grade on the right, red with "Di
  bawah KKTP" under the KKTP. Above the rows three numbers from the same reads
  (gradebookSummary). A row opens in place into the student's assessments, each
  with the score that counts or a word for why there is none ("Remedial" under a
  score only a remedial attempt reached, the recap's `countedFromRemedial`), and
  the final grade taken apart: each type's average and the weight it carries
  once the types with nothing that counts drop out, the number before rounding,
  and every count above 0 (finalNotes). That was a popover by the table's cell
  (FinalGradeDetails, gone with the table). The CSV keeps the table's shape and
  the bare numbers.

  Used by the teacher's page (TeacherClassSubjectDetail: an assessment opens its
  "Hasil") and, read only, by the homeroom teacher and the leaders
  (GradebookReader: no `onOpen`, nothing opens).

  The final grade is GET /grading/class-subjects/:id/grades (backend 79b319f),
  read beside the recap. A student another class's slot reports reads
  "Dilaporkan oleh XI IPA 1". The grade read failing leaves the scores standing,
  the grades "-" and a line saying so.

  @param classSubjectId     the class subject
  @param caption            its name, for the list's label ("MTK - XI IPS / ...")
  @param fileName           the CSV's name
  @param onOpen             (assessment) => void, or null for a reader
  @param onOpenAssessments  () => void - the empty state's way to the assessments, or null
  @param framed             false inside a dialog or a host card: no card of its own
  @param showTitle          false where the host already heads it "Buku nilai"
  @param kktp               the KKTP that applies (SlotGradeSettings' read), or null: a
                            score under it is red (owner, 2026-10-14). The CSV keeps
                            the bare number.
  @param settingsStamp      the slot settings' `updatedAt` as the panel last read it
                            (undefined before its first read): a change after that,
                            a save there, reads the grades again.
  @param onGrades           (grades) => void - each grade read (undefined reading, the
                            answer, or { failed: true }), for SlotDescriptions
  @param reloadKey          a change reads the grades again (the descriptions card's
                            stale row)
*/

const CARD = 'bg-white border border-slate-100 rounded-2xl p-6 max-sm:p-[18px] shadow-sm min-w-0 text-left';

const WORD_TONE = {
  WAITING_FOR_MARKING: 'text-amber-700',
  WAITING_FOR_RELEASE: 'text-brand',
  DID_NOT_SUBMIT: 'text-rose-700',
};

/* An assessment's title opens it when there is somewhere to open it (the teacher's page). */
const Opener = ({ onOpen, assessment, className, children }) =>
  onOpen ? (
    <button type="button" onClick={() => onOpen(assessment)} className={`${className} text-left cursor-pointer rounded hover:text-brand focus:outline-none focus-visible:ring-2 focus-visible:ring-brand`}>
      {children}
    </button>
  ) : (
    <span className={className}>{children}</span>
  );

/* The final grade at the row's right: the number, red under the KKTP with the words under it. */
const FinalValue = ({ final, reading, kktp }) => {
  const { t, lang } = useT();
  if (reading) return <span className="block h-6 w-10 rounded-lg bg-slate-100 animate-pulse" aria-hidden="true" />;
  if (!final) return <span className="text-xl font-extrabold text-slate-900">-</span>;
  if (!('value' in final)) {
    return (
      <span className="block max-w-[9rem] text-[11px] font-semibold text-slate-500 break-words">
        {final.reportedBy ? t('gradebook.final.reportedBy', { name: final.reportedBy }) : t('gradebook.final.reportedElsewhere')}
      </span>
    );
  }
  const below = belowKktp({ score: final.value }, kktp);
  return (
    <>
      <span className={`block text-lg sm:text-xl font-extrabold tabular-nums leading-tight ${below ? 'text-rose-700' : 'text-slate-900'}`}>{formatNumber(final.value, lang)}</span>
      {below && <span className="block text-[11px] font-bold text-rose-700">{t('gradebook.below')}</span>}
    </>
  );
};

/* How the final grade was reached: a cell per type, the number before rounding, then the counts. */
const FinalBreakdown = ({ final, rule }) => {
  const { t, lang } = useT();
  const ruleName = rule ? t(`grading.rule.${rule}`) : '-';
  const notes = finalNotes(final);
  return (
    <div className="mt-3 rounded-xl border border-slate-100 bg-white p-3.5 space-y-2.5">
      <p className="text-xs font-bold text-slate-600">{t('gradebook.final.title')}</p>
      <dl className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {GRADE_TYPES.map((type) => {
          const part = final.types?.[type] ?? null;
          return (
            <div key={type} className="min-w-0 rounded-lg bg-slate-50 px-2.5 py-2">
              <dt className="text-[10px] font-bold tracking-wider uppercase text-slate-500">{t(`tasm.type.${type}`)}</dt>
              <dd className="text-base font-extrabold tabular-nums text-slate-900">{part ? formatNumber(part.average, lang) : '-'}</dd>
              <dd className="text-[11px] font-semibold text-slate-500 tabular-nums">
                {part ? `${t('gradebook.final.weight', { weight: formatNumber(part.weight, lang) })}, ${t('gradebook.final.count', { n: part.count })}` : t('gradebook.final.noneYet')}
              </dd>
            </div>
          );
        })}
      </dl>
      <p className="text-xs font-semibold text-slate-600 tabular-nums">
        {final.unrounded === null
          ? t('gradebook.final.empty')
          : t('gradebook.final.unrounded', {
              value: new Intl.NumberFormat(lang === 'en' ? 'en-GB' : 'id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(final.unrounded)),
            })}
      </p>
      {notes.length > 0 && (
        <ul className="space-y-0.5">
          {notes.map(({ key, n }) => (
            <li key={key} className={`text-xs font-semibold leading-relaxed ${key === 'didNotSubmit' ? 'text-rose-700' : key === 'waiting' ? 'text-amber-700' : 'text-slate-500'}`}>
              {t(`gradebook.final.note.${key}`, { n, rule: ruleName })}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

/* One student: the row, and when open, their assessments and how the final grade was reached. */
const StudentRow = ({ row, columns, open, onToggle, onOpen, kktp, gradesReading, rule, columnDay }) => {
  const { t, lang } = useT();
  const name = row.fullName ?? t('tasm.results.unnamed');
  const panelId = `gradebook-row-${row.studentProfileId}`;
  return (
    <li className="border-b border-slate-100 last:border-0">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={panelId}
        className="w-full flex items-center gap-3 px-4 py-3.5 text-left cursor-pointer transition-colors duration-150 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand"
      >
        <span className="grid place-items-center w-9 h-9 shrink-0 rounded-full bg-brand-tint text-brand text-xs font-extrabold" aria-hidden="true">
          {initialsOf(name)}
        </span>
        <span className="flex-1 min-w-0">
          <span className="block text-sm font-bold text-slate-900 break-words">{name}</span>
          <span className="block text-xs font-medium text-slate-500">
            {rowCounts(row).map(({ key, n }, i) => (
              <React.Fragment key={key}>
                {i > 0 && (
                  <>
                    {' '}
                    <span className="mx-1 text-slate-300" aria-hidden="true">
                      /
                    </span>{' '}
                  </>
                )}
                <span className={`whitespace-nowrap ${WORD_TONE[key] ?? ''}`}>{t(`gradebook.count.${key}`, { n })}</span>
              </React.Fragment>
            ))}
            {!row.placedNow && (
              <>
                {' '}
                <span className="mx-1 text-slate-300" aria-hidden="true">
                  /
                </span>{' '}
                <span className="whitespace-nowrap">{t('tasm.results.movedAway')}</span>
              </>
            )}
          </span>
        </span>
        <span className="shrink-0 text-right">
          <FinalValue final={row.final} reading={gradesReading} kktp={kktp} />
        </span>
        <ChevronDown className={`w-4 h-4 shrink-0 text-slate-500 transition-transform duration-300 motion-reduce:transition-none ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>
      {open && (
        <div id={panelId} className="animate-rise bg-slate-50 border-t border-slate-100 px-4 pb-4 pt-1 pl-16 max-sm:pl-4">
          <ul>
            {columns.map(({ assessment }, i) => {
              const cell = row.cells[i];
              const below = 'score' in cell && belowKktp(cell, kktp);
              return (
                <li key={assessment.id} className="flex items-center justify-between gap-3 py-2.5 border-b border-slate-200 last:border-0">
                  <span className="min-w-0">
                    <Opener onOpen={onOpen} assessment={assessment} className="block text-[13px] font-bold text-slate-800 break-words">
                      {assessment.title}
                    </Opener>
                    <FactLine size="xs" facts={[t(`tasm.type.${assessment.type}`), columnDay(assessment)]} />
                  </span>
                  <span className="shrink-0 text-right">
                    {'score' in cell ? (
                      <>
                        <span className={`block text-base font-extrabold tabular-nums ${below ? 'text-rose-700' : 'text-slate-900'}`}>
                          {formatNumber(cell.score, lang)}
                          {below && <span className="sr-only"> ({t('gradebook.kktp.below')})</span>}
                        </span>
                        {cell.remedial && <span className="block text-[11px] font-semibold text-brand">{t('tasm.results.remedial')}</span>}
                      </>
                    ) : (
                      <span className={`text-xs font-semibold ${WORD_TONE[cell.word] ?? 'text-slate-500'}`}>{t(`gradebook.cell.${cell.word}`)}</span>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
          {row.final && 'value' in row.final && <FinalBreakdown final={row.final} rule={rule} />}
        </div>
      )}
    </li>
  );
};

/* The rows' shape while the recap is read: a circle, two lines and a number per row. */
const RowsLoading = () => (
  <ul className="mt-4 border border-slate-100 rounded-xl" aria-hidden="true">
    {[0, 1, 2].map((i) => (
      <li key={i} className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-100 last:border-0">
        <span className="w-9 h-9 rounded-full bg-slate-100 animate-pulse" />
        <span className="flex-1 space-y-2">
          <span className="block h-3 w-1/3 rounded-[10px] bg-slate-100 animate-pulse" />
          <span className="block h-2.5 w-1/2 rounded-[10px] bg-slate-100 animate-pulse" />
        </span>
        <span className="h-6 w-10 rounded-[10px] bg-slate-100 animate-pulse" />
      </li>
    ))}
  </ul>
);

const Summary = ({ summary, kktp }) => {
  const { t, lang } = useT();
  const cells = [
    { key: 'average', value: summary.average === null ? '-' : formatNumber(summary.average, lang) },
    {
      key: 'below',
      value: summary.below === null || summary.graded === 0 ? '-' : t('gradebook.sum.belowValue', { n: summary.below, total: summary.graded }),
      red: typeof kktp === 'number' && summary.below > 0,
    },
    { key: 'didNotSubmit', value: String(summary.didNotSubmit) },
  ];
  return (
    <div className="mt-4 grid grid-cols-3 gap-2 sm:gap-2.5">
      {cells.map(({ key, value, red }) => (
        <p key={key} className="min-w-0 rounded-xl border border-slate-100 px-2.5 sm:px-3 py-2.5">
          <span className={`block text-lg sm:text-xl font-extrabold tabular-nums leading-tight ${red ? 'text-rose-700' : 'text-slate-900'}`}>{value}</span>
          <span className="block text-xs font-semibold text-slate-500">{t(`gradebook.sum.${key}`)}</span>
        </p>
      ))}
    </div>
  );
};

export const GradebookTable = ({
  classSubjectId,
  caption,
  fileName,
  onOpen = null,
  onOpenAssessments = null,
  framed = true,
  showTitle = true,
  kktp = null,
  settingsStamp = undefined,
  onGrades = null,
  reloadKey = 0,
}) => {
  const { t, lang } = useT();
  const { zone } = useSchoolZoneState();
  /* undefined reading · { columns, recap } · { error } */
  const [table, setTable] = useState(undefined);
  const [attempt, setAttempt] = useState(0);
  /* The grade read, apart from the recap: undefined reading · the answer · { failed: true } */
  const [grades, setGrades] = useState(undefined);
  const [gradesAttempt, setGradesAttempt] = useState(0);
  /* The rows opened, by student */
  const [opened, setOpened] = useState(() => new Set());
  /* A settings save changes the stamp: the grades are read again (adjusted while rendering, not in an effect). Its first arrival is the panel's first read, not a save. */
  const [seenStamp, setSeenStamp] = useState(settingsStamp);
  if (settingsStamp !== seenStamp) {
    setSeenStamp(settingsStamp);
    if (seenStamp !== undefined) setGradesAttempt((n) => n + 1);
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const recap = await assessmentService.recap(classSubjectId);
      return { columns: gradebookColumns(recap?.assessments, new Date()), recap };
    })()
      .then((answer) => !cancelled && setTable(answer))
      .catch((err) => !cancelled && setTable({ error: assessmentErrorMessage(err, t) }));
    return () => {
      cancelled = true;
    };
  }, [classSubjectId, attempt, t]);

  useEffect(() => {
    let cancelled = false;
    gradingService
      .slotGrades(classSubjectId)
      .then((answer) => !cancelled && setGrades(answer ?? { failed: true }))
      .catch(() => !cancelled && setGrades({ failed: true }));
    return () => {
      cancelled = true;
    };
  }, [classSubjectId, attempt, gradesAttempt, reloadKey]);

  /* The host hears every grade read (the descriptions card below the list reads the same one). */
  useEffect(() => {
    onGrades?.(grades);
  }, [grades, onGrades]);

  const rows = useMemo(() => (table?.columns ? gradebookRows(table.columns, table.recap, grades && !grades.failed ? grades : null) : []), [table, grades]);
  const summary = useMemo(() => gradebookSummary(rows, kktp), [rows, kktp]);

  const frame = framed ? CARD : 'text-left';
  const columnDay = (assessment) => formatSchoolDay(localOf(assessment.opensAt, zone)?.date, lang);
  const ready = table && !table.error && table.columns.length > 0 && rows.length > 0;

  const toggle = (id) =>
    setOpened((now) => {
      const next = new Set(now);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const download = () =>
    downloadFile(
      async () =>
        new Blob(
          [
            gradebookCsv(table.columns, rows, {
              lang,
              nameHeader: t('gradebook.student'),
              columnHeader: (assessment) => `${assessment.title} (${t(`tasm.type.${assessment.type}`)}, ${columnDay(assessment)})`,
              words: (key) => t(`gradebook.cell.${key}`),
              finalHeader: t('gradebook.final.header'),
            }),
          ],
          { type: 'text/csv;charset=utf-8' }
        ),
      fileName
    );

  const facts = ready
    ? [t('gradebook.facts.students', { n: rows.length }), t('gradebook.facts.assessments', { n: table.columns.length }), typeof kktp === 'number' ? t('gradebook.facts.kktp', { kktp }) : null]
    : [];

  let body;
  if (table === undefined) {
    body = (
      <div aria-busy="true" aria-label={t('common.loading')}>
        <RowsLoading />
      </div>
    );
  } else if (table.error) {
    body = (
      <div className="mt-4">
        <HomeError
          message={table.error}
          retryLabel={t('att.error.retry')}
          onRetry={() => {
            setTable(undefined);
            setAttempt((n) => n + 1);
          }}
        />
      </div>
    );
  } else if (table.columns.length === 0) {
    body = (
      <HomeEmpty
        icon={ClipboardCheck}
        title={t('gradebook.noAssessments')}
        body={t('gradebook.noAssessments.hint')}
        action={
          onOpenAssessments && (
            <Button size="sm" variant="outline" onClick={onOpenAssessments}>
              {t('gradebook.openAssessments')}
            </Button>
          )
        }
      />
    );
  } else if (rows.length === 0) {
    body = <HomeEmpty icon={ClipboardCheck} title={t('gradebook.noStudents')} />;
  } else {
    body = (
      <>
        <Summary summary={summary} kktp={kktp} />
        <p className="mt-3.5 text-[13px] font-medium text-slate-500 leading-relaxed">
          {t('gradebook.intro')}
          {typeof kktp === 'number' && (
            <>
              {' '}
              <span className="text-rose-700">{t('gradebook.kktp.red')}</span> {t('gradebook.kktp.legend', { kktp })}
            </>
          )}
        </p>
        {grades?.failed && (
          <p className="mt-2 flex flex-wrap items-center gap-x-2 text-xs font-semibold text-amber-700" role="status">
            {t('gradebook.final.failed')}
            <button
              type="button"
              onClick={() => {
                setGrades(undefined);
                setGradesAttempt((n) => n + 1);
              }}
              className="font-extrabold text-brand hover:underline cursor-pointer rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            >
              {t('att.error.retry')}
            </button>
          </p>
        )}
        <ul className="mt-4 border border-slate-100 rounded-xl overflow-hidden" aria-label={t('gradebook.caption', { name: caption ?? '' })}>
          {rows.map((row) => (
            <StudentRow
              key={row.studentProfileId}
              row={row}
              columns={table.columns}
              open={opened.has(row.studentProfileId)}
              onToggle={() => toggle(row.studentProfileId)}
              onOpen={onOpen}
              kktp={kktp}
              gradesReading={grades === undefined}
              rule={grades?.settings?.remedialRule?.value ?? null}
              columnDay={columnDay}
            />
          ))}
        </ul>
      </>
    );
  }

  return (
    <section className={frame} aria-label={t('gradebook.readerTitle')}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          {showTitle && <h3 className="text-base font-extrabold text-slate-900 tracking-tight">{t('gradebook.readerTitle')}</h3>}
          {facts.length > 0 && <FactLine className="mt-0.5" facts={facts} />}
        </div>
        {ready && (
          <Button size="sm" variant="outline" onClick={download} className="shrink-0">
            <span className="inline-flex items-center gap-1.5">
              <Download className="w-4 h-4" aria-hidden="true" />
              {t('gradebook.csv')}
            </span>
          </Button>
        )}
      </div>
      {body}
    </section>
  );
};

export default GradebookTable;
