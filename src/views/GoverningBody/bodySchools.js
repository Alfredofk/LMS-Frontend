/*
  What the Governing Body's Schools tab decides (backend ed0d304, governing-body
  ticket 05), kept out of the markup so it can be tested.

  - Creating: governingBody.schema.js `createSchoolsBody` - 1 to 10 rows, all or none,
    each a School Registration's fields without the phone and the KTP (`schoolRow`,
    school.schema.js `schoolFields`), as JSON. `durationYears` is sent for an SMK
    only, as the registration form does: every other type has one legal value the
    server fills in.
  - Refusals per row: a 400 names `schools.<i>.<field>` (validate.js joins the path
    with dots), a 409 an NPSN taken in `details.rows: [{ row, index, npsn }]`.
  - Fixing: `schoolPatchBody` - the name, the NPSN, the type and an SMK's duration,
    only what changed. A type changed to an SMK states its duration; one changed away
    from SMK sends none (the server sets the type's own).
*/

import { SCHOOL_TYPES, choosesDuration } from '../../constants/schoolTypes';
import {
  parseCoordinate,
  validateCity,
  validateCoordinate,
  validateDurationYears,
  validateNpsn,
  validateSchoolName,
  validateTimeZone,
} from '../../utils/validation';

/** At most this many Schools in one submission (governingBody.schema.js MAX_SCHOOLS_AT_ONCE). */
export const MAX_SCHOOLS_AT_ONCE = 10;

export const ROW_FIELDS = ['npsn', 'schoolName', 'schoolType', 'city', 'latitude', 'longitude', 'timeZone', 'durationYears'];

/** An empty card. `key` only keeps React's list steady; it is never sent. */
export const emptyRow = (key) => ({
  key,
  npsn: '',
  schoolName: '',
  schoolType: 'SMA',
  city: '',
  latitude: '',
  longitude: '',
  timeZone: '',
  durationYears: '',
});

/** Whether a card holds anything typed: the type alone, preset, is nothing. */
export const rowTouched = (row) => ['npsn', 'schoolName', 'city', 'latitude', 'longitude', 'timeZone', 'durationYears'].some((field) => String(row[field] ?? '').trim() !== '');

/** One card's mistakes, `{ field: { key, vars? } }`, empty when it may be sent. */
export function rowErrorsOf(row) {
  const errors = {};
  const put = (field, fail) => {
    if (fail) errors[field] = fail;
  };
  put('npsn', validateNpsn(row.npsn ?? ''));
  put('schoolName', validateSchoolName(row.schoolName ?? ''));
  put('city', validateCity(row.city ?? ''));
  put('latitude', validateCoordinate('latitude', row.latitude));
  put('longitude', validateCoordinate('longitude', row.longitude));
  put('timeZone', validateTimeZone(row.timeZone));
  put('durationYears', validateDurationYears(row.schoolType, row.durationYears));
  return errors;
}

/**
 * Two cards naming one NPSN, as the schema refuses them: the later one is marked,
 * `{ index: firstIndex }` (both counted from 0).
 */
export function repeatedNpsnsOf(rows) {
  const firstOf = new Map();
  const repeats = {};
  rows.forEach((row, index) => {
    const npsn = String(row.npsn ?? '').trim();
    if (!npsn) return;
    if (firstOf.has(npsn)) repeats[index] = firstOf.get(npsn);
    else firstOf.set(npsn, index);
  });
  return repeats;
}

/** Every card's mistakes at once: `{ index: { field: { key, vars? } } }`, only the cards with any. */
export function rowsErrorsOf(rows) {
  const all = {};
  const repeats = repeatedNpsnsOf(rows);
  rows.forEach((row, index) => {
    const errors = rowErrorsOf(row);
    if (!errors.npsn && repeats[index] !== undefined) errors.npsn = { key: 'gbs.new.error.npsnRepeat', vars: { row: repeats[index] + 1 } };
    if (Object.keys(errors).length) all[index] = errors;
  });
  return all;
}

/** The body of `POST /governing-body/schools`. */
export function createBodyOf(rows) {
  return {
    schools: rows.map((row) => {
      const school = {
        npsn: row.npsn.trim(),
        schoolName: row.schoolName.trim(),
        schoolType: row.schoolType,
        city: row.city.trim(),
        latitude: parseCoordinate(row.latitude),
        longitude: parseCoordinate(row.longitude),
        timeZone: row.timeZone,
      };
      if (choosesDuration(row.schoolType)) school.durationYears = Number(row.durationYears);
      return school;
    }),
  };
}

/**
 * A refusal laid on the cards: `{ rows: { index: { field: { key } | { text } } },
 * rowNumbers: [1-based] }`. A 400 keeps the server's own words, as `fieldErrorsFrom`
 * does; a 409's taken NPSNs read the registration's sentence.
 */
export function serverRowErrorsOf(err) {
  const rows = {};
  const put = (index, field, error) => {
    rows[index] = { ...rows[index], [field]: error };
  };

  if (err?.code === 'BAD_REQUEST' && Array.isArray(err.details)) {
    for (const issue of err.details) {
      const [head, index, field] = String(issue?.path ?? '').split('.');
      if (head !== 'schools' || !/^\d+$/.test(index ?? '') || !ROW_FIELDS.includes(field)) continue;
      put(Number(index), field, { text: issue.message });
    }
  }

  if (err?.code === 'CONFLICT' && Array.isArray(err.details?.rows)) {
    for (const entry of err.details.rows) {
      if (Number.isInteger(entry?.index)) put(entry.index, 'npsn', { key: 'reg.conflict.npsn' });
    }
  }

  const rowNumbers = Object.keys(rows)
    .map((index) => Number(index) + 1)
    .sort((a, b) => a - b);
  return { rows, rowNumbers };
}

/** Whether a School matches the search box: its name, NPSN or city. */
export function matchesSchool(school, needle) {
  const words = String(needle ?? '').trim().toLowerCase();
  if (!words) return true;
  return [school.name, school.npsn, school.city].some((value) => String(value ?? '').toLowerCase().includes(words));
}

/* ---- fixing one ---- */

/** The fix form's starting values, from the School as listed. */
export const fixFormOf = (school) => ({
  schoolName: school?.name ?? '',
  npsn: school?.npsn ?? '',
  schoolType: school?.schoolType ?? 'SMA',
  durationYears: choosesDuration(school?.schoolType) && school?.durationYears ? String(school.durationYears) : '',
});

export function fixErrorsOf(values) {
  const errors = {};
  const put = (field, fail) => {
    if (fail) errors[field] = fail;
  };
  put('schoolName', validateSchoolName(values.schoolName ?? ''));
  put('npsn', validateNpsn(values.npsn ?? ''));
  put('durationYears', validateDurationYears(values.schoolType, values.durationYears));
  return errors;
}

/** The PATCH body, only what changed; null when nothing did. */
export function fixPatchOf(school, values) {
  const patch = {};
  const name = values.schoolName.trim();
  const npsn = values.npsn.trim();
  if (name !== school.name) patch.schoolName = name;
  if (npsn !== school.npsn) patch.npsn = npsn;
  if (values.schoolType !== school.schoolType) patch.schoolType = values.schoolType;

  if (choosesDuration(values.schoolType)) {
    const years = Number(values.durationYears);
    if (patch.schoolType || years !== school.durationYears) patch.durationYears = years;
  }

  return Object.keys(patch).length ? patch : null;
}

/** A School's length in years as the list says it: an SMK's chosen one, otherwise the type's. */
export const durationOf = (school) => school?.durationYears ?? SCHOOL_TYPES[school?.schoolType]?.defaultDurationYears ?? null;
