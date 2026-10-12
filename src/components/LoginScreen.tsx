import React, { useState } from 'react';
import { api, setStoredToken } from '../api';
import { User } from '../types';
import { User as UserIcon, Lock, Eye, EyeOff, AlertCircle } from 'lucide-react';

interface LoginScreenProps {
  onLoginSuccess: (user: User) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await api.login({ username, password });
      setStoredToken(res.token);
      onLoginSuccess(res.user);
    } catch (err: any) {
      // Exact specification error text
      setError(err?.message || 'Wrong username or password. Check and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-white flex flex-col justify-center px-4 py-8 overflow-x-hidden">
      {/* Thin eight-point-star decorative band across the top of the page at ~8% opacity */}
      <div className="absolute top-0 left-0 right-0 h-16 sm:h-20 pointer-events-none overflow-hidden opacity-[0.08]">
        <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg" fill="none">
          <defs>
            <pattern id="star-band-pattern" width="48" height="48" patternUnits="userSpaceOnUse">
              <path
                d="M 24 4 L 29.86 9.86 L 38.14 9.86 L 38.14 18.14 L 44 24 L 38.14 29.86 L 38.14 38.14 L 29.86 38.14 L 24 44 L 18.14 38.14 L 9.86 38.14 L 9.86 29.86 L 4 24 L 9.86 18.14 L 9.86 9.86 L 18.14 9.86 Z"
                stroke="#D93F3B"
                strokeWidth="1.2"
                fill="none"
              />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#star-band-pattern)" />
        </svg>
      </div>

      {/* Faint eight-point-star background pattern behind the rest at ~3% opacity */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-[0.03]">
        <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg" fill="none">
          <defs>
            <pattern id="star-bg-pattern" width="60" height="60" patternUnits="userSpaceOnUse">
              <path
                d="M 30 5 L 37.32 12.32 L 47.68 12.32 L 47.68 22.68 L 55 30 L 47.68 37.32 L 47.68 47.68 L 37.32 47.68 L 30 55 L 22.68 47.68 L 12.32 47.68 L 12.32 37.32 L 5 30 L 12.32 22.68 L 12.32 12.32 L 22.68 12.32 Z"
                stroke="#D93F3B"
                strokeWidth="1"
                fill="none"
              />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#star-bg-pattern)" />
        </svg>
      </div>

      <div className="relative z-10 max-w-sm w-full mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col items-center text-center">
          <h1
            className="text-[#111111] leading-none"
            style={{
              fontFamily: "'Cinzel', serif",
              fontWeight: 700,
              fontSize: '40px',
              letterSpacing: '0.12em',
            }}
          >
            SIBAQ
          </h1>
          <span
            className="text-[#D93F3B] leading-none mt-1.5"
            style={{
              fontFamily: "'Cinzel', serif",
              fontWeight: 500,
              fontSize: '18px',
              letterSpacing: '0.3em',
            }}
          >
            2026
          </span>
          <div
            className="w-[40px] h-[3px] bg-[#D93F3B] my-4 rounded-full"
            aria-hidden="true"
          />
          <p className="text-[15px] text-[#6B7280] leading-normal">
            Sign in to your account
          </p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleLogin} className="space-y-4">
          {/* Username field */}
          <div>
            <label htmlFor="login-username" className="block text-[14px] font-medium text-[#111111] mb-1.5">
              Username
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#6B7280]">
                <UserIcon className="w-5 h-5" />
              </div>
              <input
                id="login-username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Username"
                required
                autoComplete="username"
                className="w-full h-[48px] pl-11 pr-4 rounded-[10px] bg-[#F9FAFB] text-[#111111] text-sm sm:text-base border border-[#E5E7EB] focus:outline-none focus:ring-2 focus:ring-[#D93F3B] focus:border-[#D93F3B] transition-colors"
              />
            </div>
          </div>

          {/* Password field with show/hide eye */}
          <div>
            <label htmlFor="login-password" className="block text-[14px] font-medium text-[#111111] mb-1.5">
              Password
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#6B7280]">
                <Lock className="w-5 h-5" />
              </div>
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                required
                autoComplete="current-password"
                className="w-full h-[48px] pl-11 pr-11 rounded-[10px] bg-[#F9FAFB] text-[#111111] text-sm sm:text-base border border-[#E5E7EB] focus:outline-none focus:ring-2 focus:ring-[#D93F3B] focus:border-[#D93F3B] transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-[#6B7280] hover:text-[#111111] focus:outline-none"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? (
                  <EyeOff className="w-5 h-5" />
                ) : (
                  <Eye className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>

          {/* Error alert container */}
          {error && (
            <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-[8px] bg-[#FEF2F2] border border-[#FCA5A5]/60 text-[#B91C1C] text-sm font-medium animate-in fade-in duration-200">
              <AlertCircle className="w-4 h-4 shrink-0 text-[#D93F3B]" />
              <span className="leading-snug">{error}</span>
            </div>
          )}

          {/* Sign in Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full h-[48px] rounded-[10px] bg-[#D93F3B] text-white font-semibold text-base hover:opacity-95 transition-opacity disabled:opacity-60 shadow-none cursor-pointer"
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </button>

          {/* Footer Note */}
          <p className="text-center text-xs text-[#6B7280] leading-relaxed pt-1">
            Accounts are created by the admin. Forgot your password? Ask your admin.
          </p>
        </form>
      </div>
    </div>
  );
};
