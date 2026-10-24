import { describe, expect, it } from 'vitest';

import { normaliseBodyCode, seatLinesOf, validateBodyCode } from './bodyApplication';

// governingBody.schema.js `code` (backend 3d7d05a): trimmed, upper case, /^[A-Z2-9]{8}$/.
describe('governing body application - the code', () => {
  it('reads the code as the server does', () => {
    expect(normaliseBodyCode('  qulzb443 ')).toBe('QULZB443');
    expect(validateBodyCode(' qulzb443 ')).toBeNull();
  });

  it('asks for one, of 8 letters and digits without 0 and 1', () => {
    expect(validateBodyCode('   ')).toEqual({ key: 'gbapp.code.required' });
    expect(validateBodyCode('QULZB44')).toEqual({ key: 'gbapp.code.format' });
    expect(validateBodyCode('QULZB4433')).toEqual({ key: 'gbapp.code.format' });
    expect(validateBodyCode('QULZB440')).toEqual({ key: 'gbapp.code.format' });
    expect(validateBodyCode('QULZB441')).toEqual({ key: 'gbapp.code.format' });
    expect(validateBodyCode('QUL-B443')).toEqual({ key: 'gbapp.code.format' });
  });
});

// governingBody.admins.js ownSeatView, newest first.
describe('governing body application - my seats', () => {
  const body = (name, kind = 'FOUNDATION') => ({ name, kind });
  const seat = (id, status, governingBody, extra = {}) => ({ id, status, governingBody, rejectionReason: null, endReason: null, ...extra });

  it('says a waiting application, which can be taken back', () => {
    expect(seatLinesOf([seat('s1', 'PENDING', body('Yayasan A'))])).toEqual([{ id: 's1', name: 'Yayasan A', state: 'WAITING' }]);
  });

  it('says a rejection with the reason, and a removal with why it ended', () => {
    expect(seatLinesOf([seat('s1', 'REJECTED', body('Yayasan A'), { rejectionReason: 'Bukan pengurus' })])).toEqual([
      { id: 's1', name: 'Yayasan A', state: 'REJECTED', reason: 'Bukan pengurus' },
    ]);
    expect(seatLinesOf([seat('s1', 'LEFT', body('Yayasan A'), { endReason: 'Sudah tidak menjabat' })])).toEqual([
      { id: 's1', name: 'Yayasan A', state: 'REMOVED', reason: 'Sudah tidak menjabat' },
    ]);
  });

  it('says nothing of a seat held, a cancelled application or a plain leave', () => {
    expect(seatLinesOf([seat('s1', 'ACTIVE', body('A')), seat('s2', 'CANCELLED', body('B')), seat('s3', 'LEFT', body('C'))])).toEqual([]);
  });

  it('reads only the newest seat at each body', () => {
    const lines = seatLinesOf([
      seat('s3', 'CANCELLED', body('Yayasan A')),
      seat('s2', 'REJECTED', body('Yayasan A'), { rejectionReason: 'lama' }),
      seat('s1', 'PENDING', body('Yayasan A', 'ASSOCIATION')),
    ]);
    expect(lines).toEqual([{ id: 's1', name: 'Yayasan A', state: 'WAITING' }]);
  });

  it('takes no list as none', () => {
    expect(seatLinesOf(undefined)).toEqual([]);
  });
});
