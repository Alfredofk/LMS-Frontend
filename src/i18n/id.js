/*
  Bahasa Indonesia, dan bahasa bawaan aplikasi ini — penggunanya sekolah
  Indonesia. Kuncinya harus sama persis dengan ./en.js.

  Beberapa kalimat sengaja tidak diterjemahkan kata per kata. "Organization" pada
  kartu pemilih peran berarti *mendaftarkan sekolah baru*, jadi di sini ia
  berbunyi "Sekolah" — yang menyampaikan maksudnya, bukan bunyinya. Istilah yang
  memang nama resmi — NPSN, KTP, SD, SMP, SMA, SMK — dibiarkan apa adanya.
*/
export default {
  // --- bersama -----------------------------------------------------------
  'common.continue': 'Lanjutkan',
  'common.backToSignIn': 'Kembali ke halaman masuk',
  'common.signOut': 'Keluar',
  'common.loading': 'Memuat…',
  'common.checking': 'Memeriksa…',
  'common.sending': 'Mengirim…',
  'common.or': 'atau',

  'lang.switch': 'Ganti bahasa',
  'lang.id': 'Indonesia',
  'lang.en': 'English',

  // --- halaman depan -----------------------------------------------------
  'landing.nav.home': 'Beranda',
  'landing.nav.course': 'Kelas',
  'landing.nav.mentor': 'Pengajar',
  'landing.nav.about': 'Tentang kami',
  'landing.nav.signIn': 'Masuk',
  'landing.nav.register': 'Daftar',
  'landing.onHomeAlready': 'Anda sedang berada di halaman utama.',
  'landing.underConstruction': 'Fitur "{feature}" masih dalam pengerjaan.',

  'landing.hero.lead': 'Buka',
  'landing.hero.accentOne': 'Dunia',
  'landing.hero.accentTwo': 'Pembelajaran',
  'landing.hero.trail': 'Tanpa Batas',
  'landing.hero.subtitle':
    'Kembangkan kemampuan Anda bersama kelas daring dan pengajar berpengalaman. Jalan menuju keberhasilan dimulai di sini.',
  'landing.hero.getStarted': 'Mulai Sekarang',
  'landing.hero.contact': 'Hubungi Kami',

  'landing.stats.classes': 'Kelas Terkelola',
  'landing.stats.schools': 'Sekolah Mitra',
  'landing.stats.users': 'Pengguna',

  'landing.features.title': 'Fitur Lengkap untuk',
  'landing.features.titleAccent': 'Pembelajaran Modern',
  'landing.features.subtitle': 'Jelajahi fitur-fitur andalan kami',

  'landing.feature.builder.title': 'Penyusun Materi',
  'landing.feature.builder.desc': 'Membuat dan menata materi pelajaran.',
  'landing.feature.quiz.title': 'Kuis & Ujian',
  'landing.feature.quiz.desc': 'Menyusun kuis dan penilaian.',
  'landing.feature.progress.title': 'Pemantauan Kemajuan',
  'landing.feature.progress.desc': 'Memantau perkembangan tiap siswa.',
  'landing.feature.forum.title': 'Forum Diskusi',
  'landing.feature.forum.desc': 'Berdiskusi bersama di satu tempat.',
  'landing.feature.insights.title': 'Wawasan Belajar',
  'landing.feature.insights.desc': 'Masukan yang disesuaikan dengan capaian tiap siswa.',
  'landing.feature.chatbot.title': 'Chatbot',
  'landing.feature.chatbot.desc': 'Menjawab pertanyaan Anda kapan saja.',

  'landing.footer.tagline':
    'Platform pembelajaran modern untuk menyusun, mengelola, dan menyampaikan pengalaman belajar yang bermakna bagi semua.',
  'landing.footer.platform': 'Platform',
  'landing.footer.features': 'Fitur',
  'landing.footer.pricing': 'Harga',
  'landing.footer.integrations': 'Integrasi',
  'landing.footer.updates': 'Pembaruan',
  'landing.footer.support': 'Bantuan',
  'landing.footer.helpCenter': 'Pusat Bantuan',
  'landing.footer.contact': 'Hubungi Kami',
  'landing.footer.faq': 'Tanya Jawab',
  'landing.footer.resources': 'Sumber Daya',
  'landing.footer.guides': 'Panduan',
  'landing.footer.apiDocs': 'Dokumentasi API',
  'landing.footer.webinars': 'Webinar',
  'landing.footer.community': 'Komunitas',
  'landing.footer.legal': 'Legal',
  'landing.footer.terms': 'Ketentuan Layanan',
  'landing.footer.privacy': 'Kebijakan Privasi',
  'landing.footer.cookies': 'Kebijakan Cookie',
  'landing.footer.rights': '© 2026 EduForID - Seluruh hak cipta dilindungi.',

  // --- masuk / daftar ----------------------------------------------------
  'auth.back': 'Kembali',
  'auth.backToHome': 'Kembali ke halaman utama',
  'auth.signUp.title': 'Buat',
  'auth.signUp.titleAccent': 'akun Anda',
  'auth.signUp.subtitle': 'Mulai perjalanan Anda bersama EduForID',
  'auth.signIn.title': 'Selamat',
  'auth.signIn.titleAccent': 'datang kembali',
  'auth.signIn.subtitle': 'Masuk untuk melanjutkan ke EduForID',

  'auth.field.fullName': 'Masukkan nama lengkap Anda',
  'auth.field.email': 'Masukkan email Anda',
  'auth.field.password': 'Masukkan kata sandi Anda',
  'auth.field.confirmPassword': 'Ulangi kata sandi Anda',
  'auth.rememberMe': 'Ingat saya',
  'auth.forgotPassword': 'Lupa kata sandi?',
  'auth.haveAccount': 'Sudah punya akun?',
  'auth.noAccount': 'Belum punya akun?',
  'auth.signInLink': 'Masuk',
  'auth.signUpLink': 'Daftar',
  'auth.terms': 'Dengan menekan tombol di atas, Anda menyetujui',
  'auth.termsOfUse': 'ketentuan layanan',
  'auth.and': 'dan',
  'auth.privacy': 'kebijakan privasi',
  'auth.verifiedNotice': 'Email Anda sudah terverifikasi. Silakan masuk untuk melanjutkan.',
  'auth.resendLink': 'Kirim ulang tautan konfirmasi',
  'auth.welcomeBack': 'Selamat datang kembali, {name}.',
  'auth.welcome': 'Selamat datang, {name}.',

  'auth.panel.signUp.heading': 'Buat akun EduForID Anda',
  'auth.panel.signUp.a': 'Satu akun, apa pun sebutan Anda di sekolah',
  'auth.panel.signUp.b': 'Peran diberikan setelah sekolah menyetujui Anda',
  'auth.panel.signUp.c': 'Kelas, nilai, dan jadwal dalam satu tempat',
  'auth.panel.checkEmail.heading': 'Tinggal satu tautan lagi',
  'auth.panel.checkEmail.a': 'Buka tautan yang baru kami kirim',
  'auth.panel.checkEmail.b': 'Kembali ke sini dan lanjutkan — tanpa mengetik ulang',
  'auth.panel.checkEmail.c': 'Tautannya berlaku 24 jam',
  'auth.panel.signIn.heading': 'Selamat datang kembali di EduForID',
  'auth.panel.signIn.a': 'Lanjutkan tepat dari tempat Anda berhenti',
  'auth.panel.signIn.b': 'Berpindah peran tanpa perlu keluar',
  'auth.panel.signIn.c': 'Semua dari sekolah Anda dalam satu tempat',

  // --- cek email ---------------------------------------------------------
  'checkEmail.title': 'Periksa',
  'checkEmail.titleAccent': 'email Anda',
  'checkEmail.subtitle':
    'Akun Anda sudah dibuat. Tinggal satu tautan antara Anda dan EduForID.',
  'checkEmail.sentTo': 'Tautan dikirim ke',
  'checkEmail.hint':
    'Buka tautannya, lalu kembali ke sini. Tautan berlaku 24 jam. Kalau tidak ada di kotak masuk, coba periksa folder spam.',
  'checkEmail.verified': 'Saya sudah verifikasi — lanjutkan',
  'checkEmail.resend': 'Kirim ulang tautannya',
  'checkEmail.notOpened':
    'Tautannya belum dibuka. Periksa kotak masuk Anda, lalu coba lagi.',
  'checkEmail.resent': 'Kalau {email} memiliki akun, tautan baru sedang dikirim.',
  'checkEmail.resendFailed': 'Tautannya gagal dikirim. Silakan coba lagi.',
  'checkEmail.created': 'Akun berhasil dibuat. Periksa {email} untuk tautan konfirmasinya.',

  // --- verifikasi email --------------------------------------------------
  'verify.panel.heading': 'Sedikit Lagi',
  'verify.panel.blurb':
    'Mengonfirmasi alamat email adalah cara akun ini tetap terikat pada orang yang bisa dikenali sekolah.',
  'verify.checking.title': 'Memverifikasi',
  'verify.checking.titleAccent': 'email Anda',
  'verify.checking.note': 'Mohon tunggu sebentar…',
  'verify.error.title': 'Tautan ini tidak',
  'verify.error.titleAccent': 'berfungsi',
  'verify.error.noToken':
    'Tautan ini tidak membawa token. Buka tautannya langsung dari email Anda.',
  'verify.error.invalid': 'Tautan ini sudah tidak berlaku.',
  'verify.resend.label': 'Kirim tautan baru',
  'verify.resend.hint':
    'Tautan kedaluwarsa 24 jam setelah dikirim. Masukkan alamat yang Anda daftarkan dan kami kirimkan yang baru.',
  'verify.resend.action': 'Kirim tautannya',

  // --- lupa kata sandi ---------------------------------------------------
  'forgot.panel.heading': 'Lupa Kata Sandi',
  'forgot.panel.blurb':
    'Wajar saja. Sebutkan alamat yang Anda daftarkan, dan kami kirimkan jalan masuknya kembali.',
  'forgot.title': 'Atur ulang',
  'forgot.titleAccent': 'kata sandi',
  'forgot.subtitle': 'Kami akan mengirim tautan untuk memilih kata sandi baru',
  'forgot.action': 'Kirim tautannya',
  'forgot.failed': 'Tautannya gagal dikirim. Silakan coba lagi.',
  'forgot.sent.panelHeading': 'Periksa Kotak Masuk',
  'forgot.sent.panelBlurb':
    'Tautan pengaturan ulang sedang dikirim, kalau alamat itu memang memiliki akun.',
  'forgot.sent.title': 'Periksa',
  'forgot.sent.titleAccent': 'email Anda',
  'forgot.sent.body':
    'Kalau alamat itu memiliki akun, tautan pengaturan ulang sudah dikirim ke sana. Tautannya berlaku satu jam.',
  'forgot.sent.hint':
    'Belum ada yang masuk? Periksa folder spam, atau pastikan alamat yang Anda ketik sama dengan yang didaftarkan — kami tidak bisa memberi tahu apakah alamat itu terdaftar.',
  'forgot.sent.other': 'Pakai alamat lain',

  // --- atur ulang kata sandi ---------------------------------------------
  'reset.checking.panelHeading': 'Sebentar',
  'reset.checking.panelBlurb': 'Memeriksa apakah tautan ini masih berlaku.',
  'reset.checking.note': 'Memeriksa tautan Anda…',
  'reset.rejected.panelHeading': 'Tautan Ini Sudah Terpakai',
  'reset.rejected.panelBlurb':
    'Tautan pengaturan ulang berlaku satu jam dan hanya sekali pakai. Meminta yang baru hanya perlu sebentar.',
  'reset.rejected.title': 'Tautan ini tidak',
  'reset.rejected.titleAccent': 'berfungsi',
  'reset.rejected.noToken':
    'Tautan ini tidak membawa token. Buka tautannya langsung dari email Anda.',
  'reset.rejected.invalid': 'Tautan pengaturan ulang ini tidak sah atau sudah kedaluwarsa.',
  'reset.rejected.action': 'Minta tautan baru',
  'reset.form.panelHeading': 'Pilih Kata Sandi Baru',
  'reset.form.panelBlurb':
    'Pilih yang belum pernah Anda pakai di sini. Tautan ini hanya berlaku sekali.',
  'reset.form.title': 'Kata sandi',
  'reset.form.titleAccent': 'baru',
  'reset.form.subtitle': 'Anda akan dikeluarkan dari semua perangkat setelah ini berubah',
  'reset.form.newPassword': 'Masukkan kata sandi baru',
  'reset.form.confirm': 'Ulangi kata sandi baru',
  'reset.form.action': 'Ubah kata sandi saya',
  'reset.form.failed': 'Kata sandi Anda gagal diubah.',
  'reset.done.panelHeading': 'Kata Sandi Berubah',
  'reset.done.panelBlurb':
    'Akun Anda kembali menjadi milik Anda. Semua perangkat lain sudah dikeluarkan.',
  'reset.done.title': 'Kata sandi',
  'reset.done.titleAccent': 'berubah',
  'reset.done.body':
    'Mengubah kata sandi mengeluarkan akun dari semua perangkat, termasuk yang ini. Masuk lagi dengan yang baru.',
  'reset.done.action': 'Masuk sekarang',
  'reset.done.fallback': 'Kata sandi berhasil diubah.',

  // --- peran -------------------------------------------------------------
  'role.STUDENT.label': 'Siswa',
  'role.TEACHER.label': 'Guru',
  'role.PRINCIPAL.label': 'Sekolah',
  'role.GUARDIAN.label': 'Wali Murid',
  'role.STUDENT.tagline': 'Bergabung ke kelas dan mulai belajar',
  'role.TEACHER.tagline': 'Menyusun dan mengelola mata pelajaran Anda',
  'role.PRINCIPAL.tagline': 'Menyiapkan EduForID untuk sekolah Anda',
  'role.GUARDIAN.tagline': 'Memantau perkembangan anak Anda',

  'selectRole.panel.hasRoles': 'Belajar Lebih Cerdas Dimulai di Sini',
  'selectRole.panel.pending': 'Sedikit Lagi',
  'selectRole.panel.fresh': 'Pilih Jalan Masuk Anda',
  'selectRole.blurb.hasRoles':
    'Anda masuk di {school}. Pilih bagaimana Anda ingin melanjutkan.',
  'selectRole.blurb.pending':
    'Permintaan Anda sudah terkirim. Sebuah sekolah hanya bisa dimasuki setelah ada yang menyetujuinya di sana.',
  'selectRole.blurb.fresh':
    'Pilih yang sesuai. Bergabung ke sekolah dan mendirikan sekolah adalah dua jalan berbeda, dan masing-masing menyebutkan apa yang dibutuhkan.',
  'selectRole.title': 'Mulai Sekarang',
  'selectRole.signedInAs': 'Masuk sebagai {name}',
  'selectRole.explain.pending':
    'Anda mengajukan diri bergabung ke {school}. Tidak ada lagi yang perlu Anda lakukan — halaman ini memperbarui dirinya sendiri begitu ada yang menjawab di sana.',
  'selectRole.explain.fresh.a': 'Siswa',
  'selectRole.explain.fresh.b': 'Guru',
  'selectRole.explain.fresh.middle': 'bergabung ke sekolah yang sudah ada, dengan kodenya.',
  'selectRole.explain.fresh.c': 'Sekolah',
  'selectRole.explain.fresh.end': 'mendaftarkan sekolah baru.',
  'selectRole.note.pending': 'Menunggu persetujuan dari sekolah Anda',
  'selectRole.note.rejected': 'Tidak disetujui — Anda bisa mengajukan lagi',
  'selectRole.badge.PENDING': 'MENUNGGU',
  'selectRole.badge.REJECTED': 'DITOLAK',
  'selectRole.checkAgain': 'Periksa lagi',
  'selectRole.nothingChanged': 'Belum ada perubahan. Coba lagi nanti.',
  'selectRole.loadFailed': 'Peran Anda gagal dimuat.',
  'selectRole.notAvailable': 'Peran itu tidak tersedia pada akun Anda.',

  // --- mulai -------------------------------------------------------------
  'getStarted.needLabel': 'Yang perlu Anda siapkan',
  'getStarted.thenWhat': 'Setelah itu',
  'getStarted.notOpen': 'Belum dibuka — bagian EduForID ini masih dalam pengerjaan.',
  'getStarted.back': 'Kembali ke tiga pilihan',

  'getStarted.org.panelHeading': 'Dirikan Sekolah',
  'getStarted.org.panelBlurb':
    'Tidak ada sekolah yang bisa memberikan peran ini — sekolahnya memang belum ada. Anda mengajukan, dan EduForID sendiri yang meninjau.',
  'getStarted.org.title': 'Daftarkan',
  'getStarted.org.titleAccent': 'sekolah Anda',
  'getStarted.org.subtitle': 'Siapkan EduForID untuk sekolah yang belum ada di sini',
  'getStarted.org.need.npsn': 'NPSN',
  'getStarted.org.need.npsnDetail':
    'Delapan digit angka yang menjadi identitas sekolah Anda secara nasional.',
  'getStarted.org.need.name': 'Nama dan jenjang sekolah',
  'getStarted.org.need.nameDetail': 'SD, SMP, SMA, atau SMK.',
  'getStarted.org.need.city': 'Kota',
  'getStarted.org.need.cityDetail': 'Lokasi sekolahnya.',
  'getStarted.org.need.phone': 'Nomor telepon',
  'getStarted.org.need.phoneDetail': 'Agar Anda bisa dihubungi mengenai pengajuan ini.',
  'getStarted.org.need.ktp': 'Foto KTP Anda',
  'getStarted.org.need.ktpDetail': 'Bukti bahwa Anda memang orang yang Anda sebutkan.',
  'getStarted.org.approval':
    'Seorang administrator EduForID meninjau setiap pengajuan satu per satu. Begitu disetujui, sekolahnya dibuat dan Anda menjadi kepala sekolahnya.',
  'getStarted.org.action': 'Daftarkan sekolah saya',

  'getStarted.join.panelHeading': 'Temukan Sekolah Anda',
  'getStarted.join.panelBlurb':
    'Sekolah membagikan sebuah kode kepada orang-orang yang menjadi bagiannya. Kode itulah yang memberi tahu aplikasi ini sekolah mana yang Anda maksud.',
  'getStarted.join.title': 'Bergabung ke',
  'getStarted.join.titleAccent': 'sekolah Anda',
  'getStarted.join.subtitle': 'Ajukan diri untuk ditambahkan sebagai {role}',
  'getStarted.join.need.code': 'Kode Sekolah',
  'getStarted.join.need.codeDetail':
    'Kode yang dibagikan sekolah Anda kepada para {role}. Tanyakan kepada tata usaha sekolah.',
  'getStarted.join.approval':
    'Sekolah Anda menerima permintaan itu dan memutuskan. Sampai ada yang menyetujuinya di sana, kartu {Role} tetap terkunci — dan Anda hanya bisa memiliki satu permintaan berjalan.',
  'getStarted.join.action': 'Masukkan kode sekolah',

  // --- tidak berwenang ---------------------------------------------------
  'unauthorized.title': 'Akses Ditolak',
  'unauthorized.canSwitch':
    'Halaman ini tidak dilayani oleh peran yang sedang Anda pakai. Ganti peran, atau kembali ke beranda.',
  'unauthorized.cannotSwitch':
    'Anda tidak berwenang membuka halaman ini. Silakan masuk dengan akun yang sesuai.',
  'unauthorized.home': 'Kembali ke Beranda',
  'unauthorized.switchRole': 'Ganti Peran',
  'unauthorized.switchAccount': 'Ganti Akun',

  // --- kerangka aplikasi -------------------------------------------------
  'shell.mainMenu': 'Menu Utama',
  'shell.activities': 'Aktivitas',
  'shell.account': 'Akun',
  'shell.dashboard': 'Dasbor',
  'shell.myCourses': 'Kelas Saya',
  'shell.gradebook': 'Buku Nilai',
  'shell.schedule': 'Jadwal',
  'shell.homeroom': 'Kelas Perwalian',
  'shell.scores': 'Nilai',
  'shell.chatbot': 'Chatbot',
  'shell.assessment': 'Penilaian',
  'shell.attendance': 'Kehadiran',
  'shell.announcement': 'Pengumuman',
  'shell.myProfile': 'Profil Saya',
  'shell.switchRole': 'Ganti Peran',
  'shell.logOut': 'Keluar',
  'shell.noSchool': 'Belum ada sekolah',
  'shell.account.fallback': 'Akun',
  'shell.underConstruction': 'Fitur "{feature}" masih dalam pengerjaan.',
  'shell.search': 'Cari…',
  'shell.notifications': 'Notifikasi',
  'shell.backToDashboard': 'Kembali ke Dasbor',
  'shell.delete': 'Hapus',
  'shell.markAllRead': 'Tandai semua terbaca',
  'shell.allMarkedRead': 'Semua notifikasi ditandai sebagai terbaca.',
  'shell.noNotifications': 'Tidak ada notifikasi untuk Anda.',
  'shell.viewNotifications': 'Lihat notifikasi',
  'shell.time.justNow': 'Baru saja',
  'shell.time.minutes': '{n} menit lalu',
  'shell.time.hours': '{n} jam lalu',
  'shell.time.days': '{n} hari lalu',
  'shell.title.teacherDashboard': 'Dasbor Guru',
  'shell.title.createAssignment': 'Buat Tugas',

  'roleTitle.STUDENT': 'Siswa',
  'roleTitle.TEACHER': 'Guru',
  'roleTitle.PRINCIPAL': 'Kepala Sekolah',
  'roleTitle.GUARDIAN': 'Wali Murid',
  'roleTitle.fallback': 'Anggota',

  // --- kesalahan dari server ---------------------------------------------
  'error.unauthorized': 'Sesi Anda sudah berakhir. Silakan masuk kembali.',
  'error.badCredentials': 'Email atau kata sandi salah.',
  'error.googleRejected': 'Google tidak dapat memastikan proses masuk itu. Silakan coba lagi.',
  'error.emailNotVerified':
    'Email ini belum dikonfirmasi. Periksa kotak masuk Anda, atau kirim ulang tautannya.',
  'error.conflict': 'Sudah ada akun dengan email ini.',
  'error.badRequest':
    'Sebagian isian Anda tidak diterima. Periksa kembali kolomnya lalu coba lagi.',
  'error.notFound': 'Kami tidak menemukannya.',
  'error.unreachable': 'Server tidak dapat dihubungi. Periksa koneksi Anda lalu coba lagi.',
  'error.unknown': 'Terjadi kesalahan. Silakan coba lagi.',
  'error.authFailed': 'Autentikasi gagal. Silakan coba lagi.',
  'error.googleFailed': 'Masuk dengan Google gagal.',
  'error.signInFailed': 'Anda gagal dimasukkan.',

  // --- Google ------------------------------------------------------------
  'google.unconfigured': 'Masuk dengan Google belum dikonfigurasi pada versi ini.',
  'google.blocked': 'Google tidak dapat dihubungi. Gunakan email dan kata sandi Anda.',
  'google.loading': 'Memuat Google…',

  // --- validasi kolom ----------------------------------------------------
  'validation.password.required': 'Kata sandi wajib diisi.',
  'validation.password.min': 'Kata sandi minimal {min} karakter',
  'validation.password.upper': 'Kata sandi harus memuat huruf besar',
  'validation.password.lower': 'Kata sandi harus memuat huruf kecil',
  'validation.password.digit': 'Kata sandi harus memuat angka',
  'validation.password.symbol': 'Kata sandi harus memuat simbol',
  'validation.password.maxBytes': 'Kata sandi maksimal {max} byte',
  'validation.rule.min': 'Minimal {min} karakter',
  'validation.rule.upper': 'Memuat huruf besar',
  'validation.rule.lower': 'Memuat huruf kecil',
  'validation.rule.digit': 'Memuat angka',
  'validation.rule.symbol': 'Memuat simbol',
  'validation.email.required': 'Email wajib diisi.',
  'validation.email.invalid': 'Masukkan alamat email yang sah',
  'validation.fullName.required': 'Nama lengkap wajib diisi.',
  'validation.fullName.short': 'Nama lengkap terlalu pendek',
  'validation.fullName.long': 'Nama lengkap terlalu panjang',
  'validation.confirm.required': 'Konfirmasi kata sandi wajib diisi.',
  'validation.confirm.mismatch': 'Kata sandinya tidak cocok.',
};
