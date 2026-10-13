import React, { useEffect, useState } from 'react';
import { AlertCircle, Download, RefreshCw } from 'lucide-react';

import { useSchoolZoneState } from '../../hooks/useSchoolToday';
import { useT } from '../../i18n/LanguageContext';
import { assessmentErrorMessage } from '../../i18n/apiError';
import { assessmentService } from '../../services/assessmentService';
import { downloadFile } from '../../utils/openFile';
import { localOf } from '../Attendance/attendance';
import { formatSchoolDay } from '../QuestionBank/questionBank';
import { formatNumber } from '../TeacherAssessment/results';
import { gradebookColumns, gradebookCsv, gradebookRows } from './gradebook';

/*
  One class subject's gradebook: students down the side, its published
  assessments across, each cell the score that counts after release or a word for
  why there is none, and "Unduh CSV" (gradebook.js), all from one recap read. A
  score reached only by a remedial attempt says "Remedial" under it (the recap's
  `countedFromRemedial`, backend 96d2109); the CSV keeps the
  bare number, so a spreadsheet still reads it as one. Used by the teacher's page
  (TeacherGradebook, cells open the assessment's "Hasil") and, read only, by the
  homeroom teacher and the leaders (GradebookReader: no `onOpen`, nothing opens).

  @param classSubjectId  the class subject
  @param caption         its name for the table's caption ("MTK - XI IPS / ...")
  @param fileName        the CSV's name
  @param onOpen          (assessment) => void, or null for a reader
  @param framed          false inside a dialog or a host card: no card of its own
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

export const GradebookTable = ({ classSubjectId, caption, fileName, onOpen = null, framed = true }) => {
  const { t, lang } = useT();
  const { zone } = useSchoolZoneState();
  /* undefined reading · { columns, rows } · { error } */
  const [table, setTable] = useState(undefined);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const recap = await assessmentService.recap(classSubjectId);
      const columns = gradebookColumns(recap?.assessments, new Date());
      return { columns, rows: gradebookRows(columns, recap) };
    })()
      .then((answer) => !cancelled && setTable(answer))
      .catch((err) => !cancelled && setTable({ error: assessmentErrorMessage(err, t) }));
    return () => {
      cancelled = true;
    };
  }, [classSubjectId, attempt, t]);

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
  if (table.rows.length === 0) return <p className={`${frame} text-sm font-semibold text-slate-600`}>{t('gradebook.noStudents')}</p>;

  const download = () =>
    downloadFile(
      async () =>
        new Blob(
          [
            gradebookCsv(table.columns, table.rows, {
              lang,
              nameHeader: t('gradebook.student'),
              columnHeader: (assessment) => `${assessment.title} (${t(`tasm.type.${assessment.type}`)}, ${columnDay(assessment)})`,
              words: word,
            }),
          ],
          { type: 'text/csv;charset=utf-8' }
        ),
      fileName
    );

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button type="button" onClick={download} className={`${tool} border border-slate-200 text-slate-700 hover:bg-slate-50`}>
          <Download className="w-4 h-4" aria-hidden="true" />
          {t('gradebook.csv')}
        </button>
      </div>
      <div className={`overflow-x-auto ${framed ? 'bg-white border border-slate-100 rounded-2xl shadow-sm' : 'border border-slate-100 rounded-xl'}`}>
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
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {table.rows.map((row) => (
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
                          <Opener onOpen={onOpen} assessment={assessment} className="text-base font-extrabold text-slate-900 tabular-nums">
                            {formatNumber(cell.score, lang)}
                          </Opener>
                          {cell.remedial && <span className="block text-[11px] font-semibold text-brand">{t('tasm.results.remedial')}</span>}
                        </>
                      ) : (
                        <span className={`text-[11px] font-semibold ${WORD_TONE[cell.word] ?? 'text-slate-500'}`}>{word(cell.word)}</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default GradebookTable;
