import { normaliseSchoolCode, validatePhone } from '../../utils/validation';

/*
  Applying to be the Principal of a Governing Body's School (backend e206bd9,
  governing-body ticket 06; owner 2026-10-26, A1-A8), kept out of the markup so it can
  be tested. Validators return keys, as utils/validation.js does.

  - The School is named by its own code, which its body hands out. The lookup says
    `principalWanted` - true only for a body's School with no Principal sitting - and
    `governingBody.name`; any other School takes no application.
  - The body (governingBody.schema.js `principalApplicationBody`, multipart): the code,
    the applicant's phone (auth.schema.js `phone`), and the KTP, JPG or PNG of at most
    2 MB, read from its bytes (bodyRegistration.js `fileError('ktp', ...)`).
  - An application (`GET /principal-applications/mine`, newest first) is PENDING, then
    APPROVED or REJECTED, or CANCELLED by its applicant. It names the School by name,
    type and city, never by its id, so those three tell Schools apart. Once another
    applicant is approved, every one still waiting there is rejected with one fixed
    reason (approval.js SCHOOL_HAS_PRINCIPAL), said in our own words.
*/

/** The reason a waiting application gets when another one is approved (approval.js). */
export const SCHOOL_HAS_PRINCIPAL = 'The school has a Principal now';

/** Whether a looked-up School takes an application to be its Principal. */
export const takesApplication = (school) => school?.principalWanted === true;

/** What is wrong with the typed fields, as `{ field: { key, vars? } }`; empty when nothing is. */
export function applicationErrors(values) {
  const errors = {};
  const phone = validatePhone(values?.applicantPhone ?? '');
  if (phone) errors.applicantPhone = phone;
  return errors;
}

/** The multipart body: the code in capitals, the phone trimmed, then the KTP. */
export function applicationFormData(schoolCode, applicantPhone, ktp) {
  const body = new FormData();
  body.append('schoolCode', normaliseSchoolCode(schoolCode));
  body.append('applicantPhone', String(applicantPhone ?? '').trim());
  body.append('ktp', ktp);
  return body;
}

/**
 * One line per School, from its newest application: 'WAITING' (cancellable),
 * 'REJECTED' with the admin's reason, or 'TAKEN' when it closed because another
 * applicant was approved. An approved one is a place, listed with the schools, and a
 * cancelled one says nothing.
 */
export function principalLinesOf(applications) {
  const seen = new Set();
  const lines = [];
  for (const application of Array.isArray(applications) ? applications : []) {
    const school = application.school ?? {};
    const key = `${school.name}|${school.schoolType}|${school.city}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const line = { id: application.id, name: school.name ?? '' };
    if (application.status === 'PENDING') lines.push({ ...line, state: 'WAITING' });
    else if (application.status === 'REJECTED' && application.rejectionReason === SCHOOL_HAS_PRINCIPAL) lines.push({ ...line, state: 'TAKEN' });
    else if (application.status === 'REJECTED') lines.push({ ...line, state: 'REJECTED', reason: application.rejectionReason ?? null });
  }
  return lines;
}
