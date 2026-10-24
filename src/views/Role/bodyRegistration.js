import { validatePhone } from '../../utils/validation';

/*
  Registering a Governing Body (backend b5cfffd, governingBody.schema.js
  `registrationBody`, governingBody.routes.js `registrationFiles`; owner 2026-10-24).
  Validators return keys, not sentences, as utils/validation.js does.

  - kind FOUNDATION | ASSOCIATION | GOVERNMENT; a name of 2-150;
  - since backend c79b56f (ticket 04b): the NPYP, six letters and digits in capitals,
    required of a foundation or an association; the Kemenkumham SK number (5-100 after
    trimming) optional for them; a government body gives neither - the schema refuses
    one given;
  - the full address: street 2-200, kelurahan or desa, kecamatan, kota or kabupaten
    and province 2-100 each, a postal code of five digits or none;
  - the applicant's phone (auth.schema.js `phone`);
  - the KTP, JPG or PNG of at most 2 MB, and the proof of office, PDF, JPG or PNG of
    at most 5 MB - the server reads the type from the bytes (upload.js `detectType`),
    so `typeOfBytes` does too, and a renamed file is refused here first.

  The province is chosen from the 38 (owner): the server takes free text, so one
  spelling per province keeps the column comparable.
*/

export const BODY_KINDS = ['FOUNDATION', 'ASSOCIATION', 'GOVERNMENT'];

/** The 38 provinces, as Kemendagri writes them (UU 29/2022 the newest, Papua Barat Daya). */
export const PROVINCES = [
  'Aceh',
  'Sumatera Utara',
  'Sumatera Barat',
  'Riau',
  'Kepulauan Riau',
  'Jambi',
  'Sumatera Selatan',
  'Kepulauan Bangka Belitung',
  'Bengkulu',
  'Lampung',
  'DKI Jakarta',
  'Jawa Barat',
  'Banten',
  'Jawa Tengah',
  'DI Yogyakarta',
  'Jawa Timur',
  'Bali',
  'Nusa Tenggara Barat',
  'Nusa Tenggara Timur',
  'Kalimantan Barat',
  'Kalimantan Tengah',
  'Kalimantan Selatan',
  'Kalimantan Timur',
  'Kalimantan Utara',
  'Sulawesi Utara',
  'Gorontalo',
  'Sulawesi Tengah',
  'Sulawesi Barat',
  'Sulawesi Selatan',
  'Sulawesi Tenggara',
  'Maluku',
  'Maluku Utara',
  'Papua',
  'Papua Barat',
  'Papua Barat Daya',
  'Papua Selatan',
  'Papua Tengah',
  'Papua Pegunungan',
];

/** Whether a kind carries the numbers - an NPYP, and an SK number if it has one: every kind but a government body. */
export const takesNumbers = (kind) => kind !== 'GOVERNMENT';

/** An NPYP as the server reads it: trimmed, in capitals. A space inside stays, and is refused. */
export const normaliseNpyp = (value) => String(value ?? '').trim().toUpperCase();

const NPYP_PATTERN = /^[A-Z0-9]{6}$/;

/** What is wrong with an NPYP, as `{ key }`, or null. `required` false lets an empty one pass. */
export function npypError(value, { required = true } = {}) {
  const npyp = normaliseNpyp(value);
  if (!npyp) return required ? { key: 'gbreg.npyp.required' } : null;
  if (!NPYP_PATTERN.test(npyp)) return { key: 'gbreg.npyp.format' };
  return null;
}

const text = (value) => String(value ?? '').trim();

/* A part of the address, or the name: required, `min`-`max` after trimming. */
const sized = (value, min, max, prefix) => {
  const length = text(value).length;
  if (length === 0) return { key: `${prefix}.required` };
  if (length < min) return { key: `${prefix}.short`, vars: { min } };
  if (length > max) return { key: `${prefix}.long`, vars: { max } };
  return null;
};

export const ADDRESS_FIELDS = [
  { name: 'street', max: 200 },
  { name: 'village', max: 100 },
  { name: 'district', max: 100 },
  { name: 'city', max: 100 },
];

/** The file types the server accepts per field, and their ceilings. */
export const FILE_RULES = {
  ktp: { maxBytes: 2 * 1024 * 1024, max: '2 MB', types: ['jpg', 'png'] },
  proof: { maxBytes: 5 * 1024 * 1024, max: '5 MB', types: ['pdf', 'jpg', 'png'] },
};

const SIGNATURES = {
  jpg: [0xff, 0xd8, 0xff],
  png: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  pdf: [0x25, 0x50, 0x44, 0x46, 0x2d],
};

/** A file's type from its first bytes, as upload.js `detectType` reads it: 'jpg' | 'png' | 'pdf' | null. */
export function typeOfBytes(bytes) {
  for (const [type, signature] of Object.entries(SIGNATURES)) {
    if (bytes.length >= signature.length && signature.every((byte, i) => bytes[i] === byte)) return type;
  }
  return null;
}

/** Reads a File's first bytes and answers its type (see `typeOfBytes`). */
export async function typeOfFile(file) {
  const head = new Uint8Array(await file.slice(0, 8).arrayBuffer());
  return typeOfBytes(head);
}

/** What is wrong with a file for `field` ('ktp' | 'proof'), given its detected type, or null. */
export function fileError(field, file, detectedType) {
  const rule = FILE_RULES[field];
  if (!file) return { key: `gbreg.${field}.required` };
  if (file.size > rule.maxBytes) return { key: `gbreg.${field}.tooLarge`, vars: { max: rule.max } };
  if (!rule.types.includes(detectedType)) return { key: `gbreg.${field}.type` };
  return null;
}

/** Field -> { key, vars } for every text field that is wrong; empty when nothing is. */
export function registrationErrors(values) {
  const errors = {};
  const set = (name, fail) => {
    if (fail) errors[name] = fail;
  };

  if (!BODY_KINDS.includes(values.kind)) errors.kind = { key: 'gbreg.kind.required' };
  set('name', sized(values.name, 2, 150, 'gbreg.name'));

  const sk = text(values.skNumber);
  if (takesNumbers(values.kind)) {
    set('npyp', npypError(values.npyp));
    /* The SK number is optional since c79b56f; one given still holds to 5-100. */
    if (sk && sk.length < 5) errors.skNumber = { key: 'gbreg.skNumber.short' };
    else if (sk.length > 100) errors.skNumber = { key: 'gbreg.skNumber.long' };
  }

  for (const field of ADDRESS_FIELDS) set(field.name, sized(values[field.name], 2, field.max, 'gbreg.address'));
  if (!PROVINCES.includes(values.province)) errors.province = { key: 'gbreg.province.required' };

  const postal = text(values.postalCode);
  if (postal && !/^\d{5}$/.test(postal)) errors.postalCode = { key: 'gbreg.postalCode.format' };

  set('applicantPhone', validatePhone(values.applicantPhone));
  return errors;
}

/**
 * The multipart body, as the schema reads it: trimmed text, the NPYP (in capitals) and
 * the SK number when given only for a kind that takes them, the postal code only when
 * given, then both files.
 */
export function registrationFormData(values, files) {
  const body = new FormData();
  body.append('kind', values.kind);
  body.append('name', text(values.name));
  if (takesNumbers(values.kind)) {
    body.append('npyp', normaliseNpyp(values.npyp));
    if (text(values.skNumber)) body.append('skNumber', text(values.skNumber));
  }
  for (const field of ADDRESS_FIELDS) body.append(field.name, text(values[field.name]));
  body.append('province', values.province);
  if (text(values.postalCode)) body.append('postalCode', text(values.postalCode));
  body.append('applicantPhone', text(values.applicantPhone));
  body.append('ktp', files.ktp);
  body.append('proof', files.proof);
  return body;
}

/**
 * What the link on /select-role and My Profile says, from this account's
 * registrations (newest first): 'WAITING' while the newest waits, 'REJECTED' with its
 * reason while the newest was turned down, else 'OPEN' - the link itself.
 */
export function registrationLineOf(registrations) {
  const newest = (registrations ?? [])[0] ?? null;
  if (newest?.status === 'PENDING') return { state: 'WAITING', name: newest.name, reason: null };
  if (newest?.status === 'REJECTED') return { state: 'REJECTED', name: newest.name, reason: newest.rejectionReason ?? null };
  return { state: 'OPEN', name: null, reason: null };
}
