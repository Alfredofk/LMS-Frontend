import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, Download, RefreshCw } from 'lucide-react';

import { useSchoolZoneState } from '../../hooks/useSchoolToday';
import { useT } from '../../i18n/LanguageContext';
import { assessmentErrorMessage } from '../../i18n/apiError';
import { assessmentService } from '../../services/assessmentService';
import { gradingService } from '../../services/gradingService';
import { downloadFile } from '../../utils/openFile';
import { localOf } from '../Attendance/attendance';
import { formatSchoolDay } from '../QuestionBank/questionBank';
import { formatNumber } from '../TeacherAssessment/results';
import { belowKktp, finalFlags, gradebookColumns, gradebookCsv, gradebookRows } from './gradebook';
import FinalGradeDetails from './FinalGradeDetails';

/*
  One class subject's gradebook: students down the side, its published
  assessments across, each cell the score that counts after release or a word for
  why there is none, and "Unduh CSV" (gradebook.js), all from one recap read. A
  score reached only by a remedial attempt says "Remedial" under it (the recap's
  `countedFromRemedial`, backend 96d2109); the CSV keeps the
  bare number, so a spreadsheet still reads it as one. Used by the teacher's page
  (TeacherGradebook, cells open the assessment's "Hasil") and, read only, by the
  homeroom teacher and the leaders (GradebookReader: no `onOpen`, nothing opens).

  The last column, kept in view as the names are (owner, 2026-10-18), is the
  final grade from GET /grading/class-subjects/:id/grades (backend 79b319f),
  read beside the recap: the number, red under the KKTP, with "2 menunggu" /
  "1 tidak mengumpulkan" under it (finalFlags); a click opens its details
  (FinalGradeDetails). A student another class's slot reports reads "Dilaporkan
  oleh XI IPA 1". The grade read failing leaves the scores standing, the column
  "-" and a line saying so. The CSV carries the whole number.

  @param classSubjectId  the class subject
  @param caption         its name for the table's caption ("MTK - XI IPS / ...")
  @param fileName        the CSV's name
  @param onOpen          (assessment) => void, or null for a reader
  @param framed          false inside a dialog or a host card: no card of its own
  @param kktp            the KKTP that applies (SlotGradeSettings' read), or null: a
                         score under it is red, with a line above the table saying so
                         (owner, 2026-10-14). The CSV keeps the bare number.
  @param settingsStamp   the slot settings' `updatedAt` as the panel last read it
                         (undefined before its first read): a change after that,
                         a save there, reads the grades again.
  @param onGrades        (grades) => void - each grade read (undefined reading, the
                         answer, or { failed: true }), for SlotDescriptions
  @param reloadKey       a change reads the grades again (the descriptions card's
                         stale row)
*/

const card = 'bg-white border border-slate-100 rounded-2xl p-5 sm:p-6 shadow-sm';
const tool =
  'inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-50 disabled:cursor-not-allowed';

const WORD_TONE = {
  WAITING_FOR_MARKING: 'text-amber-700',
  WAITING_FOR_RELEASE: 'text-brand',
  DID_NOT_SUBMIT: 'text-rose-700',
};

/* A header or a score opens the assessment when there is somewhere to open it (the teacher's page). */
const Opener = ({ onOpen, assessment, className, children }) =>
  onOpen ? (
    <button type="button" onClick={() => onOpen(assessment)} className={`${className} cursor-pointer rounded hover:text-brand focus:outline-none focus-visible:ring-2 focus-visible:ring-brand`}>
      {children}
    </button>
  ) : (
    <span className={className}>{children}</span>
  );

/* Kept in view at the right as the names are at the left, a rule on its left edge. */
const FINAL_CELL = 'sticky right-0 z-10 bg-white px-4 min-w-[7rem] border-l border-slate-100';

/* One student's final grade: the number (a button opening its details), red under the KKTP, with the counts under it. */
const FinalCell = ({ final, reading, kktp, open, label, onToggle }) => {
  const { t, lang } = useT();
  if (reading) return <span className="block h-4 w-8 rounded bg-slate-100 animate-pulse" aria-hidden="true" />;
  if (!final) return <span className="text-base font-extrabold text-slate-900">-</span>;
  if (!('value' in final)) {
    return (
      <span className="block text-[11px] font-semibold text-slate-500 break-words">
        {final.reportedBy ? t('gradebook.final.reportedBy', { name: final.reportedBy }) : t('gradebook.final.reportedElsewhere')}
      </span>
    );
  }
  const below = belowKktp({ score: final.value }, kktp);
  return (
    <>
      <button
        type="button"
        onClick={(event) => onToggle(event.currentTarget)}
        aria-expanded={open}
        aria-haspopup="dialog"
        className={`text-base font-extrabold tabular-nums cursor-pointer rounded underline decoration-dotted decoration-slate-300 underline-offset-4 hover:text-brand focus:outline-none focus-visible:ring-2 focus-visible:ring-brand ${below ? 'text-rose-700' : 'text-slate-900'}`}
      >
        {formatNumber(final.value, lang)}
        {below && <span className="sr-only"> ({t('gradebook.kktp.below')})</span>}
        <span className="sr-only">, {label}</span>
      </button>
      {finalFlags(final).map(({ key, n }) => (
        <span key={key} className={`block text-[11px] font-semibold ${key === 'waiting' ? 'text-amber-700' : 'text-rose-700'}`}>
          {t(`gradebook.final.flag.${key}`, { n })}
        </span>
      ))}
    </>
  );
};

export const GradebookTable = ({ classSubjectId, caption, fileName, onOpen = null, framed = true, kktp = null, settingsStamp = undefined, onGrades = null, reloadKey = 0 }) => {
  const { t, lang } = useT();
  const { zone } = useSchoolZoneState();
  /* undefined reading · { columns, recap } · { error } */
  const [table, setTable] = useState(undefined);
  const [attempt, setAttempt] = useState(0);
  /* The grade read, apart from the recap: undefined reading · the answer · { failed: true } */
  const [grades, setGrades] = useState(undefined);
  const [gradesAttempt, setGradesAttempt] = useState(0);
  /* The open details: { studentProfileId, anchor } */
  const [details, setDetails] = useState(null);
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

  /* The host hears every grade read (the descriptions card below the table reads the same one). */
  useEffect(() => {
    onGrades?.(grades);
  }, [grades, onGrades]);

  const rows = useMemo(() => (table?.columns ? gradebookRows(table.columns, table.recap, grades && !grades.failed ? grades : null) : []), [table, grades]);
  const closeDetails = useCallback(() => setDetails(null), []);

  const frame = framed ? card : '';
  const columnDay = (assessment) => formatSchoolDay(localOf(assessment.opensAt, zone)?.date, lang);
  const word = (key) => t(`gradebook.cell.${key}`);

  if (table === undefined) {
    return <div className="h-48 rounded-2xl bg-slate-50 animate-pulse" aria-busy="true" aria-label={t('common.loading')} />;
  }
  if (table.error) {
    return (
      <div className={`${frame} flex flex-col items-center text-center gap-3 py-8`} role="alert">
        <AlertCircle className="w-7 h-7 text-rose-500" aria-hidden="true" />
        <p className="text-sm font-bold text-slate-700 max-w-sm">{table.error}</p>
        <button type="button" onClick={() => setAttempt((n) => n + 1)} className={`${tool} bg-slate-100 text-slate-700 hover:bg-slate-200`}>
          <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
          {t('att.error.retry')}
        </button>
      </div>
    );
  }
  if (table.columns.length === 0) return <p className={`${frame} text-sm font-semibold text-slate-600`}>{t('gradebook.noAssessments')}</p>;
  if (rows.length === 0) return <p className={`${frame} text-sm font-semibold text-slate-600`}>{t('gradebook.noStudents')}</p>;

  const detailsRow = details && rows.find((row) => row.studentProfileId === details.studentProfileId);

  const download = () =>
    downloadFile(
      async () =>
        new Blob(
          [
            gradebookCsv(table.columns, rows, {
              lang,
              nameHeader: t('gradebook.student'),
              columnHeader: (assessment) => `${assessment.title} (${t(`tasm.type.${assessment.type}`)}, ${columnDay(assessment)})`,
              words: word,
              finalHeader: t('gradebook.final.header'),
            }),
          ],
          { type: 'text/csv;charset=utf-8' }
        ),
      fileName
    );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          {typeof kktp === 'number' && (
            <p className="text-xs font-semibold text-slate-500">
              <span className="text-rose-700">{t('gradebook.kktp.red')}</span> {t('gradebook.kktp.legend', { kktp })}
            </p>
          )}
          {grades?.failed && (
            <p className="flex flex-wrap items-center gap-x-2 text-xs font-semibold text-amber-700" role="status">
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
        </div>
        <button type="button" onClick={download} className={`${tool} border border-slate-200 text-slate-700 hover:bg-slate-50`}>
          <Download className="w-4 h-4" aria-hidden="true" />
          {t('gradebook.csv')}
        </button>
      </div>
      {/* relative: a score's sr-only words are absolute, and would otherwise widen the page past this scroll box. */}
      <div className={`relative overflow-x-auto ${framed ? 'bg-white border border-slate-100 rounded-2xl shadow-sm' : 'border border-slate-100 rounded-xl'}`}>
        <table className="min-w-full text-sm">
          <caption className="sr-only">{t('gradebook.caption', { name: caption ?? '' })}</caption>
          <thead>
            <tr className="border-b border-slate-100">
              <th scope="col" className="sticky left-0 z-10 bg-white px-4 py-3 text-left text-xs font-bold text-slate-600 min-w-[10rem]">
                {t('gradebook.student')}
              </th>
              {table.columns.map(({ assessment }) => (
                <th key={assessment.id} scope="col" className="px-3 py-3 text-left align-bottom min-w-[8rem] max-w-[12rem]">
                  <Opener onOpen={onOpen} assessment={assessment} className="block text-left space-y-0.5">
                    <span className="block text-xs font-bold text-slate-800 break-words">{assessment.title}</span>
                    <span className="flex flex-wrap gap-x-2 text-[11px] font-semibold text-slate-500">
                      <span>{t(`tasm.type.${assessment.type}`)}</span>
                      <span className="tabular-nums">{columnDay(assessment)}</span>
                    </span>
                  </Opener>
                </th>
              ))}
              <th scope="col" className={`${FINAL_CELL} py-3 text-left align-bottom text-xs font-bold text-slate-800`}>
                {t('gradebook.final.header')}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row) => (
              <tr key={row.studentProfileId}>
                <th scope="row" className="sticky left-0 z-10 bg-white px-4 py-2.5 text-left">
                  <span className="block text-sm font-bold text-slate-900 break-words">{row.fullName ?? t('tasm.results.unnamed')}</span>
                  {!row.placedNow && <span className="block text-[11px] font-semibold text-slate-500">{t('tasm.results.movedAway')}</span>}
                </th>
                {row.cells.map((cell, i) => {
                  const assessment = table.columns[i].assessment;
                  return (
                    <td key={assessment.id} className="px-3 py-2.5">
                      {'score' in cell ? (
                        <>
                          <Opener
                            onOpen={onOpen}
                            assessment={assessment}
                            className={`text-base font-extrabold tabular-nums ${belowKktp(cell, kktp) ? 'text-rose-700' : 'text-slate-900'}`}
                          >
                            {formatNumber(cell.score, lang)}
                            {belowKktp(cell, kktp) && <span className="sr-only"> ({t('gradebook.kktp.below')})</span>}
                          </Opener>
                          {cell.remedial && <span className="block text-[11px] font-semibold text-brand">{t('tasm.results.remedial')}</span>}
                        </>
                      ) : (
                        <span className={`text-[11px] font-semibold ${WORD_TONE[cell.word] ?? 'text-slate-500'}`}>{word(cell.word)}</span>
                      )}
                    </td>
                  );
                })}
                <td className={`${FINAL_CELL} py-2.5`}>
                  <FinalCell
                    final={row.final}
                    reading={grades === undefined}
                    kktp={kktp}
                    open={details?.studentProfileId === row.studentProfileId}
                    label={t('gradebook.final.open', { name: row.fullName ?? t('tasm.results.unnamed') })}
                    onToggle={(anchor) =>
                      setDetails((now) => (now?.studentProfileId === row.studentProfileId ? null : { studentProfileId: row.studentProfileId, anchor }))
                    }
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {detailsRow?.final && 'value' in detailsRow.final && (
        <FinalGradeDetails
          anchor={details.anchor}
          final={detailsRow.final}
          name={detailsRow.fullName ?? t('tasm.results.unnamed')}
          rule={grades?.settings?.remedialRule?.value ?? null}
          onClose={closeDetails}
        />
      )}
    </div>
  );
};

export default GradebookTable;
