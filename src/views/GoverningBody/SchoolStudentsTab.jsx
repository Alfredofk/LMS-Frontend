import React, { useEffect, useRef, useState } from 'react';

import { GraduationCap } from 'lucide-react';

import Button from '../../components/ui/Button';
import Select from '../../components/ui/Select';
import { useT } from '../../i18n/LanguageContext';
import { governingBodySeatErrorMessage } from '../../i18n/apiError';
import { governingBodyService } from '../../services/governingBodyService';
import { ADMIN_CARD, SlashFacts } from '../Admin/adminParts';
import { HomeEmpty, HomeError } from '../Dashboard/components/HomeCard';
import { RowsLoading, SearchBox } from './bodyParts';
import { classGroupsOf, studentQueryOf } from './schoolPeople';

/*
  The "Siswa" tab of a School's page (backend f01cd28, ticket 07; owner 2026-10-26, D5):
  `GET .../schools/:id/students` a page of 50 at a time, by name - searched on the
  server by a part of the name or NISN (sent 300 ms after typing stops) and kept to one
  of the current year's Classes, grouped by grade. "Muat lebih banyak" appends the next
  page; a new search or Class starts again from the first. Each: the name, NISN and the
  Class they sit in now, or "Belum ditempatkan". A table from md, a card below. No grade,
  attendance, contact or guardian is ever sent.

  Since 2026-10-29 (owner, mockup yayasan-sekolah-admin.html) the search and the Class
  sit in one row above one card of rows, each the name over "NISN: ... / Class"; it
  was a three-column table.
*/

const PAGE = 50;

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

  if (state === 'failed') {
    return (
      <div className={ADMIN_CARD}>
        <HomeError
          message={governingBodySeatErrorMessage(error, t)}
          retryLabel={t('gb.retry')}
          onRetry={() => {
            setState('loading');
            setAttempt((n) => n + 1);
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2.5">
        <SearchBox
          id="gbspStudentSearch"
          label={t('gbsp.students.search')}
          placeholder={t('gbsp.students.searchPlaceholder')}
          value={typed}
          onChange={setTyped}
        />
        <Select size="sm" id="gbspStudentClass" className="w-full sm:w-52" aria-label={t('gbsp.students.class')} value={classId} onChange={(e) => setClassId(e.target.value)}>
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
        </Select>
      </div>

      {state === 'loading' ? (
        <RowsLoading />
      ) : students.length === 0 ? (
        <div className={ADMIN_CARD}>
          {filtering ? (
            <HomeEmpty icon={GraduationCap} title={t('gbsp.students.noMatch')} />
          ) : (
            <HomeEmpty icon={GraduationCap} title={t('gbsp.students.emptyTitle')} body={t('gbsp.students.empty')} />
          )}
        </div>
      ) : (
        <div className="bg-white border border-slate-100 rounded-2xl shadow-sm min-w-0">
          <SlashFacts
            className="block px-4 sm:px-5 pt-3.5 text-xs font-semibold text-slate-500"
            parts={[
              <span aria-live="polite">{t('gbsp.students.count', { shown: students.length, n: total })}</span>,
              yearLabel ? t('gbsp.students.year', { label: yearLabel }) : t('gbsp.term.none'),
            ]}
          />
          <ul>
            {students.map((student) => (
              <li key={student.membershipId} className="px-4 sm:px-5 py-3 border-b border-slate-100 last:border-0">
                <p className="text-sm font-bold text-slate-900 break-words">{student.fullName}</p>
                <SlashFacts
                  className="block mt-0.5 text-xs font-medium text-slate-500"
                  parts={[
                    <span className="tabular-nums">{t('gbsp.nisn', { nisn: student.nisn ?? '-' })}</span>,
                    student.class?.name ?? t('gbsp.students.unplaced'),
                  ]}
                />
              </li>
            ))}
          </ul>
          {students.length < total && (
            <div className="flex justify-center px-4 py-3 border-t border-slate-100">
              <Button variant="outline" size="sm" onClick={more} isLoading={appending}>
                {t('admin.queue.loadMore')}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SchoolStudentsTab;
