import React, { useState } from 'react';
import { User } from '../types';
import { api } from '../api';
import { X, Lock, Pencil, Shield, User as UserIcon, Mail, LogOut } from 'lucide-react';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User;
  onUserUpdated: (user: User) => void;
  onLogout: () => void;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({
  isOpen,
  onClose,
  user,
  onUserUpdated,
  onLogout,
}) => {
  if (!isOpen) return null;

  // Toggle state for editing account information
  const [isEditingInfo, setIsEditingInfo] = useState(false);

  // Profile fields state
  const [username, setUsername] = useState(user.username);
  const [fullName, setFullName] = useState(user.fullName);
  const [email, setEmail] = useState(user.email || '');

  // Gmail validation error
  const [emailError, setEmailError] = useState<string | null>(null);

  // Password fields state (inside account edit)
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Status and error states
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const validateGmail = (val: string): boolean => {
    const trimmed = val.trim();
    if (!trimmed) {
      setEmailError(null);
      return true;
    }
    // Strict Gmail validation (e.g. name@gmail.com)
    const gmailRegex = /^[a-zA-Z0-9._%+-]+@gmail\.com$/i;
    if (!gmailRegex.test(trimmed)) {
      setEmailError('Enter a valid Gmail address');
      return false;
    }
    setEmailError(null);
    return true;
  };

  const handleEmailChange = (val: string) => {
    setEmail(val);
    validateGmail(val);
  };

  const resetEditForm = () => {
    setUsername(user.username);
    setFullName(user.fullName);
    setEmail(user.email || '');
    setEmailError(null);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setErrorMessage(null);
  };

  const handleSaveAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setStatusMessage(null);

    // Validate email
    if (!validateGmail(email)) {
      setErrorMessage('Enter a valid Gmail address');
      return;
    }

    // Validate password change if any password field is touched
    const wantsPasswordChange = currentPassword.length > 0 || newPassword.length > 0 || confirmPassword.length > 0;
    if (wantsPasswordChange) {
      if (!currentPassword) {
        setErrorMessage('Current password is required to update password.');
        return;
      }
      if (newPassword.length < 4) {
        setErrorMessage('New password must be at least 4 characters.');
        return;
      }
      if (newPassword !== confirmPassword) {
        setErrorMessage('New passwords do not match.');
        return;
      }
    }

    setIsSaving(true);
    try {
      const res = await api.updateProfile({
        email: email.trim() || undefined,
      });
      onUserUpdated(res.user);

      if (wantsPasswordChange) {
        await api.changePassword({ currentPassword, newPassword });
      }

      setStatusMessage(
        wantsPasswordChange
          ? 'Account information and password updated successfully.'
          : 'Account information updated successfully.'
      );
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setIsEditingInfo(false);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to update account settings.');
    } finally {
      setIsSaving(false);
    }
  };

  const getRoleDisplayName = (role: string) => {
    if (role === 'admin') return 'Administrator';
    if (role === 'guide') return 'Guide Supervisor';
    return 'Student';
  };

  const isSaveDisabled = isSaving || Boolean(emailError);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3 sm:p-4">
      <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] flex flex-col border border-[#E5E7EB] overflow-hidden">
        {/* Header */}
        <div className="p-3.5 sm:p-4 border-b border-[#F3F4F6] flex items-center justify-between gap-2">
          <div className="min-w-0 pr-2">
            <h2 className="text-base sm:text-lg font-bold text-[#111111] truncate">
              Profile & account settings
            </h2>
            <p className="text-[13px] text-[#6B7280] truncate mt-0.5">
              Manage personal credentials and contact preferences
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-[#F3F4F6] text-[#111111] hover:bg-gray-200 transition-colors shrink-0"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
          {/* Account Information Section */}
          <div className="p-4 rounded-xl sm:rounded-2xl bg-[#F3F4F6] space-y-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-[#6B7280]">
                Account information
              </span>
              {!isEditingInfo ? (
                <button
                  onClick={() => {
                    resetEditForm();
                    setStatusMessage(null);
                    setIsEditingInfo(true);
                  }}
                  className="px-2.5 py-1 rounded-lg bg-white text-xs font-semibold text-[#111111] hover:bg-gray-100 flex items-center gap-1 transition-colors"
                >
                  <Pencil className="w-3 h-3 text-[#D4202C]" />
                  <span>Edit</span>
                </button>
              ) : (
                <button
                  onClick={() => {
                    resetEditForm();
                    setIsEditingInfo(false);
                  }}
                  className="px-2.5 py-1 rounded-lg bg-white text-xs font-medium text-[#6B7280] hover:text-[#111111] transition-colors"
                >
                  Cancel
                </button>
              )}
            </div>

            {!isEditingInfo ? (
              /* Compact Summary View */
              <div className="space-y-2 pt-1 text-xs">
                <div>
                  <span className="text-xs text-[#6B7280] block">Full name</span>
                  <span className="font-bold text-sm text-[#111111] block">
                    {user.fullName}
                  </span>
                </div>

                <div>
                  <span className="text-xs text-[#6B7280] block">
                    Username / identification ID
                  </span>
                  <span className="font-semibold text-xs text-[#111111] block font-mono">
                    {user.username}
                  </span>
                </div>

                <div>
                  <span className="text-xs text-[#6B7280] block">
                    Gmail address
                  </span>
                  <span className="font-medium text-xs text-[#111111] block">
                    {user.email || 'No email configured'}
                  </span>
                </div>

                <div className="pt-1 flex items-center gap-1.5">
                  <span className="text-xs text-[#6B7280]">Designated role:</span>
                  <span className="px-2 py-0.5 rounded-md bg-white text-xs font-semibold text-[#111111]">
                    {getRoleDisplayName(user.role)}
                  </span>
                </div>
              </div>
            ) : (
              /* Expanded Edit Form including Password Change */
              <form onSubmit={handleSaveAccount} className="space-y-3 pt-1">
                <div>
                  <label className="block text-xs font-semibold text-[#111111] mb-1">
                    Full name
                  </label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                    className="w-full px-3 py-2 rounded-xl bg-white text-xs text-[#111111] border-0"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#111111] mb-1">
                    Username / identification ID
                  </label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    className="w-full px-3 py-2 rounded-xl bg-white text-xs text-[#111111] border-0 font-mono"
                  />
                  <p className="text-xs text-[#6B7280] mt-0.5">
                    Customize your personal login username or roll identifier.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#111111] mb-1">
                    Gmail address
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => handleEmailChange(e.target.value)}
                    onBlur={(e) => validateGmail(e.target.value)}
                    placeholder="name@gmail.com"
                    className={`w-full px-3 py-2 rounded-xl bg-white text-xs text-[#111111] border ${
                      emailError ? 'border-[#D4202C]' : 'border-transparent'
                    } focus:outline-none`}
                  />
                  {emailError ? (
                    <p className="text-xs text-[#D4202C] mt-1 font-medium">{emailError}</p>
                  ) : (
                    <p className="text-xs text-[#6B7280] mt-0.5">
                      Enter a valid Gmail address (e.g. name@gmail.com).
                    </p>
                  )}
                </div>

                {/* Password Update Subsection */}
                <div className="pt-2 border-t border-gray-200 space-y-2.5">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Lock className="w-3.5 h-3.5 text-[#6B7280]" />
                    <span className="text-xs font-bold text-[#111111]">
                      Change password (optional)
                    </span>
                  </div>

                  <div>
                    <label className="block text-xs text-[#6B7280] mb-1">
                      Current password
                    </label>
                    <input
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="Enter current password"
                      className="w-full px-3 py-2 rounded-xl bg-white text-xs text-[#111111] border-0"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-[#6B7280] mb-1">
                      New password
                    </label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Minimum 4 characters"
                      className="w-full px-3 py-2 rounded-xl bg-white text-xs text-[#111111] border-0"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-[#6B7280] mb-1">
                      Confirm new password
                    </label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirm new password"
                      className="w-full px-3 py-2 rounded-xl bg-white text-xs text-[#111111] border-0"
                    />
                  </div>
                </div>

                {errorMessage && (
                  <p className="text-xs text-[#D4202C] font-medium pt-1">{errorMessage}</p>
                )}

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      resetEditForm();
                      setIsEditingInfo(false);
                    }}
                    className="px-3 py-1.5 rounded-xl bg-white border border-[#E5E7EB] text-xs font-semibold text-[#6B7280] hover:text-[#111111]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSaveDisabled}
                    className="px-3.5 py-1.5 rounded-[10px] bg-[#D4202C] text-white text-xs font-semibold hover:bg-[#B81B26] active:bg-[#B81B26] disabled:opacity-50 transition-colors"
                  >
                    {isSaving ? 'Saving...' : 'Save changes'}
                  </button>
                </div>
              </form>
            )}
          </div>

          {statusMessage && (
            <div className="p-3 rounded-xl bg-white border border-gray-200 text-xs text-[#111111]">
              {statusMessage}
            </div>
          )}

          {/* Privacy & Account Security Notes */}
          <div className="p-3 rounded-xl bg-[#F3F4F6] text-xs text-[#6B7280] leading-relaxed">
            Personal login credentials and contact email are kept private. Screen-time screenshots are automatically erased after 48 hours.
          </div>
        </div>

        {/* Footer: Sign Out Button */}
        <div className="p-3.5 sm:p-4 border-t border-[#F3F4F6] bg-gray-50 flex items-center justify-between">
          <span className="text-xs text-[#6B7280]">
            Logged in as <strong className="text-[#111111]">{user.username}</strong>
          </span>
          <button
            onClick={onLogout}
            className="px-3.5 py-1.5 rounded-xl bg-white border border-[#E5E7EB] text-xs font-semibold text-[#D4202C] hover:bg-[#F3F4F6] flex items-center gap-1.5 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign out</span>
          </button>
        </div>
      </div>
    </div>
  );
};
