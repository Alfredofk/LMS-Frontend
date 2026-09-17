import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../../components/ui/Button';
import Toast from '../../components/ui/Toast';

const features = [
  ['Course Builder', 'Create and organize content.', 'bg-emerald-50', 'text-emerald-600'],
  ['Quiz & Exams', 'Build quizzes and assessments.', 'bg-purple-50', 'text-purple-600'],
  ['Progress Tracking', 'Monitor learner milestones.', 'bg-blue-50', 'text-blue-600'],
  ['Discussion Forum', 'Engage in discussion.', 'bg-yellow-50', 'text-yellow-600'],
  ['Smart Learning Insights', 'Personalized feedback based on performance.', 'bg-orange-50', 'text-orange-600'],
  ['Chatbot', 'Solve your problem with Chatbot.', 'bg-pink-50', 'text-pink-600']
];

export const LandingPage = () => {
  const navigate = useNavigate();
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'info') => setToast({ message, type });
  const handleUnderConstruction = (featureName) => {
    showToast(`Fitur "${featureName}" sedang dalam proses pengerjaan (On Progress).`, 'info');
  };

  return (
    <div className="min-h-screen overflow-x-hidden bg-slate-50 font-sans text-slate-800 antialiased">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-600 text-lg font-black text-white shadow-lg shadow-violet-500/20">L</div>
          <span className="text-lg font-extrabold tracking-tight">LMS</span>
        </div>
        <nav className="hidden items-center gap-8 text-sm font-semibold text-slate-500 md:flex">
          <button onClick={() => showToast('Anda berada di halaman utama.', 'info')}>Home</button>
          <button onClick={() => handleUnderConstruction('Course')}>Course</button>
          <button onClick={() => handleUnderConstruction('Mentor')}>Mentor</button>
          <button onClick={() => handleUnderConstruction('About Us')}>About us</button>
        </nav>
        <Button onClick={() => navigate('/login')}>Get Started</Button>
      </header>

      <main className="mx-auto max-w-6xl px-6 pb-16 pt-16">
        <section className="max-w-3xl">
          <p className="mb-4 text-sm font-bold uppercase tracking-[0.2em] text-violet-600">Learning management system</p>
          <h1 className="text-5xl font-black tracking-tight text-slate-900 sm:text-7xl">Make learning feel possible.</h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-slate-500">One calm workspace for courses, assessments, progress, and the people who make learning happen.</p>
          <div className="mt-8 flex flex-wrap gap-4">
            <Button onClick={() => navigate('/login')}>Start learning</Button>
            <Button variant="secondary" onClick={() => showToast('Explore our learning features below.', 'info')}>Explore features</Button>
          </div>
        </section>

        <section className="mt-20 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map(([title, description, background, color]) => (
            <button key={title} onClick={() => handleUnderConstruction(title)} className={`rounded-2xl p-6 text-left transition-transform hover:-translate-y-1 ${background}`}>
              <div className={`mb-10 text-2xl ${color}`}>+</div>
              <h2 className="text-lg font-bold text-slate-900">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
            </button>
          ))}
        </section>
      </main>
    </div>
  );
};

export default LandingPage;
