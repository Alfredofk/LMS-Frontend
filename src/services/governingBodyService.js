/**
 * The backend's /api/governing-body contract (backend b5cfffd, 3d7d05a and ed0d304,
 * governing-body tickets 03 to 05), thin over apiClient: the seat's own read, its
 * admins and its Schools, and the applicant's registration. Every admin reads the admins,
 * changes the address and phone, replaces the code and leaves unless the last; only
 * the senior admin approves, rejects and removes (403 for the rest).
 */

import { api, requestBlob } from './apiClient';

export const governingBodyService = {
  /**
   * The Governing Body this sign-in's seat is for (`GET /api/governing-body`):
   * `{ id, kind, name, skNumber, address: { street, village, district, city,
   * province, postalCode }, phone, code, subdomain, deactivatedAt, deactivationReason,
   * createdAt }` (`phone` since 3d7d05a, null until an admin sets it).
   *
   * @throws {ApiError} FORBIDDEN when the seat has ended or the body is switched off
   */
  async own() {
    const answer = await api.get('/governing-body');
    return answer?.governingBody ?? null;
  },

  /**
   * Change the address and the phone (`PATCH /api/governing-body`): only what changed;
   * `postalCode: null` and `phone: null` clear them. The name, kind and SK number are
   * the Platform Admin's, and refused here. `{ governingBody, message }`.
   *
   * @throws {ApiError} CONFLICT "changed meanwhile"; BAD_REQUEST for a field
   */
  async updateProfile(patch) {
    const answer = await api.patch('/governing-body', patch);
    return answer?.governingBody ?? null;
  },

  /** A new Governing Body Code; the old one stops at once (`POST .../code/rotate`). Answers the body. */
  async rotateCode() {
    const answer = await api.post('/governing-body/code/rotate');
    return answer?.governingBody ?? null;
  },

  /**
   * The sitting admins, the senior first, and the applications waiting, oldest first
   * (`GET .../admins`): `{ admins: [{ id, user: { id, fullName, email }, approvedAt,
   * senior, you }], applications: [{ id, status, user, requestedAt, approvedAt,
   * rejectionReason }], youAreSenior }`. Ids are the seats'.
   */
  admins: () => api.get('/governing-body/admins'),

  /** The senior's approval of an application. `{ application, message }`. */
  approveApplication: (seatId) => api.post(`/governing-body/admins/${encodeURIComponent(seatId)}/approve`),

  /** The senior's rejection; a reason of 3-500, shown to the applicant. `{ application, message }`. */
  rejectApplication: (seatId, reason) => api.post(`/governing-body/admins/${encodeURIComponent(seatId)}/reject`, { reason }),

  /** The senior removing another admin, with a reason of 3-500 they will read. `{ seat, message }`. */
  removeAdmin: (seatId, reason) => api.post(`/governing-body/admins/${encodeURIComponent(seatId)}/remove`, { reason }),

  /**
   * Leave the body (`POST .../leave`). `{ seat, message }`.
   *
   * @throws {ApiError} CONFLICT for the last admin
   */
  leave: () => api.post('/governing-body/leave'),

  /**
   * The body's Schools, by name (`GET /governing-body/schools`, backend ed0d304): each
   * `{ id, npsn, name, schoolType, durationYears, city, latitude, longitude, timeZone,
   * subdomain, schoolCode, hasPrincipal, hadPrincipal, deactivatedAt, createdAt }`.
   * `hasPrincipal` is a Principal sitting now, `hadPrincipal` one now or before
   * (backend f669e3e), which is what a fix asks.
   */
  async schools() {
    const answer = await api.get('/governing-body/schools');
    return answer?.schools ?? [];
  },

  /**
   * Create 1-10 Schools at once, all or none (`POST /governing-body/schools`):
   * `{ schools: [{ npsn, schoolName, schoolType, city, latitude, longitude, timeZone,
   * durationYears? }] }`, each live at once with its code and address and no Principal.
   * 201 `{ schools, message }`.
   *
   * @throws {ApiError} CONFLICT for an NPSN taken (`details.rows: [{ row, index, npsn }]`)
   *   or taken meanwhile; BAD_REQUEST per row (`schools.<i>.<field>`)
   */
  async createSchools(schools) {
    const answer = await api.post('/governing-body/schools', { schools });
    return answer?.schools ?? [];
  },

  /**
   * Fix a School's name, NPSN, type or an SMK's duration (`PATCH .../schools/:id`), only
   * while it has never had a Principal; the address does not follow. `{ school, message }`.
   *
   * @throws {ApiError} CONFLICT once it has had a Principal, changed meanwhile or an NPSN
   *   taken; NOT_FOUND for another body's or none
   */
  async fixSchool(schoolId, patch) {
    const answer = await api.patch(`/governing-body/schools/${encodeURIComponent(schoolId)}`, patch);
    return answer?.school ?? null;
  },

  /**
   * One of the body's Schools (`GET /governing-body/schools/:id`, backend f01cd28), as a
   * row of `schools()` gives it. Another body's or none is NOT_FOUND.
   */
  async school(schoolId) {
    const answer = await api.get(`/governing-body/schools/${encodeURIComponent(schoolId)}`);
    return answer?.school ?? null;
  },

  /**
   * A School's Teachers (`GET .../schools/:id/teachers`, backend f01cd28, any admin), by
   * name, not paged: `{ academicYear: { id, label } | null, semester: { id, ordinal } |
   * null, teachers: [{ membershipId, fullName, nip, nuptk, roles (PRINCIPAL |
   * VICE_PRINCIPAL | TEACHER), classSubjects: [{ id, subject: { id, code, name }, class:
   * { id, name } }], homeroomOf: [{ id, name }] }] }` - the current year and Semester.
   */
  schoolTeachers: (schoolId) => api.get(`/governing-body/schools/${encodeURIComponent(schoolId)}/teachers`),

  /**
   * A page of a School's Students (`GET .../schools/:id/students`, f01cd28), by name:
   * `query` `{ q?, classId?, limit?, offset? }` (50 a page, at most 100). `{ students:
   * [{ membershipId, fullName, nisn, class: { id, name, gradeLevel } | null }], total,
   * page: { limit, offset, returned }, academicYear, classes: [{ id, name, gradeLevel }] }`.
   */
  schoolStudents: (schoolId, query = {}) => api.get(`/governing-body/schools/${encodeURIComponent(schoolId)}/students`, { query }),

  /**
   * Make an ACTIVE Teacher of the School its Principal (`POST .../schools/:id/principal`,
   * backend 261a9c7, any admin), named by the teacher list's `membershipId`, with a reason
   * of 3-500. The Principal before stays if they hold another role, else leaves; the
   * applications waiting there close. `{ school, principal: { membershipId, fullName },
   * previous: [{ membershipId, status: ACTIVE | LEFT }], message }`.
   *
   * @throws {ApiError} NOT_FOUND for anyone not an active teacher there
   */
  appointPrincipal: (schoolId, membershipId, reason) =>
    api.post(`/governing-body/schools/${encodeURIComponent(schoolId)}/principal`, { membershipId, reason }),

  /** End the Principal's role with no successor (`POST .../principal/end`): `{ school, previous, message }`; CONFLICT when none sits. */
  endPrincipal: (schoolId, reason) => api.post(`/governing-body/schools/${encodeURIComponent(schoolId)}/principal/end`, { reason }),

  /** Switch the School off (`POST .../deactivate`, a reason of 3-500): `{ school, message }`. */
  deactivateSchool: (schoolId, reason) => api.post(`/governing-body/schools/${encodeURIComponent(schoolId)}/deactivate`, { reason }),

  /**
   * Switch it back on (`POST .../reactivate`, a note of up to 500 or none): `{ school, message }`.
   *
   * @throws {ApiError} CONFLICT when the Platform Admin switched it off, or it is not off
   */
  reactivateSchool: (schoolId, note) =>
    api.post(`/governing-body/schools/${encodeURIComponent(schoolId)}/reactivate`, note ? { reason: note } : {}),

  /** Let the School go, independent (`POST .../release`, a reason of 3-500), only while a Principal sits: `{ school: { id, name }, message }`. */
  releaseSchool: (schoolId, reason) => api.post(`/governing-body/schools/${encodeURIComponent(schoolId)}/release`, { reason }),

  /**
   * Independent Schools asking to join the body (`GET /governing-body/affiliation-requests`,
   * 261a9c7): PENDING unless `status` says APPROVED | REJECTED | CANCELLED | ALL. Each
   * `{ id, status, school: { id, name, npsn, schoolType, city }, requestedBy: { fullName },
   * requestedAt, decidedAt, decidedBy: { id, fullName } | null, rejectionReason }`.
   */
  async affiliationRequests(status = 'PENDING') {
    const answer = await api.get('/governing-body/affiliation-requests', { query: { status } });
    return answer?.requests ?? [];
  },

  /** Take the School in (`POST .../affiliation-requests/:id/approve`): `{ request, message }`. */
  approveAffiliation: (requestId) => api.post(`/governing-body/affiliation-requests/${encodeURIComponent(requestId)}/approve`),

  /** Turn it down with a reason of 3-500 the Principal reads (`POST .../:id/reject`). */
  rejectAffiliation: (requestId, reason) => api.post(`/governing-body/affiliation-requests/${encodeURIComponent(requestId)}/reject`, { reason }),

  /**
   * A School's Principal applications, oldest first (`GET .../schools/:id/principal-applications`,
   * backend e206bd9, any admin): PENDING unless `status` says APPROVED | REJECTED |
   * CANCELLED | ALL. Each `{ id, status, school: { id, name }, applicant: { id, fullName,
   * email | null (account deleted) }, applicantPhone, hasKtp, requestedAt, decidedAt,
   * decidedBy: { id, fullName } | null, rejectionReason }`.
   */
  async principalApplications(schoolId, status = 'PENDING') {
    const answer = await api.get(`/governing-body/schools/${encodeURIComponent(schoolId)}/principal-applications`, { query: { status } });
    return answer?.applications ?? [];
  },

  /** An application's KTP while it waits (`GET .../principal-applications/:id/ktp`), as a Blob; NOT_FOUND once decided. */
  principalApplicationKtp: (applicationId) => requestBlob(`/governing-body/principal-applications/${encodeURIComponent(applicationId)}/ktp`),

  /**
   * Make the applicant the School's Principal (`POST .../:id/approve`): the others waiting
   * there are rejected on their own and every KTP is discarded. `{ application, message }`.
   *
   * @throws {ApiError} CONFLICT when decided, the account gone, a student, joined meanwhile
   *   or the School has a Principal now
   */
  approvePrincipalApplication: (applicationId) => api.post(`/governing-body/principal-applications/${encodeURIComponent(applicationId)}/approve`),

  /** Turn it down with a reason of 3-500 the applicant reads (`POST .../:id/reject`). */
  rejectPrincipalApplication: (applicationId, reason) =>
    api.post(`/governing-body/principal-applications/${encodeURIComponent(applicationId)}/reject`, { reason }),

  /**
   * Register a yayasan, perkumpulan or dinas (`POST /api/governing-body-registrations`),
   * multipart: `kind, name, skNumber?, street, village, district, city, province,
   * postalCode?, applicantPhone` and the files `ktp` and `proof`. 201 `{ registration,
   * message }`. Any signed-in account but a student; one waiting per applicant, five a day.
   *
   * @throws {ApiError} CONFLICT for one already waiting, a student, an SK number taken or
   *   too many today; EMAIL_NOT_VERIFIED; BAD_REQUEST for a field or a file
   */
  async submitRegistration(formData) {
    return api.post('/governing-body-registrations', formData);
  },

  /**
   * This account's own registrations, newest first (`GET .../mine`): each `{ id, kind,
   * name, skNumber, address, applicantPhone, status, rejectionReason, reviewedAt,
   * createdAt, governingBody: { id, name, code, subdomain } | null }`.
   */
  async listMine() {
    const answer = await api.get('/governing-body-registrations/mine');
    return answer?.registrations ?? [];
  },

  /**
   * What a Governing Body Code locates (`POST /governing-body-applications/lookup`):
   * `{ name, kind }` and nothing else. Shares the School Code's budget for wrong codes.
   *
   * @throws {ApiError} NOT_FOUND for an unknown or switched-off body (one answer);
   *   CONFLICT for a student; EMAIL_NOT_VERIFIED; TOO_MANY_REQUESTS
   */
  async lookup(code) {
    const answer = await api.post('/governing-body-applications/lookup', { code });
    return answer?.governingBody ?? null;
  },

  /**
   * Ask to be an admin through the code (`POST .../admins`), 201 `{ seat, message }`,
   * the seat as `listMySeats` gives it. The senior admin decides.
   *
   * @throws {ApiError} CONFLICT for one waiting or held there, a student, or three
   *   rejections there today; NOT_FOUND for the code
   */
  async apply(code) {
    const answer = await api.post('/governing-body-applications/admins', { code });
    return answer?.seat ?? null;
  },

  /**
   * Every seat of this account, newest first (`GET .../mine`): `{ id, status
   * (PENDING | ACTIVE | REJECTED | CANCELLED | LEFT), requestedAt, approvedAt, endedAt,
   * rejectionReason, endReason, governingBody: { name, kind } }`.
   */
  async listMySeats() {
    const answer = await api.get('/governing-body-applications/mine');
    return answer?.seats ?? [];
  },

  /** Take a waiting application back (`POST .../admins/:id/cancel`); never counts against the cap. */
  cancelApplication: (seatId) => api.post(`/governing-body-applications/admins/${encodeURIComponent(seatId)}/cancel`),
};

export default governingBodyService;
