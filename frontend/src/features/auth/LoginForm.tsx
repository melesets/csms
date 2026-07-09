// Login form component - handles user authentication with username/password
import React, { useState } from 'react';
import { Eye, EyeOff, LogIn, Stethoscope } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { Spinner } from '../../components/shared';
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

    // Pre-flight: ensure backend + DB are ready
    const maxAttempts = 12; // up to ~60s
    const delayMs = 5000;
    let attempt = 0;
    while (attempt < maxAttempts) {
      try {
        await apiGet('/test-db');
        break; // ready
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
      // Distinguish service unavailability from invalid credentials
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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center px-4">
      <div className="bg-white rounded-xl shadow-xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-4 border-2 border-white bg-[#003153] text-white">
            <Stethoscope className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">AGH-CSMS</h1>
          <p className="text-gray-600">Sign in to your account</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-2">
              Username
            </label>
            <input
              id="username"
              type="text"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              placeholder="Enter your username"
              required
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all pr-12"
                placeholder="Enter your password"
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <div>
            <label htmlFor="profession" className="block text-sm font-medium text-gray-700 mb-2">
              Professionals
            </label>
            <select
              id="profession"
              value={profession}
              onChange={(e) => setProfession(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
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
            className="w-full bg-brand hover:bg-brand-600 disabled:bg-brand-300 text-white font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center"
          >
            {isLoading ? (
              <Spinner size="md" color="white" />
            ) : (
              <>
                <LogIn className="w-5 h-5 mr-2" />
                Sign In
              </>
            )}
          </button>
        </form>

              </div>
    </div>
  );
};
