import React, { useState } from 'react';
import { X, UserPlus, AlertCircle, Loader2 } from 'lucide-react';
import { User } from '../../types';
import { api } from '../../api';

interface CreateUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  onNotify: (msg: string) => void;
  guides: User[];
}

export const CreateUserModal: React.FC<CreateUserModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  onNotify,
  guides,
}) => {
  const [role, setRole] = useState<'student' | 'guide'>('student');
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [notificationEmail, setNotificationEmail] = useState('');
  const [assignedGuideId, setAssignedGuideId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const resetForm = () => {
    setRole('student');
    setFullName('');
    setUsername('');
    setPassword('');
    setNotificationEmail('');
    setAssignedGuideId('');
    setErrorMessage(null);
  };

  const handleClose = () => {
    if (isSubmitting) return;
    resetForm();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const trimmedUsername = username.trim();
    const trimmedFullName = fullName.trim();

    // 1. Frontend validation
    if (!trimmedUsername) {
      setErrorMessage('Username / Roll ID is required.');
      return;
    }

    if (!trimmedFullName) {
      setErrorMessage('Full name is required.');
      return;
    }

    if (!password) {
      setErrorMessage('Password is required.');
      return;
    }

    // Password minimum length check (>= 6 chars)
    if (password.length < 6) {
      setErrorMessage('Password must be at least 6 characters long.');
      return;
    }

    if (notificationEmail.trim()) {
      const gmailRegex = /^[a-zA-Z0-9._%+-]+@gmail\.com$/i;
      if (!gmailRegex.test(notificationEmail.trim())) {
        setErrorMessage('Enter a valid Gmail address');
        return;
      }
    }

    setIsSubmitting(true);

    try {
      await api.createAccount({
        username: trimmedUsername,
        password: password,
        fullName: trimmedFullName,
        role,
        email: notificationEmail.trim() || undefined,
      });

      // 3. Reset form, close modal, and refresh user list
      resetForm();
      onClose();
      onNotify(`Account created successfully for ${trimmedFullName}.`);
      onSuccess();
    } catch (err: any) {
      setErrorMessage(err.message || 'An unexpected error occurred while creating the account.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs animate-in fade-in">
      <div
        className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] flex flex-col shadow-2xl overflow-hidden border border-[#E5E7EB]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-user-modal-title"
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-[#F3F4F6] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#F3F4F6] text-[#D4202C] flex items-center justify-center shrink-0">
              <UserPlus className="w-4 h-4" />
            </div>
            <div>
              <h3 id="create-user-modal-title" className="font-bold text-base text-[#111111]">
                Create User Account
              </h3>
              <p className="text-[13px] text-[#6B7280]">
                Add student or supervisor guide
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={isSubmitting}
            className="p-1.5 rounded-lg bg-[#F3F4F6] text-[#6B7280] hover:text-[#111111] hover:bg-[#E5E7EB] transition-colors disabled:opacity-50"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto">
          {/* Explicit Error Display */}
          {errorMessage && (
            <div
              className="p-3 rounded-xl bg-white border border-[#E5E7EB] flex items-center gap-2 text-[#111111] text-xs font-medium leading-relaxed"
              role="alert"
            >
              <AlertCircle className="w-4 h-4 shrink-0 text-[#D4202C]" />
              <div className="flex-1">
                <span>{errorMessage}</span>
              </div>
            </div>
          )}

          {/* Role selector */}
          <div>
            <label className="block text-xs font-semibold text-[#111111] mb-1.5">
              Account Role
            </label>
            <div className="grid grid-cols-2 gap-2 bg-[#F3F4F6] p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setRole('student')}
                disabled={isSubmitting}
                className={`py-2 rounded-lg text-xs font-semibold transition-all ${
                  role === 'student'
                    ? 'bg-[#D4202C] text-white'
                    : 'text-[#6B7280] hover:text-[#111111]'
                }`}
              >
                Student
              </button>
              <button
                type="button"
                onClick={() => setRole('guide')}
                disabled={isSubmitting}
                className={`py-2 rounded-lg text-xs font-semibold transition-all ${
                  role === 'guide'
                    ? 'bg-[#D4202C] text-white'
                    : 'text-[#6B7280] hover:text-[#111111]'
                }`}
              >
                Guide
              </button>
            </div>
          </div>

          {/* Full name */}
          <div>
            <label className="block text-xs font-semibold text-[#111111] mb-1">
              Full Name <span className="text-[#D4202C]">*</span>
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => {
                setFullName(e.target.value);
                if (errorMessage) setErrorMessage(null);
              }}
              placeholder="e.g. Ahmad Shafi"
              required
              disabled={isSubmitting}
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#F3F4F6] text-sm text-[#111111] border border-transparent focus:border-[#D4202C] focus:bg-white outline-hidden transition-all disabled:opacity-60"
            />
          </div>

          {/* Username / Roll ID */}
          <div>
            <label className="block text-xs font-semibold text-[#111111] mb-1">
              Username / Roll ID <span className="text-[#D4202C]">*</span>
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                if (errorMessage) setErrorMessage(null);
              }}
              placeholder="e.g. DH2401 or u_guide1"
              required
              disabled={isSubmitting}
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#F3F4F6] text-sm text-[#111111] border border-transparent focus:border-[#D4202C] focus:bg-white outline-hidden transition-all disabled:opacity-60"
            />
            <p className="text-[13px] text-[#6B7280] mt-1">
              Used for login. Will be provisioned as <span className="font-mono text-[#111111]">{username.trim() ? username.trim().toLowerCase() : '<username>'}@accounts.sibaq.internal</span>
            </p>
          </div>

          {/* Initial password */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-[#111111]">
                Initial Password <span className="text-[#D4202C]">*</span>
              </label>
              <span className="text-xs text-[#6B7280]">
                Min. 6 characters
              </span>
            </div>
            <input
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (errorMessage) setErrorMessage(null);
              }}
              placeholder="At least 6 characters"
              required
              minLength={6}
              disabled={isSubmitting}
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#F3F4F6] text-sm text-[#111111] border border-transparent focus:border-[#D4202C] focus:bg-white outline-hidden transition-all disabled:opacity-60"
            />
          </div>

          {/* Gmail / Notification Email (optional) */}
          <div>
            <label className="block text-xs font-semibold text-[#111111] mb-1">
              Gmail Address (optional)
            </label>
            <input
              type="email"
              value={notificationEmail}
              onChange={(e) => setNotificationEmail(e.target.value)}
              placeholder="student@gmail.com"
              disabled={isSubmitting}
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#F3F4F6] text-sm text-[#111111] border border-transparent focus:border-[#D4202C] focus:bg-white outline-hidden transition-all disabled:opacity-60"
            />
            <p className="text-[13px] text-[#6B7280] mt-1">
              Used for daily task and attendance alert notifications
            </p>
          </div>

          {/* Assign Guide (students only) */}
          {role === 'student' && (
            <div>
              <label className="block text-xs font-semibold text-[#111111] mb-1">
                Assign Guide (optional)
              </label>
              <select
                value={assignedGuideId}
                onChange={(e) => setAssignedGuideId(e.target.value)}
                disabled={isSubmitting}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#F3F4F6] text-sm text-[#111111] border border-transparent focus:border-[#D4202C] focus:bg-white outline-hidden transition-all disabled:opacity-60"
              >
                <option value="">Unassigned</option>
                {guides.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.fullName} ({g.username})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Modal Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#F3F4F6]">
            <button
              type="button"
              onClick={handleClose}
              disabled={isSubmitting}
              className="px-4 py-2.5 rounded-xl bg-[#F3F4F6] text-xs font-semibold text-[#111111] hover:bg-[#E5E7EB] transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="h-12 px-5 rounded-[10px] bg-[#D4202C] hover:bg-[#B81B26] active:bg-[#B81B26] text-white text-xs font-semibold transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Creating account...</span>
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4" />
                  <span>Create account</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
