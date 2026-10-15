/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { api, getStoredToken, setStoredToken } from './api';
import { AppNotification, TaskRecord, User } from './types';
import { Header } from './components/Header';
import { NotificationsModal } from './components/NotificationsModal';
import { ProfileModal } from './components/ProfileModal';
import { LoginScreen } from './components/LoginScreen';

// Student screens
import { StudentHome } from './components/student/StudentHome';
import { StudentTasks } from './components/student/StudentTasks';
import { StudentProgress } from './components/student/StudentProgress';
import { LeaderboardView } from './components/LeaderboardView';

// Guide screens
import { GuideToday } from './components/guide/GuideToday';
import { GuideTasks } from './components/guide/GuideTasks';
import { GuideMentees } from './components/guide/GuideMentees';

// Admin screens
import { AdminToday } from './components/admin/AdminToday';
import { AdminGuides } from './components/admin/AdminGuides';
import { AdminPrograms } from './components/admin/AdminPrograms';
import { AdminAccounts } from './components/admin/AdminAccounts';
import { AdminScreenshots } from './components/admin/AdminScreenshots';
import { AdminCharts } from './components/admin/AdminCharts';
import { AdminAuditLog } from './components/admin/AdminAuditLog';
import { AdminStudentDrillDown } from './components/admin/AdminStudentDrillDown';

import {
  Home,
  CheckSquare,
  TrendingUp,
  Award,
  Calendar,
  Users,
  Grid,
  ShieldAlert,
  BarChart2,
  FileText,
  UserCheck,
  MoreHorizontal,
  X,
} from 'lucide-react';

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loadingInitial, setLoadingInitial] = useState(true);

  // Active navigation tab
  const [activeTab, setActiveTab] = useState<string>('home');

  // Notifications & Profile modal state
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isMoreSheetOpen, setIsMoreSheetOpen] = useState(false);

  // Feedback toast message
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Student active task shortcut
  const [activeTaskForModal, setActiveTaskForModal] = useState<TaskRecord | null>(null);
  const [studentHomeData, setStudentHomeData] = useState<any | null>(null);

  // Admin student drill down
  const [drillDownStudentId, setDrillDownStudentId] = useState<string | null>(null);

  // Toast timer
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  // Auth restore check
  useEffect(() => {
    api
      .getMe()
      .then((res) => {
        setCurrentUser(res.user);
        setDefaultTabForRole(res.user.role);
      })
      .catch(() => {
        setCurrentUser(null);
      })
      .finally(() => {
        setLoadingInitial(false);
      });

    const handleUnauthorized = () => {
      setCurrentUser(null);
    };
    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => {
      window.removeEventListener('auth:unauthorized', handleUnauthorized);
    };
  }, []);

  const setDefaultTabForRole = (role: string) => {
    if (role === 'student') setActiveTab('home');
    else if (role === 'guide') setActiveTab('today');
    else if (role === 'admin') setActiveTab('today');
  };

  // Load notifications periodically if logged in
  useEffect(() => {
    if (!currentUser) return;
    loadNotifications();
    const interval = setInterval(loadNotifications, 30000);
    return () => clearInterval(interval);
  }, [currentUser]);

  // Load student dashboard data if student
  useEffect(() => {
    if (currentUser?.role === 'student') {
      loadStudentHomeData();
    }
  }, [currentUser]);

  const loadNotifications = () => {
    api
      .getNotifications()
      .then((res) => {
        setNotifications(res.notifications);
        setUnreadNotificationsCount(res.unreadCount);
      })
      .catch(() => {});
  };

  const handleMarkAllNotificationsRead = async () => {
    try {
      await api.markNotificationsRead();
      loadNotifications();
    } catch {}
  };

  const loadStudentHomeData = () => {
    api
      .getStudentHome()
      .then((res) => {
        setStudentHomeData(res);
      })
      .catch(() => {});
  };

  const handleLoginSuccess = (user: User) => {
    setCurrentUser(user);
    setDefaultTabForRole(user.role);
    if (user.role === 'student') {
      loadStudentHomeData();
    }
    loadNotifications();
    showToast(`Signed in as ${user.fullName}`);
  };

  const handleLogout = async () => {
    try {
      await api.logout();
    } catch {}
    setStoredToken(null);
    setCurrentUser(null);
    setIsProfileOpen(false);
  };

  if (loadingInitial) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center text-sm text-[#6B7280]">
        Loading SIBAQ'26...
      </div>
    );
  }

  // If not logged in, render strict specification LoginScreen
  if (!currentUser) {
    return <LoginScreen onLoginSuccess={handleLoginSuccess} />;
  }

  // Role: STUDENT (bottom nav: Home, Tasks, Progress, Leaderboard)
  const renderStudentContent = () => {
    if (activeTab === 'home') {
      return studentHomeData ? (
        <StudentHome
          data={studentHomeData}
          onOpenTaskModal={(task) => {
            setActiveTaskForModal(task);
            setActiveTab('tasks');
          }}
          onNavigateToTab={(tab) => setActiveTab(tab)}
        />
      ) : (
        <div className="p-8 text-center text-xs text-[#6B7280]">
          Loading preparation data...
        </div>
      );
    }
    if (activeTab === 'tasks') {
      return (
        <StudentTasks
          pendingTasks={studentHomeData?.pendingTasks || []}
          completedTasks={studentHomeData?.completedTasks || []}
          onRefresh={() => {
            loadStudentHomeData();
            showToast('Tasks updated');
          }}
          activeTaskToComplete={activeTaskForModal}
          onClearActiveTask={() => setActiveTaskForModal(null)}
        />
      );
    }
    if (activeTab === 'progress') {
      return (
        <StudentProgress
          attendanceHistory={studentHomeData?.attendanceHistory || []}
          remarks={studentHomeData?.remarks || []}
          programs={studentHomeData?.programs || []}
          hasUploadedScreenshotToday={studentHomeData?.hasUploadedScreenshotToday || false}
          onRefresh={() => {
            loadStudentHomeData();
            showToast('Progress updated');
          }}
        />
      );
    }
    if (activeTab === 'leaderboard') {
      return <LeaderboardView currentStudentId={currentUser.id} />;
    }
    return null;
  };

  // Role: GUIDE (bottom nav: Today, Tasks, Mentees. NO LEADERBOARD!)
  const renderGuideContent = () => {
    if (activeTab === 'today') {
      return <GuideToday onRemindSuccess={(msg) => showToast(msg)} />;
    }
    if (activeTab === 'tasks') {
      return <GuideTasks />;
    }
    if (activeTab === 'mentees') {
      return <GuideMentees onNotify={(msg) => showToast(msg)} />;
    }
    // Safety redirect: If guide ever attempts to open leaderboard, redirect to Today
    if (activeTab === 'leaderboard') {
      setActiveTab('today');
      return <GuideToday onRemindSuccess={(msg) => showToast(msg)} />;
    }
    return null;
  };

  // Role: ADMIN (Navigation: Today, Guides, Programs, Accounts, Screenshots, Charts, Audit log)
  const renderAdminContent = () => {
    if (activeTab === 'today') {
      return (
        <AdminToday
          onSelectStudent={(sId) => setDrillDownStudentId(sId)}
          onNotify={(msg) => showToast(msg)}
        />
      );
    }
    if (activeTab === 'guides') {
      return (
        <AdminGuides
          onSelectStudent={(sId) => setDrillDownStudentId(sId)}
          onNotify={(msg) => showToast(msg)}
        />
      );
    }
    if (activeTab === 'programs') {
      return <AdminPrograms onNotify={(msg) => showToast(msg)} />;
    }
    if (activeTab === 'accounts') {
      return <AdminAccounts onNotify={(msg) => showToast(msg)} />;
    }
    if (activeTab === 'screenshots') {
      return <AdminScreenshots onNotify={(msg) => showToast(msg)} />;
    }
    if (activeTab === 'charts') {
      return <AdminCharts />;
    }
    if (activeTab === 'audit-log') {
      return <AdminAuditLog />;
    }
    return null;
  };

  return (
    <div className="min-h-screen bg-white text-[#111111] flex flex-col antialiased selection:bg-[#D4202C] selection:text-white">
      {/* Header */}
      <Header
        user={currentUser}
        unreadCount={unreadNotificationsCount}
        onOpenNotifications={() => setIsNotificationsOpen(true)}
        onOpenProfile={() => setIsProfileOpen(true)}
        onLogout={handleLogout}
        onHomeClick={() => setActiveTab(currentUser.role === 'student' ? 'home' : 'today')}
      />

      {/* Main Container */}
      {currentUser.role === 'admin' ? (
        <div className="flex-1 max-w-6xl w-full mx-auto px-4 py-4 sm:py-6 flex flex-col md:flex-row gap-6">
          {/* Desktop/Tablet Left Sidebar */}
          <aside className="hidden md:block w-52 shrink-0">
            <nav className="sticky top-20 space-y-1 bg-white border border-[#E5E7EB] rounded-2xl p-2">
              {[
                { id: 'today', label: 'Today', icon: Calendar },
                { id: 'guides', label: 'Guides', icon: Users },
                { id: 'screenshots', label: 'Screenshots', icon: ShieldAlert },
                { id: 'charts', label: 'Charts', icon: BarChart2 },
                { id: 'programs', label: 'Programs', icon: Grid },
                { id: 'accounts', label: 'Accounts', icon: UserCheck },
                { id: 'audit-log', label: 'Audit log', icon: FileText },
              ].map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-colors ${
                      isActive
                        ? 'bg-[#D4202C] text-white'
                        : 'text-[#6B7280] hover:text-[#111111] hover:bg-[#F3F4F6]'
                    }`}
                  >
                    <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-[#6B7280]'}`} />
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </aside>

          {/* Admin Content Area */}
          <section className="flex-1 min-w-0">
            {renderAdminContent()}
          </section>
        </div>
      ) : (
        <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-4 sm:py-6">
          {currentUser.role === 'student' && renderStudentContent()}
          {currentUser.role === 'guide' && renderGuideContent()}
        </main>
      )}

      {/* Student Bottom Navigation (4 items max: Home, Tasks, Progress, Leaderboard) */}
      {currentUser.role === 'student' && (
        <nav className="fixed bottom-0 inset-x-0 bg-white border-t border-[#E5E7EB] z-40 py-1.5 px-4">
          <div className="max-w-md mx-auto grid grid-cols-4 gap-1">
            <button
              onClick={() => setActiveTab('home')}
              className={`flex flex-col items-center justify-center py-1 rounded-xl text-xs font-medium transition-colors ${
                activeTab === 'home'
                  ? 'text-[#D4202C]'
                  : 'text-[#6B7280] hover:text-[#111111]'
              }`}
            >
              <Home className="w-5 h-5 mb-0.5" />
              <span>Home</span>
            </button>
            <button
              onClick={() => setActiveTab('tasks')}
              className={`flex flex-col items-center justify-center py-1 rounded-xl text-xs font-medium transition-colors ${
                activeTab === 'tasks'
                  ? 'text-[#D4202C]'
                  : 'text-[#6B7280] hover:text-[#111111]'
              }`}
            >
              <CheckSquare className="w-5 h-5 mb-0.5" />
              <span>Tasks</span>
            </button>
            <button
              onClick={() => setActiveTab('progress')}
              className={`flex flex-col items-center justify-center py-1 rounded-xl text-xs font-medium transition-colors ${
                activeTab === 'progress'
                  ? 'text-[#D4202C]'
                  : 'text-[#6B7280] hover:text-[#111111]'
              }`}
            >
              <TrendingUp className="w-5 h-5 mb-0.5" />
              <span>Progress</span>
            </button>
            <button
              onClick={() => setActiveTab('leaderboard')}
              className={`flex flex-col items-center justify-center py-1 rounded-xl text-xs font-medium transition-colors ${
                activeTab === 'leaderboard'
                  ? 'text-[#D4202C]'
                  : 'text-[#6B7280] hover:text-[#111111]'
              }`}
            >
              <Award className="w-5 h-5 mb-0.5" />
              <span>Leaderboard</span>
            </button>
          </div>
        </nav>
      )}

      {/* Guide Bottom Navigation (3 items: Today, Tasks, Mentees. NO LEADERBOARD!) */}
      {currentUser.role === 'guide' && (
        <nav className="fixed bottom-0 inset-x-0 bg-white border-t border-[#E5E7EB] z-40 py-1.5 px-4">
          <div className="max-w-md mx-auto grid grid-cols-3 gap-1">
            <button
              onClick={() => setActiveTab('today')}
              className={`flex flex-col items-center justify-center py-1 rounded-xl text-xs font-medium transition-colors ${
                activeTab === 'today'
                  ? 'text-[#D4202C]'
                  : 'text-[#6B7280] hover:text-[#111111]'
              }`}
            >
              <Calendar className="w-5 h-5 mb-0.5" />
              <span>Today</span>
            </button>
            <button
              onClick={() => setActiveTab('tasks')}
              className={`flex flex-col items-center justify-center py-1 rounded-xl text-xs font-medium transition-colors ${
                activeTab === 'tasks'
                  ? 'text-[#D4202C]'
                  : 'text-[#6B7280] hover:text-[#111111]'
              }`}
            >
              <CheckSquare className="w-5 h-5 mb-0.5" />
              <span>Tasks</span>
            </button>
            <button
              onClick={() => setActiveTab('mentees')}
              className={`flex flex-col items-center justify-center py-1 rounded-xl text-xs font-medium transition-colors ${
                activeTab === 'mentees'
                  ? 'text-[#D4202C]'
                  : 'text-[#6B7280] hover:text-[#111111]'
              }`}
            >
              <Users className="w-5 h-5 mb-0.5" />
              <span>Mentees</span>
            </button>
          </div>
        </nav>
      )}

      {/* Admin Mobile Bottom Navigation (5 items: Today, Guides, Screenshots, Charts, More) */}
      {currentUser.role === 'admin' && (
        <>
          <nav className="fixed bottom-0 inset-x-0 bg-white border-t border-[#E5E7EB] z-40 py-1 px-1 sm:px-2 md:hidden">
            <div className="max-w-md mx-auto grid grid-cols-5 gap-0.5 sm:gap-1">
              <button
                type="button"
                onClick={() => setActiveTab('today')}
                className={`flex flex-col items-center justify-center py-1 rounded-xl text-xs font-medium transition-colors ${
                  activeTab === 'today'
                    ? 'text-[#D4202C]'
                    : 'text-[#6B7280] hover:text-[#111111]'
                }`}
              >
                <Calendar className="w-5 h-5 mb-0.5" />
                <span className="truncate">Today</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('guides')}
                className={`flex flex-col items-center justify-center py-1 rounded-xl text-xs font-medium transition-colors ${
                  activeTab === 'guides'
                    ? 'text-[#D4202C]'
                    : 'text-[#6B7280] hover:text-[#111111]'
                }`}
              >
                <Users className="w-5 h-5 mb-0.5" />
                <span className="truncate">Guides</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('screenshots')}
                className={`flex flex-col items-center justify-center py-1 rounded-xl text-xs font-medium transition-colors ${
                  activeTab === 'screenshots'
                    ? 'text-[#D4202C]'
                    : 'text-[#6B7280] hover:text-[#111111]'
                }`}
              >
                <ShieldAlert className="w-5 h-5 mb-0.5" />
                <span className="truncate">Screenshots</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('charts')}
                className={`flex flex-col items-center justify-center py-1 rounded-xl text-xs font-medium transition-colors ${
                  activeTab === 'charts'
                    ? 'text-[#D4202C]'
                    : 'text-[#6B7280] hover:text-[#111111]'
                }`}
              >
                <BarChart2 className="w-5 h-5 mb-0.5" />
                <span className="truncate">Charts</span>
              </button>

              <button
                type="button"
                onClick={() => setIsMoreSheetOpen(true)}
                className={`flex flex-col items-center justify-center py-1 rounded-xl text-xs font-medium transition-colors ${
                  ['programs', 'accounts', 'audit-log'].includes(activeTab)
                    ? 'text-[#D4202C]'
                    : 'text-[#6B7280] hover:text-[#111111]'
                }`}
              >
                <MoreHorizontal className="w-5 h-5 mb-0.5" />
                <span className="truncate">More</span>
              </button>
            </div>
          </nav>

          {/* Admin More Bottom Sheet */}
          {isMoreSheetOpen && (
            <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/40 md:hidden animate-in fade-in duration-150">
              <div
                className="fixed inset-0"
                onClick={() => setIsMoreSheetOpen(false)}
              />
              <div className="relative bg-white rounded-t-2xl p-5 border-t border-[#E5E7EB] z-10 space-y-3 animate-in slide-in-from-bottom duration-200">
                <div className="flex items-center justify-between pb-2 border-b border-[#F3F4F6]">
                  <h3 className="text-sm font-bold text-[#111111]">More options</h3>
                  <button
                    type="button"
                    onClick={() => setIsMoreSheetOpen(false)}
                    className="p-1 rounded-lg text-[#6B7280] hover:bg-[#F3F4F6]"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="space-y-1">
                  {[
                    { id: 'programs', label: 'Programs', icon: Grid },
                    { id: 'accounts', label: 'Accounts', icon: UserCheck },
                    { id: 'audit-log', label: 'Audit log', icon: FileText },
                  ].map((item) => {
                    const Icon = item.icon;
                    const isActive = activeTab === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          setActiveTab(item.id);
                          setIsMoreSheetOpen(false);
                        }}
                        className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-xs font-semibold transition-colors ${
                          isActive
                            ? 'bg-[#F3F4F6] text-[#D4202C]'
                            : 'text-[#111111] hover:bg-[#F3F4F6]'
                        }`}
                      >
                        <Icon className={`w-4 h-4 ${isActive ? 'text-[#D4202C]' : 'text-[#6B7280]'}`} />
                        <span>{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Admin Student Drill-Down Modal */}
      {drillDownStudentId && (
        <AdminStudentDrillDown
          studentId={drillDownStudentId}
          onClose={() => setDrillDownStudentId(null)}
          onNotify={(msg) => showToast(msg)}
        />
      )}

      {/* Notifications Modal */}
      <NotificationsModal
        isOpen={isNotificationsOpen}
        onClose={() => setIsNotificationsOpen(false)}
        notifications={notifications}
        onMarkAllRead={handleMarkAllNotificationsRead}
      />

      {/* Profile & Settings Modal */}
      <ProfileModal
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
        user={currentUser}
        onUserUpdated={(updated) => setCurrentUser(updated)}
        onLogout={handleLogout}
      />

      {/* Floating Action Toast (White text only on red) */}
      {toastMessage && (
        <div className="fixed bottom-16 sm:bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl bg-[#D4202C] text-white text-xs font-semibold border border-[#B81B26] transition-all animate-fade-in">
          {toastMessage}
        </div>
      )}
    </div>
  );
}
