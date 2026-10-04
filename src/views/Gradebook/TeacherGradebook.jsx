import React, { useMemo, useState } from 'react';
import { useOutletContext, useSearchParams } from 'react-router-dom';
import {
  AlertCircle,
  BookOpen,
  CheckCircle2,
  ClipboardCheck,
  LockKeyhole,
  Search,
  Users,
} from 'lucide-react';

import ConfirmDialog from '../../components/ui/ConfirmDialog';
import { useT } from '../../i18n/LanguageContext';
import { buildSampleTeacherData } from '../Dashboard/sampleTeacherData';
import { SampleDataBanner } from '../Dashboard/components/SampleDataNotice';

const FILTERS = ['all', 'pending', 'scored'];
const cellKey = (assessmentId, studentId) => `${assessmentId}::${studentId}`;

export const TeacherGradebook = () => {
  const { showToast } = useOutletContext();
  const { t } = useT();
  const [searchParams, setSearchParams] = useSearchParams();
  const data = useMemo(() => buildSampleTeacherData(), []);
  const classSubjects = data.classSubjects;
  const selectedClassSubject = classSubjects.find(
    (item) => item.id === searchParams.get('classSubjectId'),
  ) ?? classSubjects[0];
  const assessments = data.gradebook.find(
    (item) => item.classSubjectId === selectedClassSubject.id,
  )?.assessments ?? [];
  const students = data.students.filter((student) =>
    selectedClassSubject.studentIds.includes(student.id),
  );

  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [draftScores, setDraftScores] = useState({});
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [recordedScores, setRecordedScores] = useState(() => Object.fromEntries(
    data.gradebook.flatMap((classEntry) => classEntry.assessments.flatMap((assessment) =>
      Object.entries(assessment.students).map(([studentId, record]) => [
        cellKey(assessment.id, studentId), record.score,
      ]),
    )),
  ));

  const getRecord = (assessment, studentId) =>
    assessment.students[studentId] ?? { submissionStatus: 'NOT_SUBMITTED', score: null };
  const getScore = (assessment, studentId) =>
    recordedScores[cellKey(assessment.id, studentId)] ?? null;

  const updateClassSubject = (classSubjectId) => {
    const next = new URLSearchParams(searchParams);
    next.set('classSubjectId', classSubjectId);
    setSearchParams(next);
    setSearchQuery('');
    setActiveFilter('all');
  };

  const handleDraftChange = (assessmentId, studentId, value) => {
    const key = cellKey(assessmentId, studentId);
    setDraftScores((current) => {
      if (value === '') {
        const next = { ...current };
        delete next[key];
        return next;
      }
      return { ...current, [key]: value };
    });
  };

  const entriesToRecord = assessments.flatMap((assessment) => students.flatMap((student) => {
    const key = cellKey(assessment.id, student.id);
    const submitted = getRecord(assessment, student.id).submissionStatus === 'SUBMITTED';
    return submitted && getScore(assessment, student.id) === null
      && draftScores[key] !== undefined && draftScores[key] !== ''
      ? [{ key, value: draftScores[key] }]
      : [];
  }));

  const invalidDraftCount = entriesToRecord.filter(({ value }) => {
    const score = Number(value);
    return !Number.isInteger(score) || score < 0 || score > 100;
  }).length;

  const waitingCount = assessments.reduce((total, assessment) => total + students.filter((student) =>
    getRecord(assessment, student.id).submissionStatus === 'SUBMITTED'
      && getScore(assessment, student.id) === null,
  ).length, 0);
  const recordedCount = assessments.reduce((total, assessment) => total + students.filter((student) =>
    getRecord(assessment, student.id).submissionStatus === 'SUBMITTED'
      && getScore(assessment, student.id) !== null,
  ).length, 0);
  const waitingStudents = students.filter((student) => assessments.some((assessment) =>
    getRecord(assessment, student.id).submissionStatus === 'SUBMITTED'
      && getScore(assessment, student.id) === null,
  )).length;
  const scoredStudents = students.filter((student) => assessments.some((assessment) =>
    getRecord(assessment, student.id).submissionStatus === 'SUBMITTED'
      && getScore(assessment, student.id) !== null,
  )).length;

  const visibleStudents = students.filter((student) => {
    if (!student.fullName.toLocaleLowerCase().includes(searchQuery.trim().toLocaleLowerCase())) return false;
    if (activeFilter === 'pending') {
      return assessments.some((assessment) =>
        getRecord(assessment, student.id).submissionStatus === 'SUBMITTED'
          && getScore(assessment, student.id) === null,
      );
    }
    if (activeFilter === 'scored') {
      return assessments.some((assessment) =>
        getRecord(assessment, student.id).submissionStatus === 'SUBMITTED'
          && getScore(assessment, student.id) !== null,
      );
    }
    return true;
  });

  const commitDrafts = () => {
    const nextScores = { ...recordedScores };
    entriesToRecord.forEach(({ key, value }) => {
      nextScores[key] = Number(value);
    });
    setRecordedScores(nextScores);
    setDraftScores((current) => {
      const next = { ...current };
      entriesToRecord.forEach(({ key }) => delete next[key]);
      return next;
    });
    setIsConfirmOpen(false);
    if (showToast) showToast(t('teacherGradebook.demoRecorded', { n: entriesToRecord.length }), 'success');
  };

  const renderScoreCell = (assessment, student) => {
    const key = cellKey(assessment.id, student.id);
    const record = getRecord(assessment, student.id);
    const score = getScore(assessment, student.id);

    if (record.submissionStatus !== 'SUBMITTED') {
      return (
        <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-500">
          {t('teacherGradebook.notSubmitted')}
        </span>
      );
    }

    if (score !== null) {
      return (
        <span
          title={t('teacherGradebook.scoreLocked')}
          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-2.5 py-1.5 text-sm font-extrabold text-emerald-800"
        >
          <LockKeyhole className="h-3.5 w-3.5" aria-hidden="true" />{score}
        </span>
      );
    }

    const value = draftScores[key] ?? '';
    const numericValue = Number(value);
    const invalid = value !== ''
      && (!Number.isInteger(numericValue) || numericValue < 0 || numericValue > 100);

    return (
      <div className="space-y-1.5">
        <span className="inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-800">
          {t('teacherGradebook.pendingCell')}
        </span>
        <label className="inline-flex items-center gap-2">
          <span className="sr-only">
            {t('teacherGradebook.scoreFor', { student: student.fullName, assessment: assessment.title })}
          </span>
          <input
            type="number"
            min="0"
            max="100"
            step="1"
            inputMode="numeric"
            value={value}
            aria-invalid={invalid}
            aria-describedby={invalid ? `score-error-${key}` : undefined}
            onChange={(event) => handleDraftChange(assessment.id, student.id, event.target.value)}
            className={`h-10 w-20 rounded-lg border bg-white px-2 text-center text-sm font-bold text-slate-800 outline-none focus:ring-2 focus:ring-brand/30 ${invalid ? 'border-rose-400 focus:border-rose-500' : 'border-slate-200 focus:border-brand'}`}
            placeholder="—"
          />
          <span className="text-xs text-slate-500">/100</span>
          {invalid && (
            <span id={`score-error-${key}`} className="sr-only">
              {t('teacherGradebook.invalidScore')}
            </span>
          )}
        </label>
      </div>
    );
  };

  const filterLabels = {
    all: t('teacherGradebook.filter.all', { n: students.length }),
    pending: t('teacherGradebook.filter.pending', { n: waitingStudents }),
    scored: t('teacherGradebook.filter.scored', { n: scoredStudents }),
  };

  return (
    <div className="space-y-6 text-left">
      <header className="flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-1 text-xs font-bold uppercase text-brand">{t('teacherGradebook.eyebrow')}</p>
          <h1 className="text-3xl font-extrabold leading-tight tracking-tight text-slate-900">
            {t('teacherGradebook.title')}
          </h1>
          <p className="mt-1 text-sm font-medium text-slate-500">
            {selectedClassSubject.subjectName} · {t('teacherCourses.class', {
              name: selectedClassSubject.className,
              grade: selectedClassSubject.gradeLevel,
            })} · {t('teacherCourses.context', {
              year: selectedClassSubject.academicYearLabel,
              semester: selectedClassSubject.semesterOrdinal,
            })}
          </p>
        </div>
        <label className="w-full sm:w-80">
          <span className="mb-1 block text-xs font-semibold text-slate-500">
            {t('teacherGradebook.selectTeachingAssignment')}
          </span>
          <select
            value={selectedClassSubject.id}
            onChange={(event) => updateClassSubject(event.target.value)}
            className="w-full appearance-none rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand"
          >
            {classSubjects.map((item) => (
              <option key={item.id} value={item.id}>{item.subjectName} · {item.className}</option>
            ))}
          </select>
        </label>
      </header>

      <SampleDataBanner />

      <section aria-label={t('teacherGradebook.summary')} className="grid grid-cols-3 divide-x divide-slate-200 border-y border-slate-200 bg-white py-3">
        <div className="px-3 sm:px-5">
          <p className="text-xs font-semibold text-slate-500">{t('teacherGradebook.assessmentCount')}</p>
          <p className="mt-1 flex items-center gap-1.5 text-xl font-extrabold text-slate-900">
            <BookOpen className="h-4 w-4 text-brand" aria-hidden="true" />{assessments.length}
          </p>
        </div>
        <div className="px-3 sm:px-5">
          <p className="text-xs font-semibold text-amber-800">{t('teacherGradebook.waitingCount')}</p>
          <p className="mt-1 flex items-center gap-1.5 text-xl font-extrabold text-amber-900">
            <ClipboardCheck className="h-4 w-4" aria-hidden="true" />{waitingCount}
          </p>
        </div>
        <div className="px-3 sm:px-5">
          <p className="text-xs font-semibold text-slate-500">{t('teacherGradebook.recordedCount')}</p>
          <p className="mt-1 flex items-center gap-1.5 text-xl font-extrabold text-slate-900">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden="true" />{recordedCount}
          </p>
        </div>
      </section>

      <section className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <label className="relative min-w-0 sm:w-80">
          <span className="sr-only">{t('teacherGradebook.searchStudent')}</span>
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" aria-hidden="true" />
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder={t('teacherGradebook.searchPlaceholder')}
            className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-800 shadow-sm outline-none placeholder:text-slate-400 focus:border-brand focus:ring-1 focus:ring-brand"
          />
        </label>
        <div role="group" aria-label={t('teacherGradebook.filter.label')} className="flex flex-wrap gap-1 border-b border-slate-200 sm:border-0">
          {FILTERS.map((filter) => (
            <button
              key={filter}
              type="button"
              aria-pressed={activeFilter === filter}
              onClick={() => setActiveFilter(filter)}
              className={`border-b-2 px-3 py-2.5 text-xs font-bold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand ${activeFilter === filter ? 'border-brand text-brand' : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800'}`}
            >
              {filterLabels[filter]}
            </button>
          ))}
        </div>
      </section>

      {entriesToRecord.length > 0 && (
        <div className="flex flex-col gap-3 rounded-xl border border-brand/20 bg-brand-tint/40 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-semibold text-slate-700">
            {t('teacherGradebook.draftsReady', { n: entriesToRecord.length })}
            {invalidDraftCount > 0 && (
              <span className="ml-2 inline-flex items-center gap-1 text-rose-700">
                <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />
                {t('teacherGradebook.invalidDrafts', { n: invalidDraftCount })}
              </span>
            )}
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setDraftScores({})}
              className="rounded-lg px-3 py-2 text-sm font-bold text-slate-600 hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            >
              {t('teacherGradebook.discardDrafts')}
            </button>
            <button
              type="button"
              disabled={invalidDraftCount > 0}
              onClick={() => setIsConfirmOpen(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-bold text-white hover:bg-brand-deep focus:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:cursor-not-allowed disabled:opacity-50"
            >
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              {t('teacherGradebook.recordDrafts', { n: entriesToRecord.length })}
            </button>
          </div>
        </div>
      )}

      {visibleStudents.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-5 py-12 text-center">
          <Users className="mx-auto h-9 w-9 text-slate-400" aria-hidden="true" />
          <h2 className="mt-3 text-sm font-bold text-slate-700">{t('teacherGradebook.emptyTitle')}</h2>
          <p className="mt-1 text-sm text-slate-500">{t('teacherGradebook.emptyBody')}</p>
          {(searchQuery || activeFilter !== 'all') && (
            <button
              type="button"
              onClick={() => { setSearchQuery(''); setActiveFilter('all'); }}
              className="mt-3 rounded-lg px-3 py-2 text-sm font-bold text-brand hover:bg-brand-tint focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            >
              {t('teacherGradebook.clearFilters')}
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm md:block">
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50 text-left text-xs font-bold text-slate-600">
                    <th scope="col" className="sticky left-0 z-20 min-w-52 border-r border-slate-100 bg-slate-50 px-5 py-4">
                      {t('teacherGradebook.studentColumn')}
                    </th>
                    {assessments.map((assessment) => (
                      <th key={assessment.id} scope="col" className="min-w-56 px-5 py-4 align-top">
                        <span className="block max-w-64 text-sm font-extrabold text-slate-800">{assessment.title}</span>
                        <span className="mt-1 block text-xs font-medium text-slate-500">{t('teacherGradebook.scoreScale')}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {visibleStudents.map((student) => (
                    <tr key={student.id} className="hover:bg-slate-50/50">
                      <th scope="row" className="sticky left-0 z-10 min-w-52 border-r border-slate-100 bg-white px-5 py-4 text-left align-middle">
                        <span className="block text-sm font-bold text-slate-800">{student.fullName}</span>
                        <span className="mt-1 block text-xs font-medium text-slate-500">
                          {t('teacherCourses.class', { name: student.className, grade: student.gradeLevel })}
                        </span>
                      </th>
                      {assessments.map((assessment) => (
                        <td key={assessment.id} className="px-5 py-3 align-middle">{renderScoreCell(assessment, student)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-3 md:hidden">
            {visibleStudents.map((student) => (
              <article key={student.id} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                <header className="border-b border-slate-100 pb-3">
                  <h2 className="text-sm font-extrabold text-slate-900">{student.fullName}</h2>
                  <p className="mt-1 text-xs font-medium text-slate-500">
                    {t('teacherCourses.class', { name: student.className, grade: student.gradeLevel })}
                  </p>
                </header>
                <dl className="divide-y divide-slate-100">
                  {assessments.map((assessment) => (
                    <div key={assessment.id} className="flex items-center justify-between gap-3 py-3">
                      <dt className="min-w-0 flex-1 text-xs font-semibold text-slate-700">{assessment.title}</dt>
                      <dd className="shrink-0">{renderScoreCell(assessment, student)}</dd>
                    </div>
                  ))}
                </dl>
              </article>
            ))}
          </div>
        </>
      )}

      <p className="flex items-start gap-2 text-xs leading-relaxed text-slate-500">
        <LockKeyhole className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden="true" />
        {t('teacherGradebook.immutableNote')}
      </p>

      <ConfirmDialog
        open={isConfirmOpen}
        title={t('teacherGradebook.confirm.title')}
        body={t('teacherGradebook.confirm.body', { n: entriesToRecord.length })}
        confirmLabel={t('teacherGradebook.confirm.action')}
        cancelLabel={t('common.cancel')}
        tone="brand"
        onCancel={() => setIsConfirmOpen(false)}
        onConfirm={commitDrafts}
      />
    </div>
  );
};

export default TeacherGradebook;
