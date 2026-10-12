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

  // Password fields state (inside account edit)
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Status and error states
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const resetEditForm = () => {
    setUsername(user.username);
    setFullName(user.fullName);
    setEmail(user.email || '');
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setErrorMessage(null);
  };

  const handleSaveAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setStatusMessage(null);

    // Validate password change if any password field is touched
    const wantsPasswordChange = currentPassword.length > 0 || newPassword.length > 0 || confirmPassword.length > 0;
    if (wantsPasswordChange) {
      if (!currentPassword) {
        setErrorMessage('Current Password Is Required to Update Password.');
        return;
      }
      if (newPassword.length < 4) {
        setErrorMessage('New Password Must Be at Least 4 Characters.');
        return;
      }
      if (newPassword !== confirmPassword) {
        setErrorMessage('New Passwords Do Not Match.');
        return;
      }
    }

    setIsSaving(true);
    try {
      // 1. Update notification email (profiles: user may update only their own notification_email)
      const res = await api.updateProfile({
        email: email.trim() || undefined,
      });
      onUserUpdated(res.user);

      // 2. Update Password if specified
      if (wantsPasswordChange) {
        await api.changePassword({ currentPassword, newPassword });
      }

      setStatusMessage(
        wantsPasswordChange
          ? 'Account Information and Password Updated Successfully.'
          : 'Account Information Updated Successfully.'
      );
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setIsEditingInfo(false);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to Update Account Settings.');
    } finally {
      setIsSaving(false);
    }
  };

  const getRoleDisplayName = (role: string) => {
    if (role === 'admin') return 'Administrator';
    if (role === 'guide') return 'Guide Supervisor';
    return 'Candidate';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3 sm:p-4">
      <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] sm:max-h-[85vh] flex flex-col shadow-xl overflow-hidden">
        {/* Header */}
        <div className="p-3.5 sm:p-4 border-b border-[#F3F4F6] flex items-center justify-between gap-2">
          <div className="min-w-0 pr-2">
            <h2 className="text-base sm:text-lg font-bold text-[#111111] truncate">
              Profile & Account Settings
            </h2>
            <p className="text-[11px] sm:text-xs text-[#6B7280] truncate mt-0.5">
              Manage Personal Credentials and Contact Preferences
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
              <span className="text-[11px] sm:text-xs font-bold text-[#6B7280] uppercase tracking-wider">
                Account Information
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
                  <Pencil className="w-3 h-3 text-[#EF4B47]" />
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
                  <span className="text-[11px] text-[#6B7280] block">Full Name</span>
                  <span className="font-bold text-sm text-[#111111] block">
                    {user.fullName}
                  </span>
                </div>

                <div>
                  <span className="text-[11px] text-[#6B7280] block">
                    Username / Identification ID
                  </span>
                  <span className="font-semibold text-xs text-[#111111] block font-mono">
                    {user.username}
                  </span>
                </div>

                <div>
                  <span className="text-[11px] text-[#6B7280] block">
                    Notification Email Address
                  </span>
                  <span className="font-medium text-xs text-[#111111] block">
                    {user.email || 'No Email Configured'}
                  </span>
                </div>

                <div className="pt-1 flex items-center gap-1.5">
                  <span className="text-[11px] text-[#6B7280]">Designated Role:</span>
                  <span className="px-2 py-0.5 rounded-md bg-white text-[11px] font-semibold text-[#111111]">
                    {getRoleDisplayName(user.role)}
                  </span>
                </div>
              </div>
            ) : (
              /* Expanded Edit Form including Password Change */
              <form onSubmit={handleSaveAccount} className="space-y-3 pt-1">
                <div>
                  <label className="block text-[11px] font-semibold text-[#111111] mb-1">
                    Full Name
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
                  <label className="block text-[11px] font-semibold text-[#111111] mb-1">
                    Username / Identification ID
                  </label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    className="w-full px-3 py-2 rounded-xl bg-white text-xs text-[#111111] border-0 font-mono"
                  />
                  <p className="text-[10px] text-[#6B7280] mt-0.5">
                    Customize your personal login username or roll identifier.
                  </p>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-[#111111] mb-1">
                    Notification Email Address
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="user@gmail.com"
                    className="w-full px-3 py-2 rounded-xl bg-white text-xs text-[#111111] border-0"
                  />
                  <p className="text-[10px] text-[#6B7280] mt-0.5">
                    System reminders and alerts are delivered to this address.
                  </p>
                </div>

                {/* Password Update Subsection */}
                <div className="pt-2 border-t border-gray-200/80 space-y-2.5">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Lock className="w-3.5 h-3.5 text-[#6B7280]" />
                    <span className="text-[11px] font-bold text-[#111111]">
                      Update Password (Optional)
                    </span>
                  </div>
                  <p className="text-[10px] text-[#6B7280]">
                    Leave password fields blank if you do not wish to modify your password.
                  </p>

                  <div>
                    <label className="block text-[10px] font-semibold text-[#6B7280] mb-1">
                      Current Password
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
                    <label className="block text-[10px] font-semibold text-[#6B7280] mb-1">
                      New Password
                    </label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Enter new password (min. 4 characters)"
                      className="w-full px-3 py-2 rounded-xl bg-white text-xs text-[#111111] border-0"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-semibold text-[#6B7280] mb-1">
                      Confirm New Password
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
                  <p className="text-xs text-[#EF4B47] font-medium pt-1">{errorMessage}</p>
                )}

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      resetEditForm();
                      setIsEditingInfo(false);
                    }}
                    className="px-3 py-1.5 rounded-xl bg-white text-xs font-semibold text-[#6B7280] hover:text-[#111111]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="px-3.5 py-1.5 rounded-xl bg-[#EF4B47] text-white text-xs font-semibold hover:opacity-95 disabled:opacity-50 transition-opacity shadow-sm"
                  >
                    {isSaving ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            )}

            {statusMessage && (
              <p className="text-xs text-[#111111] font-semibold pt-1">
                {statusMessage}
              </p>
            )}
          </div>

          {/* Central Administration Policy Note */}
          <div className="p-3 rounded-xl bg-[#F3F4F6] text-[11px] text-[#6B7280] leading-relaxed">
            Accounts and initial credentials are administered centrally. System notifications and updates are delivered to the registered email address.
          </div>
        </div>

        {/* Footer */}
        <div className="p-3.5 sm:p-4 border-t border-[#F3F4F6] bg-white flex items-center justify-between gap-3">
          <button
            onClick={onLogout}
            className="px-3.5 py-2 rounded-xl bg-red-50 text-[#EF4B47] hover:bg-red-100 font-semibold text-xs flex items-center gap-1.5 transition-colors border border-red-100 shadow-sm"
          >
            <LogOut className="w-3.5 h-3.5 shrink-0" />
            <span>Sign Out</span>
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-[#F3F4F6] text-[#111111] font-semibold text-xs hover:bg-gray-200 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
