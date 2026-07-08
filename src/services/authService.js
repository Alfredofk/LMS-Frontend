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
   * Login for Teacher (Guru) or Student using Gmail (OAuth flow)
   */
  async loginWithGoogle(role) {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          token: `mock-jwt-token-google-${role || 'teacher'}`,
          user: {
            role: role || 'teacher',
            email: role === 'student' ? 'student.teladan@gmail.com' : 'guru.teladan@gmail.com',
            name: role === 'student' ? 'Student User' : 'Teacher User',
          }
        });
      }, 1500);
    });
  },

  /**
   * Login for Teacher or Student using School Code
   */
  async loginWithSchoolCode(schoolCode, role, username, password) {
    if (role === 'student') {
      const response = await fetch('/api/auth/student/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ schoolCode, username, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        const error = new Error(data.error || 'Login gagal.');
        error.field = data.field;
        throw error;
      }

      localStorage.setItem('token', data.token);
      return data;
    }

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
    const response = await fetch('/api/auth/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ role, name, email, password }),
    });

    const data = await response.json();

    if (!response.ok) {
      const error = new Error(data.error || 'Registrasi gagal.');
      error.field = data.field;
      throw error;
    }

    localStorage.setItem('token', data.token);
    return data;
  }
};

export default authService;
