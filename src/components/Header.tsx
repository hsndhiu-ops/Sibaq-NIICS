import React, { useState, useRef, useEffect } from 'react';
import { User } from '../types';
import { Bell, LogOut } from 'lucide-react';
import { BrandMark, DiamondBand } from './brand/Decorations';

interface HeaderProps {
  user: User;
  unreadCount: number;
  onOpenNotifications: () => void;
  onOpenProfile: () => void;
  onLogout?: () => void;
  onHomeClick?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  user,
  unreadCount,
  onOpenNotifications,
  onOpenProfile,
  onLogout,
  onHomeClick,
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

  const handleBrandClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (onHomeClick) {
      onHomeClick();
    }
  };

  return (
    <header
      className="sticky top-0 z-40 bg-[#D4202C] text-white"
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
    >
      {/* 56px red bar */}
      <div className="h-14 px-4 flex items-center">
        <div className="max-w-6xl w-full mx-auto flex items-center justify-between">
          {/* Left: White mark 32px tall + text "SIBAQ'26" in white DM Serif Display 22px, 10px gap */}
          <a
            href="#"
            onClick={handleBrandClick}
            className="flex items-center gap-[10px] text-white no-underline select-none hover:opacity-95 transition-opacity"
            title="SIBAQ'26 Home"
            aria-label="SIBAQ'26 Home"
          >
            <BrandMark variant="white" height={32} />
            <span className="font-serif text-[22px] text-white leading-none font-normal tracking-normal">
              SIBAQ'26
            </span>
          </a>

          {/* Right: The bell and the avatar in white */}
          <div className="flex items-center gap-2.5">
            {/* Notification bell in white */}
            <button
              onClick={onOpenNotifications}
              className="relative p-2 rounded-xl text-white hover:bg-[#B81B26] transition-colors focus:outline-none"
              title="Notifications"
              aria-label="Notifications"
            >
              <Bell className="w-5 h-5 text-white" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 bg-white text-[#D4202C] text-xs font-bold px-1 min-w-4 h-4 rounded-full flex items-center justify-center leading-none">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {/* Avatar: White circle with a red initial; still opens menu */}
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setIsMenuOpen((prev) => !prev)}
                className="w-8 h-8 rounded-full bg-white text-[#D4202C] flex items-center justify-center font-bold text-xs hover:opacity-95 transition-opacity focus:outline-none cursor-pointer"
                title="Account menu"
                aria-label="Account menu"
                aria-expanded={isMenuOpen}
              >
                {user.fullName ? user.fullName.charAt(0).toUpperCase() : 'U'}
              </button>

              {/* Avatar Dropdown Menu (white card, clean border, dark text) */}
              {isMenuOpen && (
                <div className="absolute right-0 mt-2 w-52 bg-white rounded-xl border border-[#E5E7EB] py-2 z-50 animate-in fade-in zoom-in-95 duration-100 text-[#111111]">
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
                    className="w-full text-left px-4 py-2 text-xs font-medium text-[#111111] hover:bg-[#F3F4F6] transition-colors"
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
                    className="w-full text-left px-4 py-2 text-xs font-medium text-[#D4202C] hover:bg-[#F3F4F6] transition-colors flex items-center gap-2"
                  >
                    <LogOut className="w-3.5 h-3.5 text-[#D4202C]" />
                    <span>Sign out</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* A <DiamondBand /> runs along the bottom edge of the bar, showing 8px of it */}
      <div className="w-full h-2 overflow-hidden block">
        <DiamondBand height={12} />
      </div>
    </header>
  );
};
