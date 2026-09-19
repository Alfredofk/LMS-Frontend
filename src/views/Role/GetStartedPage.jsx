import React from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';

import AuthLayout from '../../layouts/AuthLayout';
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

  Neither can be submitted yet: the backend has the models, the rate limiters and
  the approval guards, but no routes — `server.js` mounts only `auth` and
  `users`. So these screens say exactly what will be asked and who will answer,
  and their primary button is visibly inactive rather than alive and quietly
  failing.

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
  action: 'getStarted.join.action',
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
    action: 'getStarted.org.action',
  },
  student: joinIntent('STUDENT'),
  teacher: joinIntent('TEACHER'),
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
      className="text-xs text-slate-400 hover:text-[#7047EB] font-bold transition-colors focus:outline-none cursor-pointer"
    >
      {t('getStarted.back')}
    </button>
  );

  return (
    <AuthLayout heading={t(content.panelHeading)} blurb={t(content.panelBlurb)} footer={footer}>
      <div className="w-16 h-16 bg-[#F1EEFF] rounded-2xl flex items-center justify-center text-[#7047EB] mx-auto shadow-sm">
        {content.icon}
      </div>

      <div>
        <h1 className="text-3xl sm:text-[34px] font-extrabold text-slate-800 leading-tight select-none">
          {t(content.heading[0])} <span className="text-[#7047EB]">{t(content.heading[1])}</span>
        </h1>
        <p className="text-slate-400 text-xs sm:text-sm mt-2 font-semibold">
          {t(content.subheading[0], fill(content.subheading[1]))}
          {user?.fullName ? ` · ${user.fullName}` : ''}
        </p>
      </div>

      <div className="border border-slate-200 rounded-2xl p-5 text-left bg-white shadow-sm space-y-4">
        <div>
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            {t('getStarted.needLabel')}
          </span>
          <ul className="mt-2 space-y-2">
            {content.needs.map(([label, detail, vars]) => (
              <li key={label} className="flex items-start gap-2.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#7047EB] shrink-0 mt-1.5" aria-hidden="true" />
                <span className="min-w-0">
                  <span className="text-sm font-extrabold text-slate-800">{t(label)}</span>
                  <span className="block text-xs text-slate-400 font-medium leading-relaxed">{t(detail, fill(vars))}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="pt-1 border-t border-slate-100">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            {t('getStarted.thenWhat')}
          </span>
          <p className="text-xs text-slate-500 font-medium leading-relaxed mt-1.5">
            {t(content.approval[0], fill(content.approval[1]))}
          </p>
        </div>
      </div>

      {/*
        Deliberately dead, and saying so. The endpoint behind it does not exist
        yet — a live button here would fail on press and teach somebody that the
        app is broken rather than unfinished.
      */}
      <div className="space-y-2">
        <button
          type="button"
          disabled
          className="w-full py-3.5 rounded-2xl justify-center font-bold text-base bg-slate-100 text-slate-400 flex items-center gap-2 select-none cursor-not-allowed"
        >
          {t(content.action)}
        </button>
        <p className="text-[11px] text-slate-400 font-semibold">
          {t('getStarted.notOpen')}
        </p>
      </div>
    </AuthLayout>
  );
};

export default GetStartedPage;
