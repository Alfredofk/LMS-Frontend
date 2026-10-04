import React, { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  Clock3,
  MapPin,
  Search,
  Users,
  X,
} from 'lucide-react';

import { useAuth } from '../../context/AuthContext';
import { useT } from '../../i18n/LanguageContext';
import { buildSampleTeacherData } from '../Dashboard/sampleTeacherData';
import { SampleDataBanner } from '../Dashboard/components/SampleDataNotice';

const VIEW_KEYS = ['assignments', 'classes', 'students'];

const weekdayFor = (dayOfWeek, locale) =>
  new Intl.DateTimeFormat(locale, { weekday: 'long' }).format(
    new Date(2026, 0, dayOfWeek + 4),
  );

export const TeacherCourses = () => {
  const { membership } = useAuth();
  const { t, lang } = useT();
  const [searchParams, setSearchParams] = useSearchParams();
  const data = useMemo(() => buildSampleTeacherData(), []);
  const locale = lang === 'id' ? 'id-ID' : 'en-GB';
  const schoolName = membership?.school?.name ?? membership?.schoolName ?? '';
  const academicContext = data.classSubjects[0];
  const requestedView = searchParams.get('view');
  const activeView = VIEW_KEYS.includes(requestedView) ? requestedView : 'assignments';
  const searchQuery = searchParams.get('q') ?? '';
  const selectedClass = searchParams.get('classId') ?? 'all';

  const updateQuery = (changes, { replace = false } = {}) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(changes).forEach(([key, value]) => {
      if (value === null || value === undefined || value === '') next.delete(key);
      else next.set(key, value);
    });
    setSearchParams(next, { replace });
  };

  const classOptions = useMemo(() => {
    const uniqueClasses = new Map();
    data.classSubjects.forEach((item) => {
      uniqueClasses.set(item.classId, {
        id: item.classId,
        name: item.className,
        gradeLevel: item.gradeLevel,
      });
    });
    return [...uniqueClasses.values()].sort((left, right) => left.name.localeCompare(right.name));
  }, [data.classSubjects]);

  const filteredClassSubjects = data.classSubjects.filter((item) => {
    const query = searchQuery.trim().toLocaleLowerCase(locale);
    const matchesQuery = !query || [item.subjectName, item.className, String(item.gradeLevel)]
      .some((value) => value.toLocaleLowerCase(locale).includes(query));
    return matchesQuery && (selectedClass === 'all' || item.classId === selectedClass);
  });

  const visibleStudents = data.students.filter((student) =>
    selectedClass === 'all' || student.classId === selectedClass,
  );
  const uniqueStudentCount = data.students.length;
  const classSummaries = classOptions.map((classOption) => {
    const assignments = data.classSubjects.filter((item) => item.classId === classOption.id);
    const studentIds = new Set(assignments.flatMap((item) => item.studentIds));
    return { ...classOption, assignments, studentCount: studentIds.size };
  });

  const summary = [
    { id: 'assignments', value: data.classSubjects.length, label: t('teacherCourses.assignmentCount', { n: data.classSubjects.length }) },
    { id: 'classes', value: classOptions.length, label: t('teacherCourses.classCount', { n: classOptions.length }) },
    { id: 'students', value: uniqueStudentCount, label: t('teacherCourses.studentCount', { n: uniqueStudentCount }) },
  ];

  const resetFilters = () => updateQuery({ q: null, classId: null });

  return (
    <div className="space-y-6 text-left">
      <header className="select-none">
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight leading-tight">
          {t('teacherCourses.title')}
        </h1>
        <p className="mt-1 text-sm font-medium text-slate-500">
          {schoolName ? `${schoolName} · ` : ''}
          {t('teacherCourses.context', {
            year: academicContext.academicYearLabel,
            semester: academicContext.semesterOrdinal,
          })}
        </p>
      </header>

      <SampleDataBanner />

      <section aria-label={t('teacherCourses.summary')} className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {summary.map(({ id, value, label }) => (
          <button
            key={id}
            type="button"
            aria-pressed={activeView === id}
            onClick={() => updateQuery({ view: id, q: null, classId: null })}
            className={`flex min-h-20 items-center justify-between gap-4 rounded-2xl border px-4 py-4 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand ${activeView === id ? 'border-brand/40 bg-brand-tint/50' : 'border-slate-200 bg-white hover:border-slate-300'}`}
          >
            <span>
              <span className="block text-2xl font-extrabold leading-none text-slate-900">{value}</span>
              <span className="mt-2 block text-sm font-semibold text-slate-600">{label}</span>
              <span className="mt-1 block text-xs font-medium text-brand">{t(`teacherCourses.view.${id}`)}</span>
            </span>
            <span className="h-2 w-2 shrink-0 rounded-full bg-brand" aria-hidden="true" />
          </button>
        ))}
      </section>

      {activeView === 'assignments' && (
        <>
          <section aria-label={t('teacherCourses.filters')} className="flex flex-col gap-3 sm:flex-row">
            <label className="relative min-w-0 flex-1">
              <span className="sr-only">{t('teacherCourses.searchLabel')}</span>
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" aria-hidden="true" />
              <input
                type="search"
                value={searchQuery}
                onChange={(event) => updateQuery({ q: event.target.value }, { replace: true })}
                placeholder={t('teacherCourses.searchPlaceholder')}
                className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-4 text-sm text-slate-800 shadow-sm outline-none placeholder:text-slate-400 focus:border-brand focus:ring-1 focus:ring-brand"
              />
            </label>

            <label className="w-full sm:w-56">
              <span className="sr-only">{t('teacherCourses.classFilter')}</span>
              <select
                value={selectedClass}
                onChange={(event) => updateQuery({ classId: event.target.value === 'all' ? null : event.target.value })}
                className="w-full appearance-none rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand"
              >
                <option value="all">{t('teacherCourses.allClasses')}</option>
                {classOptions.map((classOption) => (
                  <option key={classOption.id} value={classOption.id}>
                    {t('teacherCourses.classOption', {
                      name: classOption.name,
                      grade: classOption.gradeLevel,
                    })}
                  </option>
                ))}
              </select>
            </label>
          </section>

          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-extrabold text-slate-700">{t('teacherCourses.listTitle')}</h2>
            <span className="text-xs font-medium text-slate-500">
              {t('teacherCourses.resultCount', { n: filteredClassSubjects.length })}
            </span>
          </div>

          {filteredClassSubjects.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-5 py-12 text-center">
              <BookOpen className="mx-auto h-9 w-9 text-slate-400" aria-hidden="true" />
              <h3 className="mt-3 text-sm font-bold text-slate-700">{t('teacherCourses.emptyTitle')}</h3>
              <p className="mt-1 text-sm text-slate-500">{t('teacherCourses.emptyBody')}</p>
              {(searchQuery || selectedClass !== 'all') && (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="mt-4 inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-bold text-brand hover:bg-brand-tint focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                  {t('teacherCourses.clearFilters')}
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filteredClassSubjects.map((item) => (
                <Link
                  key={item.id}
                  to={`/teacher/courses/${item.id}`}
                  aria-label={t('teacherCourses.openDetail', { subject: item.subjectName, className: item.className })}
                  className="flex min-h-56 w-full flex-col rounded-2xl border border-slate-100 bg-white p-5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-brand/30 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-tint text-brand">
                      <BookOpen className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">
                      {t('teacherCourses.semester', { n: item.semesterOrdinal })}
                    </span>
                  </div>
                  <div className="mt-4 min-w-0">
                    <h3 className="text-base font-extrabold text-slate-900">{item.subjectName}</h3>
                    <p className="mt-1 text-sm font-medium text-slate-500">
                      {t('teacherCourses.class', { name: item.className, grade: item.gradeLevel })}
                    </p>
                  </div>
                  <div className="mt-auto flex items-center justify-between gap-3 border-t border-slate-100 pt-4">
                    <div className="space-y-2">
                      <p className="flex items-center gap-2 text-sm text-slate-600">
                        <Users className="h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
                        {t('teacherCourses.studentsInClass', { n: item.studentIds.length })}
                      </p>
                      <p className="flex items-center gap-2 text-sm text-slate-600">
                        <CalendarDays className="h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
                        {weekdayFor(item.schedule.dayOfWeek, locale)}
                      </p>
                      <p className="flex items-center gap-2 text-sm text-slate-600">
                        <Clock3 className="h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
                        {item.schedule.startTime}–{item.schedule.endTime}
                        <span className="text-slate-300">·</span>
                        <MapPin className="h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
                        {item.schedule.room}
                      </p>
                    </div>
                    <span className="inline-flex shrink-0 items-center gap-1 text-xs font-bold text-brand">
                      {t('teacherCourses.viewDetail')}
                      <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </>
      )}

      {activeView === 'classes' && (
        <section aria-labelledby="teacher-classes-heading" className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 id="teacher-classes-heading" className="text-sm font-extrabold text-slate-700">{t('teacherCourses.classesHeading')}</h2>
            <span className="text-xs font-medium text-slate-500">{t('teacherCourses.resultCount', { n: classSummaries.length })}</span>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {classSummaries.map((classSummary) => (
              <article key={classSummary.id} className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-extrabold text-slate-900">{classSummary.name}</h3>
                    <p className="mt-1 text-sm text-slate-500">{t('teacherCourses.grade', { n: classSummary.gradeLevel })}</p>
                  </div>
                  <span className="rounded-full bg-brand-tint px-3 py-1 text-xs font-bold text-brand">
                    {t('teacherCourses.studentsInClass', { n: classSummary.studentCount })}
                  </span>
                </div>
                <ul className="mt-4 space-y-2 border-t border-slate-100 pt-4">
                  {classSummary.assignments.map((item) => (
                    <li key={item.id} className="flex items-center justify-between gap-3 text-sm">
                      <span className="font-semibold text-slate-700">{item.subjectName}</span>
                      <span className="text-slate-500">{t('teacherCourses.semester', { n: item.semesterOrdinal })}</span>
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  onClick={() => updateQuery({ view: 'assignments', classId: classSummary.id, q: null })}
                  className="mt-4 rounded-lg px-3 py-2 text-sm font-bold text-brand hover:bg-brand-tint focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                >
                  {t('teacherCourses.showClassAssignments')}
                </button>
              </article>
            ))}
          </div>
        </section>
      )}

      {activeView === 'students' && (
        <section aria-labelledby="teacher-students-heading" className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 id="teacher-students-heading" className="text-sm font-extrabold text-slate-700">{t('teacherCourses.studentsHeading')}</h2>
              <p className="mt-1 text-xs text-slate-500">{t('teacherCourses.studentsScope')}</p>
            </div>
            <label className="w-full sm:w-56">
              <span className="sr-only">{t('teacherCourses.classFilter')}</span>
              <select
                value={selectedClass}
                onChange={(event) => updateQuery({ classId: event.target.value === 'all' ? null : event.target.value })}
                className="w-full appearance-none rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand"
              >
                <option value="all">{t('teacherCourses.allClasses')}</option>
                {classOptions.map((classOption) => (
                  <option key={classOption.id} value={classOption.id}>{classOption.name}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
            <ul className="divide-y divide-slate-100">
              {visibleStudents.map((student) => {
                const subjectNames = [...new Set(data.classSubjects
                  .filter((item) => item.classId === student.classId && item.studentIds.includes(student.id))
                  .map((item) => item.subjectName))];
                return (
                  <li key={student.id} className="flex flex-col gap-2 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                    <div>
                      <h3 className="text-sm font-bold text-slate-800">{student.fullName}</h3>
                      <p className="mt-1 text-sm text-slate-500">{t('teacherCourses.class', { name: student.className, grade: student.gradeLevel })}</p>
                    </div>
                    <p className="text-sm text-slate-600">{subjectNames.join(', ')}</p>
                  </li>
                );
              })}
            </ul>
            {visibleStudents.length === 0 && (
              <p className="px-5 py-10 text-center text-sm text-slate-500">{t('teacherCourses.noStudents')}</p>
            )}
          </div>
          {selectedClass !== 'all' && (
            <button
              type="button"
              onClick={() => updateQuery({ classId: null })}
              className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-bold text-brand hover:bg-brand-tint focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            >
              <X className="h-4 w-4" aria-hidden="true" />
              {t('teacherCourses.clearFilters')}
            </button>
          )}
        </section>
      )}
    </div>
  );
};

export default TeacherCourses;
