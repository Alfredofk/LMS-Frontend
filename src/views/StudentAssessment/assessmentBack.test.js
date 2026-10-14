import { describe, expect, it } from 'vitest';

import { assessmentBackOf, noteAssessmentSubject, noteAssessmentTab } from './assessmentBack';

describe('assessmentBack - the navbar arrow on an outline', () => {
  it('cold: to /assessment; once the subject is noted: its Penilaian tab', () => {
    expect(assessmentBackOf('/assessment/a1')).toEqual({ to: '/assessment', labelKey: 'smenu.backToList' });
    noteAssessmentSubject('a1', 'cs1');
    expect(assessmentBackOf('/assessment/a1').to).toBe('/classroom/cs1?tab=penilaian');
  });

  it('opened from the Nilai tab: back to it, and to Penilaian again once opened there', () => {
    noteAssessmentSubject('a2', 'cs1');
    noteAssessmentTab('a2', 'nilai');
    expect(assessmentBackOf('/assessment/a2')).toEqual({ to: '/classroom/cs1?tab=nilai', labelKey: 'smenu.backToScores' });
    noteAssessmentTab('a2', 'penilaian');
    expect(assessmentBackOf('/assessment/a2').to).toBe('/classroom/cs1?tab=penilaian');
    noteAssessmentTab('a2', 'kehadiran');
    expect(assessmentBackOf('/assessment/a2').to).toBe('/classroom/cs1?tab=penilaian');
  });

  it('an attempt goes back to its outline; other paths have no arrow of this kind', () => {
    expect(assessmentBackOf('/assessment/a2/percobaan/s1')).toEqual({ to: '/assessment/a2', labelKey: 'sasm.backToOutline' });
    expect(assessmentBackOf('/scores')).toBeNull();
  });
});
