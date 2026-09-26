/*
  The browser's copy of the backend's field rules, checked against the backend.

  `validation.js` claims to restate the server's zod "rule for rule". Until this
  file that was a claim nobody had checked. Every expectation below was taken by
  READING the zod schema it cites — `LMS-Backend` is read-only here, so nothing in
  it is imported or run — which makes each `describe` a statement of the form
  "the browser refuses exactly what the server refuses".

  When a schema in the backend changes, the test that cites it is the one that
  should start failing. If it does not, the citation is stale: fix the test first,
  then the validator.

  Two rules here are deliberately NOT parity, and say so where they are tested:
  the email shape is an approximation of zod's, and a future birth date is refused
  only in the browser. Everything else is meant to match exactly.
*/

import { describe, it, expect } from 'vitest';

import {
  MIN_PASSWORD,
  MAX_PASSWORD_BYTES,
  validatePassword,
  passwordChecklist,
  validateEmail,
  validateFullName,
  normaliseSchoolCode,
  validateSchoolCode,
  validateNisn,
  validateNip,
  validateNuptk,
  validateTeacherIds,
  teacherIdErrors,
  validateChildFullName,
  validateRelationship,
  validateGradeLevel,
  validateBirthDate,
  validateNpsn,
  validateSchoolName,
  validateCity,
  validateApplicantPhone,
  validateDurationYears,
  validateKtpFile,
  fieldErrorsFrom,
  nestedFieldErrors,
  validateAcademicYearLabel,
  validateDateRange,
  validateClassName,
  confirmsName,
  childErrors,
  childPayload,
  yearDatesMatchLabel,
  semesterFits,
  validateLeaveReason,
  validateLetterFile,
  monthsBetween,
  isUsualYearLength,
} from './validation.js';
import { gradesFor, maxGradeFor } from '../constants/schoolTypes.js';

/* The key a validator answers with, or null when the value is accepted. */
const keyOf = (result) => (result === null ? null : result.key);

const digits = (n) => '1'.repeat(n);

/* ======================================================================== */
/*  Accounts — LMS-Backend/src/modules/auth/auth.schema.js                  */
/* ======================================================================== */

describe('password — auth.schema.js:14-38', () => {
  it('uses the same two numbers as the server', () => {
    expect(MIN_PASSWORD).toBe(8); // :14
    expect(MAX_PASSWORD_BYTES).toBe(72); // :15
  });

  it('accepts eight characters carrying all four classes', () => {
    expect(validatePassword('Abcdef1!')).toBeNull();
  });

  it.each([
    ['', 'validation.password.required'],
    ['Abcde1!', 'validation.password.min'], // seven
    ['abcdef1!', 'validation.password.upper'],
    ['ABCDEF1!', 'validation.password.lower'],
    ['Abcdefg!', 'validation.password.digit'],
    ['Abcdefg1', 'validation.password.symbol'],
  ])('refuses %j with %s', (value, key) => {
    expect(keyOf(validatePassword(value))).toBe(key);
  });

  it('does not count whitespace as a symbol — a trailing space is usually a typo', () => {
    // /[^A-Za-z0-9\s]/ on both sides.
    expect(keyOf(validatePassword('Abcdef1 '))).toBe('validation.password.symbol');
  });

  it('caps bytes, not characters, because bcrypt reads only 72 bytes', () => {
    const ascii72 = 'Aa1!' + 'x'.repeat(68);
    expect(new TextEncoder().encode(ascii72).length).toBe(72);
    expect(validatePassword(ascii72)).toBeNull();
    expect(keyOf(validatePassword(ascii72 + 'x'))).toBe('validation.password.maxBytes');

    // 39 characters, 74 bytes: é is two bytes in UTF-8. A character count would
    // wave this through and bcrypt would quietly hash only part of it.
    const accented = 'Aa1!' + 'é'.repeat(35);
    expect(accented.length).toBe(39);
    expect(keyOf(validatePassword(accented))).toBe('validation.password.maxBytes');
  });

  it('lists the same four classes as the checklist the form draws', () => {
    const rules = passwordChecklist('Abcdef1!');
    expect(rules.map((r) => r.key)).toEqual([
      'validation.rule.min',
      'validation.rule.upper',
      'validation.rule.lower',
      'validation.rule.digit',
      'validation.rule.symbol',
    ]);
    expect(rules.every((r) => r.met)).toBe(true);
    expect(passwordChecklist('').every((r) => !r.met)).toBe(true);
  });
});

describe('email — auth.schema.js:41-44', () => {
  /*
    NOT exact parity. The server uses zod's own z.email(); this is a simpler shape
    check that catches the common mistakes. Only the uncontroversial cases are
    pinned here — an exotic address the two might disagree on is the server's to
    judge, and it answers with its own message when it does.
  */
  it('accepts an ordinary address', () => {
    expect(validateEmail('budi@sekolah.sch.id')).toBeNull();
  });

  it.each([
    ['', 'validation.email.required'],
    ['   ', 'validation.email.required'],
    ['budi', 'validation.email.invalid'],
    ['budi@', 'validation.email.invalid'],
    ['budi @sekolah.id', 'validation.email.invalid'],
  ])('refuses %j with %s', (value, key) => {
    expect(keyOf(validateEmail(value))).toBe(key);
  });

  it('caps the length at 254, as .max(254) does', () => {
    const at = (total) => 'a'.repeat(total - '@b.id'.length) + '@b.id';
    expect(at(254).length).toBe(254);
    expect(validateEmail(at(254))).toBeNull();
    expect(keyOf(validateEmail(at(255)))).toBe('validation.email.invalid');
  });
});

describe('account full name — auth.schema.js:46-50', () => {
  it.each([
    ['Al', null], // min 2
    ['x'.repeat(120), null], // max 120
    ['  Budi Santoso  ', null], // trimmed first
    ['', 'validation.fullName.required'],
    ['   ', 'validation.fullName.required'],
    [' A ', 'validation.fullName.short'],
    ['x'.repeat(121), 'validation.fullName.long'],
  ])('%j → %s', (value, key) => {
    expect(keyOf(validateFullName(value))).toBe(key);
  });
});

/* ======================================================================== */
/*  Joining a school — LMS-Backend/src/modules/membership/membership.schema.js */
/* ======================================================================== */

describe('School Code — membership.schema.js:25-29', () => {
  it('folds case and trims before checking, as .trim().toUpperCase() does', () => {
    expect(normaliseSchoolCode('  dbgkh7xt ')).toBe('DBGKH7XT');
    expect(normaliseSchoolCode(null)).toBe('');
    expect(validateSchoolCode('dbgkh7xt')).toBeNull();
  });

  it('accepts a real code — the one Bintang Jaya Supreme was issued', () => {
    expect(validateSchoolCode('DBGKH7XT')).toBeNull();
  });

  it.each([
    ['', 'validation.schoolCode.required'],
    ['DBGKH7X', 'validation.schoolCode.format'], // seven
    ['DBGKH7XTA', 'validation.schoolCode.format'], // nine
    ['DBGKH0XT', 'validation.schoolCode.format'], // 0 is outside 2-9
    ['DBGKH1XT', 'validation.schoolCode.format'], // 1 is outside 2-9
    ['DBGK-7XT', 'validation.schoolCode.format'],
  ])('refuses %j with %s', (value, key) => {
    expect(keyOf(validateSchoolCode(value))).toBe(key);
  });

  it('ACCEPTS O and I — the regex is [A-Z2-9], on both sides', () => {
    /*
      The generator never produces them (school.service.js:32 has no O and no I),
      but neither validator refuses them: A-Z includes both. So a code containing
      one is well-formed, reaches the server, and comes back 404 as an unknown
      code. That is consistent rather than broken — and it is pinned here because
      it is easy to misremember the alphabet as the validation rule.
    */
    expect(validateSchoolCode('DBGKHOXT')).toBeNull();
    expect(validateSchoolCode('DBGKHIXT')).toBeNull();
  });
});

describe('NISN — membership.schema.js:44', () => {
  it.each([
    ['0012345678', null],
    [' 0012345678 ', null],
    ['', 'validation.nisn.required'],
    ['001234567', 'validation.nisn.format'], // nine
    ['00123456789', 'validation.nisn.format'], // eleven
    ['00123A5678', 'validation.nisn.format'],
  ])('%j → %s', (value, key) => {
    expect(keyOf(validateNisn(value))).toBe(key);
  });
});

describe('NIP — membership.schema.js:45', () => {
  it('is optional on its own — the pair rule asks for one of NIP or NUPTK', () => {
    expect(validateNip('')).toBeNull();
    expect(validateNip(undefined)).toBeNull();
  });

  it.each([
    [digits(9), null], // NIP lama, before 2009
    [digits(18), null], // the current format
    [digits(8), 'validation.nip.format'],
    [digits(19), 'validation.nip.format'],
    ['19870123A01', 'validation.nip.format'],
  ])('%j → %s', (value, key) => {
    expect(keyOf(validateNip(value))).toBe(key);
  });
});

describe('NUPTK — membership.schema.js:46', () => {
  it.each([
    ['', null],
    [digits(16), null],
    [digits(15), 'validation.nuptk.format'],
    [digits(17), 'validation.nuptk.format'],
  ])('%j → %s', (value, key) => {
    expect(keyOf(validateNuptk(value))).toBe(key);
  });
});

describe('NIP or NUPTK — the refinement at membership.schema.js:57-62', () => {
  it.each([
    [digits(9), '', null],
    ['', digits(16), null],
    [digits(18), digits(16), null],
    ['', '', 'validation.teacherIds.required'],
    ['   ', '   ', 'validation.teacherIds.required'],
  ])('nip %j, nuptk %j → %s', (nip, nuptk, key) => {
    expect(keyOf(validateTeacherIds(nip, nuptk))).toBe(key);
  });
});

describe('teacherIdErrors — both boxes, as the two teacher forms show them', () => {
  const keys = (nip, nuptk) => {
    const { nip: a, nuptk: b } = teacherIdErrors(nip, nuptk);
    return [keyOf(a), keyOf(b)];
  };

  it('accepts either number, or both', () => {
    expect(keys(digits(18), '')).toEqual([null, null]);
    expect(keys('', digits(16))).toEqual([null, null]);
    expect(keys(digits(9), digits(16))).toEqual([null, null]);
  });

  it('asks for one of them on the NIP box when both are empty', () => {
    expect(keys('', '')).toEqual(['validation.teacherIds.required', null]);
  });

  it('prefers a shape complaint over "give one" when a number was attempted', () => {
    /* A NUPTK one digit short is a typo, not an absence. */
    expect(keys('', digits(15))).toEqual([null, 'validation.nuptk.format']);
    expect(keys(digits(8), '')).toEqual(['validation.nip.format', null]);
    expect(keys(digits(8), digits(15))).toEqual(['validation.nip.format', 'validation.nuptk.format']);
  });
});

describe('guardian: child full name — membership.schema.js:48', () => {
  /*
    3 to 150, not the account name's 2 to 120. Reusing validateFullName here
    would accept a two-letter name the server refuses and refuse a long one it
    accepts — wrong at both ends. This is the test that keeps them apart.
  */
  it.each([
    ['Ali', null],
    ['x'.repeat(150), null],
    ['', 'validation.fullName.required'],
    ['Al', 'validation.fullName.short'],
    ['x'.repeat(151), 'validation.fullName.long'],
  ])('%j → %s', (value, key) => {
    expect(keyOf(validateChildFullName(value))).toBe(key);
  });

  it('differs from the account name rule at both ends, on purpose', () => {
    expect(validateFullName('Al')).toBeNull();
    expect(validateChildFullName('Al')).not.toBeNull();
    expect(validateFullName('x'.repeat(150))).not.toBeNull();
    expect(validateChildFullName('x'.repeat(150))).toBeNull();
  });
});

describe('guardian: relationship — membership.schema.js:86', () => {
  it.each([
    ['Ibu', null],
    ['Nenek', null],
    ['x'.repeat(50), null],
    ['', 'validation.relationship.required'],
    ['Ay', 'validation.relationship.short'],
    ['x'.repeat(51), 'validation.relationship.long'],
  ])('%j → %s', (value, key) => {
    expect(keyOf(validateRelationship(value))).toBe(key);
  });
});

describe('grade level — membership.schema.js:78 and shared/schoolType.js:54-66', () => {
  it.each([
    ['SD', 1, 6],
    ['SMP', 7, 9],
    ['SMA', 10, 12],
    ['SMK', 10, 12],
  ])('%s accepts %i to %i and nothing either side', (type, min, max) => {
    expect(validateGradeLevel(min, type)).toBeNull();
    expect(validateGradeLevel(max, type)).toBeNull();
    expect(keyOf(validateGradeLevel(min - 1, type))).toBe('validation.gradeLevel.range');
    expect(keyOf(validateGradeLevel(max + 1, type))).toBe('validation.gradeLevel.range');
  });

  it('runs a four-year SMK to 13, and only a four-year SMK', () => {
    /*
      This test used to say the opposite. The zod capped every grade at 12, so
      the server refused 13 before maxGradeFor was ever asked, and the browser
      matched what actually happened. Backend 60ea459 raised the zod to 13 and
      left the per-school decision to maxGradeFor (shared/schoolType.js:54-58),
      and the School Code lookup started carrying durationYears
      (membership.service.js:87) — which is what this decision needs.
    */
    expect(validateGradeLevel(13, 'SMK', 4)).toBeNull();
    expect(keyOf(validateGradeLevel(14, 'SMK', 4))).toBe('validation.gradeLevel.range');
    expect(keyOf(validateGradeLevel(13, 'SMK', 3))).toBe('validation.gradeLevel.range');
    expect(keyOf(validateGradeLevel(13, 'SMA', 4))).toBe('validation.gradeLevel.range'); // only SMK chooses
  });

  it('names the right ceiling when it refuses', () => {
    expect(validateGradeLevel(14, 'SMK', 4).vars).toEqual({ min: 10, max: 13 });
    expect(validateGradeLevel(13, 'SMK', 3).vars).toEqual({ min: 10, max: 12 });
  });

  it('falls back to the ordinary ceiling when the duration is unknown', () => {
    /* A lookup from before 60ea459 carries no durationYears. Offering 13 on a
       guess is how a request earns a 400. */
    expect(keyOf(validateGradeLevel(13, 'SMK'))).toBe('validation.gradeLevel.range');
    expect(keyOf(validateGradeLevel(13, 'SMK', undefined))).toBe('validation.gradeLevel.range');
  });

  it('offers the same grades in the selector as it accepts', () => {
    expect(gradesFor('SMK', 4)).toEqual([10, 11, 12, 13]);
    expect(gradesFor('SMK', 3)).toEqual([10, 11, 12]);
    expect(gradesFor('SMK')).toEqual([10, 11, 12]);
    expect(gradesFor('SD')).toEqual([1, 2, 3, 4, 5, 6]);
    expect(gradesFor('SMU')).toEqual([]);
    expect(maxGradeFor('SMK', 4)).toBe(13);
    expect(maxGradeFor('SMU', 4)).toBeNull();
  });

  it('takes the value as a form gives it — a string', () => {
    expect(validateGradeLevel('10', 'SMA')).toBeNull();
    expect(keyOf(validateGradeLevel('10.5', 'SMA'))).toBe('validation.gradeLevel.range');
  });

  it('asks for a grade when there is none, or no school type to judge it by', () => {
    expect(keyOf(validateGradeLevel('', 'SMA'))).toBe('validation.gradeLevel.required');
    expect(keyOf(validateGradeLevel(10, 'SMU'))).toBe('validation.gradeLevel.required');
  });
});

describe('birth date — membership.schema.js:75', () => {
  it('accepts a parseable date in the past', () => {
    expect(validateBirthDate('2010-05-17')).toBeNull();
  });

  it.each([
    ['', 'validation.birthDate.required'],
    ['bukan tanggal', 'validation.birthDate.invalid'],
  ])('%j → %s', (value, key) => {
    expect(keyOf(validateBirthDate(value))).toBe(key);
  });

  it('refuses a future date — STRICTER than the server, deliberately', () => {
    /*
      z.coerce.date() accepts any date Date can parse, the future included. The
      browser adds this one rule of its own because nobody is born next year,
      and saying so before submitting beats a request that succeeds with nonsense.
    */
    expect(keyOf(validateBirthDate('2999-01-01'))).toBe('validation.birthDate.future');
  });
});

/* ======================================================================== */
/*  Founding a school — LMS-Backend/src/modules/school/school.schema.js     */
/* ======================================================================== */

describe('NPSN — school.schema.js:14', () => {
  it.each([
    ['12354678', null], // Bintang Jaya Supreme's
    [' 12354678 ', null],
    ['', 'validation.npsn.required'],
    ['1235467', 'validation.npsn.format'],
    ['123546789', 'validation.npsn.format'],
    ['1235467A', 'validation.npsn.format'],
  ])('%j → %s', (value, key) => {
    expect(keyOf(validateNpsn(value))).toBe(key);
  });
});

describe('school name — school.schema.js:30', () => {
  it.each([
    ['SMA', null],
    ['x'.repeat(150), null],
    ['', 'validation.schoolName.required'],
    ['SD', 'validation.schoolName.short'],
    ['x'.repeat(151), 'validation.schoolName.long'],
  ])('%j → %s', (value, key) => {
    expect(keyOf(validateSchoolName(value))).toBe(key);
  });
});

describe('city — school.schema.js:32', () => {
  it.each([
    ['Bogor', null],
    ['Xy', null],
    ['x'.repeat(100), null],
    ['', 'validation.city.required'],
    ['X', 'validation.city.short'],
    ['x'.repeat(101), 'validation.city.long'],
  ])('%j → %s', (value, key) => {
    expect(keyOf(validateCity(value))).toBe(key);
  });
});

describe('applicant phone — school.schema.js:22-25', () => {
  it('strips spaces and dashes first, as the server preprocess does', () => {
    expect(validateApplicantPhone('0812 3456 7890')).toBeNull();
    expect(validateApplicantPhone('0812-3456-7890')).toBeNull();
  });

  it.each([
    ['+6281234567890', null],
    [digits(8), null],
    [digits(15), null],
    ['', 'validation.phone.required'],
    [digits(7), 'validation.phone.format'],
    [digits(16), 'validation.phone.format'],
    ['0812abc7890', 'validation.phone.format'],
    ['62+81234567', 'validation.phone.format'], // + only at the front
  ])('%j → %s', (value, key) => {
    expect(keyOf(validateApplicantPhone(value))).toBe(key);
  });
});

describe('duration — school.schema.js:34-60 and shared/schoolType.js:20-25', () => {
  it('makes an SMK choose, and choose 3 or 4', () => {
    expect(keyOf(validateDurationYears('SMK', ''))).toBe('validation.duration.required');
    expect(validateDurationYears('SMK', 3)).toBeNull();
    expect(validateDurationYears('SMK', '4')).toBeNull();
    expect(keyOf(validateDurationYears('SMK', 5))).toBe('validation.duration.invalid');
  });

  it('asks nothing of the other three — the form does not send the field for them', () => {
    /*
      The server fills in their single legal value and REFUSES a different one
      (:52-60). So the right behaviour for SD, SMP and SMA is not to send
      durationYears at all, which SchoolRegistrationForm does; this validator
      stepping aside is what lets it.
    */
    for (const type of ['SD', 'SMP', 'SMA']) {
      expect(validateDurationYears(type, '')).toBeNull();
    }
  });
});

describe('KTP file — school.routes.js:32', () => {
  const MB = 1024 * 1024;

  it('takes a JPEG or PNG up to 2 MB', () => {
    expect(validateKtpFile({ size: 2 * MB, type: 'image/png' })).toBeNull();
    expect(validateKtpFile({ size: 150_000, type: 'image/jpeg' })).toBeNull();
  });

  it.each([
    [null, 'validation.ktp.required'],
    [{ size: 2 * MB + 1, type: 'image/png' }, 'validation.ktp.tooLarge'],
    [{ size: 150_000, type: 'application/pdf' }, 'validation.ktp.type'],
    [{ size: 150_000, type: 'image/webp' }, 'validation.ktp.type'],
  ])('%j → %s', (file, key) => {
    expect(keyOf(validateKtpFile(file))).toBe(key);
  });
});

/* ======================================================================== */
/*  The calendar and classes — LMS-Backend/src/modules/academics/academics.schema.js */
/* ======================================================================== */

describe('academic year label — academics.schema.js:10-16', () => {
  it.each([
    ['2026/2027', null],
    [' 2026/2027 ', null], // .trim() first
    ['', 'validation.academicYear.required'],
    ['2026-2027', 'validation.academicYear.format'],
    ['26/27', 'validation.academicYear.format'],
    ['2026/27', 'validation.academicYear.format'],
    ['2026/2028', 'validation.academicYear.sequence'], // the refine: second = first + 1
    ['2027/2026', 'validation.academicYear.sequence'],
    ['2026/2026', 'validation.academicYear.sequence'],
  ])('%j → %s', (value, key) => {
    expect(keyOf(validateAcademicYearLabel(value))).toBe(key);
  });
});

describe('date range — the startDate < endDate refine on year and semester', () => {
  const keys = (start, end) => {
    const { start: a, end: b } = validateDateRange(start, end);
    return [keyOf(a), keyOf(b)];
  };

  it('accepts an end strictly after the start', () => {
    expect(keys('2026-07-13', '2027-06-30')).toEqual([null, null]);
  });

  it('refuses the same day, and puts it on the end date as the schema does', () => {
    expect(keys('2026-07-13', '2026-07-13')).toEqual([null, 'validation.date.order']);
    expect(keys('2027-06-30', '2026-07-13')).toEqual([null, 'validation.date.order']);
  });

  it('asks for both, box by box', () => {
    expect(keys('', '')).toEqual(['validation.date.required', 'validation.date.required']);
    expect(keys('2026-07-13', '')).toEqual([null, 'validation.date.required']);
    expect(keys('bukan tanggal', '2027-06-30')).toEqual(['validation.date.invalid', null]);
  });
});

describe('class name — academics.schema.js:51, trim().min(1).max(50)', () => {
  it.each([
    ['X IPA 1', null],
    ['7A', null],
    ['x'.repeat(50), null],
    ['x'.repeat(51), 'validation.className.long'],
    ['', 'validation.className.required'],
    ['   ', 'validation.className.required'],
  ])('%j → %s', (value, key) => {
    expect(keyOf(validateClassName(value))).toBe(key);
  });
});

/* ======================================================================== */
/*  Reading the server's own verdict                                        */
/* ======================================================================== */

describe('fieldErrorsFrom — the zod issues the server sends back', () => {
  it('maps the first path segment to the first message for that field', () => {
    const details = [
      { path: 'npsn', message: 'NPSN must be exactly 8 digits' },
      { path: 'npsn', message: 'a second complaint about the same field' },
      { path: 'city', message: 'City is required' },
    ];
    expect(fieldErrorsFrom(details, ['npsn', 'city'])).toEqual({
      npsn: 'NPSN must be exactly 8 digits',
      city: 'City is required',
    });
  });

  it('drops anything the form does not own', () => {
    const details = [{ path: 'durationYears', message: 'An SMK runs 3 or 4 years' }];
    expect(fieldErrorsFrom(details, ['npsn'])).toEqual({});
  });

  it('answers an empty object to anything that is not a list', () => {
    expect(fieldErrorsFrom(undefined, ['npsn'])).toEqual({});
    expect(fieldErrorsFrom({ path: 'npsn' }, ['npsn'])).toEqual({});
  });
});

describe('nestedFieldErrors — the same, for the membership bodies', () => {
  it('reads the LAST path segment, where the nested bodies name the box', () => {
    const details = [
      { path: 'teacher.nip', message: 'Give a NIP or a NUPTK' },
      { path: 'guardian.childNisn', message: 'NISN must be 10 digits' },
    ];
    expect(nestedFieldErrors(details, ['nip', 'nuptk', 'childNisn'])).toEqual({
      nip: 'Give a NIP or a NUPTK',
      childNisn: 'NISN must be 10 digits',
    });
  });

  it('is what fieldErrorsFrom cannot do: the first segment names a role, not a box', () => {
    const details = [{ path: 'teacher.nip', message: 'Give a NIP or a NUPTK' }];
    expect(fieldErrorsFrom(details, ['nip'])).toEqual({});
    expect(nestedFieldErrors(details, ['nip'])).toEqual({ nip: 'Give a NIP or a NUPTK' });
  });

  it('drops boxes it does not own, and anything that is not a list', () => {
    expect(nestedFieldErrors([{ path: 'student.nisn', message: 'x' }], ['nip'])).toEqual({});
    expect(nestedFieldErrors(undefined, ['nip'])).toEqual({});
  });
});

describe("confirmsName — typing the school before leaving it (the app's own rule, not the server's)", () => {
  it('accepts the name whatever its capitals and spacing', () => {
    expect(confirmsName('SMA Negeri 1 Contoh', 'SMA Negeri 1 Contoh')).toBe(true);
    expect(confirmsName('  sma negeri 1   contoh ', 'SMA Negeri 1 Contoh')).toBe(true);
  });

  it('refuses anything short of the whole name', () => {
    expect(confirmsName('SMA Negeri 1', 'SMA Negeri 1 Contoh')).toBe(false);
    expect(confirmsName('SMA Negeri 1 Contoh.', 'SMA Negeri 1 Contoh')).toBe(false);
    expect(confirmsName('', 'SMA Negeri 1 Contoh')).toBe(false);
  });

  it('never confirms against a school with no name', () => {
    expect(confirmsName('', '')).toBe(false);
    expect(confirmsName('', null)).toBe(false);
  });
});

describe('childErrors — the three boxes that name a child (membership.schema.js:73 guardianPayload)', () => {
  const ok = { childNisn: '0012345678', childFullName: 'Budi Santoso', relationship: 'Ayah' };

  it('passes a child named in full', () => {
    expect(childErrors(ok)).toEqual({});
  });

  it('names each failing box, and only those', () => {
    expect(Object.keys(childErrors({ ...ok, childNisn: '123' }))).toEqual(['childNisn']);
    expect(Object.keys(childErrors({ ...ok, relationship: 'Ay' }))).toEqual(['relationship']);
    expect(Object.keys(childErrors({}))).toEqual(['childNisn', 'childFullName', 'relationship']);
  });

  it('builds a payload of exactly those three, trimmed', () => {
    expect(childPayload({ ...ok, childFullName: '  Budi Santoso ', extra: 'x' })).toEqual(ok);
  });
});

describe("an academic year's dates against its label (the app's own rule — academicYearBody checks neither)", () => {
  it('accepts a 2028/2029 year running from 2028 into 2029', () => {
    expect(yearDatesMatchLabel('2028/2029', '2028-07-13', '2029-06-20')).toEqual({ start: null, end: null });
  });

  it('refuses the year the owner actually created: 18 Aug – 18 Sep 2028 under 2028/2029', () => {
    const fail = yearDatesMatchLabel('2028/2029', '2028-08-18', '2028-09-18');
    expect(fail.start).toBeNull();
    expect(fail.end).toEqual({ key: 'validation.academicYear.endYear', vars: { year: 2029 } });
  });

  it('refuses a start in the wrong year too', () => {
    expect(yearDatesMatchLabel('2028/2029', '2027-07-13', '2029-06-20').start).toEqual({
      key: 'validation.academicYear.startYear',
      vars: { year: 2028 },
    });
  });

  it('counts months, and calls 9 to 13 of them usual', () => {
    expect(monthsBetween('2028-07-13', '2029-06-20')).toBe(11);
    expect(monthsBetween('2028-08-18', '2028-09-18')).toBe(1);
    expect(isUsualYearLength(11)).toBe(true);
    expect(isUsualYearLength(9)).toBe(true);
    expect(isUsualYearLength(13)).toBe(true);
    expect(isUsualYearLength(8)).toBe(false);
    expect(isUsualYearLength(14)).toBe(false);
  });
});

describe('semesterFits — createSemester, academics.service.js:200-207', () => {
  const year = {
    label: '2026/2027',
    startDate: '2026-07-13T00:00:00.000Z',
    endDate: '2027-06-20T00:00:00.000Z',
    semesters: [{ ordinal: 1, startDate: '2026-07-13T00:00:00.000Z', endDate: '2026-12-19T00:00:00.000Z' }],
  };

  it('accepts the second half, inside the year and clear of the first', () => {
    expect(semesterFits(year, 2, '2027-01-04', '2027-06-20')).toEqual({ start: null, end: null });
  });

  it('refuses a start before the year, and an end after it', () => {
    expect(semesterFits(year, 2, '2026-07-01', '2027-06-20').start?.key).toBe('validation.semester.beforeYear');
    expect(semesterFits(year, 2, '2027-01-04', '2027-07-01').end?.key).toBe('validation.semester.afterYear');
  });

  it('refuses overlapping the other semester, but not touching it', () => {
    expect(semesterFits(year, 2, '2026-12-01', '2027-06-20').end).toEqual({ key: 'validation.semester.overlap', vars: { n: 1 } });
    expect(semesterFits(year, 2, '2026-12-19', '2027-06-20').end).toBeNull();
  });
});

describe('a leave request — leaveRequestBody and the letter upload (membership.routes.js)', () => {
  const file = (type, size = 1000) => ({ type, size });

  it('wants a reason of 3 to 500 characters', () => {
    expect(validateLeaveReason('ab')).toEqual({ key: 'validation.leaveReason.short' });
    expect(validateLeaveReason('  abc  ')).toBeNull();
    // Counted after trim(), as zod's .trim().min(3) does: spaces do not make a reason.
    expect(validateLeaveReason('  ab  ')).toEqual({ key: 'validation.leaveReason.short' });
    expect(validateLeaveReason('x'.repeat(500))).toBeNull();
    expect(validateLeaveReason('x'.repeat(501))).toEqual({ key: 'validation.leaveReason.long' });
  });

  it('takes a PDF, JPG or PNG letter of at most 5 MB', () => {
    expect(validateLetterFile(null)).toEqual({ key: 'validation.letter.required' });
    expect(validateLetterFile(file('application/pdf'))).toBeNull();
    expect(validateLetterFile(file('image/jpeg'))).toBeNull();
    expect(validateLetterFile(file('image/png', 5 * 1024 * 1024))).toBeNull();
    expect(validateLetterFile(file('image/png', 5 * 1024 * 1024 + 1))?.key).toBe('validation.letter.tooLarge');
    expect(validateLetterFile(file('application/msword'))).toEqual({ key: 'validation.letter.type' });
  });
});
