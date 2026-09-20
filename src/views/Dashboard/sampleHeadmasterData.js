/*
  Sample data for the Principal Dashboard.

  Three numbers, and they matter more than their size suggests. Before this,
  `/api/headmaster/stats` answered 404, the fetch swallowed it, and the cards
  kept the zeros they were initialised with — so the screen said **0 teachers,
  0 students, 0 subjects** with no hint that it had simply failed to ask.

  A red panel would have been wrong too; nothing is broken. But a confident zero
  is worse than an error, because it reads as a fact about the school.

  Shown only on 404. A real failure still surfaces as a real failure, and the day
  the route lands this file stops being reached.

    stats.totalTeachers   REAL  counted from MembershipRole where role = TEACHER
    stats.totalStudents   REAL  counted from MembershipRole where role = STUDENT
    stats.totalCourses    REAL  counted from ClassSubject

  All three are countable from tables that already exist in `schema.prisma`,
  which makes this one of the cheapest endpoints for the backend to deliver —
  the numbers below are placeholders for a query nobody has written, not for a
  feature nobody has designed.

  No factory argument: nothing here is relative to the clock.
*/
export function buildSampleHeadmasterData() {
  return {
    stats: {
      totalTeachers: 24,
      totalStudents: 612,
      totalCourses: 38,
    },
  };
}

export default buildSampleHeadmasterData;
