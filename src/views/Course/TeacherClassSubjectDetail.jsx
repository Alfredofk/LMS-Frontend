import React, { useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useOutletContext } from 'react-router-dom';
import { 
  ArrowLeft, 
  CalendarDays, 
  ClipboardCheck, 
  GraduationCap, 
  MapPin, 
  Users,
  ChevronRight,
  Clock
} from 'lucide-react';

import { useAuth } from '../../context/AuthContext';
import { useT } from '../../i18n/LanguageContext';
import { buildSampleTeacherData } from '../Dashboard/sampleTeacherData';
import { SampleDataBanner } from '../Dashboard/components/SampleDataNotice';
import SubmissionDetailModal from './components/SubmissionDetailModal';

const weekdayFor = (dayOfWeek, locale) =>
  new Intl.DateTimeFormat(locale, { weekday: 'long' }).format(
    new Date(2026, 0, dayOfWeek + 4),
  );

const timeAgo = (timestamp, t) => {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(timestamp).getTime()) / 60000));
  if (minutes < 1) return t('shell.time.justNow');
  if (minutes < 60) return t('shell.time.minutes', { n: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t('shell.time.hours', { n: hours });
  return t('shell.time.days', { n: Math.floor(hours / 24) });
};

export const TeacherClassSubjectDetail = () => {
  const { classSubjectId } = useParams();
  const navigate = useNavigate();
  const { membership } = useAuth();
  const { showToast } = useOutletContext() ?? {};
  const { t, lang } = useT();
  const data = useMemo(() => buildSampleTeacherData(), []);
  const classSubject = data.classSubjects.find((item) => item.id === classSubjectId);
  const locale = lang === 'id' ? 'id-ID' : 'en-GB';
  const schoolName = membership?.school?.name ?? membership?.schoolName ?? '';

  // Filter submissions for this classSubject
  const initialSubmissions = useMemo(() => {
    if (!classSubject) return [];
    return data.submissions.filter((submission) =>
      submission.classId === classSubject.classId
      && submission.subjectName === classSubject.subjectName,
    );
  }, [classSubject, data.submissions]);

  const [submissions, setSubmissions] = useState(initialSubmissions);
  const [selectedSubmissionId, setSelectedSubmissionId] = useState(null);

  // Active submission for modal
  const activeIndex = submissions.findIndex((s) => s.id === selectedSubmissionId);
  const activeSubmission = activeIndex !== -1 ? submissions[activeIndex] : null;

  if (!classSubject) {
    return (
      <div className="space-y-5 text-left">
        <button
          type="button"
          onClick={() => navigate('/teacher/courses')}
          className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-bold text-brand hover:bg-brand-tint focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          {t('teacherCourses.back')}
        </button>
        <section className="rounded-2xl border border-slate-200 bg-white px-5 py-12 text-center">
          <h1 className="text-xl font-extrabold text-slate-900">{t('teacherCourses.detailNotFound')}</h1>
          <p className="mt-2 text-sm text-slate-500">{t('teacherCourses.detailNotFoundBody')}</p>
        </section>
      </div>
    );
  }

  const students = data.students.filter((student) => classSubject.studentIds.includes(student.id));
  const relatedAssignments = data.classSubjects.filter((item) =>
    item.classId === classSubject.classId
    && item.semesterOrdinal === classSubject.semesterOrdinal,
  );

  // Handle Score Save
  const handleSaveScore = (submissionId, score, feedback) => {
    const target = submissions.find((s) => s.id === submissionId);
    setSubmissions((prev) =>
      prev.map((sub) =>
        sub.id === submissionId
          ? {
              ...sub,
              score,
              feedback,
            }
          : sub,
      ),
    );

    if (showToast && target) {
      showToast(
        t('teacherCourses.submission.savedSuccess', { name: target.studentName }),
        'success',
      );
    }
  };

  // Handle mock file download
  const handleDownloadAttachment = (attachment) => {
    const filename = attachment?.name || 'tugas_siswa.pdf';
    const blob = new Blob([`Berkas tugas: ${filename}`], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    if (showToast) showToast(`${t('teacherCourses.submission.download')}: ${filename}`, 'success');
  };

  return (
    <div className="space-y-6 text-left">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => navigate('/teacher/courses')}
          className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-bold text-brand hover:bg-brand-tint focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          {t('teacherCourses.back')}
        </button>
        <Link
          to={`/teacher/gradebook?classSubjectId=${classSubject.id}`}
          className="inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-brand-deep focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
        >
          <ClipboardCheck className="h-4 w-4" aria-hidden="true" />
          {t('teacherGradebook.openFromAssignment')}
        </Link>
      </div>

      <header>
        <p className="text-sm font-bold text-brand">
          {t('teacherCourses.class', { name: classSubject.className, grade: classSubject.gradeLevel })}
        </p>
        <h1 className="mt-1 text-3xl font-extrabold leading-tight tracking-tight text-slate-900">
          {classSubject.subjectName}
        </h1>
        <p className="mt-2 text-sm font-medium text-slate-500">
          {schoolName ? `${schoolName} · ` : ''}
          {t('teacherCourses.context', {
            year: classSubject.academicYearLabel,
            semester: classSubject.semesterOrdinal,
          })}
        </p>
      </header>

      <SampleDataBanner />

      <section aria-label={t('teacherCourses.detailSummary')} className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-500">
            <Users className="h-4 w-4 text-brand" aria-hidden="true" />
            {t('teacherCourses.studentMetric')}
          </div>
          <p className="mt-3 text-2xl font-extrabold text-slate-900">{students.length}</p>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-500">
            <CalendarDays className="h-4 w-4 text-brand" aria-hidden="true" />
            {t('teacherCourses.classSchedule')}
          </div>
          <p className="mt-3 text-sm font-bold text-slate-800">
            {weekdayFor(classSubject.schedule.dayOfWeek, locale)}
          </p>
          <p className="mt-1 text-sm text-slate-500">
            {classSubject.schedule.startTime}–{classSubject.schedule.endTime}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-500">
            <MapPin className="h-4 w-4 text-brand" aria-hidden="true" />
            {t('teacherCourses.location')}
          </div>
          <p className="mt-3 text-sm font-bold text-slate-800">{classSubject.schedule.room}</p>
          <p className="mt-1 text-sm text-slate-500">
            {t('teacherCourses.classAssignmentCount', { n: relatedAssignments.length })}
          </p>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Roster Section */}
        <section aria-labelledby="class-subject-roster-heading" className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 id="class-subject-roster-heading" className="text-sm font-extrabold text-slate-700">
              {t('teacherCourses.rosterTitle')}
            </h2>
            <span className="text-xs font-medium text-slate-500">
              {t('teacherCourses.studentsInClass', { n: students.length })}
            </span>
          </div>
          <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
            <ul className="divide-y divide-slate-100">
              {students.map((student) => (
                <li key={student.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-tint text-xs font-extrabold text-brand" aria-hidden="true">
                    {student.fullName.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-800">
                    {student.fullName}
                  </span>
                  <span className="flex shrink-0 items-center gap-1 text-xs text-slate-500">
                    <GraduationCap className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
                    {classSubject.className}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Recent Submissions Section (Interactive) */}
        <section aria-labelledby="class-subject-submissions-heading" className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 id="class-subject-submissions-heading" className="text-sm font-extrabold text-slate-700">
              {t('teacherCourses.recentSubmissions')}
            </h2>
            <span className="text-xs font-medium text-slate-500">
              {t('teacherCourses.submissionCount', { n: submissions.length })}
            </span>
          </div>
          <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
            {submissions.length ? (
              <ul className="divide-y divide-slate-100">
                {submissions.map((submission) => {
                  const isGraded = submission.score !== null && submission.score !== undefined;
                  const isLate = submission.status === 'LATE';

                  return (
                    <li key={submission.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedSubmissionId(submission.id)}
                        className="group flex w-full items-center justify-between gap-3 p-4 sm:p-5 text-left hover:bg-purple-50/40 transition-all cursor-pointer focus:outline-none focus:bg-purple-50/50"
                      >
                        <div className="min-w-0 flex-1 space-y-1.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-extrabold text-slate-900 group-hover:text-brand transition-colors">
                              {submission.studentName}
                            </span>
                            <span
                              className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase ${
                                isLate
                                  ? 'bg-amber-50 text-amber-700 border border-amber-200/60'
                                  : 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                              }`}
                            >
                              {isLate
                                ? t('teacherCourses.submission.status.late')
                                : t('teacherCourses.submission.status.onTime')}
                            </span>
                            {isGraded && (
                              <span className="inline-flex items-center gap-1 rounded-md bg-purple-100 text-brand px-2 py-0.5 text-[10px] font-extrabold">
                                {submission.score} / 100
                              </span>
                            )}
                          </div>

                          <p className="text-xs font-semibold text-slate-600 truncate">
                            {submission.assessmentTitle}
                          </p>

                          <p className="text-[11px] font-medium text-slate-500 flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            {timeAgo(submission.submittedAt, t)}
                          </p>
                        </div>

                        <div className="flex items-center gap-1 text-slate-400 group-hover:text-brand group-hover:translate-x-0.5 transition-all shrink-0">
                          <span className="text-xs font-bold hidden sm:inline">
                            {isGraded ? t('teacherCourses.submission.status.graded') : t('teacherCourses.viewDetail')}
                          </span>
                          <ChevronRight className="w-4 h-4" />
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="px-5 py-10 text-center text-sm text-slate-500">
                {t('teacherCourses.noSubmissions')}
              </p>
            )}
          </div>
        </section>
      </div>

      {/* Student Submission Detail & Grading Modal Dialog */}
      {activeSubmission && (
        <SubmissionDetailModal
          key={activeSubmission.id}
          submission={activeSubmission}
          classSubject={classSubject}
          onClose={() => setSelectedSubmissionId(null)}
          onSaveScore={handleSaveScore}
          onPrev={() => setSelectedSubmissionId(submissions[activeIndex - 1].id)}
          onNext={() => setSelectedSubmissionId(submissions[activeIndex + 1].id)}
          isFirst={activeIndex <= 0}
          isLast={activeIndex >= submissions.length - 1}
          currentIndex={activeIndex}
          totalCount={submissions.length}
          onDownload={handleDownloadAttachment}
          locale={locale}
        />
      )}
    </div>
  );
};

export default TeacherClassSubjectDetail;