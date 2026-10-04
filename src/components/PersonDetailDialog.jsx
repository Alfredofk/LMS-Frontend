import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Cake,
  CalendarCheck,
  CalendarRange,
  ClipboardCheck,
  GraduationCap,
  History,
  IdCard,
  LogOut,
  Mail,
  MessageCircle,
  Phone,
  School,
  UserRound,
  Users,
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
import InfoChips from './ui/InfoChips';
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

  The answer's class has no homeroom teacher and no placement date. The class
  page knows both and hands them over as `placement`; from the member list they
  are simply not shown (owner, 2026-10-04) - reading every class's roster for two
  lines was the old way, dropped.

  Phone numbers and email addresses are links: tel:, wa.me and mailto: (owner,
  2026-10-04).

  @param person    { membershipId, fullName, roles?, nisn?, nip?, nuptk?, joinedAt?, endedAt?, endReason? }
  @param placement { className, gradeLevel, academicYear, homeroomName, placedAt } | null (not placed) | undefined (from the detail)
*/

const LEADER_ROLES = [ROLES.PRINCIPAL, ROLES.VICE_PRINCIPAL];

const Fact = ({ icon, label, children, wide = false }) => {
  const Icon = icon;
  return (
    <div className={`flex items-start gap-3 rounded-2xl bg-slate-50 px-3.5 py-3 min-w-0 ${wide ? 'sm:col-span-2' : ''}`}>
      <span className="w-8 h-8 rounded-xl bg-white text-brand flex items-center justify-center shrink-0 shadow-sm">
        <Icon className="w-4 h-4" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</span>
        <span className="block text-sm font-bold text-slate-800 break-words tabular-nums">{children}</span>
      </span>
    </div>
  );
};

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

const SectionTitle = ({ icon, children }) => {
  const Icon = icon;
  return (
    <h3 className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-slate-500">
      <Icon className="w-4 h-4 text-brand" aria-hidden="true" />
      {children}
    </h3>
  );
};

const Guardians = ({ guardians }) => {
  const { t } = useT();
  return (
    <section className="space-y-2.5">
      <SectionTitle icon={Users}>{t('person.guardians')}</SectionTitle>
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
      <SectionTitle icon={ClipboardCheck}>{t('person.attendance', { year: attendance.academicYear })}</SectionTitle>
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
                  <InfoChips
                    size="xs"
                    items={[
                      { label: `${t('att.status.PRESENT')} ${semester.present}`, tone: 'emerald' },
                      { label: `${t('att.status.SICK')} ${semester.sick}`, tone: 'amber' },
                      { label: `${t('att.status.EXCUSED')} ${semester.excused}`, tone: 'brand' },
                      { label: `${t('att.status.ABSENT')} ${semester.absent}`, tone: 'rose' },
                      semester.late > 0 && { label: t('att.flags.late', { n: semester.late }) },
                      semester.outsideSchool > 0 && { label: t('att.flags.outside', { n: semester.outsideSchool }) },
                    ]}
                  />
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

  /* The class: what the caller handed over, else the detail's (no homeroom, no date). */
  const fromDetail = student?.class
    ? { className: student.class.name, gradeLevel: student.class.gradeLevel, academicYear: student.class.academicYear }
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
            <Fact key={label} icon={IdCard} label={label}>
              {value}
            </Fact>
          ))}

          {student?.birthDate && (
            <Fact icon={Cake} label={t('person.birthDate')}>
              {day(student.birthDate)}
            </Fact>
          )}

          {showClass &&
            (placement === undefined ? (
              <div className="h-[58px] rounded-2xl bg-slate-50 animate-pulse sm:col-span-2" aria-label={t('common.loading')} />
            ) : placement ? (
              <>
                <Fact icon={School} label={t('person.class')}>
                  {placement.className}
                  <span className="ml-1.5 px-1.5 py-0.5 bg-brand-tint text-brand text-[10px] font-extrabold rounded-md align-middle">
                    {t('classes.grade', { n: placement.gradeLevel })}
                  </span>
                </Fact>
                <Fact icon={CalendarRange} label={t('person.year')}>
                  {placement.academicYear || '-'}
                </Fact>
                {placement.homeroomName !== undefined && (
                  <Fact icon={GraduationCap} label={t('person.homeroom')}>
                    {placement.homeroomName ?? t('classes.detail.noHomeroom')}
                  </Fact>
                )}
                {placement.placedAt !== undefined && (
                  <Fact icon={CalendarCheck} label={t('person.inClassSince')}>
                    {day(placement.placedAt)}
                  </Fact>
                )}
              </>
            ) : (
              <Fact icon={School} label={t('person.class')}>
                {t('person.notPlaced')}
              </Fact>
            ))}

          {endedAt && student?.lastClass && (
            <Fact icon={History} label={t('person.lastClass')}>
              {student.lastClass.name}
              <span className="ml-1.5 text-[11px] font-semibold text-slate-500">{student.lastClass.academicYear}</span>
            </Fact>
          )}

          {endedAt ? (
            <Fact icon={LogOut} label={t('person.leftOn')}>
              {day(endedAt)}
            </Fact>
          ) : (
            joinedAt && (
              <Fact icon={UserRound} label={t('person.joinedOn')}>
                {day(joinedAt)}
              </Fact>
            )
          )}

          {detail && (
            <>
              <Fact icon={Mail} label={t('person.email')} wide>
                <EmailValue email={detail.email} />
              </Fact>
              <Fact icon={Phone} label={t('person.phone')} wide>
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
