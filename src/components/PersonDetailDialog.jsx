import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Mail,
  MessageCircle,
  Phone,
  X,
} from 'lucide-react';

import { useT } from '../i18n/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { ROLES, activeRolesOf } from '../constants/roles';
import { membersService } from '../services/membersService';
import { formatDay } from '../views/Classes/format';
import { semesterRate } from '../views/Attendance/attendance';
import { initialsOf } from '../utils/names';
import { telLink, waLink } from '../utils/contact';
import { modalActions, modalCancelClass } from './ui/modalStyles';

/*
  One member of the school, opened from a roster row or the member list (owner,
  2026-10-03: "bagian siswa bisa di klik, dan akan muncul informasi").

  ## What it reads

  `GET /members/:id` (backend c0a4f18, ticket 22) answers the Principal and the
  Vice Principals only: email, phone, roles, NISN/NIP/NUPTK, joined/left, and for
  a student the birth date, the class (or the last one, after leaving), the
  linked guardians and an attendance summary per semester. So it is read when the
  reader holds PRINCIPAL or VICE_PRINCIPAL, whichever role they are working as
  (owner, 2026-10-04) - a homeroom teacher who is neither would only earn a 403,
  and sees what the roster row carries.

  The answer's class carries its homeroom teacher and placement date since backend
  ccba4e0 (request #7), so the member list shows both too. The class page still
  hands over its own as `placement`, which wins.

  Phone numbers and email addresses are links: tel:, wa.me and mailto: (owner,
  2026-10-04).

  @param person    { membershipId, fullName, roles?, nisn?, nip?, nuptk?, joinedAt?, endedAt?, endReason? }
  @param placement { className, gradeLevel, academicYear, homeroomName, placedAt } | null (not placed) | undefined (from the detail)
*/

const LEADER_ROLES = [ROLES.PRINCIPAL, ROLES.VICE_PRINCIPAL];

/* A label over its value, no icon tile and no capitals (owner, 2026-10-07: not
   so "AI"). Callers still pass `icon`; it is no longer drawn. */
const Fact = ({ label, children, wide = false }) => (
  <div className={`rounded-2xl bg-slate-50 px-3.5 py-3 min-w-0 ${wide ? 'sm:col-span-2' : ''}`}>
    <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</span>
    <span className="block text-sm font-bold text-slate-800 break-words tabular-nums mt-0.5">{children}</span>
  </div>
);

const linkClass = 'text-brand hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-brand rounded';

/* A number to call, with a WhatsApp button beside it; "not given" when there is none. */
const PhoneValue = ({ phone, name }) => {
  const { t } = useT();
  if (!phone) return <span className="text-slate-500 font-semibold">{t('person.phoneNone')}</span>;
  return (
    <span className="flex items-center gap-2 flex-wrap">
      <a href={telLink(phone)} className={linkClass} aria-label={t('person.call', { name })}>
        {phone}
      </a>
      <a
        href={waLink(phone)}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={t('person.whatsapp', { name })}
        title={t('person.whatsapp', { name })}
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 text-[10px] font-extrabold hover:bg-emerald-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
      >
        <MessageCircle className="w-3 h-3" aria-hidden="true" />
        WhatsApp
      </a>
    </span>
  );
};

const EmailValue = ({ email }) => {
  const { t } = useT();
  if (!email) return <span className="text-slate-500 font-semibold">-</span>;
  return (
    <a href={`mailto:${email}`} className={`${linkClass} break-all`} aria-label={t('person.mail', { email })}>
      {email}
    </a>
  );
};

const SectionTitle = ({ children }) => <h3 className="text-sm font-extrabold text-slate-900">{children}</h3>;

const Guardians = ({ guardians }) => {
  const { t } = useT();
  return (
    <section className="space-y-2.5">
      <SectionTitle>{t('person.guardians')}</SectionTitle>
      {guardians.length === 0 ? (
        <p className="text-xs text-slate-500 font-semibold">{t('person.guardiansNone')}</p>
      ) : (
        <ul className="space-y-2">
          {guardians.map((guardian) => (
            <li key={guardian.membershipId} className="rounded-2xl border border-slate-100 px-3.5 py-3 space-y-1.5">
              <p className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-extrabold text-slate-800 break-words">{guardian.fullName}</span>
                <span className="px-1.5 py-0.5 bg-brand-tint text-brand text-[10px] font-extrabold rounded-md">
                  {guardian.relationship}
                </span>
              </p>
              <p className="flex items-center gap-2 text-xs font-bold text-slate-700 min-w-0">
                <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" aria-hidden="true" />
                <PhoneValue phone={guardian.phone} name={guardian.fullName} />
              </p>
              {guardian.email && (
                <p className="flex items-center gap-2 text-xs font-bold text-slate-700 min-w-0">
                  <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" aria-hidden="true" />
                  <EmailValue email={guardian.email} />
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};

const Attendance = ({ attendance }) => {
  const { t } = useT();
  return (
    <section className="space-y-2.5">
      <SectionTitle>{t('person.attendance', { year: attendance.academicYear })}</SectionTitle>
      <ul className="space-y-2">
        {attendance.semesters.map((semester) => {
          const rate = semesterRate(semester);
          return (
            <li key={semester.semesterId} className="rounded-2xl border border-slate-100 px-3.5 py-3 space-y-2">
              <p className="flex items-baseline justify-between gap-3">
                <span className="text-sm font-extrabold text-slate-800 whitespace-nowrap">
                  {t('person.semester', { n: semester.ordinal })}
                </span>
                {rate !== null && <span className="text-sm font-extrabold text-brand tabular-nums">{rate}%</span>}
              </p>
              {rate === null ? (
                <p className="text-xs text-slate-500 font-semibold">{t('person.att.none')}</p>
              ) : (
                <>
                  <p className="-mt-1 text-[11px] font-semibold text-slate-500">
                    {t('person.att.of', { present: semester.present, n: semester.counted })}
                  </p>
                  {/* Plain counts, not four coloured pills (owner, 2026-10-07). */}
                  <p className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs font-medium text-slate-600 tabular-nums">
                    <span>{`${t('att.status.PRESENT')} ${semester.present}`}</span>
                    <span>{`${t('att.status.SICK')} ${semester.sick}`}</span>
                    <span>{`${t('att.status.EXCUSED')} ${semester.excused}`}</span>
                    <span>{`${t('att.status.ABSENT')} ${semester.absent}`}</span>
                    {semester.late > 0 && <span>{t('att.flags.late', { n: semester.late })}</span>}
                    {semester.outsideSchool > 0 && <span>{t('att.flags.outside', { n: semester.outsideSchool })}</span>}
                  </p>
                </>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
};

export const PersonDetailDialog = ({ person, placement: givenPlacement, onClose }) => {
  const { t, lang } = useT();
  const { membership } = useAuth();
  const closeRef = useRef(null);
  const openerRef = useRef(null);

  const id = person?.membershipId;
  const canRead = activeRolesOf(membership).some((role) => LEADER_ROLES.includes(role));
  /* undefined while reading (or not read at all), null when the read failed. */
  const [detail, setDetail] = useState(undefined);

  /* Mounted once per person (callers key it), so this reads once. */
  useEffect(() => {
    if (!id || !canRead) return undefined;
    let cancelled = false;
    membersService
      .get(id)
      .then((found) => {
        if (!cancelled) setDetail(found);
      })
      .catch(() => {
        if (!cancelled) setDetail(null);
      });
    return () => {
      cancelled = true;
    };
  }, [id, canRead]);

  useEffect(() => {
    if (!id) return undefined;
    openerRef.current = document.activeElement;
    closeRef.current?.focus();
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      if (openerRef.current?.isConnected) openerRef.current.focus();
    };
  }, [id, onClose]);

  if (!person) return null;

  const loading = canRead && detail === undefined;
  const known = detail ?? {};
  const roles = known.roles ?? person.roles ?? [];
  const student = known.student ?? null;
  const isStudent = roles.includes(ROLES.STUDENT) || Boolean(person.nisn) || Boolean(student);
  const joinedAt = known.joinedAt ?? person.joinedAt;
  const endedAt = known.endedAt ?? person.endedAt;
  const endReason = known.endReason ?? person.endReason;
  const day = (value) => (value ? formatDay(value, lang) : '-');

  const ids = [
    [t('profile.nisn'), known.nisn ?? person.nisn],
    [t('profile.nip'), known.nip ?? person.nip],
    [t('profile.nuptk'), known.nuptk ?? person.nuptk],
  ].filter(([, value]) => value);

  /* The class: what the caller handed over, else the detail's - with its homeroom
     teacher and placement date since backend ccba4e0 (request #7). */
  const fromDetail = student?.class
    ? {
        className: student.class.name,
        gradeLevel: student.class.gradeLevel,
        academicYear: student.class.academicYear,
        homeroomName: student.class.homeroomTeacher?.fullName ?? null,
        placedAt: student.class.placedAt,
      }
    : student
      ? null
      : undefined;
  const placement = givenPlacement !== undefined ? givenPlacement : fromDetail;
  const showClass = isStudent && !endedAt && (placement !== undefined || loading);

  return createPortal(
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="person-detail-title"
        aria-busy={loading || undefined}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-3xl shadow-2xl border border-slate-100 max-w-md w-full p-6 sm:p-7 space-y-5 text-left max-h-[90dvh] overflow-y-auto"
      >
        <div className="flex items-start gap-4">
          <span className="w-14 h-14 rounded-2xl bg-brand text-white text-lg font-extrabold flex items-center justify-center shrink-0 select-none">
            {initialsOf(person.fullName)}
          </span>
          <div className="min-w-0 flex-1 space-y-1.5 pt-0.5">
            <h2 id="person-detail-title" className="text-lg font-extrabold text-slate-900 tracking-tight break-words">
              {person.fullName}
            </h2>
            {roles.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {roles.map((role) => (
                  <span key={role} className="px-2 py-0.5 bg-brand-tint text-brand text-[10px] font-extrabold rounded-md">
                    {t(`roleTitle.${role}`)}
                  </span>
                ))}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('common.close')}
            className="w-9 h-9 -mr-2 -mt-2 rounded-xl text-slate-500 hover:bg-slate-100 flex items-center justify-center shrink-0 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {ids.map(([label, value]) => (
            <Fact key={label} label={label}>
              {value}
            </Fact>
          ))}

          {student?.birthDate && (
            <Fact label={t('person.birthDate')}>
              {day(student.birthDate)}
            </Fact>
          )}

          {showClass &&
            (placement === undefined ? (
              <div className="h-[58px] rounded-2xl bg-slate-50 animate-pulse sm:col-span-2" aria-label={t('common.loading')} />
            ) : placement ? (
              <>
                <Fact label={t('person.class')}>
                  {placement.className}
                  <span className="ml-1.5 px-1.5 py-0.5 bg-brand-tint text-brand text-[10px] font-extrabold rounded-md align-middle">
                    {t('classes.grade', { n: placement.gradeLevel })}
                  </span>
                </Fact>
                <Fact label={t('person.year')}>
                  {placement.academicYear || '-'}
                </Fact>
                {placement.homeroomName !== undefined && (
                  <Fact label={t('person.homeroom')}>
                    {placement.homeroomName ?? t('classes.detail.noHomeroom')}
                  </Fact>
                )}
                {placement.placedAt !== undefined && (
                  <Fact label={t('person.inClassSince')}>
                    {day(placement.placedAt)}
                  </Fact>
                )}
              </>
            ) : (
              <Fact label={t('person.class')}>
                {t('person.notPlaced')}
              </Fact>
            ))}

          {endedAt && student?.lastClass && (
            <Fact label={t('person.lastClass')}>
              {student.lastClass.name}
              <span className="ml-1.5 text-[11px] font-semibold text-slate-500">{student.lastClass.academicYear}</span>
            </Fact>
          )}

          {endedAt ? (
            <Fact label={t('person.leftOn')}>
              {day(endedAt)}
            </Fact>
          ) : (
            joinedAt && (
              <Fact label={t('person.joinedOn')}>
                {day(joinedAt)}
              </Fact>
            )
          )}

          {detail && (
            <>
              <Fact label={t('person.email')} wide>
                <EmailValue email={detail.email} />
              </Fact>
              <Fact label={t('person.phone')} wide>
                <PhoneValue phone={detail.phone} name={person.fullName} />
              </Fact>
            </>
          )}
        </div>

        {endedAt && (
          <p className="pl-3 border-l-2 border-slate-200 text-xs text-slate-600 font-semibold break-words">
            {endReason ?? t('members.leftThemselves')}
          </p>
        )}

        {loading && <div className="h-24 rounded-2xl bg-slate-50 animate-pulse" aria-label={t('common.loading')} />}

        {detail === null && (
          <p className="text-xs text-slate-500 font-semibold" role="status">
            {t('person.detailFailed')}
          </p>
        )}

        {student && <Guardians guardians={student.guardians ?? []} />}

        {student?.attendance && <Attendance attendance={student.attendance} />}

        <div className={modalActions}>
          <button ref={closeRef} type="button" onClick={onClose} className={modalCancelClass()}>
            {t('common.close')}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default PersonDetailDialog;
