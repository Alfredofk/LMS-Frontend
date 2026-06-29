import React, { useState } from 'react';
import LandingPage from './views/Landing/LandingPage';
import LoginPage from './views/Login/LoginPage';
import Toast from './components/ui/Toast';

function App() {
  const [view, setView] = useState('landing'); // 'landing' | 'auth'
  const [initialAuthStep, setInitialAuthStep] = useState('role_selection');
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'info') => {
    setToast({ message, type });
  };

  const closeToast = () => {
    setToast(null);
  };

  // Navigates from landing to sign-in / sign-up / role selection
  const handleNavigate = (step) => {
    setInitialAuthStep(step);
    setView('auth');
  };

  // Navigates back to landing page
  const handleBackToHome = () => {
    setView('landing');
  };

  return (
    <>
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={closeToast}
        />
      )}
      
      {view === 'landing' ? (
        <LandingPage 
          onNavigate={handleNavigate} 
          showToast={showToast} 
        />
      ) : (
        <LoginPage 
          onBackToHome={handleBackToHome} 
          initialAuthStep={initialAuthStep} 
        />
      )}
    </>
  );
}

export default App;
