import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import MainLayout from './layouts/MainLayout';
import LandingPage from './views/Landing/LandingPage';
import LoginPage from './views/Login/LoginPage';
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

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/unauthorized" element={<UnauthorizedPage />} />

          <Route
            element={
              <ProtectedRoute allowedRoles={['student']}>
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
              <ProtectedRoute allowedRoles={['teacher']}>
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
              <ProtectedRoute allowedRoles={['headmaster']}>
                <MainLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/headmaster/dashboard" element={<HeadmasterDashboard />} />
          </Route>

          <Route
            element={
              <ProtectedRoute allowedRoles={['student', 'teacher', 'headmaster']}>
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
  );
}

export default App;
