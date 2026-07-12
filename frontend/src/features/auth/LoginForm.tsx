import React, { useState } from 'react';
import { Eye, EyeOff, LogIn, Stethoscope, ShieldCheck, User, Lock } from 'lucide-react';
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

    const success = await login(username, password, profession);
    if (!success) {
      try {
        const health: any = await apiGet('/health');
        if (!health?.ready) {
          setError('Service temporarily unavailable. Please try again shortly.');
        } else {
          setError('Invalid username or password');
        }
      } catch (e: any) {
        if ((e as any)?.status === 503) {
          setError('Service temporarily unavailable. Please try again shortly.');
        } else {
          setError('Invalid username or password');
        }
      }
    }

    setIsLoading(false);
  };

  return (
    <div className="flex flex-col lg:flex-row min-h-screen w-full">
      {/* Left Panel - Welcome Section with Hospital Background */}
      <div className="relative w-full lg:w-1/2 flex items-center justify-center overflow-hidden" style={{ minHeight: '40vh' }}>
        <div className="absolute inset-0 bg-[url('/isbar/login-bg.jpg')] bg-cover bg-center" />
        <div className="absolute inset-0 bg-gradient-to-br from-[#003153] via-[#003d66] to-[#003153] opacity-90" />

        <div className="relative z-10 text-center px-8 py-12 max-w-md">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full border-2 border-white/30 mb-6">
            <Stethoscope className="w-10 h-10 text-white" />
          </div>

          <h1 className="text-3xl lg:text-4xl font-bold text-white mb-3">Welcome Back</h1>
          <p className="text-base lg:text-lg text-white/80 mb-6 leading-relaxed">
            Sign in to continue your journey towards better healthcare.
          </p>

          <div className="w-16 h-1 bg-[#003153] mx-auto mb-6" />

          <div className="flex items-center justify-center gap-2 text-white/70">
            <ShieldCheck className="w-5 h-5 text-white/70" />
            <span className="text-sm">Secure. Reliable. For Better Care.</span>
          </div>
        </div>
      </div>

      {/* Right Panel - Login Form */}
      <div className="w-full lg:w-1/2 bg-white flex items-center justify-center px-6 py-10 lg:py-12">
        <div className="w-full max-w-md">
          <div className="text-right mb-12">
            <h2 className="text-2xl font-bold text-[#003153]">CSMS</h2>
            <p className="text-xs text-gray-500 tracking-wider">CLINICAL SERVICE MANAGEMENT SYSTEM</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1">
                Username
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="username"
                  type="text"
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:ring-2 focus:ring-[#003153]/20 focus:border-[#003153] transition-all outline-none"
                  placeholder="Enter your username"
                  required
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-10 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:ring-2 focus:ring-[#003153]/20 focus:border-[#003153] transition-all outline-none"
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="profession" className="block text-sm font-medium text-gray-700 mb-1">
                Professionals
              </label>
              <select
                id="profession"
                value={profession}
                onChange={(e) => setProfession(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:ring-2 focus:ring-[#003153]/20 focus:border-[#003153] transition-all outline-none"
                required
              >
                {PROFESSIONS.map((prof: string) => (
                  <option key={prof} value={prof}>{prof}</option>
                ))}
                <option value="Admin">Admin</option>
              </select>
            </div>

            {import.meta.env.DEV && info && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm text-blue-700">{info}</p>
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-[#003153] hover:bg-[#002640] disabled:opacity-50 text-white text-xs font-semibold rounded-lg py-2.5 px-4 transition-colors flex items-center justify-center gap-2"
            >
              <LogIn className="w-4 h-4" />
              Sign In
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
