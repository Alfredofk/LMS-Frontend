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

// Fungsi pembantu untuk membuat waktu relatif terhadap waktu saat ini
const ago = (ms) => new Date(Date.now() - ms).toISOString();

export function buildSampleTeacherData() {
  const students = [
    { id: 'student-01', fullName: 'Siti Rahma', classId: 'class-xii-2', className: 'XII-2', gradeLevel: 12 },
    { id: 'student-02', fullName: 'Ratna Sari', classId: 'class-xii-2', className: 'XII-2', gradeLevel: 12 },
    { id: 'student-03', fullName: 'Diah Putri', classId: 'class-xii-2', className: 'XII-2', gradeLevel: 12 },
    { id: 'student-04', fullName: 'Arif Nugraha', classId: 'class-xii-2', className: 'XII-2', gradeLevel: 12 },
    { id: 'student-05', fullName: 'Budi Santoso', classId: 'class-xi-1', className: 'XI-1', gradeLevel: 11 },
    { id: 'student-06', fullName: 'Fajar Utama', classId: 'class-xi-1', className: 'XI-1', gradeLevel: 11 },
    { id: 'student-07', fullName: 'Nanda Prakoso', classId: 'class-xi-1', className: 'XI-1', gradeLevel: 11 },
    { id: 'student-08', fullName: 'Putri Ayu', classId: 'class-xi-1', className: 'XI-1', gradeLevel: 11 },
  ];

  const grade12StudentIds = students.filter((student) => student.classId === 'class-xii-2').map((student) => student.id);
  const grade11StudentIds = students.filter((student) => student.classId === 'class-xi-1').map((student) => student.id);

  return {
    classSubjects: [
      {
        id: 'cs-mtk-xii-2',
        academicYearLabel: '2026/2027',
        semesterOrdinal: 1,
        classId: 'class-xii-2',
        subjectName: 'Matematika',
        className: 'XII-2',
        gradeLevel: 12,
        studentIds: grade12StudentIds,
        schedule: { dayOfWeek: 1, startTime: '07:00', endTime: '08:30', room: 'R. 12' }
      },
      {
        id: 'cs-fis-xi-1',
        academicYearLabel: '2026/2027',
        semesterOrdinal: 1,
        classId: 'class-xi-1',
        subjectName: 'Fisika',
        className: 'XI-1',
        gradeLevel: 11,
        studentIds: grade11StudentIds,
        schedule: { dayOfWeek: 1, startTime: '09:00', endTime: '10:30', room: 'Lab Fisika' }
      },
      {
        id: 'cs-kim-xii-2',
        academicYearLabel: '2026/2027',
        semesterOrdinal: 1,
        classId: 'class-xii-2',
        subjectName: 'Kimia',
        className: 'XII-2',
        gradeLevel: 12,
        studentIds: grade12StudentIds,
        schedule: { dayOfWeek: 2, startTime: '07:00', endTime: '08:30', room: 'Lab Kimia' }
      },
      {
        id: 'cs-bin-xi-1',
        academicYearLabel: '2026/2027',
        semesterOrdinal: 1,
        classId: 'class-xi-1',
        subjectName: 'Bahasa Indonesia',
        className: 'XI-1',
        gradeLevel: 11,
        studentIds: grade11StudentIds,
        schedule: { dayOfWeek: 3, startTime: '10:45', endTime: '12:15', room: 'R. 08' }
      },
      {
        id: 'cs-mtk-xi-1',
        academicYearLabel: '2026/2027',
        semesterOrdinal: 1,
        classId: 'class-xi-1',
        subjectName: 'Matematika',
        className: 'XI-1',
        gradeLevel: 11,
        studentIds: grade11StudentIds,
        schedule: { dayOfWeek: 4, startTime: '13:00', endTime: '14:30', room: 'R. 05' }
      },
    ],

    submissions: [
      {
        id: 'sub-1',
        studentId: 'student-01',
        studentName: 'Siti Rahma',
        assessmentTitle: 'Latihan Limit Fungsi Aljabar',
        className: 'XII-2',
        subjectName: 'Matematika',
        classId: 'class-xii-2',
        submittedAt: ago(25 * MINUTE),
        status: 'ON_TIME',
        notes: 'Berikut saya lampirkan hasil pengerjaan latihan nomor 1 sampai 10 beserta cara langkah-langkahnya.',
        attachment: {
          name: 'latihan_limit_siti_rahma.pdf',
          size: '2.4 MB',
          type: 'application/pdf'
        },
        score: 88,
        feedback: 'Pengerjaan langkah-langkah sudah sangat runtut dan sistematis. Pertahankan!'
      },
      {
        id: 'sub-2',
        studentId: 'student-02',
        studentName: 'Ratna Sari',
        assessmentTitle: 'Latihan Limit Fungsi Aljabar',
        className: 'XII-2',
        subjectName: 'Matematika',
        classId: 'class-xii-2',
        submittedAt: ago(2 * HOUR),
        status: 'ON_TIME',
        notes: 'Tugas sudah selesai dikerjakan sesuai petunjuk di kelas.',
        attachment: {
          name: 'tugas_matematika_ratna.pdf',
          size: '1.8 MB',
          type: 'application/pdf'
        },
        score: null,
        feedback: ''
      },
      {
        id: 'sub-3',
        studentId: 'student-04',
        studentName: 'Arif Nugraha',
        assessmentTitle: 'Latihan Limit Fungsi Aljabar',
        className: 'XII-2',
        subjectName: 'Matematika',
        classId: 'class-xii-2',
        submittedAt: ago(14 * HOUR),
        status: 'LATE',
        notes: 'Mohon maaf atas keterlambatan pengumpulan karena kendala jaringan di rumah.',
        attachment: {
          name: 'jawaban_limit_arif.pdf',
          size: '3.1 MB',
          type: 'application/pdf'
        },
        score: 75,
        feedback: 'Hasil pengerjaan cukup baik. Perhatikan batas waktu di penugasan berikutnya.'
      },
      {
        id: 'sub-4',
        studentId: 'student-05',
        studentName: 'Budi Santoso',
        assessmentTitle: 'Analisis Gerak Parabola',
        className: 'XI-1',
        subjectName: 'Fisika',
        classId: 'class-xi-1',
        submittedAt: ago(2 * HOUR),
        status: 'ON_TIME',
        notes: 'Grafik analisis vektor kecepatan telah disertakan pada halaman lampiran ke-2.',
        attachment: {
          name: 'laporan_fisika_budi.pdf',
          size: '2.1 MB',
          type: 'application/pdf'
        },
        score: 92,
        feedback: 'Analisis data gerak parabola sangat detail dan akurat.'
      },
      {
        id: 'sub-5',
        studentId: 'student-06',
        studentName: 'Fajar Utama',
        assessmentTitle: 'Latihan Integral Tentu',
        className: 'XI-1',
        subjectName: 'Matematika',
        classId: 'class-xi-1',
        submittedAt: ago(26 * HOUR),
        status: 'ON_TIME',
        notes: 'Hasil integral substitusi dan parsial sudah lengkap.',
        attachment: {
          name: 'integral_fajar_xi1.pdf',
          size: '1.5 MB',
          type: 'application/pdf'
        },
        score: null,
        feedback: ''
      },
      {
        id: 'sub-6',
        studentId: 'student-03',
        studentName: 'Diah Putri',
        assessmentTitle: 'Laporan Praktikum Asam Basa',
        className: 'XII-2',
        subjectName: 'Kimia',
        classId: 'class-xii-2',
        submittedAt: ago(5 * HOUR),
        status: 'ON_TIME',
        notes: 'Tabel pH indikator lakmus dan fenolftalein telah diisi lengkap.',
        attachment: {
          name: 'praktikum_kimia_diah.pdf',
          size: '2.7 MB',
          type: 'application/pdf'
        },
        score: 85,
        feedback: 'Laporan rapi dan tabel pengamatan lengkap.'
      },
      {
        id: 'sub-7',
        studentId: 'student-07',
        studentName: 'Nanda Prakoso',
        assessmentTitle: 'Analisis Struktur Teks Eksposisi',
        className: 'XI-1',
        subjectName: 'Bahasa Indonesia',
        classId: 'class-xi-1',
        submittedAt: ago(3 * HOUR),
        status: 'ON_TIME',
        notes: 'Analisis tesis, argumentasi, dan penegasan ulang sudah diketik rapi.',
        attachment: {
          name: 'eksposisi_nanda.pdf',
          size: '1.2 MB',
          type: 'application/pdf'
        },
        score: 80,
        feedback: 'Argumen sudah runtut, tingkatkan variasi konjungsi antarparagraf.'
      }
    ],
    students,
    stats: {
      classCount: new Set(students.map((student) => student.classId)).size,
      studentCount: students.length,
      pendingSubmissionCount: 4,
      classSubjectCount: 5,
    },
  };
}

export default buildSampleTeacherData;
