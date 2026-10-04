import { describe, it, expect } from 'vitest';

import { fileSize, hostOf, isImage, isWebLink, opensInTab, youtubeEmbed } from './contentView';

describe('opensInTab / isImage - the backend INLINE_TYPES', () => {
  it('shows a PDF and the two image types in a tab, and saves the office files', () => {
    expect(['pdf', 'jpg', 'png'].map(opensInTab)).toEqual([true, true, true]);
    expect(['docx', 'pptx', undefined].map(opensInTab)).toEqual([false, false, false]);
  });
  it('previews only the images', () => {
    expect(isImage('PNG')).toBe(true);
    expect(isImage('pdf')).toBe(false);
  });
});

describe('fileSize', () => {
  it('says bytes under 1 KB as bytes', () => {
    expect(fileSize(512)).toBe('512 B');
  });
  it('uses the reader’s decimal mark', () => {
    expect(fileSize(1536, 'id')).toBe('1,5 KB');
    expect(fileSize(1536, 'en')).toBe('1.5 KB');
    expect(fileSize(10 * 1024 * 1024, 'en')).toBe('10 MB');
  });
  it('says nothing for a size it cannot read', () => {
    expect(fileSize(undefined)).toBe('');
  });
});

describe('youtubeEmbed', () => {
  it('builds the nocookie player for a parsed YouTube video', () => {
    expect(youtubeEmbed({ provider: 'YOUTUBE', videoId: 'dQw4w9WgXcQ' })).toBe('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0');
  });
  it('refuses another provider or a malformed id', () => {
    expect(youtubeEmbed({ provider: 'OTHER', videoId: null, url: 'https://vimeo.com/1' })).toBeNull();
    expect(youtubeEmbed({ provider: 'YOUTUBE', videoId: 'x"><script>' })).toBeNull();
  });
});

describe('hostOf / isWebLink', () => {
  it('names the site without www', () => {
    expect(hostOf('https://www.example.com/a/b')).toBe('example.com');
  });
  it('opens http(s) only', () => {
    expect(isWebLink('https://a.id')).toBe(true);
    expect(isWebLink('javascript:alert(1)')).toBe(false);
  });
});

describe('youtubeEmbed with the IFrame API', () => {
  it('adds enablejsapi and the page origin only when asked', () => {
    expect(youtubeEmbed({ provider: 'YOUTUBE', videoId: 'dQw4w9WgXcQ' }, { origin: 'http://localhost:5173' })).toBe(
      'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0&enablejsapi=1&origin=http%3A%2F%2Flocalhost%3A5173'
    );
  });
});
