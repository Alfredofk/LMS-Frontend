/*
  Reaching a person from a number or an address the backend gave (GET /members/:id,
  backend a9ed505). The number is stored as typed, minus spaces and dashes
  (auth.schema.js `phone`): "08123456789", "+628123456789" or "628123456789".
*/

/** The number a wa.me link wants: digits only, international, no plus. Null when there is none. */
export function waNumber(phone) {
  const digits = String(phone ?? '').replace(/[^\d+]/g, '');
  if (!digits) return null;
  if (digits.startsWith('+')) return digits.slice(1).replace(/\D/g, '') || null;
  if (digits.startsWith('0')) return `62${digits.slice(1)}`;
  return digits.replace(/\D/g, '');
}

export const waLink = (phone) => {
  const number = waNumber(phone);
  return number ? `https://wa.me/${number}` : null;
};

export const telLink = (phone) => (phone ? `tel:${String(phone).replace(/[^\d+]/g, '')}` : null);
