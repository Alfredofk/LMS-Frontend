import { useState } from 'react';
import { authService } from '../services/authService';
import { useAuth } from '../context/AuthContext';

/**
 * Custom hook to handle state and logic of the LMS login/signup form.
 * Keeps UI components pure and focused on layout/rendering.
 */
export const useLoginForm = (initialStep, onAuthSuccess) => {
  const { login } = useAuth();
  // Navigation step: 'role_selection' (Get Started), 'sign_up', 'sign_in'
  const [authStep, setAuthStep] = useState(initialStep || 'role_selection');

  // Active role can be: 'student', 'teacher', 'headmaster' (maps to Organization)
  const [activeRole, setActiveRole] = useState('student');
  
  // Teacher-specific sign-in method: 'google' or 'school_code'
  const [teacherMethod, setTeacherMethod] = useState('google');

  // Input states for SIGN UP
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Input states for SIGN IN (Login)
  const [npsn, setNpsn] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [schoolCode, setSchoolCode] = useState('');
  const [username, setUsername] = useState('');

  // UI state
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  
  // Reusable custom Toast state
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'info') => {
    setToast({ message, type });
  };

  const closeToast = () => {
    setToast(null);
  };

  // Field validation
  const validateForm = () => {
    const tempErrors = {};

    if (authStep === 'sign_up') {
      // SIGN UP validations
      if (!name.trim()) {
        tempErrors.name = activeRole === 'headmaster' 
          ? 'School name is required.' 
          : 'Full name is required.';
      }
      if (!email.trim()) {
        tempErrors.email = 'Email is required.';
      } else if (!/\S+@\S+\.\S+/.test(email)) {
        tempErrors.email = 'Email format is invalid.';
      }
      if (!password) {
        tempErrors.password = 'Password is required.';
      } else if (password.length < 6) {
        tempErrors.password = 'Password must be at least 6 characters.';
      }
      if (!confirmPassword) {
        tempErrors.confirmPassword = 'Confirm password is required.';
      } else if (password !== confirmPassword) {
        tempErrors.confirmPassword = 'Passwords do not match.';
      }
    } else if (authStep === 'sign_in') {
      // SIGN IN validations
      if (activeRole === 'headmaster') {
        if (!npsn) {
          tempErrors.npsn = 'NPSN is required.';
        } else if (!/^\d{8}$/.test(npsn)) {
          tempErrors.npsn = 'NPSN must be an 8-digit number.';
        }
        if (!loginPassword) {
          tempErrors.loginPassword = 'Password is required.';
        } else if (loginPassword.length < 6) {
          tempErrors.loginPassword = 'Password must be at least 6 characters.';
        }
      }

      if (activeRole === 'teacher' && teacherMethod === 'school_code') {
        if (!schoolCode) tempErrors.schoolCode = 'School Code is required.';
        if (!username) tempErrors.username = 'Username/Email is required.';
        if (!loginPassword) tempErrors.loginPassword = 'Password is required.';
      }

      if (activeRole === 'student') {
        if (!schoolCode) tempErrors.schoolCode = 'School Code is required.';
        if (!username) tempErrors.username = 'NISN/Username is required.';
        if (!loginPassword) tempErrors.loginPassword = 'Password is required.';
      }
    }

    setErrors(tempErrors);
    return Object.keys(tempErrors).length === 0;
  };

  // Submit handler
  const handleAuthSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!validateForm()) return;

    setIsLoading(true);
    setErrors({});

    try {
      if (authStep === 'sign_up') {
        const response = await authService.signUp(activeRole, name, email, password);
        console.log('API Response (Sign Up):', response);
        showToast('Registration successful! Your account is created.', 'success');
        
        // Reset and redirect back to role selection
        resetForm();
        setAuthStep('role_selection');
        const userPayload = { ...response.user, role: activeRole };
        login(userPayload);
        if (onAuthSuccess) onAuthSuccess(userPayload);
      } else {
        // Sign In Flow
        let response;
        if (activeRole === 'headmaster') {
          response = await authService.loginWithNpsn(npsn, loginPassword);
        } else if (activeRole === 'teacher') {
          if (teacherMethod === 'google') {
            response = await authService.loginWithGoogle();
          } else {
            response = await authService.loginWithSchoolCode(schoolCode, 'teacher', username, loginPassword);
          }
        } else if (activeRole === 'student') {
          response = await authService.loginWithSchoolCode(schoolCode, 'student', username, loginPassword);
        }
        
        console.log('API Response (Sign In):', response);
        showToast(`Welcome back, ${response.user.name}! Login successful.`, 'success');
        
        // Reset and redirect back to role selection
        resetForm();
        setAuthStep('role_selection');
        const userPayload = { ...response.user, role: response.user.role || activeRole };
        login(userPayload);
        if (onAuthSuccess) onAuthSuccess(userPayload);
      }
    } catch (err) {
      setErrors({ global: err.message || 'Authentication failed. Please try again.' });
      showToast(err.message || 'Authentication failed.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Google Login direct trigger
  const handleGoogleAuth = async () => {
    setIsLoading(true);
    setErrors({});
    try {
      const response = await authService.loginWithGoogle();
      console.log('API Response (Google):', response);
      showToast(`Logged in successfully via Google as ${response.user.name}`, 'success');
      resetForm();
      setAuthStep('role_selection');
      const userPayload = { ...response.user, role: 'teacher' };
      login(userPayload);
      if (onAuthSuccess) onAuthSuccess(userPayload);
    } catch (err) {
      setErrors({ global: err.message || 'Google Auth failed.' });
      showToast(err.message || 'Google authentication failed.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setName('');
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setNpsn('');
    setLoginPassword('');
    setSchoolCode('');
    setUsername('');
    setErrors({});
  };

  return {
    authStep,
    setAuthStep,
    activeRole,
    setActiveRole,
    teacherMethod,
    setTeacherMethod,
    name,
    setName,
    email,
    setEmail,
    password,
    setPassword,
    confirmPassword,
    setConfirmPassword,
    npsn,
    setNpsn,
    loginPassword,
    setLoginPassword,
    schoolCode,
    setSchoolCode,
    username,
    setUsername,
    errors,
    isLoading,
    toast,
    showToast,
    closeToast,
    handleAuthSubmit,
    handleGoogleAuth,
    resetForm,
  };
};

export default useLoginForm;
