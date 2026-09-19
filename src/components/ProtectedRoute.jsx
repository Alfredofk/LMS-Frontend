import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * Signed in, and nothing more.
 *
 * /select-role is where ProtectedRoute sends people who have no role to enter
 * with, so it cannot be guarded by it — the redirect would point at itself and
 * spin. It is guarded by this instead.
 */
export const RequireAuth = ({ children }) => {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? children : <Navigate to="/login" replace />;
};

/**
 * Route guard: signed in, belongs to a school, and entered as a role this route
 * serves.
 *
 * `allowedRoles` holds the backend's own names — 'STUDENT', 'TEACHER',
 * 'PRINCIPAL' — never lowercase and never 'headmaster'. Omit it for a route any
 * signed-in member may open.
 *
 * The order of the checks is the order of the causes, so a person is never told
 * the wrong thing: somebody with no school is not "unauthorized", they simply
 * have nowhere to be yet.
 */
export const ProtectedRoute = ({ children, allowedRoles }) => {
  const { isAuthenticated, roles, activeRole } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // No usable role: no membership at all, or one still waiting on approval.
  // Both are real states, and /select-role explains them card by card.
  if (roles.length === 0) {
    return <Navigate to="/select-role" replace />;
  }

  // Holds roles but has not said which one they are here as. Only possible with
  // more than one, since a single role is entered automatically.
  if (!activeRole) {
    return <Navigate to="/select-role" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(activeRole)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return children;
};

export default ProtectedRoute;
