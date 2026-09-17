import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from '../views/Dashboard/components/Sidebar';
import Navbar from '../views/Dashboard/components/Navbar';
import Toast from '../components/ui/Toast';
import { useAuth } from '../context/AuthContext';

export const MainLayout = () => {
  const { logout } = useAuth();
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'info') => {
    setToast({ message, type });
  };

  const closeToast = () => {
    setToast(null);
  };

  const handleLogout = () => {
    logout();
    showToast('Logged out successfully.', 'success');
  };

  return (
    <div className="h-screen w-screen flex flex-row overflow-hidden bg-slate-50 font-sans antialiased text-slate-800">
      {/* Toast Alert Notifier container */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={closeToast}
        />
      )}

      {/* 1. Sidebar Component (Fixed on Left) */}
      <Sidebar onLogout={handleLogout} showToast={showToast} />

      {/* 2. Main content container */}
      <div className="flex-1 h-full flex flex-col overflow-hidden">
        {/* Navbar */}
        <Navbar showToast={showToast} />

        {/* Scrollable Content Body */}
        <main className="flex-1 overflow-y-auto p-6 sm:p-8">
          <div className="max-w-7xl mx-auto text-left">
            {/* Child routes rendered here */}
            <Outlet context={{ showToast }} />
          </div>
        </main>
      </div>
    </div>
  );
};

export default MainLayout;
