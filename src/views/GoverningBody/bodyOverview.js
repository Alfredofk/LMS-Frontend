import { GOVERNING_BODY_ADMINS, GOVERNING_BODY_SCHOOLS } from '../../constants/roles';

/*
  The summary at the top of a Governing Body's home (owner 2026-10-26, 1-8), kept out of
  the markup so it can be tested. Everything comes from reads the body already has:

  - `GET /governing-body/schools` (ownSchoolView, backend f01cd28 / 227473f): the totals
    are the rows' `counts` summed, every School as it is - one switched off included, and
    a teacher at two Schools twice (the rows name nobody across Schools).
  - "Perlu perhatian", each row only when there is something: Principal applications
    waiting (`principalApplicationsWaiting`), Schools asking to join
    (`GET .../affiliation-requests`, PENDING), applications to be an admin for the senior
    alone (`GET .../admins`, `youAreSenior`), Schools without a Principal (`hasPrincipal`),
    Schools switched off (`deactivatedAt`).
  - A row about one School opens it (its "Lamaran" tab for applications); about several,
    the Schools tab, which has no filter to pass on. The two side reads may fail on their
    own: their rows are then left out (null), never counted as none.
*/

const schoolPath = (school, tab = null) => `${GOVERNING_BODY_SCHOOLS}/${encodeURIComponent(school.id)}${tab ? `?tab=${tab}` : ''}`;

/** Sekolah / Siswa / Guru across the body's Schools. */
export function totalsOf(schools) {
  const rows = Array.isArray(schools) ? schools : [];
  let students = 0;
  let teachers = 0;
  for (const school of rows) {
    students += Number(school?.counts?.students) || 0;
    teachers += Number(school?.counts?.teachers) || 0;
  }
  return { schools: rows.length, students, teachers };
}

/* A row about some Schools: the one named and opened, or how many and the list. */
const aboutSchools = (kind, schools, tab = null) => {
  if (schools.length === 0) return null;
  if (schools.length === 1) return { kind, count: 1, school: schools[0].name, to: schoolPath(schools[0], tab) };
  return { kind, count: schools.length, school: null, to: GOVERNING_BODY_SCHOOLS };
};

/**
 * What needs the admins, most pressing first: each `{ kind, count, school, at?, to }`
 * where `school` names the one School a row is about (null for several), `at` how many
 * Schools applications wait at. `affiliationRequests` / `admins` null: not read.
 */
export function attentionOf(schools, { affiliationRequests = null, admins = null } = {}) {
  const rows = Array.isArray(schools) ? schools : [];
  const items = [];

  const waitingAt = rows.filter((school) => (Number(school?.principalApplicationsWaiting) || 0) > 0);
  if (waitingAt.length > 0) {
    const count = waitingAt.reduce((sum, school) => sum + Number(school.principalApplicationsWaiting), 0);
    const one = waitingAt.length === 1;
    items.push({
      kind: 'PRINCIPAL_APPLICATIONS',
      count,
      school: one ? waitingAt[0].name : null,
      at: waitingAt.length,
      to: one ? schoolPath(waitingAt[0], 'lamaran') : GOVERNING_BODY_SCHOOLS,
    });
  }

  const asking = Array.isArray(affiliationRequests) ? affiliationRequests.filter((request) => request?.status === 'PENDING') : [];
  if (asking.length > 0) items.push({ kind: 'AFFILIATION_REQUESTS', count: asking.length, school: asking.length === 1 ? asking[0].school?.name ?? null : null, to: GOVERNING_BODY_SCHOOLS });

  if (admins?.youAreSenior) {
    const applying = (Array.isArray(admins.applications) ? admins.applications : []).filter((application) => application?.status === 'PENDING');
    if (applying.length > 0) items.push({ kind: 'ADMIN_APPLICATIONS', count: applying.length, school: null, to: GOVERNING_BODY_ADMINS });
  }

  const headless = aboutSchools('NO_PRINCIPAL', rows.filter((school) => !school?.hasPrincipal));
  if (headless) items.push(headless);

  const off = aboutSchools('SWITCHED_OFF', rows.filter((school) => school?.deactivatedAt));
  if (off) items.push(off);

  return items;
}
