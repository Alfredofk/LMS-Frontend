/*
  Sample data for the Student Dashboard.

  Nothing here comes from the backend, because no route serves any of it —
  `server.js` mounts only `auth` and `users`. The dashboard shows it anyway, with
  a visible marker (see components/SampleDataNotice.jsx), because an empty screen
  cannot show what the screen is for.

  Field names copy `prisma/schema.prisma` wherever a model exists, so that the
  day a real endpoint lands the widgets already speak its vocabulary. Where no
  model exists the name is invented, and this list says which is which — that
  distinction is the whole reason this file is separate rather than inlined:

    context.academicYearLabel   REAL   AcademicYear.label, format "2026/2027"
    context.semesterOrdinal     REAL   Semester.ordinal (1 or 2). Semester has no
                                       name column, so the UI composes the phrase
    context.className           REAL   Class.name
    context.gradeLevel          REAL   Class.gradeLevel
    courseProgress[].classSubjectId    REAL   ClassSubject.id
    courseProgress[].subjectName       REAL   Subject.name
    courseProgress[].teacherName       REAL   User.fullName, via the membership
                                       named by ClassSubject.teacherMembershipId

    stats.*                     INVENTED  nothing counts any of these
    activities[]                INVENTED  there is no Session, Timetable or
                                       Schedule model. ClassSubject records who
                                       teaches what; it never records when
    assessments[]               INVENTED  no Assignment, no Assessment model
    courseProgress[].totalTasks
    courseProgress[].submittedTasks    INVENTED  nothing is submitted or counted
    announcements[]             INVENTED  no Announcement model. The field names
                                       follow Notification (title · body ·
                                       createdAt), the nearest real thing

  Two vocabulary rules from the backend's CONTEXT.md are obeyed here and must
  stay obeyed: the class is "XII-2" and never "XII IPA 2", because IPA/IPS
  streaming is banned; and what is counted is Subjects, because `Course` does not
  exist in the schema at all.
*/

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

/** ISO string `ms` milliseconds after `now`. Negative reaches into the past. */
const at = (now, ms) => new Date(now.getTime() + ms).toISOString();

/*
  Tonight at 23:59, whatever the hour is now.

  Not `now + n hours`: opened in the morning, "+14 hours" lands after midnight and
  the widget correctly calls it tomorrow — correct, but not the case this row is
  here to show. Anchoring to the end of the day keeps one assignment due *today*
  no matter when somebody looks.
*/
const endOfToday = (now) =>
  new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59).toISOString();

/**
 * Build a fresh set of sample data, relative to the moment it is called.
 *
 * A function rather than a frozen object, because three of the four widgets
 * measure time: assessments colour themselves by how close their due date is,
 * announcements render "2 days ago", activities are "today". Dates written as
 * literals would look right the week they were typed and wrong a month later —
 * every deadline past, the urgent banner dead, an announcement stamped "270 days
 * ago". A mockup that decays is worse than no mockup.
 *
 * @param {Date} [now]
 */
export function buildSampleStudentData(now = new Date()) {
  return {
    context: {
      academicYearLabel: '2025/2026',
      semesterOrdinal: 2,
      className: 'XII-2',
      gradeLevel: 12,
    },

    stats: {
      subjectCount: 8,
      todoCount: 3,
      avgScore: 86,
      newMaterialCount: 5,
    },

    activities: [
      {
        id: 'act-1',
        startTime: '07:00',
        endTime: '08:30',
        subjectName: 'Matematika',
        teacherName: 'Sari Wulandari, S.Pd.',
        room: 'R-301',
      },
      {
        id: 'act-2',
        startTime: '08:45',
        endTime: '10:15',
        subjectName: 'Fisika',
        teacherName: 'Budi Santoso, S.Pd.',
        room: 'Lab Fisika',
      },
      {
        id: 'act-3',
        startTime: '10:30',
        endTime: '12:00',
        subjectName: 'Kimia',
        teacherName: 'Ratna Dewi, S.Si.',
        room: 'Lab Kimia',
      },
      {
        id: 'act-4',
        startTime: '13:00',
        endTime: '14:30',
        subjectName: 'Bahasa Indonesia',
        teacherName: 'Indra Permana, S.Pd.',
        room: 'R-301',
      },
    ],

    /*
      Deliberately spread across the colour thresholds the widget uses, so that
      the three badges on screen are visibly different and a reviewer can see
      that the colour follows the date rather than the row's position.
    */
    assessments: [
      {
        id: 'asg-1',
        title: 'Soal latihan integral',
        subjectName: 'Matematika',
        dueAt: endOfToday(now),
      },
      {
        id: 'asg-2',
        title: 'Laporan praktikum asam basa',
        subjectName: 'Kimia',
        dueAt: at(now, 3 * DAY),
      },
      {
        id: 'asg-3',
        title: 'Esai "Sumpah Pemuda"',
        subjectName: 'Bahasa Indonesia',
        dueAt: at(now, 9 * DAY),
      },
    ],

    courseProgress: [
      {
        classSubjectId: 'cs-1',
        subjectName: 'Matematika',
        teacherName: 'Sari Wulandari, S.Pd.',
        totalTasks: 12,
        submittedTasks: 11,
      },
      {
        classSubjectId: 'cs-2',
        subjectName: 'Fisika',
        teacherName: 'Budi Santoso, S.Pd.',
        totalTasks: 10,
        submittedTasks: 4,
      },
      {
        classSubjectId: 'cs-3',
        subjectName: 'Pendidikan Jasmani',
        teacherName: 'Gaby Pratama, S.Pd.',
        totalTasks: 6,
        submittedTasks: 1,
      },
      {
        classSubjectId: 'cs-4',
        subjectName: 'Sejarah',
        teacherName: 'Wati Kusuma, S.Pd.',
        totalTasks: 8,
        submittedTasks: 8,
      },
    ],

    announcements: [
      {
        id: 'ann-1',
        title: 'Ujian Akhir Semester (UAS)',
        body: 'UAS Genap dilaksanakan pada 9–18 Juni 2026. Jadwal lengkap tersedia di menu Jadwal.',
        createdAt: at(now, -2 * HOUR),
        authorName: 'Hendra Gunawan, S.Pd.',
      },
      {
        id: 'ann-2',
        title: 'Libur Waisak',
        body: 'Sekolah libur 12 Mei 2026. KBM dilanjutkan 13 Mei 2026.',
        createdAt: at(now, -3 * DAY),
        authorName: 'Hendra Gunawan, S.Pd.',
      },
      {
        id: 'ann-3',
        title: 'Pekan Olahraga Antarkelas',
        body: 'Pendaftaran tim dibuka sampai Jumat. Hubungi wali kelas masing-masing.',
        createdAt: at(now, -6 * DAY),
        authorName: 'Hendra Gunawan, S.Pd.',
      },
    ],
  };
}

export default buildSampleStudentData;
