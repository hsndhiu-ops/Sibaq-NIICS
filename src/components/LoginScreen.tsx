import React, { useState } from 'react';
import { api, setStoredToken } from '../api';
import { User } from '../types';
import { User as UserIcon, Lock, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { BrandMark, DiamondBand, Pentagon } from './brand/Decorations';

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
      setError(err?.message || 'Wrong username or password. Check and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col overflow-x-hidden">
      {/* Top section: full-width red, ~38% screen height (min 240px) */}
      <section className="relative w-full bg-[#D4202C] min-h-[240px] h-[38vh] flex flex-col items-center justify-center overflow-hidden">
        {/* DiamondBand along top edge */}
        <div className="absolute top-0 inset-x-0 w-full overflow-hidden">
          <DiamondBand height={12} />
        </div>

        {/* Pentagon decoration at top-right corner */}
        <Pentagon
          size={110}
          className="absolute -top-6 -right-6 pointer-events-none"
        />

        {/* Pentagon decoration at left edge, partly off-screen */}
        <Pentagon
          size={96}
          className="absolute top-1/2 -left-12 -translate-y-1/2 pointer-events-none"
        />

        {/* Centered: White mark 96px tall, and under it "SIBAQ'26" in white DM Serif Display 40px */}
        <div className="relative z-10 flex flex-col items-center text-center px-4 select-none">
          <BrandMark variant="white" height={96} />
          <h1 className="font-serif text-[40px] text-white leading-none font-normal mt-3 tracking-normal">
            SIBAQ'26
          </h1>
        </div>
      </section>

      {/* Main card container: white card with 10px radius, overlapping red section by ~32px */}
      <div className="flex-1 w-full px-4 pb-10">
        <div className="relative z-20 -mt-8 mx-auto w-full max-w-[420px] bg-white rounded-[10px] border border-[#E5E7EB] p-6 sm:p-8">
          <h2 className="font-serif text-[28px] text-[#111111] font-normal mb-5 leading-tight">
            Sign in
          </h2>

          <form onSubmit={handleLogin} className="space-y-4">
            {/* Username field */}
            <div>
              <label
                htmlFor="login-username"
                className="block text-xs font-semibold text-[#111111] mb-1.5"
              >
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
                  className="w-full h-[48px] pl-11 pr-4 rounded-[10px] bg-[#F3F4F6] text-[#111111] text-sm sm:text-base border border-[#E5E7EB] focus:outline-none focus:ring-2 focus:ring-[#D4202C] transition-colors"
                />
              </div>
            </div>

            {/* Password field with show/hide toggle */}
            <div>
              <label
                htmlFor="login-password"
                className="block text-xs font-semibold text-[#111111] mb-1.5"
              >
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
                  className="w-full h-[48px] pl-11 pr-11 rounded-[10px] bg-[#F3F4F6] text-[#111111] text-sm sm:text-base border border-[#E5E7EB] focus:outline-none focus:ring-2 focus:ring-[#D4202C] transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-[#6B7280] hover:text-[#111111] focus:outline-none cursor-pointer"
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

            {/* Errors: dark text with a small icon, never a red background */}
            {error && (
              <div className="flex items-center gap-2 text-[#111111] text-xs font-medium py-1">
                <AlertCircle className="w-4 h-4 shrink-0 text-[#D4202C]" />
                <span className="leading-snug">{error}</span>
              </div>
            )}

            {/* Primary button: red background, white text, 48px high, 10px radius, pressed state --red-dark */}
            <button
              type="submit"
              disabled={loading}
              className="w-full h-[48px] rounded-[10px] bg-[#D4202C] hover:bg-[#B81B26] active:bg-[#B81B26] text-white font-semibold text-base transition-colors disabled:opacity-50 cursor-pointer"
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </button>

            {/* Existing help line */}
            <p className="text-center text-xs text-[#6B7280] leading-relaxed pt-2">
              Accounts are created by the admin. Forgot your password? Ask your admin.
            </p>
          </form>
        </div>
      </div>
    </div>
  );
};
