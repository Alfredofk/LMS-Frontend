import React, { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import ProfileHeader from './components/ProfileHeader';
import BadgeCase from './components/BadgeCase';
import LeaderboardWidget from './components/LeaderboardWidget';
import Button from '../../components/ui/Button';
import { Lock, Save, User, Mail, Shield } from 'lucide-react';

export const ProfilePage = () => {
  const { user } = useAuth();
  const { showToast } = useOutletContext();
  const isTeacher = user?.role === 'teacher';

  // State management for teacher password change
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handlePasswordSubmit = (e) => {
    e.preventDefault();
    if (!oldPassword || !newPassword || !confirmPassword) {
      showToast('Semua input form ganti password wajib diisi.', 'warning');
      return;
    }
    if (newPassword !== confirmPassword) {
      showToast('Konfirmasi password baru tidak cocok.', 'warning');
      return;
    }
    showToast('Memproses penggantian password...', 'info');
    setTimeout(() => {
      showToast('Password administratif berhasil diperbarui!', 'success');
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    }, 1000);
  };

  // Get Initials dynamically
  const getInitials = () => {
    if (!user || !user.name) return 'AR';
    return user.name
      .split(' ')
      .map(n => n[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();
  };

  // ==========================================
  // VIEW: Teacher Administrative Profile Layout
  // ==========================================
  if (isTeacher) {
    return (
      <div className="space-y-6 text-left">
        
        <div className="pb-4 select-none">
          <h1 className="text-xl sm:text-2xl font-black text-slate-905 tracking-tight leading-tight flex items-center gap-2">
            <Shield className="w-6 h-6 text-[#7047EB]" />
            Profil Administratif Guru
          </h1>
          <p className="text-xs font-semibold text-slate-500">
            Kelola detail profil institusi dan keamanan sandi Anda.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          
          {/* Left Column: Basic Teacher Details (NIP, Contact) */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow duration-200 text-center select-none space-y-5">
              
              {/* Profile Avatar circle */}
              <div className="w-20 h-20 rounded-full bg-violet-100 text-[#7047EB] flex items-center justify-center font-black text-2xl mx-auto border-2 border-white ring-4 ring-violet-50 shadow-inner">
                {getInitials()}
              </div>

              {/* Bio Detail info */}
              <div className="space-y-1.5">
                <h3 className="text-base font-extrabold text-slate-805">
                  {user?.name || 'Teacher User'}
                </h3>
                <p className="text-xs text-slate-500 font-bold">
                  Guru Mata Pelajaran
                </p>
                <div className="px-2.5 py-0.5 bg-[#F1EEFF] text-[#7047EB] text-[10px] font-black rounded-md inline-block">
                  NIP {user?.username && !user.username.includes('@') ? user.username : '197805122003122002'}
                </div>
              </div>

              <div className="border-t border-slate-100 pt-4 space-y-3.5 text-xs text-left font-bold text-slate-600">
                <div className="flex items-center gap-2.5">
                  <Mail className="w-4 h-4 text-slate-400 shrink-0" />
                  <div>
                    <span className="text-[10px] text-slate-450 block font-semibold leading-none mb-0.5">Surel Institusi</span>
                    <span className="truncate block max-w-[200px]" title={user?.email || 'teacher.teladan@gmail.com'}>
                      {user?.email || 'teacher.teladan@gmail.com'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2.5">
                  <User className="w-4 h-4 text-slate-400 shrink-0" />
                  <div>
                    <span className="text-[10px] text-slate-450 block font-semibold leading-none mb-0.5">Sekolah Pengampu</span>
                    <span>{user?.schoolName || 'SMA Patroli Jaya'}</span>
                  </div>
                </div>
              </div>

            </div>
          </div>

          {/* Right Column: Security Change Password Form */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white border border-slate-100 rounded-2xl p-6 sm:p-8 shadow-sm hover:shadow-md transition-shadow duration-200 space-y-6">
              
              <div className="space-y-1 pb-4 border-b border-slate-100 select-none">
                <h3 className="text-sm font-extrabold text-slate-855 tracking-tight flex items-center gap-1.5">
                  <Lock className="w-4 h-4 text-[#7047EB] shrink-0" />
                  Perbarui Kata Sandi
                </h3>
                <p className="text-[11px] text-slate-400 font-semibold">
                  Demi keamanan akun, harap gunakan kombinasi kata sandi yang kuat dan unik.
                </p>
              </div>

              <form onSubmit={handlePasswordSubmit} className="space-y-4">
                
                {/* Old Password Input */}
                <div className="space-y-1.5">
                  <label className="text-xs font-black text-slate-700 select-none">
                    Kata Sandi Lama
                  </label>
                  <input
                    type="password"
                    placeholder="••••••••"
                    value={oldPassword}
                    onChange={(e) => setOldPassword(e.target.value)}
                    className="w-full text-xs font-semibold border border-slate-200 rounded-xl px-3.5 py-3 focus:outline-none focus:border-[#7047EB] transition-colors bg-white shadow-sm"
                  />
                </div>

                {/* Grid side by side for new credentials */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-black text-slate-700 select-none">
                      Kata Sandi Baru
                    </label>
                    <input
                      type="password"
                      placeholder="••••••••"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full text-xs font-semibold border border-slate-200 rounded-xl px-3.5 py-3 focus:outline-none focus:border-[#7047EB] transition-colors bg-white shadow-sm"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-black text-slate-700 select-none">
                      Konfirmasi Kata Sandi Baru
                    </label>
                    <input
                      type="password"
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full text-xs font-semibold border border-slate-200 rounded-xl px-3.5 py-3 focus:outline-none focus:border-[#7047EB] transition-colors bg-white shadow-sm"
                    />
                  </div>
                </div>

                {/* Actions button */}
                <div className="pt-2 flex justify-end">
                  <Button
                    type="submit"
                    className="bg-[#7047EB] hover:bg-[#5E3BD2] text-white py-2.5 px-5 rounded-xl font-bold shadow-md shadow-violet-500/10 cursor-pointer text-xs flex items-center justify-center gap-1.5"
                  >
                    <Save className="w-4 h-4" />
                    Simpan Sandi Baru
                  </Button>
                </div>

              </form>

            </div>
          </div>

        </div>

      </div>
    );
  }

  // ==========================================
  // VIEW: Student Gamified Profile Layout (Default)
  // ==========================================
  return (
    <div className="space-y-6">
      
      {/* 1. Header (Profile info + XP progress) */}
      <ProfileHeader />

      {/* 2. Grid split content */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Badge cabinet (Left - 8 columns on desktop) */}
        <div className="lg:col-span-8">
          <BadgeCase />
        </div>

        {/* Leaderboard ranking (Right - 4 columns on desktop) */}
        <div className="lg:col-span-4">
          <LeaderboardWidget />
        </div>

      </div>

    </div>
  );
};

export default ProfilePage;
