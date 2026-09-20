import { timeAgo } from '../../utils/datetime';

/*
  Sample data for the Teacher Dashboard.

  Shown only when the endpoints behind this screen answer 404 — that is, when
  they have not been written yet. A real failure still shows a real error, and
  the day the routes land this file stops being reached at all. See
  TeacherDashboard.jsx for that branch.

  Until then the alternative was the red panel this screen used to show, which
  said "Terjadi Kesalahan" for something nobody broke.

  Field names copy `prisma/schema.prisma` where a model exists, so the widgets
  already speak the vocabulary a real endpoint would use. Where no model exists
  the name is invented, and this list says which is which:

    classes[].id            REAL      ClassSubject.id
    classes[].name          REAL      Subject.name
    classes[].grade         REAL      Class.name
    classes[].studentsCount REAL      counted from ClassMembership

    stats.totalClasses      REAL      counted from ClassSubject
    stats.totalStudents     REAL      counted from ClassMembership
    stats.pendingGrading    INVENTED  nothing is submitted or marked anywhere
    classes[].schedule      INVENTED  there is no Session or Timetable model.
                                      ClassSubject records who teaches what; it
                                      never records when. This string used to be
                                      pasted onto every real class the server
                                      sent — it belongs here instead
    recentSubmissions[]     INVENTED  no Assignment and no Submission model

  Two vocabulary rules carried over from sampleStudentData.js and still binding:
  a class is **"XII-2"**, never "XII IPA 2", because IPA/IPS streaming is gone
  from the schema; and what is counted is **subjects**, because `Course` does not
  exist as a model at all.

  A factory rather than a constant, for the same reason as the student file: the
  submission times are relative, so a frozen object would visibly age on screen.
*/

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

/** ISO string `ms` milliseconds before `now`. */
const ago = (now, ms) => new Date(now.getTime() - ms).toISOString();

/**
 * @param {Date} now
 * @param {(key: string, vars?: object) => string} t  for the relative times
 */
export function buildSampleTeacherData(now = new Date(), t) {
  const submissions = [
    { studentName: 'Siti Rahma', assignmentTitle: 'Laporan Praktikum Asam Basa', grade: 'XII-2', at: ago(now, 25 * MINUTE) },
    { studentName: 'Budi Santoso', assignmentTitle: 'Analisis Gerak Parabola', grade: 'XI-1', at: ago(now, 2 * HOUR) },
    { studentName: 'Ratna Sari', assignmentTitle: 'Esai Teks Persuasi', grade: 'XII-2', at: ago(now, 5 * HOUR) },
    { studentName: 'Fajar Utama', assignmentTitle: 'Latihan Integral Tentu', grade: 'XI-1', at: ago(now, 26 * HOUR) },
  ];

  return {
    stats: {
      totalClasses: 5,
      totalStudents: 152,
      pendingGrading: 12,
    },

    classes: [
      { id: 'cs-mtk-xii-2', name: 'Matematika', grade: 'XII-2', studentsCount: 32, schedule: 'Senin · 07:00 – 08:30' },
      { id: 'cs-fis-xi-1', name: 'Fisika', grade: 'XI-1', studentsCount: 30, schedule: 'Senin · 09:00 – 10:30' },
      { id: 'cs-kim-xii-2', name: 'Kimia', grade: 'XII-2', studentsCount: 32, schedule: 'Selasa · 07:00 – 08:30' },
      { id: 'cs-bin-xi-1', name: 'Bahasa Indonesia', grade: 'XI-1', studentsCount: 30, schedule: 'Rabu · 10:45 – 12:15' },
      { id: 'cs-sej-x-3', name: 'Sejarah', grade: 'X-3', studentsCount: 28, schedule: 'Kamis · 13:00 – 14:30' },
    ],

    /*
      `time` is a rendered phrase, not a timestamp, because that is what the view
      prints and what the contract records for this endpoint. Worth revisiting
      with the backend: a server that formats "2 jam lalu" cannot serve a reader
      who switched the app to English, and this screen has that switch.
    */
    recentSubmissions: submissions.map((s, index) => ({
      id: `sub-${index + 1}`,
      studentName: s.studentName,
      assignmentTitle: s.assignmentTitle,
      grade: s.grade,
      time: timeAgo(t, s.at),
    })),
  };
}

export default buildSampleTeacherData;
