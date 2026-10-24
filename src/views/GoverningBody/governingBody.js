/*
  What the Governing Body's page decides (backend b5cfffd, governing-body ticket 03),
  kept out of the markup so it can be tested. The body's view is governingBody.service.js
  `bodyView`: `kind` FOUNDATION | ASSOCIATION | GOVERNMENT, `skNumber` null for a
  government body, and the address in six parts, the postal code optional.
*/

import { normalisePhone, validatePhone } from '../../utils/validation';
import { ADDRESS_FIELDS, PROVINCES } from '../Role/bodyRegistration';

export const GOVERNING_BODY_KINDS = ['FOUNDATION', 'ASSOCIATION', 'GOVERNMENT'];

/** The dictionary key of a body's kind: Yayasan, Perkumpulan, Dinas. */
export const kindKeyOf = (kind) => (GOVERNING_BODY_KINDS.includes(kind) ? `gb.kind.${kind}` : null);

/**
 * The address as one line, in the order it is written on a letter: street,
 * kelurahan or desa, kecamatan, kota or kabupaten, then the province with the
 * postal code after it. Parts left empty are skipped.
 */
export function addressLineOf(address) {
  if (!address) return '';
  const clean = (value) => (typeof value === 'string' ? value.trim() : '');
  const province = [clean(address.province), clean(address.postalCode)].filter(Boolean).join(' ');
  return [clean(address.street), clean(address.village), clean(address.district), clean(address.city), province].filter(Boolean).join(', ');
}

/*
  The address and the phone, changed by any admin (backend 3d7d05a, `PATCH
  /governing-body`, governingBody.schema.js `profileBody`): the same rules as the
  registration's address - every part 2 to its maximum, the province one of the 38,
  the postal code five digits or none - and the phone optional, as `phone.nullable()`.
  Only what changed is sent; an emptied postal code or phone goes as null.
*/

/** The form's starting values, from the body's view. */
export function profileFormOf(body) {
  const address = body?.address ?? {};
  return {
    street: address.street ?? '',
    village: address.village ?? '',
    district: address.district ?? '',
    city: address.city ?? '',
    province: address.province ?? '',
    postalCode: address.postalCode ?? '',
    phone: body?.phone ?? '',
  };
}

const trimmed = (value) => String(value ?? '').trim();

/** Field -> { key, vars } for every field that is wrong; empty when nothing is. */
export function profileErrorsOf(form) {
  const errors = {};
  for (const field of ADDRESS_FIELDS) {
    const length = trimmed(form[field.name]).length;
    if (length === 0) errors[field.name] = { key: 'gbreg.address.required' };
    else if (length < 2) errors[field.name] = { key: 'gbreg.address.short', vars: { min: 2 } };
    else if (length > field.max) errors[field.name] = { key: 'gbreg.address.long', vars: { max: field.max } };
  }
  if (!PROVINCES.includes(form.province)) errors.province = { key: 'gbreg.province.required' };
  const postal = trimmed(form.postalCode);
  if (postal && !/^\d{5}$/.test(postal)) errors.postalCode = { key: 'gbreg.postalCode.format' };
  const phone = validatePhone(form.phone, { optional: true });
  if (phone) errors.phone = phone;
  return errors;
}

/** The PATCH body - only the fields that differ from the body's - or null when nothing does. */
export function profilePatchOf(body, form) {
  const saved = profileFormOf(body);
  const patch = {};
  for (const field of ADDRESS_FIELDS) {
    if (trimmed(form[field.name]) !== saved[field.name]) patch[field.name] = trimmed(form[field.name]);
  }
  if (form.province !== saved.province) patch.province = form.province;
  const postal = trimmed(form.postalCode);
  if (postal !== saved.postalCode) patch.postalCode = postal || null;
  const phone = normalisePhone(form.phone);
  if (phone !== saved.phone) patch.phone = phone || null;
  return Object.keys(patch).length > 0 ? patch : null;
}

/*
  The admins (backend 3d7d05a, `GET /governing-body/admins`): the sitting admins,
  the senior first (`senior`), and the caller marked `you`. Leaving is refused to
  the last admin; when the senior leaves, the next by approval is senior.
*/

/** The senior admin's row, or null. */
export const seniorOf = (admins) => (Array.isArray(admins) ? admins.find((admin) => admin.senior) ?? null : null);

/**
 * What leaving means for the caller: 'LAST' (refused - nobody else sits),
 * 'SENIOR' with `next`, the admin who becomes senior, or 'OPEN'.
 */
export function leaveStateOf(admins) {
  const list = Array.isArray(admins) ? admins : [];
  const others = list.filter((admin) => !admin.you);
  if (others.length === 0) return { state: 'LAST' };
  const own = list.find((admin) => admin.you);
  if (own?.senior) return { state: 'SENIOR', next: others[0] };
  return { state: 'OPEN' };
}
