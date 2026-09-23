import React from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';

import AuthLayout from '../../layouts/AuthLayout';
import SchoolRegistrationForm from './SchoolRegistrationForm';
import JoinSchoolForm from './JoinSchoolForm';
import { useAuth } from '../../context/AuthContext';
import { useT } from '../../i18n/LanguageContext';

/*
  What happens after somebody picks one of the three cards.

  Two different journeys hide behind those cards, and conflating them is what
  made the earlier version wrong:

    Organization  registers a NEW school. Nobody grants this role — there is no
                  school yet to grant it. A platform admin reviews the
                  application and the school is created on approval.
    Student       joins a school that already exists, with its School Code. That
    Teacher       school then approves the request and grants the role.

  **All three can now be submitted.** Ticket 04 gave founding a school
  `POST /api/school-registrations`, and ticket 05 gave joining one
  `POST /api/memberships/lookup` and `POST /api/memberships/requests`. So this
  screen no longer keeps a visibly inactive button for the student and teacher
  paths: it hands both to `JoinSchoolForm`, which asks for the School Code first
  and for anything personal only once the school has been named back.

  Everything listed under "what you will need" comes from the schema, not from
  imagination: the Organization fields are the columns of `SchoolRegistration`.
*/

const SchoolIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8">
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12v18H3V3z" />
  </svg>
);

const KeyIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8">
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
  </svg>
);

/*
  The join path is the same act whether somebody is asking to be a student or a
  teacher — one School Code, one request, one school deciding — so it is one
  entry here with the role's name dropped in.
*/
const joinIntent = (role) => ({
  icon: <KeyIcon />,
  heading: ['getStarted.join.title', 'getStarted.join.titleAccent'],
  subheading: ['getStarted.join.subtitle', { role: `role.${role}.label` }],
  panelHeading: 'getStarted.join.panelHeading',
  panelBlurb: 'getStarted.join.panelBlurb',
  needs: [['getStarted.join.need.code', 'getStarted.join.need.codeDetail', { role: `role.${role}.label` }]],
  approval: ['getStarted.join.approval', { Role: `role.${role}.label` }],
});

const INTENTS = {
  organization: {
    icon: <SchoolIcon />,
    heading: ['getStarted.org.title', 'getStarted.org.titleAccent'],
    subheading: ['getStarted.org.subtitle'],
    panelHeading: 'getStarted.org.panelHeading',
    panelBlurb: 'getStarted.org.panelBlurb',
    needs: [
      ['getStarted.org.need.npsn', 'getStarted.org.need.npsnDetail'],
      ['getStarted.org.need.name', 'getStarted.org.need.nameDetail'],
      ['getStarted.org.need.city', 'getStarted.org.need.cityDetail'],
      ['getStarted.org.need.phone', 'getStarted.org.need.phoneDetail'],
      ['getStarted.org.need.ktp', 'getStarted.org.need.ktpDetail'],
    ],
    approval: ['getStarted.org.approval'],
  },
  /*
    The student path lists one extra thing it will ask for. Both paths now hand
    the asking to JoinSchoolForm, which knows the fields each role needs — a
    student names a grade and a birth date beside the NISN, a teacher gives a
    NIP or a NUPTK. This list is the promise; the form is the asking.
  */
  student: {
    ...joinIntent('STUDENT'),
    needs: [
      ['getStarted.join.need.code', 'getStarted.join.need.codeDetail', { role: 'role.STUDENT.label' }],
      ['getStarted.join.need.nisn', 'getStarted.join.need.nisnDetail'],
    ],
  },
  /*
    The teacher path listed only the code, which made it the one join path that
    matched its first screen exactly — and the one that never warned anybody they
    would be asked for a NIP or a NUPTK at all.
  */
  teacher: {
    ...joinIntent('TEACHER'),
    needs: [
      ['getStarted.join.need.code', 'getStarted.join.need.codeDetail', { role: 'role.TEACHER.label' }],
      ['getStarted.join.need.teacherIds', 'getStarted.join.need.teacherIdsDetail'],
    ],
  },

  /*
    A guardian names one child: the number, the name, and how they are related.

    The pairing is the point. Nothing here looks a child up, and the server
    gives no hint when the two do not match — knowing both already is the
    out-of-band check that a School Code on its own cannot be (ADR-0002).
  */
  guardian: {
    ...joinIntent('GUARDIAN'),
    needs: [
      ['getStarted.join.need.code', 'getStarted.join.need.codeDetail', { role: 'role.GUARDIAN.label' }],
      ['getStarted.join.need.child', 'getStarted.join.need.childDetail'],
    ],
  },
};

export const GetStartedPage = () => {
  const navigate = useNavigate();
  const { intent } = useParams();
  const { user } = useAuth();
  const { t } = useT();

  /* Role names inside a sentence are keys too, so they bend with the language. */
  const fill = (vars) =>
    Object.fromEntries(Object.entries(vars ?? {}).map(([k, v]) => [k, t(v)]));

  const content = INTENTS[intent];

  // A hand-typed or stale URL should land somewhere real, not on a blank card.
  if (!content) return <Navigate to="/select-role" replace />;

  const footer = (
    <button
      type="button"
      onClick={() => navigate('/select-role')}
      className="text-xs text-slate-500 hover:text-brand font-bold transition-colors focus:outline-none cursor-pointer"
    >
      {t('getStarted.back')}
    </button>
  );

  return (
    <AuthLayout heading={t(content.panelHeading)} blurb={t(content.panelBlurb)} footer={footer}>
      <div className="w-16 h-16 bg-brand-tint rounded-2xl flex items-center justify-center text-brand mx-auto shadow-sm">
        {content.icon}
      </div>

      <div>
        <h2 className="text-3xl sm:text-[34px] font-extrabold text-slate-800 leading-tight select-none">
          {t(content.heading[0])} <span className="text-brand">{t(content.heading[1])}</span>
        </h2>
        <p className="text-slate-500 text-xs sm:text-sm mt-2 font-semibold">
          {t(content.subheading[0], fill(content.subheading[1]))}
          {user?.fullName ? ` · ${user.fullName}` : ''}
        </p>
      </div>

      <div className="border border-slate-200 rounded-2xl p-5 text-left bg-white shadow-sm space-y-4">
        <div>
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
            {t('getStarted.needLabel')}
          </span>
          <ul className="mt-2 space-y-2">
            {content.needs.map(([label, detail, vars]) => (
              <li key={label} className="flex items-start gap-2.5">
                <span className="w-1.5 h-1.5 rounded-full bg-brand shrink-0 mt-1.5" aria-hidden="true" />
                <span className="min-w-0">
                  <span className="text-sm font-extrabold text-slate-800">{t(label)}</span>
                  <span className="block text-xs text-slate-500 font-medium leading-relaxed">{t(detail, fill(vars))}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="pt-1 border-t border-slate-100">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
            {t('getStarted.thenWhat')}
          </span>
          <p className="text-xs text-slate-500 font-medium leading-relaxed mt-1.5">
            {t(content.approval[0], fill(content.approval[1]))}
          </p>
        </div>
      </div>

      {/*
        Every path on this screen is now walkable. Until ticket 05 landed, two of
        the three ended at a button that was disabled on purpose, with a sentence
        under it admitting the endpoint did not exist — a live one there would
        have failed on press and read as broken rather than unfinished.

        That button and its apology are gone. There is no closed path left to
        describe.
      */}
      {intent === 'organization' ? (
        <SchoolRegistrationForm />
      ) : (
        <JoinSchoolForm intent={intent} />
      )}
    </AuthLayout>
  );
};

export default GetStartedPage;
