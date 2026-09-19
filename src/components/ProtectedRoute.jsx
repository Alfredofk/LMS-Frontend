import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * Signed in, and nothing more.
 *
 * /select-role and /no-school are where ProtectedRoute sends people who are
 * missing a role or a school, so they cannot be guarded by it — the redirect
 * would point at itself and spin. They are guarded by this instead.
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

  // No usable role: either no membership at all, or one still waiting on
  // approval. Both are real states, and /no-school is where they are explained.
  if (roles.length === 0) {
    return <Navigate to="/no-school" replace />;
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
