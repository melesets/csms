import React, { useState } from 'react';
import { Eye, EyeOff, LogIn, ShieldCheck, User, Lock } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { apiGet } from '../../api';
import { PROFESSIONS } from '../../types/auth';

export const LoginForm = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [profession, setProfession] = useState('Nurse');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setInfo('');

    const maxAttempts = 12;
    const delayMs = 5000;
    let attempt = 0;
    while (attempt < maxAttempts) {
      try {
        await apiGet('/test-db');
        break;
      } catch {
        attempt++;
        if (import.meta.env.DEV) {
          setInfo(`Server starting… retrying (${attempt}/${maxAttempts})`);
        }
        if (attempt >= maxAttempts) {
          setIsLoading(false);
          setInfo('');
          setError('Service temporarily unavailable. Please try again shortly.');
          return;
        }
        await new Promise(r => setTimeout(r, delayMs));
      }
    }

    const errorMsg = await login(username, password, profession);
    if (errorMsg) {
      setError(errorMsg);
    }

    setIsLoading(false);
  };

  return (
    <div className="flex flex-col-reverse lg:flex-row min-h-screen w-full bg-white">
      {/* Left Panel - Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center px-6 py-12 lg:py-24 bg-gray-50">
        <div className="w-full max-w-xl bg-white p-8 sm:p-10 rounded-3xl shadow-[0_10px_50px_rgba(0,0,0,0.05)] border border-gray-100/80 animate-in fade-in slide-in-from-left-8 duration-1000 ease-out">
          
          <div className="text-center lg:text-left mb-8">
            <div className="inline-flex items-center gap-2.5 mb-3">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-semibold text-gray-400 tracking-widest uppercase">Portal Access</span>
            </div>
            <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight font-display">Welcome Back</h2>
            <p className="text-sm text-gray-500 mt-2.5">Enter your credentials to securely access the Clinical Portal</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label htmlFor="username" className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
                Username
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-gray-400 group-focus-within:text-[#003153] transition-colors">
                  <User className="h-5 w-5" />
                </div>
                <input
                  id="username"
                  type="text"
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full pl-12 pr-4 py-3.5 bg-gray-50/50 border border-gray-200/80 rounded-2xl text-gray-900 placeholder-gray-400 focus:bg-white focus:border-[#003153] focus:ring-4 focus:ring-[#003153]/5 transition-all outline-none hover:border-gray-300"
                  placeholder="Enter your username"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="password" className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
                Password
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-gray-400 group-focus-within:text-[#003153] transition-colors">
                  <Lock className="h-5 w-5" />
                </div>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-12 pr-12 py-3.5 bg-gray-50/50 border border-gray-200/80 rounded-2xl text-gray-900 placeholder-gray-400 focus:bg-white focus:border-[#003153] focus:ring-4 focus:ring-[#003153]/5 transition-all outline-none hover:border-gray-300"
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-4 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="profession" className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
                Role / Profession
              </label>
              <div className="relative group">
                <select
                  id="profession"
                  value={profession}
                  onChange={(e) => setProfession(e.target.value)}
                  className="w-full px-4 py-3.5 bg-gray-50/50 border border-gray-200/80 rounded-2xl text-gray-900 appearance-none focus:bg-white focus:border-[#003153] focus:ring-4 focus:ring-[#003153]/5 transition-all outline-none hover:border-gray-300"
                  required
                >
                  {PROFESSIONS.map((prof: string) => (
                    <option key={prof} value={prof}>{prof}</option>
                  ))}
                </select>
                <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none text-gray-400">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                </div>
              </div>
            </div>

            {import.meta.env.DEV && info && (
              <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4">
                <p className="text-sm text-blue-700 font-medium flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                  {info}
                </p>
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-100 rounded-2xl p-4 animate-in shake">
                <p className="text-sm text-red-600 font-medium flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                  {error}
                </p>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-[#003153] hover:bg-[#00223b] disabled:opacity-50 disabled:hover:bg-[#003153] text-white font-bold rounded-2xl py-4 px-4 transition-all duration-200 transform hover:-translate-y-0.5 hover:shadow-xl hover:shadow-[#003153]/25 active:translate-y-0 flex items-center justify-center gap-2.5 mt-4"
            >
              <LogIn className="w-5 h-5" />
              Sign In to Portal
            </button>
          </form>
        </div>
      </div>

      {/* Right Panel - Premium Welcome Section */}
      <div className="relative w-full lg:w-1/2 flex flex-col items-center justify-between overflow-hidden min-h-[40vh] lg:min-h-screen bg-[#001220]">
        <div className="absolute inset-0 bg-[url('/csms/login-bg.jpg')] bg-cover bg-center" />
        
        {/* Balanced overlay to make the image visible while keeping the centered text readable */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#003153]/50 via-[#002640]/40 to-[#001220]/60" />

        {/* Spacer to push welcome content down if needed, but since we use justify-between, we want centered welcome and bottom footer */}
        <div />

        {/* Center welcome content */}
        <div className="relative z-10 text-center px-8 py-6 max-w-lg animate-in fade-in slide-in-from-right-8 duration-1000 ease-out my-auto">
          <div className="mb-8 mx-auto">
            <img src={`${import.meta.env.BASE_URL}applogo.png`} alt="CSMS Logo" className="h-20 w-auto mx-auto drop-shadow-lg" />
          </div>

          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white mb-3 tracking-tight drop-shadow-lg uppercase whitespace-nowrap font-display">Adare General Hospital</h1>
          <p className="text-xs sm:text-sm text-emerald-300 font-semibold tracking-widest uppercase mb-4 drop-shadow-md whitespace-nowrap">
            Clinical Service Management System - CSMS
          </p>
          <div className="w-16 h-[1px] bg-emerald-400/50 mx-auto mb-6"></div>

          <p className="text-sm text-white/90 leading-relaxed max-w-md mx-auto mb-8 drop-shadow">
            Empowering healthcare professionals with secure, reliable, and advanced management tools for better patient care.
          </p>

          <div className="mt-6">
            <img src={`${import.meta.env.BASE_URL}LOGO.png`} alt="Adare General Hospital Logo" className="h-16 w-auto mx-auto drop-shadow-lg opacity-90" />
          </div>
        </div>

        {/* Footer with full-span white line and patent notice */}
        <div className="relative z-10 w-full text-center pb-6 px-8 animate-in fade-in duration-1000 delay-300">
          <div className="w-full h-[1px] bg-white/20 mx-auto mb-3" />
          <p className="text-[10px] text-white/40 tracking-widest font-medium">
            Patented Technology &copy; {new Date().getFullYear()} Adare General Hospital. All Rights Reserved.
          </p>
        </div>
      </div>
    </div>
  );
};
