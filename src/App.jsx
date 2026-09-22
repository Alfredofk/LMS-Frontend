import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { LanguageProvider } from './i18n/LanguageContext';
import ProtectedRoute, { RequireAuth } from './components/ProtectedRoute';
import MainLayout from './layouts/MainLayout';
import LandingPage from './views/Landing/LandingPage';
import LoginPage from './views/Login/LoginPage';
import SelectRolePage from './views/Role/SelectRolePage';
import GetStartedPage from './views/Role/GetStartedPage';
import AccountPage from './views/Account/AccountPage';
import AccountChrome from './views/Account/AccountChrome';
import AdminLayout from './layouts/AdminLayout';
import AdminRegistrationsPage from './views/Admin/AdminRegistrationsPage';
import VerifyEmailPage from './views/Verify/VerifyEmailPage';
import ForgotPasswordPage from './views/Password/ForgotPasswordPage';
import ResetPasswordPage from './views/Password/ResetPasswordPage';
import { ROLES } from './constants/roles';
import StudentDashboard from './views/Dashboard/StudentDashboard';
import TeacherDashboard from './views/Dashboard/TeacherDashboard';
import TeacherGradebook from './views/Gradebook/TeacherGradebook';
import CreateAssignmentForm from './views/Assignment/CreateAssignmentForm';
import ProfilePage from './views/Profile/ProfilePage';
import ClassroomPage from './views/Classroom/ClassroomPage';
import AssignmentDetailPage from './views/Assignment/AssignmentDetailPage';
import UnauthorizedPage from './views/Unauthorized/UnauthorizedPage';
import CourseDetail from './views/Course/CourseDetail';
import TeacherCourses from './views/Course/TeacherCourses';
import HomeroomDashboard from './views/Homeroom/HomeroomDashboard';
import HeadmasterDashboard from './views/Dashboard/HeadmasterDashboard';
import StudentScores from './views/Scores/StudentScores';
import AnnouncementPage from './views/Announcement/AnnouncementPage';
import SchedulePage from './views/Schedule/SchedulePage';
import AssessmentPage from './views/Assessment/AssessmentPage';
import AttendancePage from './views/Attendance/AttendancePage';
import JoinRequestsPage from './views/Requests/JoinRequestsPage';

function App() {
  return (
    /*
      Language wraps authentication, not the other way round. The signed-out
      screens need it, and AuthProvider renders nothing at all until it has read
      storage — so anything inside it would have no language during that moment.
    */
    <LanguageProvider>
      <AuthProvider>
        <BrowserRouter>
        <Routes>
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
            <Route path="/classroom/:courseId" element={<ClassroomPage />} />
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
            <Route path="/teacher/courses/:courseId" element={<CourseDetail />} />
            <Route path="/teacher/gradebook" element={<TeacherGradebook />} />
            <Route path="/teacher/create-assignment" element={<CreateAssignmentForm />} />
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

          <Route
            element={
              <ProtectedRoute allowedRoles={[ROLES.STUDENT, ROLES.TEACHER, ROLES.PRINCIPAL]}>
                <MainLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/announcements" element={<AnnouncementPage />} />
            <Route path="/schedule" element={<SchedulePage />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </BrowserRouter>
      </AuthProvider>
    </LanguageProvider>
  );
}

export default App;
