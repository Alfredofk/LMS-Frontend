import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { AlertCircle, Printer } from 'lucide-react';

import Select from '../../components/ui/Select';
import { useSchoolZone } from '../../hooks/useSchoolToday';
import { useT } from '../../i18n/LanguageContext';
import { reportCardErrorMessage } from '../../i18n/apiError';
import { gradingService } from '../../services/gradingService';
import { openFileInNewTab } from '../../utils/openFile';
import { formatDay } from '../Classes/format';
import { shortWhen } from '../TeacherAssessment/teacherAssessment';
import {
  REPORT_TYPES,
  hasVersionChoice,
  isOlderVersion,
  letterheadParts,
  newestVersionOf,
  promotionLineOf,
  sharedKktpOf,
  showsTypeAverages,
  typeAverageText,
} from './reportCards';

/*
  One report card (/report-cards/:reportCardId; owner, 2026-10-20; backend 3a22f90 /
  46c6173), for its student, the homeroom teacher of its class and the leaders - the
  server answers 404 to anyone else, and a student reading an older version. As it was
  written at close, in the printed one's order (owner 2026-10-22, backend 4dae152): who
  and where (the school's NPSN, address and phone, the phase), the subjects (No, Mata
  pelajaran, Tugas, Kuis, UTS, UAS, Nilai akhir, Predikat, and the Capaian kompetensi
  as a row under each - a table from 640px, a list below it; the type columns left out
  for a card closed before they were frozen; the KKTP named under it when every
  subject shares one, no red), absences in sessions, the homeroom note, the grading
  system, an even semester's promotion statement, and the date with the homeroom
  teacher's and the Principal's names and NIPs. The blank extracurricular and
  personality tables are the paper's alone. "Cetak PDF" opens the printed one in a new
  tab. A staff read holding several versions offers them; an older one says so and
  links the newest. The navbar leads back where it was opened from (`state.back`,
  reportCards.js backOf).
*/

const card = 'bg-white border border-slate-100 rounded-2xl p-5 sm:p-6 shadow-sm';

const Fact = ({ label, value }) => (
  <div className="min-w-0">
    <dt className="text-[11px] font-semibold text-slate-500">{label}</dt>
    <dd className="text-sm font-bold text-slate-900 break-words">{value || '-'}</dd>
  </div>
);

export const ReportCardPage = () => {
  const { t, lang } = useT();
  const { reportCardId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const zone = useSchoolZone();
  /* `{ id, card }` or `{ id, error }` for the id it was read for; another id is still reading. */
  const [answer, setAnswer] = useState(null);
  /* `{ id, busy }` or `{ id, error }` for the card whose PDF was asked for. */
  const [pdf, setPdf] = useState(null);

  useEffect(() => {
    let cancelled = false;
    gradingService
      .reportCard(reportCardId)
      .then((card) => !cancelled && setAnswer({ id: reportCardId, card }))
      .catch((err) => !cancelled && setAnswer({ id: reportCardId, error: reportCardErrorMessage(err, t) }));
    return () => {
      cancelled = true;
    };
  }, [reportCardId, t]);

  const read = answer?.id === reportCardId ? (answer.error ? { error: answer.error } : answer.card) : undefined;
  const day = (value) => formatDay(value, lang);
  /* Another version replaces this entry, so Back still leaves the page, and keeps the way back. */
  const open = (id) => navigate(`/report-cards/${id}`, { replace: true, state: location.state });

  if (read === undefined) {
    return <div className="h-64 rounded-2xl bg-white border border-slate-100 animate-pulse" aria-busy="true" aria-label={t('common.loading')} />;
  }
  if (read?.error || !read) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">{t('shell.reportCards')}</h1>
        <div className={`${card} flex flex-col items-center text-center gap-3 py-8`} role="alert">
          <AlertCircle className="w-7 h-7 text-rose-500" aria-hidden="true" />
          <p className="text-sm font-bold text-slate-700 max-w-sm">{read?.error ?? t('rc.error.notFound')}</p>
        </div>
      </div>
    );
  }

  const rc = read;
  const newest = newestVersionOf(rc);
  const kktp = sharedKktpOf(rc.subjects);
  const withTypes = showsTypeAverages(rc.subjects);
  const promotion = promotionLineOf(rc);
  const contact = letterheadParts(rc.school);
  const pdfHere = pdf?.id === rc.id ? pdf : null;
  const versionLabel = (entry) => {
    const label = t('rc.versionOption', { n: entry.version, date: day(entry.reportDate) });
    return entry.id === newest?.id ? t('rc.versionNewest', { label }) : label;
  };

  const printPdf = async () => {
    const id = rc.id;
    setPdf({ id, busy: true });
    try {
      await openFileInNewTab(() => gradingService.reportCardPdf(id));
      setPdf(null);
    } catch (err) {
      setPdf({ id, error: reportCardErrorMessage(err, t) });
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">{t('rc.title', { n: rc.semester.ordinal, year: rc.academicYear })}</h1>
          <p className="text-xs sm:text-sm text-slate-500 font-bold mt-1 break-words">
            {rc.student.fullName}
            <span className="font-light text-slate-300"> / </span>
            {rc.class.name}
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
          {hasVersionChoice(rc) && (
            <Select size="sm" value={rc.id} onChange={(e) => open(e.target.value)} aria-label={t('rc.versionChoice')} className="w-full sm:w-64">
              {rc.versions.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {versionLabel(entry)}
                </option>
              ))}
            </Select>
          )}
          <button
            type="button"
            onClick={printPdf}
            disabled={Boolean(pdfHere?.busy)}
            className="inline-flex items-center justify-center gap-2 h-9 px-4 rounded-xl bg-brand text-white text-sm font-bold hover:bg-brand-deep disabled:opacity-60 cursor-pointer disabled:cursor-wait focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 shrink-0"
          >
            <Printer className="w-4 h-4" aria-hidden="true" />
            {pdfHere?.busy ? t('rc.pdf.opening') : t('rc.pdf.print')}
          </button>
        </div>
      </div>

      {pdfHere?.error && (
        <p className="text-sm font-semibold text-rose-700" role="alert">
          {pdfHere.error}
        </p>
      )}

      {isOlderVersion(rc) && (
        <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm font-semibold text-amber-700" role="status">
          {t('rc.olderNote', { n: newest.version })}
          <button type="button" onClick={() => open(newest.id)} className="text-xs font-extrabold text-brand hover:underline cursor-pointer rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-brand">
            {t('rc.openNewest')}
          </button>
        </p>
      )}

      <section className={`${card} space-y-4`} aria-label={t('rc.fact.student')}>
        <dl className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-3">
          <Fact label={t('rc.fact.student')} value={rc.student.fullName} />
          <Fact label={t('rc.fact.nisn')} value={rc.student.nisn} />
          <Fact label={t('rc.fact.class')} value={rc.class.name} />
          <Fact label={t('rc.fact.phase')} value={rc.phase ? t('rc.phaseValue', { phase: rc.phase }) : null} />
          <Fact label={t('rc.fact.school')} value={rc.school.name} />
          <Fact label={t('rc.fact.npsn')} value={rc.school.npsn} />
          <Fact label={t('rc.fact.year')} value={rc.academicYear} />
          <Fact label={t('rc.fact.semester')} value={String(rc.semester.ordinal)} />
        </dl>
        {contact.length > 0 && (
          <p className="text-xs font-semibold text-slate-500 break-words">
            {contact.map((part, index) => (
              <React.Fragment key={part.kind}>
                {index > 0 && <span className="font-light text-slate-300"> / </span>}
                {part.kind === 'phone' ? t('rc.phone', { phone: part.value }) : part.value}
              </React.Fragment>
            ))}
          </p>
        )}
      </section>

      <section className={`${card} space-y-3`} aria-labelledby="rc-subjects">
        <h2 id="rc-subjects" className="text-base font-extrabold text-slate-900">
          {t('rc.subjects')}
        </h2>
        {rc.subjects.length === 0 ? (
          <p className="text-sm font-semibold text-slate-600">{t('rc.noSubjects')}</p>
        ) : (
          <>
            <table className="hidden sm:table w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs font-bold text-slate-500">
                  <th scope="col" className="py-2 pr-3 w-10">{t('rc.col.no')}</th>
                  <th scope="col" className="py-2 pr-3">{t('rc.col.subject')}</th>
                  {withTypes &&
                    REPORT_TYPES.map((type) => (
                      <th key={type} scope="col" className="py-2 px-2 w-14 text-right">
                        {t(`tasm.type.${type}`)}
                      </th>
                    ))}
                  <th scope="col" className="py-2 px-2 w-20 text-right">{t('rc.col.grade')}</th>
                  <th scope="col" className="py-2 pl-2 w-20 text-center">{t('rc.col.letter')}</th>
                </tr>
              </thead>
              {rc.subjects.map((line, index) => (
                <tbody key={line.subject.id} className="border-t border-slate-100 first-of-type:border-t-0">
                  <tr className="align-top">
                    <td className="pt-2.5 pr-3 text-slate-500 tabular-nums">{index + 1}</td>
                    <td className="pt-2.5 pr-3 font-bold text-slate-900 break-words">{line.subject.name}</td>
                    {withTypes &&
                      REPORT_TYPES.map((type) => (
                        <td key={type} className="pt-2.5 px-2 text-right text-slate-700 tabular-nums">
                          {typeAverageText(line, type)}
                        </td>
                      ))}
                    <td className="pt-2.5 px-2 text-right font-extrabold text-slate-900 tabular-nums">{line.finalGrade}</td>
                    <td className="pt-2.5 pl-2 text-center font-extrabold text-slate-900">{line.letter ?? '-'}</td>
                  </tr>
                  <tr>
                    <td aria-hidden="true" />
                    <td colSpan={withTypes ? 7 : 3} className="pt-1 pb-2.5 text-xs text-slate-700 leading-relaxed break-words whitespace-pre-line">
                      <span className="font-semibold text-slate-500">{t('rc.col.description')}: </span>
                      {line.description || '-'}
                    </td>
                  </tr>
                </tbody>
              ))}
            </table>
            <ol className="sm:hidden divide-y divide-slate-100">
              {rc.subjects.map((line, index) => (
                <li key={line.subject.id} className="py-2.5 first:pt-0 last:pb-0 space-y-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-sm font-bold text-slate-900 break-words min-w-0">
                      <span className="font-semibold text-slate-500 tabular-nums">{index + 1}. </span>
                      {line.subject.name}
                    </span>
                    <span className="text-sm font-extrabold text-slate-900 tabular-nums shrink-0">
                      <span className="sr-only">{t('rc.col.grade')} </span>
                      {line.finalGrade}
                      <span className="sr-only"> {t('rc.col.letter')}</span> {line.letter ?? '-'}
                    </span>
                  </div>
                  {withTypes && (
                    <p className="text-xs font-semibold text-slate-500 tabular-nums">
                      {REPORT_TYPES.map((type, i) => (
                        <React.Fragment key={type}>
                          {i > 0 && <span className="font-light text-slate-300"> / </span>}
                          {t(`tasm.type.${type}`)} {typeAverageText(line, type)}
                        </React.Fragment>
                      ))}
                    </p>
                  )}
                  <p className="text-xs text-slate-700 leading-relaxed break-words whitespace-pre-line">{line.description || '-'}</p>
                </li>
              ))}
            </ol>
            {kktp !== null && <p className="text-xs font-semibold text-slate-500">{t('rc.kktp', { n: kktp })}</p>}
          </>
        )}
      </section>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <section className={`${card} space-y-3`} aria-labelledby="rc-attendance">
          <h2 id="rc-attendance" className="text-base font-extrabold text-slate-900">
            {t('rc.attendance')}
          </h2>
          <dl className="space-y-1.5 text-sm">
            {[
              ['rc.att.sick', rc.attendance.sick],
              ['rc.att.excused', rc.attendance.excused],
              ['rc.att.absent', rc.attendance.absent],
            ].map(([key, n]) => (
              <div key={key} className="flex justify-between gap-3">
                <dt className="text-slate-600">{t(key)}</dt>
                <dd className="font-bold text-slate-900 tabular-nums">{t('rc.att.unit', { n })}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className={`${card} space-y-2`} aria-labelledby="rc-note">
          <h2 id="rc-note" className="text-base font-extrabold text-slate-900">
            {t('rc.note')}
          </h2>
          <p className="text-sm text-slate-700 leading-relaxed break-words whitespace-pre-line">{rc.note}</p>
        </section>
      </div>

      {rc.letterScale?.length > 0 && (
        <section className={`${card} space-y-3`} aria-labelledby="rc-scale">
          <h2 id="rc-scale" className="text-base font-extrabold text-slate-900">
            {t('rc.scale.title')}
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs font-bold text-slate-500">
                  <th scope="row" className="sr-only sm:not-sr-only py-2 pr-3 text-left">{t('rc.scale.letter')}</th>
                  {rc.letterScale.map((band) => (
                    <th key={band.letter} scope="col" className="py-2 px-1 sm:px-2 text-center text-slate-900 font-extrabold">
                      {band.letter}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th scope="row" className="sr-only sm:not-sr-only py-2 pr-3 text-left text-xs font-bold text-slate-500">{t('rc.col.grade')}</th>
                  {rc.letterScale.map((band) => (
                    <td key={band.letter} className="py-2 px-1 sm:px-2 text-center text-slate-700 tabular-nums">
                      {band.from}-{band.to}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">{t('rc.scale.note')}</p>
        </section>
      )}

      <section className={`${card} space-y-4`} aria-label={t('rc.signed', { date: day(rc.reportDate) })}>
        {promotion && (
          <div className="space-y-1">
            <p className="text-sm text-slate-700">{t('rc.promotion.lead')}</p>
            <p className="text-base font-extrabold text-slate-900">{t(promotion.key, { grade: promotion.grade ?? '' })}</p>
          </div>
        )}
        <p className="text-sm font-semibold text-slate-700">{t('rc.signed', { date: day(rc.reportDate) })}</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold text-slate-500">{t('rc.homeroom')}</p>
            {rc.homeroomTeacher ? (
              <>
                <p className="text-sm font-bold text-slate-900 break-words">{rc.homeroomTeacher.fullName}</p>
                {rc.homeroomTeacher.nip && <p className="text-xs text-slate-500">{t('rc.nip', { nip: rc.homeroomTeacher.nip })}</p>}
              </>
            ) : (
              <p className="text-sm font-semibold text-slate-500">{t('rc.noHomeroom')}</p>
            )}
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold text-slate-500">{t('rc.principal')}</p>
            <p className="text-sm font-bold text-slate-900 break-words">{rc.principal.fullName}</p>
            {rc.principal.nip && <p className="text-xs text-slate-500">{t('rc.nip', { nip: rc.principal.nip })}</p>}
          </div>
        </div>
        <p className="text-[11px] font-medium text-slate-500">{t('rc.writtenAt', { when: shortWhen(rc.writtenAt, zone, lang) })}</p>
      </section>
    </div>
  );
};

export default ReportCardPage;
