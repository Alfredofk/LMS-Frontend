import { describe, expect, it } from 'vitest';

import { waNumber, waLink, telLink } from './contact.js';

describe('waNumber — a stored phone as wa.me wants it', () => {
  it.each([
    ['08123456789', '628123456789'],
    ['+628123456789', '628123456789'],
    ['628123456789', '628123456789'],
    ['0812 3456-789', '628123456789'],
    ['', null],
    [null, null],
  ])('%j → %j', (value, expected) => {
    expect(waNumber(value)).toBe(expected);
  });
});

describe('links', () => {
  it('builds wa.me and tel: links, and nothing without a number', () => {
    expect(waLink('08123456789')).toBe('https://wa.me/628123456789');
    expect(telLink('+628123456789')).toBe('tel:+628123456789');
    expect(waLink(null)).toBeNull();
    expect(telLink('')).toBeNull();
  });
});
