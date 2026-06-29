/**
 * Authentication service handling API requests.
 * Simulated network delay for a real enterprise environment.
 */
export const authService = {
  /**
   * Login for Headmaster (Kepala Sekolah / Organization) using NPSN
   */
  async loginWithNpsn(npsn, password) {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        if (!/^\d{8}$/.test(npsn)) {
          return reject(new Error('NPSN harus berupa 8 digit angka.'));
        }
        if (!password || password.length < 6) {
          return reject(new Error('Password minimal 6 karakter.'));
        }

        resolve({
          token: 'mock-jwt-token-headmaster',
          user: {
            role: 'headmaster',
            npsn,
            name: 'Organization Head',
          }
        });
      }, 1200);
    });
  },

  /**
   * Login for Teacher (Guru) using Gmail (OAuth flow)
   */
  async loginWithGoogle() {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          token: 'mock-jwt-token-google-teacher',
          user: {
            role: 'teacher',
            email: 'guru.teladan@gmail.com',
            name: 'Teacher User',
          }
        });
      }, 1500);
    });
  },

  /**
   * Login for Teacher or Student using School Code
   */
  async loginWithSchoolCode(schoolCode, role, username, password) {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        if (!schoolCode || schoolCode.trim().length < 4) {
          return reject(new Error('School Code tidak valid (minimal 4 karakter).'));
        }
        if (!username || username.trim().length === 0) {
          return reject(new Error('Username/Nomor Induk wajib diisi.'));
        }
        if (!password || password.length < 6) {
          return reject(new Error('Password minimal 6 karakter.'));
        }

        resolve({
          token: `mock-jwt-token-${role}`,
          user: {
            role,
            schoolCode,
            username,
            name: role === 'student' ? 'Student User' : 'Teacher User',
          }
        });
      }, 1200);
    });
  },

  /**
   * Sign Up for Organization, Teacher, or Student
   */
  async signUp(role, name, email, password) {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        if (!name || name.trim().length < 3) {
          return reject(new Error('Nama lengkap / sekolah minimal 3 karakter.'));
        }
        if (!email || !/\S+@\S+\.\S+/.test(email)) {
          return reject(new Error('Email tidak valid.'));
        }
        if (!password || password.length < 6) {
          return reject(new Error('Password minimal 6 karakter.'));
        }

        resolve({
          token: `mock-jwt-token-registered-${role}`,
          user: {
            role,
            name,
            email,
            message: 'Registrasi berhasil!'
          }
        });
      }, 1200);
    });
  }
};

export default authService;
