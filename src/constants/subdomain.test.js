import { describe, expect, it } from 'vitest';

import { handoffCodeOf, mainUrl, schoolAddressOf, schoolUrl, subdomainLabelError, subdomainOf, subdomainsEnabled } from './subdomain';

// Rules from backend a577abd: school.schema.js subdomainBody, shared/subdomain.js.
const dev = { protocol: 'http:', port: '5173' };
const live = { protocol: 'https:', port: '' };

describe('subdomain - reading the address', () => {
  it('names the school label under the base domain, and nothing else', () => {
    expect(subdomainOf('sma1.localhost', 'localhost')).toBe('sma1');
    expect(subdomainOf('SMA1.Localhost', 'localhost')).toBe('sma1');
    expect(subdomainOf('localhost', 'localhost')).toBeNull();
    expect(subdomainOf('www.eduforid.id', 'eduforid.id')).toBeNull();
    expect(subdomainOf('a.b.eduforid.id', 'eduforid.id')).toBeNull();
    expect(subdomainOf('evil-eduforid.id', 'eduforid.id')).toBeNull();
    expect(subdomainOf('sma1.localhost', '')).toBeNull();
  });

  it('is off without a base domain', () => {
    expect(subdomainsEnabled('')).toBe(false);
    expect(subdomainsEnabled('localhost')).toBe(true);
  });
});

describe('subdomain - building addresses', () => {
  it('keeps the protocol and the port', () => {
    expect(schoolUrl('sma1', '/handoff', 'code=abc', dev, 'localhost')).toBe('http://sma1.localhost:5173/handoff#code=abc');
    expect(schoolUrl('sma1', '/', '', live, 'eduforid.id')).toBe('https://sma1.eduforid.id/');
    expect(mainUrl('/login', dev, 'localhost')).toBe('http://localhost:5173/login');
    expect(schoolAddressOf('sma1', live, 'eduforid.id')).toBe('sma1.eduforid.id');
    expect(schoolAddressOf('sma1', dev, '')).toBeNull();
  });

  it('reads the handoff code from the fragment', () => {
    expect(handoffCodeOf('#code=abc123')).toBe('abc123');
    expect(handoffCodeOf('code=abc123')).toBe('abc123');
    expect(handoffCodeOf('#other=1')).toBeNull();
    expect(handoffCodeOf('')).toBeNull();
  });
});

describe('subdomain - a label the admin types', () => {
  it('mirrors the server: a DNS label, not reserved, not the current one', () => {
    expect(subdomainLabelError('sman1malang')).toBeNull();
    expect(subdomainLabelError(' SMAN1Malang ')).toBeNull();
    expect(subdomainLabelError('a')).toBeNull();
    expect(subdomainLabelError('')).toBe('subdomain.error.required');
    expect(subdomainLabelError('-sma')).toBe('subdomain.error.pattern');
    expect(subdomainLabelError('sma-')).toBe('subdomain.error.pattern');
    expect(subdomainLabelError('sma_1')).toBe('subdomain.error.pattern');
    expect(subdomainLabelError('a'.repeat(64))).toBe('subdomain.error.pattern');
    expect(subdomainLabelError('a'.repeat(63))).toBeNull();
    expect(subdomainLabelError('admin')).toBe('subdomain.error.reserved');
    expect(subdomainLabelError('sma1', 'sma1')).toBe('subdomain.error.same');
  });
});
