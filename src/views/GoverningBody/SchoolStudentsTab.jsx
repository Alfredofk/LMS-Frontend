import React, { useEffect, useRef, useState } from 'react';

import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import SelectField from '../../components/ui/SelectField';
import { useT } from '../../i18n/LanguageContext';
import { governingBodySeatErrorMessage } from '../../i18n/apiError';
import { governingBodyService } from '../../services/governingBodyService';
import { classGroupsOf, studentQueryOf } from './schoolPeople';

/*
  The "Siswa" tab of a School's page (backend f01cd28, ticket 07; owner 2026-10-26, D5):
  `GET .../schools/:id/students` a page of 50 at a time, by name - searched on the
  server by a part of the name or NISN (sent 300 ms after typing stops) and kept to one
  of the current year's Classes, grouped by grade. "Muat lebih banyak" appends the next
  page; a new search or Class starts again from the first. Each: the name, NISN and the
  Class they sit in now, or "Belum ditempatkan". A table from md, a card below. No grade,
  attendance, contact or guardian is ever sent.
*/

const COLUMNS = 'md:grid md:grid-cols-[minmax(0,1fr)_9rem_9rem] md:gap-4 md:items-center';
const PAGE = 50;

const CellLabel = ({ children }) => <span className="md:hidden text-[11px] font-semibold text-slate-500 block">{children}</span>;

export const SchoolStudentsTab = ({ schoolId, onGone }) => {
  const { t } = useT();
  const [typed, setTyped] = useState('');
  const [needle, setNeedle] = useState('');
  const [classId, setClassId] = useState('');
  const [students, setStudents] = useState([]);
  const [total, setTotal] = useState(0);
  const [classes, setClasses] = useState([]);
  const [yearLabel, setYearLabel] = useState(null);
  const [state, setState] = useState('loading');
  const [appending, setAppending] = useState(false);
  const [error, setError] = useState(null);
  const [attempt, setAttempt] = useState(0);
  /* Only the newest read may land: a slow first page must not overwrite a later search. */
  const latest = useRef(0);

  /* The search goes 300 ms after typing stops. */
  useEffect(() => {
    const timer = setTimeout(() => setNeedle(typed), 300);
    return () => clearTimeout(timer);
  }, [typed]);

  useEffect(() => {
    const ticket = ++latest.current;
    governingBodyService
      .schoolStudents(schoolId, studentQueryOf({ needle, classId, offset: 0, limit: PAGE }))
      .then((read) => {
        if (ticket !== latest.current) return;
        setStudents(read?.students ?? []);
        setTotal(read?.total ?? 0);
        setClasses(read?.classes ?? []);
        setYearLabel(read?.academicYear?.label ?? null);
        setState('ready');
      })
      .catch((err) => {
        if (ticket !== latest.current) return;
        if (err?.status === 403) {
          onGone();
          return;
        }
        setError(err);
        setState('failed');
      });
  }, [schoolId, needle, classId, attempt, onGone]);

  const more = async () => {
    const ticket = latest.current;
    setAppending(true);
    try {
      const read = await governingBodyService.schoolStudents(schoolId, studentQueryOf({ needle, classId, offset: students.length, limit: PAGE }));
      if (ticket !== latest.current) return;
      setStudents((prev) => [...prev, ...(read?.students ?? [])]);
      setTotal(read?.total ?? 0);
    } catch (err) {
      if (err?.status === 403) onGone();
      else {
        setError(err);
        setState('failed');
      }
    } finally {
      setAppending(false);
    }
  };

  const filtering = Boolean(needle.trim() || classId);
  const groups = classGroupsOf(classes);

  return (
    <section className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm space-y-4">
      <div className="min-w-0">
        <h2 className="text-base font-extrabold text-slate-900">{t('gbsp.students.title')}</h2>
        <p className="text-xs font-medium text-slate-500 mt-1">{yearLabel ? t('gbsp.students.year', { label: yearLabel }) : t('gbsp.term.none')}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Input
          id="gbspStudentSearch"
          name="search"
          type="search"
          label={t('gbsp.students.search')}
          placeholder={t('gbsp.students.searchPlaceholder')}
          autoComplete="off"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
        />
        <SelectField id="gbspStudentClass" label={t('gbsp.students.class')} value={classId} onChange={(e) => setClassId(e.target.value)}>
          <option value="">{t('gbsp.students.allClasses')}</option>
          {groups.map((group) => (
            <optgroup key={group.grade} label={t('gbsp.grade', { n: group.grade })}>
              {group.classes.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.name}
                </option>
              ))}
            </optgroup>
          ))}
        </SelectField>
      </div>

      {state === 'loading' && <div className="h-32 rounded-2xl bg-slate-50 animate-pulse" aria-busy="true" aria-label={t('common.loading')} />}

      {state === 'failed' && (
        <div className="space-y-3" role="alert">
          <p className="text-sm font-semibold text-rose-700">{governingBodySeatErrorMessage(error, t)}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setState('loading');
              setAttempt((n) => n + 1);
            }}
          >
            {t('gb.retry')}
          </Button>
        </div>
      )}

      {state === 'ready' &&
        (students.length === 0 ? (
          <p className="text-sm font-medium text-slate-500 leading-relaxed max-w-prose">{filtering ? t('gbsp.students.noMatch') : t('gbsp.students.empty')}</p>
        ) : (
          <>
            <p className="text-xs font-semibold text-slate-500" aria-live="polite">
              {t('gbsp.students.count', { shown: students.length, n: total })}
            </p>
            <div>
              <div className={`hidden ${COLUMNS} pb-2 border-b border-slate-100 text-[11px] font-semibold text-slate-500`} aria-hidden="true">
                <span>{t('gbsp.col.name')}</span>
                <span>NISN</span>
                <span>{t('gbsp.col.class')}</span>
              </div>
              <ul className="divide-y divide-slate-100">
                {students.map((student) => (
                  <li key={student.membershipId} className={`py-3 grid grid-cols-2 gap-x-4 gap-y-1.5 ${COLUMNS}`}>
                    <p className="col-span-2 md:col-span-1 text-sm font-bold text-slate-900 break-words min-w-0">{student.fullName}</p>
                    <div className="min-w-0">
                      <CellLabel>NISN</CellLabel>
                      <span className="text-sm font-semibold text-slate-700 tabular-nums">{student.nisn ?? '-'}</span>
                    </div>
                    <div className="min-w-0">
                      <CellLabel>{t('gbsp.col.class')}</CellLabel>
                      <span className={`text-sm font-medium ${student.class ? 'text-slate-700' : 'text-slate-500'}`}>{student.class?.name ?? t('gbsp.students.unplaced')}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
            {students.length < total && (
              <div className="flex justify-center pt-1">
                <Button variant="outline" size="sm" onClick={more} isLoading={appending}>
                  {t('admin.queue.loadMore')}
                </Button>
              </div>
            )}
          </>
        ))}
    </section>
  );
};

export default SchoolStudentsTab;
