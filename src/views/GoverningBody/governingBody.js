/*
  What the Governing Body's page decides (backend b5cfffd, governing-body ticket 03),
  kept out of the markup so it can be tested. The body's view is governingBody.service.js
  `bodyView`: `kind` FOUNDATION | ASSOCIATION | GOVERNMENT, `skNumber` null for a
  government body, and the address in six parts, the postal code optional.
*/

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
