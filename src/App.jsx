import React, { lazy, Suspense } from 'react';
import { createBrowserRouter, createRoutesFromElements, Navigate, Outlet, Route, RouterProvider } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { LanguageProvider } from './i18n/LanguageContext';
import ThemeProvider from './theme/ThemeProvider';
import ProtectedRoute, { RequireAuth } from './components/ProtectedRoute';
import MainLayout from './layouts/MainLayout';
import LandingPage from './views/Landing/LandingPage';
import LoginPage from './views/Login/LoginPage';
import AccountChrome from './views/Account/AccountChrome';
import AdminLayout from './layouts/AdminLayout';
import { ROLES } from './constants/roles';
import PageLoading from './components/ui/PageLoading';
import RouteErrorBoundary, { RouterErrorPage } from './components/ui/PageError';

/*
  Every page is its own chunk, fetched the first time it is opened (owner,
  2026-10-04): a student's first load no longer carries the Principal's, the
  admin's or the teacher's screens. The landing and sign-in pages stay in the
  first chunk - they are where people arrive. Layouts show PageLoading in their
  content area while a page arrives; the Suspense around <Routes> covers the
  pages with no layout.
*/
const SelectRolePage = lazy(() => import('./views/Role/SelectRolePage'));
const GetStartedPage = lazy(() => import('./views/Role/GetStartedPage'));
const AccountPage = lazy(() => import('./views/Account/AccountPage'));
const AdminRegistrationsPage = lazy(() => import('./views/Admin/AdminRegistrationsPage'));
const AdminHolidaysPage = lazy(() => import('./views/Admin/AdminHolidaysPage'));
const VerifyEmailPage = lazy(() => import('./views/Verify/VerifyEmailPage'));
const ForgotPasswordPage = lazy(() => import('./views/Password/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('./views/Password/ResetPasswordPage'));
const StudentDashboard = lazy(() => import('./views/Dashboard/StudentDashboard'));
const TeacherDashboard = lazy(() => import('./views/Dashboard/TeacherDashboard'));
const TeacherGradebook = lazy(() => import('./views/Gradebook/TeacherGradebook'));
const TeacherAssessmentPage = lazy(() => import('./views/TeacherAssessment/TeacherAssessmentPage'));
const AssessmentQuestionEditPage = lazy(() => import('./views/TeacherAssessment/AssessmentQuestionEditPage'));
const ProfilePage = lazy(() => import('./views/Profile/ProfilePage'));
const ClassroomPage = lazy(() => import('./views/Classroom/ClassroomPage'));
const AssignmentDetailPage = lazy(() => import('./views/Assignment/AssignmentDetailPage'));
const UnauthorizedPage = lazy(() => import('./views/Unauthorized/UnauthorizedPage'));
const TeacherClassSubjectDetail = lazy(() => import('./views/Course/TeacherClassSubjectDetail'));
const TeacherCourses = lazy(() => import('./views/Course/TeacherCourses'));
const HomeroomDashboard = lazy(() => import('./views/Homeroom/HomeroomDashboard'));
const GuardianPage = lazy(() => import('./views/Guardian/GuardianPage'));
const HeadmasterDashboard = lazy(() => import('./views/Dashboard/HeadmasterDashboard'));
const StudentScores = lazy(() => import('./views/Scores/StudentScores'));
const AnnouncementPage = lazy(() => import('./views/Announcement/AnnouncementPage'));
const SchedulePage = lazy(() => import('./views/Schedule/SchedulePage'));
const AssessmentPage = lazy(() => import('./views/Assessment/AssessmentPage'));
const AttendancePage = lazy(() => import('./views/Attendance/AttendancePage'));
const JoinRequestsPage = lazy(() => import('./views/Requests/JoinRequestsPage'));
const ClassesPage = lazy(() => import('./views/Classes/ClassesPage'));
const MembersPage = lazy(() => import('./views/Members/MembersPage'));
const QuestionBankPage = lazy(() => import('./views/QuestionBank/QuestionBankPage'));
const QuestionEditorPage = lazy(() => import('./views/QuestionBank/QuestionEditorPage'));
const SubjectsPage = lazy(() => import('./views/Subjects/SubjectsPage'));

/*
  The root of every route: the pages with no layout, and a layout that throws
  itself, are caught here (PageError.jsx), and a page still loading shows
  PageLoading. A data router (createBrowserRouter, owner 2026-10-08) rather than
  <BrowserRouter>, so a page can hold a navigation while it has unsaved changes
  (useBlocker, hooks/useUnsavedGuard.js); the routes are the same <Route> tree.
*/
const RootShell = () => (
  <RouteErrorBoundary fullScreen>
    <Suspense fallback={<PageLoading fullScreen />}>
      <Outlet />
    </Suspense>
  </RouteErrorBoundary>
);

const router = createBrowserRouter(
  createRoutesFromElements(
    <Route element={<RootShell />} errorElement={<RouterErrorPage />}>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/unauthorized" element={<UnauthorizedPage />} />

          {/* Public on purpose: somebody opening a link from their inbox has no
              session yet, and neither claiming a token nor choosing a new
              password needs one. */}
          <Route path="/verify-email" element={<VerifyEmailPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />

          {/* Signed in, with or without a role to enter as — the page itself
              says which. Guarded by RequireAuth, not ProtectedRoute: this is
              where ProtectedRoute sends people, so guarding it with it would
              loop. */}
          <Route
            path="/select-role"
            element={
              <RequireAuth>
                <SelectRolePage />
              </RequireAuth>
            }
          />

          {/* Where a card on /select-role leads when its role is not held yet:
              registering a school, or asking to join one. */}
          <Route
            path="/get-started/:intent"
            element={
              <RequireAuth>
                <GetStartedPage />
              </RequireAuth>
            }
          />

          {/* Changing one's own name and password. RequireAuth, deliberately:
              every role-guarded screen below is unreachable for a real account
              until a school registration can be approved, and this one must not
              be.

              Its shell is chosen at render time rather than fixed here, because
              the two people it serves are in different places — see
              AccountChrome. Pinning it to MainLayout would shut out everybody
              without a role; pinning it to AuthLayout threw everybody who has
              one out of the app to change their own name. */}
          <Route
            element={
              <RequireAuth>
                <AccountChrome />
              </RequireAuth>
            }
          >
            <Route path="/account" element={<AccountPage />} />
          </Route>

          {/* The platform admin, who stands above every school. RequireAuth and
              nothing more: PlatformAdmin is its own table rather than a
              SchoolRole, so it is absent from constants/roles.js and
              ProtectedRoute has nothing to compare. The server decides, and the
              page renders its 403 as an answer rather than as a fault. */}
          <Route
            element={
              <RequireAuth>
                <AdminLayout />
              </RequireAuth>
            }
          >
            <Route path="/admin/school-registrations" element={<AdminRegistrationsPage />} />
            <Route path="/admin/holidays" element={<AdminHolidaysPage />} />
          </Route>

          <Route
            element={
              <ProtectedRoute allowedRoles={[ROLES.STUDENT]}>
                <MainLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/dashboard" element={<StudentDashboard />} />
            <Route path="/classroom" element={<ClassroomPage />} />
            <Route path="/classroom/:classSubjectId" element={<ClassroomPage />} />
            <Route path="/classroom/:classSubjectId/:sessionId" element={<ClassroomPage />} />
            <Route path="/assignment/:assignmentId" element={<AssignmentDetailPage />} />
            <Route path="/scores" element={<StudentScores />} />
            <Route path="/assessment" element={<AssessmentPage />} />
            <Route path="/attendance" element={<AttendancePage />} />
          </Route>

          <Route
            element={
              <ProtectedRoute allowedRoles={[ROLES.TEACHER]}>
                <MainLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/teacher/dashboard" element={<TeacherDashboard />} />
            <Route path="/teacher/courses" element={<TeacherCourses />} />
            <Route path="/teacher/courses/:classSubjectId" element={<TeacherClassSubjectDetail />} />
            <Route path="/teacher/courses/:classSubjectId/penilaian/new" element={<TeacherAssessmentPage />} />
            <Route path="/teacher/courses/:classSubjectId/penilaian/:assessmentId" element={<TeacherAssessmentPage />} />
            <Route path="/teacher/courses/:classSubjectId/penilaian/:assessmentId/soal/:questionId" element={<AssessmentQuestionEditPage />} />
            <Route path="/teacher/gradebook" element={<TeacherGradebook />} />
            {/* An assessment of any type, Tugas included, is set from the subject's Penilaian tab. */}
            <Route path="/teacher/create-assignment" element={<Navigate to="/teacher/courses" replace />} />
            <Route path="/teacher/homeroom" element={<HomeroomDashboard />} />
          </Route>

          <Route
            element={
              <ProtectedRoute allowedRoles={[ROLES.PRINCIPAL]}>
                <MainLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/headmaster/dashboard" element={<HeadmasterDashboard />} />
          </Route>

          {/* The Vice Principal's home: the Principal's dashboard, in their words. */}
          <Route
            element={
              <ProtectedRoute allowedRoles={[ROLES.VICE_PRINCIPAL]}>
                <MainLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/vice/dashboard" element={<HeadmasterDashboard desk="vice" />} />
          </Route>

          {/*
            The academic screens, shared with a Vice Principal (backend `89a5666`,
            ticket 19). The paths keep /headmaster — a URL, not vocabulary — and
            each page hides what stays the Principal's alone.
          */}
          <Route
            element={
              <ProtectedRoute allowedRoles={[ROLES.PRINCIPAL, ROLES.VICE_PRINCIPAL]}>
                <MainLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/headmaster/classes" element={<ClassesPage />} />
            <Route path="/headmaster/members" element={<MembersPage />} />
            <Route path="/headmaster/subjects" element={<SubjectsPage />} />
          </Route>

          {/*
            Reviewing join requests, which both a Principal and a Teacher may do —
            a grouping neither block above has. The path carries no role in it for
            the same reason: two roles share the one screen.

            A Teacher who is not a homeroom teacher gets an empty list rather than
            a refusal, which is the backend deciding, not this route.
          */}
          <Route
            element={
              <ProtectedRoute allowedRoles={[ROLES.PRINCIPAL, ROLES.TEACHER]}>
                <MainLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/join-requests" element={<JoinRequestsPage />} />
          </Route>

          {/*
            The question bank (backend ed46340): read by the Principal and Vice
            Principals, written at the Teacher's desk only (owner, 2026-10-07). The
            backend answers anyone else 404.
          */}
          <Route
            element={
              <ProtectedRoute allowedRoles={[ROLES.TEACHER, ROLES.PRINCIPAL, ROLES.VICE_PRINCIPAL]}>
                <MainLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/question-bank" element={<QuestionBankPage />} />
          </Route>
          <Route
            element={
              <ProtectedRoute allowedRoles={[ROLES.TEACHER]}>
                <MainLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/question-bank/new" element={<QuestionEditorPage />} />
            <Route path="/question-bank/:id/edit" element={<QuestionEditorPage />} />
          </Route>

          {/* The guardian's home: their children, and nothing borrowed from the
              student screens, which have no guardian data behind them. */}
          <Route
            element={
              <ProtectedRoute allowedRoles={[ROLES.GUARDIAN]}>
                <MainLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/guardian" element={<GuardianPage />} />
          </Route>

          {/* My Profile is every role's, a guardian's included — the avatar menu
              offers it to all of them. */}
          <Route
            element={
              <ProtectedRoute allowedRoles={[ROLES.STUDENT, ROLES.TEACHER, ROLES.PRINCIPAL, ROLES.GUARDIAN, ROLES.VICE_PRINCIPAL]}>
                <MainLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/profile" element={<ProfilePage />} />
          </Route>

          <Route
            element={
              <ProtectedRoute allowedRoles={[ROLES.STUDENT, ROLES.TEACHER, ROLES.PRINCIPAL, ROLES.VICE_PRINCIPAL]}>
                <MainLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/announcements" element={<AnnouncementPage />} />
            <Route path="/schedule" element={<SchedulePage />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
    </Route>
  )
);

function App() {
  return (
    /*
      Language wraps authentication, not the other way round. The signed-out
      screens need it, and AuthProvider renders nothing at all until it has read
      storage — so anything inside it would have no language during that moment.
    */
    <LanguageProvider>
      <ThemeProvider>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
      </ThemeProvider>
    </LanguageProvider>
  );
}

export default App;
