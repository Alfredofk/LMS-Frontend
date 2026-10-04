# Backend API Reminders

Frontend-only integration notes. The backend repository is read-only from this
workspace; do not implement backend changes here.

## Teacher Dashboard and My Courses

**Status checked 2026-09-26: these endpoints are not available in the current backend checkout.**
`lms-backend/src/server.js` mounts auth, users, and school-registration routes
only. There is no academics module under `lms-backend/src/modules/`, and no
teacher-facing route for the dashboard or a list of the authenticated Teacher's
assignments.

The Teacher Gradebook no longer calls the legacy `/api/gradebook` or
`/api/protests` routes; its current interaction is local demo state only.

The frontend's old `GET /api/courses` request was removed from
`src/views/Course/TeacherCourses.jsx`. The domain model is `ClassSubject`, not
`Course`. Both screens currently use `src/views/Dashboard/sampleTeacherData.js`.

### Contracts to agree with backend

- **Teaching assignments:** an authenticated, tenant-scoped read of ACTIVE
	`ClassSubject` records assigned to the current Teacher. Include the Subject
	name/code, Class name and Grade Level, Academic Year label, Semester ordinal,
	and assignment status. Support filtering by Academic Year/Semester; determine
	whether PENDING assignments belong in a separate view.
- **Class roster:** for each visible ClassSubject/Class, return current student
	placements with stable student and membership/profile IDs, display name, and
	Class. State whether the API returns one deduplicated roster per Class or
	repeats students per teaching assignment. The UI's unique-student total must
	count the deduplicated set, not add class totals blindly.
- **Schedule:** there is no timetable or Session model in the current schema.
	Do not add schedule fields to ClassSubject by assumption. Define a real
	timetable/session contract (day/date, start/end, room, ClassSubject) before
	replacing the sample schedule on the dashboard.
- **Recent work to review:** there are no Assessment or Submission models/routes
	in the current backend checkout. Define an authenticated Teacher queue with
	submission ID/status, student, ClassSubject, Assessment title, submitted time,
	and whether it has a Score. Do not treat a submission count as a gradebook
	total unless its status semantics are explicit.
- **Gradebook and Score recording:** the current frontend Gradebook is a demo
	only. Backend work needs an Assessment list and each student's submission
	status for the authenticated Teacher's ClassSubject, plus a create-only Score
	operation for an eligible submitted Assessment. Confirm score range, precision,
	and any feedback fields from the real schema before mirroring validation.
	Score is immutable in the domain: return a conflict when one already exists;
	do not expose an edit/update path. Define whether batch recording is supported
	and how partial failures are reported. The demo's 0–100 whole-number input is
	illustrative, not a backend contract.
- **Dashboard summary:** initially derive class count and unique student count
	from the Teacher's assignment/roster responses. Add a stats endpoint only if
	those queries become expensive or need a consistent snapshot; the pending
	review count must use the same status definition as the review queue.
- **Gradebook:** provide an authenticated read scoped to one Teacher-owned
	`ClassSubject`, returning its Assessments and each current Class Member's
	submission status and any existing Score. Confirm the Score range and
	precision from the schema before matching browser validation. A write should
	create a Score only for an eligible submitted Assessment, reject duplicate
	Score creation rather than update it, and define whether several Score writes
	can be submitted together. If a batch is supported, specify per-item success
	and failure results so the UI can report partial outcomes accurately.

The dashboard links to the relevant filtered My Courses views. Keep those
navigation targets when wiring the real API. Assignment cards open the local
`/teacher/courses/:classSubjectId` detail view. That view reads the same fixture
for the roster, timetable, and recent submissions; it is a UI prototype, not a
backend detail contract. Its Gradebook link opens
`/teacher/gradebook?classSubjectId=...`. The Gradebook currently records demo
Scores in page state only; refresh discards them. Schedule and review rows remain
sample-only until their contracts above exist.

Before wiring the frontend, verify the route in `server.js`, read the response
envelope in its controller, then replace the fixture with the real service and
keep the sample-data marker only for fields that remain invented. Every list
must be scoped from the authenticated membership server-side; never accept a
client-supplied teacher or school ID as the authorization boundary.