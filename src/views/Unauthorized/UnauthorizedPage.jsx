import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Button from '../../components/ui/Button';

export const UnauthorizedPage = () => {
  const navigate = useNavigate();
  const { logout } = useAuth();

  const handleBackToHome = () => {
    logout();
    navigate('/', { replace: true });
  };

  const handleSwitchAccount = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-screen w-screen bg-slate-50 flex items-center justify-center p-6 text-center font-sans antialiased text-slate-800">
      <div className="max-w-md w-full bg-white rounded-3xl border border-slate-100 shadow-2xl p-8 sm:p-12 space-y-6">
        {/* Warning Icon Badge */}
        <div className="w-16 h-16 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center mx-auto shadow-inner">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-8 h-8">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m0-10.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.75c0 5.592 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.57-.598-3.75h-.152c-3.196 0-6.1-1.249-8.25-3.286zm0 13.036h.008v.008H12v-.008z" />
          </svg>
        </div>

        {/* Details */}
        <div className="space-y-2">
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Access Denied</h1>
          <p className="text-xs sm:text-sm text-slate-400 font-bold leading-relaxed">
            Anda tidak memiliki otorisasi untuk mengakses rute/dashboard ini. Silakan masuk menggunakan akun yang sesuai.
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
          <Button
            onClick={handleBackToHome}
            variant="outline"
            className="flex-1 rounded-xl py-3 text-sm font-bold border border-slate-200 text-slate-700 hover:bg-slate-50 cursor-pointer"
          >
            Go to Home
          </Button>
          <Button
            onClick={handleSwitchAccount}
            className="flex-1 rounded-xl py-3 text-sm font-bold bg-[#7047EB] hover:bg-[#5E3BD2] text-white shadow-md cursor-pointer"
          >
            Switch Account
          </Button>
        </div>
      </div>
    </div>
  );
};

export default UnauthorizedPage;
