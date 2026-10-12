import React, { useState, useRef, useEffect } from 'react';
import { User } from '../types';
import { Bell, LogOut, User as UserIcon } from 'lucide-react';

interface HeaderProps {
  user: User;
  unreadCount: number;
  onOpenNotifications: () => void;
  onOpenProfile: () => void;
  onLogout?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  user,
  unreadCount,
  onOpenNotifications,
  onOpenProfile,
  onLogout,
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when tapping outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    if (isMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isMenuOpen]);

  const formatRoleName = (role: string) => {
    if (role === 'admin') return 'Admin';
    if (role === 'guide') return 'Guide';
    if (role === 'student') return 'Student';
    return role.charAt(0).toUpperCase() + role.slice(1);
  };

  return (
    <header className="sticky top-0 z-30 h-14 bg-white border-b border-[#E5E7EB] px-4 flex items-center">
      <div className="max-w-6xl w-full mx-auto flex items-center justify-between">
        {/* Left: Wordmark SIBAQ 2026 */}
        <div className="flex items-baseline gap-1.5 select-none">
          <span
            style={{
              fontFamily: "'Cinzel', serif",
              fontWeight: 700,
              letterSpacing: '0.12em',
            }}
            className="text-[20px] text-[#111111] leading-none"
          >
            SIBAQ
          </span>
          <span
            style={{
              fontFamily: "'Cinzel', serif",
              fontWeight: 500,
            }}
            className="text-[12px] text-[#D93F3B] leading-none tracking-wider"
          >
            2026
          </span>
        </div>

        {/* Right: Notifications & Avatar Menu */}
        <div className="flex items-center gap-2">
          {/* Notification bell with real unread count */}
          <button
            onClick={onOpenNotifications}
            className="relative p-2 rounded-xl text-[#111111] hover:bg-[#F3F4F6] transition-colors"
            title="Notifications"
            aria-label="Notifications"
          >
            <Bell className="w-5 h-5 text-[#111111]" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 bg-[#D93F3B] text-white text-xs font-semibold px-1 min-w-4 h-4 rounded-full flex items-center justify-center leading-none">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {/* User Avatar with small popup menu */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setIsMenuOpen((prev) => !prev)}
              className="w-8 h-8 rounded-full bg-[#D93F3B] text-white flex items-center justify-center font-bold text-xs uppercase hover:opacity-90 transition-opacity focus:outline-none"
              title="Account menu"
              aria-label="Account menu"
              aria-expanded={isMenuOpen}
            >
              {user.fullName ? user.fullName.charAt(0) : <UserIcon className="w-4 h-4" />}
            </button>

            {/* Avatar Dropdown Menu */}
            {isMenuOpen && (
              <div className="absolute right-0 mt-2 w-52 bg-white rounded-xl shadow-lg border border-[#E5E7EB] py-2 z-50 animate-in fade-in zoom-in-95 duration-100">
                <div className="px-4 py-2 border-b border-[#F3F4F6]">
                  <p className="text-xs font-bold text-[#111111] truncate">
                    {user.fullName}
                  </p>
                  <p className="text-xs text-[#6B7280] mt-0.5">
                    {formatRoleName(user.role)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsMenuOpen(false);
                    onOpenProfile();
                  }}
                  className="w-full text-left px-4 py-2 text-xs font-medium text-[#111111] hover:bg-[#F9FAFB] transition-colors"
                >
                  Account details
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsMenuOpen(false);
                    if (onLogout) {
                      onLogout();
                    } else {
                      onOpenProfile();
                    }
                  }}
                  className="w-full text-left px-4 py-2 text-xs font-medium text-[#D93F3B] hover:bg-[#FEF2F2] transition-colors flex items-center gap-2"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign out</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
