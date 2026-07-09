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

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/unauthorized" element={<UnauthorizedPage />} />

          {/* Protected Student Dashboard Route wrapped under MainLayout and Guard */}
          <Route
            element={
              <ProtectedRoute allowedRoles={['student']}>
                <MainLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/dashboard" element={<StudentDashboard />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/classroom" element={<Navigate to="/classroom/matematika-lanjut" replace />} />
            <Route path="/classroom/:courseId" element={<ClassroomPage />} />
            <Route path="/assignment/:assignmentId" element={<AssignmentDetailPage />} />
          </Route>

          {/* Protected Teacher Dashboard Route wrapped under MainLayout and Guard */}
          <Route
            element={
              <ProtectedRoute allowedRoles={['teacher']}>
                <MainLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/teacher/dashboard" element={<TeacherDashboard />} />
            <Route path="/teacher/gradebook" element={<TeacherGradebook />} />
            <Route path="/teacher/create-assignment" element={<CreateAssignmentForm />} />
          </Route>

          {/* Fallback to Home for unmatched routes */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
