import { useState, useRef, useEffect } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { api } from '../services/api';
import { HelpChat } from './HelpChat';
import { BugReporter } from './BugReporter';
import { HelpMenu } from './HelpMenu';
import { NotificationBell } from './NotificationBell';
import { Toast } from './Toast';
import { HintLayer } from '../features/tour/HintLayer';
import { WelcomeTour } from '../features/tour/WelcomeTour';
import { WelcomeTourAutoStart } from '../features/tour/WelcomeTourAutoStart';

// Simple icon components
const HomeIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
  </svg>
);

const DocumentIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
);

const CogIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

const LogoutIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
  </svg>
);

const SwitchIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
  </svg>
);

export default function Layout() {
  const location = useLocation();
  const {
    user,
    logout,
    impersonation,
    stopImpersonation,
    openImpersonationSelector,
    getEffectiveRole,
    getEffectiveUser,
    canAccessAdminSettings,
    isSuperuser,
    updatePreferences,
  } = useAuthStore();

  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ newPassword: '', confirmPassword: '' });
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleChangePassword = async () => {
    setPasswordError('');
    setPasswordSuccess('');

    if (!passwordForm.newPassword || !passwordForm.confirmPassword) {
      setPasswordError('Both fields are required');
      return;
    }
    if (passwordForm.newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters');
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError('Passwords do not match');
      return;
    }

    setIsChangingPassword(true);
    try {
      await api.put('/api/auth/change-password', {
        newPassword: passwordForm.newPassword,
        userId: impersonation.isImpersonating && impersonation.impersonatedUser
          ? impersonation.impersonatedUser.id
          : undefined,
      });
      setPasswordSuccess('Password changed successfully');
      setPasswordForm({ newPassword: '', confirmPassword: '' });
      setTimeout(() => {
        setShowChangePassword(false);
        setPasswordSuccess('');
      }, 1500);
    } catch (err: any) {
      setPasswordError(err.response?.data?.error || 'Failed to change password');
    } finally {
      setIsChangingPassword(false);
    }
  };

  const effectiveRole = getEffectiveRole();
  const effectiveUser = getEffectiveUser();
  const showSettings = canAccessAdminSettings();
  const isCurrentlySuperuser = isSuperuser();

  // Determine whose password is being changed
  const passwordTargetUser = impersonation.isImpersonating && impersonation.impersonatedUser
    ? impersonation.impersonatedUser
    : effectiveUser;

  // CR-052 — `tourStep` keys the data-tour-step attribute the welcome
  // tour spotlights. `home`, `self-study`, `review-queue`, `compilations`,
  // `settings`, `help` map to the TOUR_TARGETS constants in
  // features/tour/welcomeTourSteps.tsx. Items without a tourStep stay
  // off the tour.
  const navigation: Array<{ name: string; href: string; icon: any; tourStep?: string }> = [
    { name: 'Home', href: '/dashboard', icon: HomeIcon, tourStep: 'home' },
  ];

  // Sprint 3 — readers get a Review queue link. PCs still see Self-Study.
  // Admins + superusers see both (they may need either surface).
  const isReaderRole = effectiveRole === 'reader' || effectiveRole === 'lead_reader';
  const isAdminLikeRole = effectiveRole === 'admin' || isCurrentlySuperuser;
  const isLeadOrAdmin = effectiveRole === 'lead_reader' || isAdminLikeRole;
  if (!isReaderRole || isAdminLikeRole) {
    navigation.push({ name: 'Self-Study', href: '/self-study', icon: DocumentIcon, tourStep: 'self-study' });
  }
  if (isReaderRole || isAdminLikeRole) {
    navigation.push({ name: 'Review queue', href: '/reader', icon: DocumentIcon, tourStep: 'review-queue' });
  }
  // Sprint 5.1 — Compilations tab for lead readers + admins (CR-009).
  if (isLeadOrAdmin) {
    navigation.push({ name: 'Compilations', href: '/lead-reader', icon: DocumentIcon, tourStep: 'compilations' });
  }

  // Show Settings for admin role or superuser (not impersonating)
  if (showSettings) {
    navigation.push({ name: 'Settings', href: '/admin', icon: CogIcon, tourStep: 'settings' });
  }

  const displayName = effectiveUser
    ? `${effectiveUser.firstName} ${effectiveUser.lastName}`
    : `${user?.firstName} ${user?.lastName}`;

  const displayRole = impersonation.isImpersonating
    ? impersonation.impersonatedRole
    : user?.role;

  // Check if we're on a full-width route (self-study editor with submissionId)
  const isFullWidthRoute = location.pathname.match(/^\/self-study\/[^/]+/);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Impersonation Banner */}
      {impersonation.isImpersonating && (
        <div className="bg-amber-500 text-white px-4 py-2">
          <div className={isFullWidthRoute ? 'flex items-center justify-between' : 'max-w-7xl mx-auto flex items-center justify-between'}>
            <div className="flex items-center space-x-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-sm font-medium">
                Viewing as:{' '}
                {impersonation.impersonatedUser
                  ? `${impersonation.impersonatedUser.firstName} ${impersonation.impersonatedUser.lastName} (${impersonation.impersonatedRole?.replace('_', ' ')})`
                  : impersonation.impersonatedRole?.replace('_', ' ')}
              </span>
            </div>
            <button
              onClick={stopImpersonation}
              className="flex items-center space-x-1 text-sm font-medium hover:text-amber-100 transition-colors"
            >
              <SwitchIcon />
              <span>Switch Role</span>
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="app-header">
        <div className={isFullWidthRoute ? 'px-4' : 'app-header-content'}>
          <div className="app-header-inner">
            {/* Logo and Navigation */}
            <div className="flex items-center">
              <Link to="/dashboard" className="app-logo">
                <img
                  src="/cshse-logo.svg"
                  alt="CSHSE"
                  className="h-14 w-14"
                />
                <span className="app-logo-text hidden md:block">Self-Study Portal</span>
              </Link>

              <nav className="nav-tabs">
                {navigation.map((item) => {
                  const isActive = location.pathname === item.href ||
                    (item.href !== '/dashboard' && location.pathname.startsWith(item.href));
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.name}
                      to={item.href}
                      // CR-052 — data-tour-step anchors the welcome tour
                      // spotlight to the nav item. Optional; items
                      // without a tourStep are simply not in the tour.
                      data-tour-step={item.tourStep}
                      className={`nav-tab flex items-center space-x-2 ${
                        isActive ? 'nav-tab-active' : 'nav-tab-inactive'
                      }`}
                    >
                      <Icon />
                      <span>{item.name}</span>
                    </Link>
                  );
                })}
              </nav>
            </div>

            {/* User Menu */}
            <div className="user-menu">
              <span className="user-name hidden sm:block">
                {displayName}
              </span>
              <span className={`user-role-badge ${isCurrentlySuperuser ? 'bg-purple-100 text-purple-700' : ''}`}>
                {isCurrentlySuperuser ? 'Superuser' : displayRole?.replace('_', ' ')}
              </span>
              {/* Switch Role button for superusers not currently impersonating */}
              {user?.isSuperuser && !impersonation.isImpersonating && (
                <button
                  onClick={openImpersonationSelector}
                  className="flex items-center space-x-1 px-3 py-1.5 text-sm font-medium text-purple-700 bg-purple-50 hover:bg-purple-100 rounded-md transition-colors"
                  title="Switch to a different role"
                >
                  <SwitchIcon />
                  <span className="hidden sm:inline">Switch Role</span>
                </button>
              )}
              {/* CR-052 — Help menu lives next to the cog. Carries the
                  data-tour-step="help" target the welcome tour spotlights
                  in its final step + the id the post-completion hint
                  anchors to. */}
              {/* Notification pass — in-app notification bell with unread badge. */}
              <NotificationBell />
              <HelpMenu />
              <div className="relative" ref={menuRef}>
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex items-center justify-center w-8 h-8 rounded-full hover:bg-gray-200 transition-colors"
                  title="User settings"
                >
                  <CogIcon />
                </button>
                {showUserMenu && (
                  <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                    {/* CR-045 — per-PC UI preferences. Only Program
                        Coordinators see the legacy-importer toggle (the
                        legacy "Import Document" button only renders for
                        the PC role). hideLegacyImporter defaults true. */}
                    {getEffectiveRole() === 'program_coordinator' && (
                      <>
                        <div className="px-4 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                          Preferences
                        </div>
                        <label className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={user?.preferences?.hideLegacyImporter ?? true}
                            onChange={(e) =>
                              updatePreferences({ hideLegacyImporter: e.target.checked })
                            }
                            className="h-4 w-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                          />
                          Hide legacy importer
                        </label>
                        <div className="my-1 border-t border-gray-100" />
                      </>
                    )}
                    <button
                      onClick={() => {
                        setShowUserMenu(false);
                        setShowChangePassword(true);
                        setPasswordError('');
                        setPasswordSuccess('');
                        setPasswordForm({ newPassword: '', confirmPassword: '' });
                      }}
                      className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                      </svg>
                      Change Password
                    </button>
                    <button
                      onClick={() => {
                        setShowUserMenu(false);
                        logout();
                      }}
                      className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                      <LogoutIcon />
                      Logout
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main content - full width for self-study editor, constrained for other pages */}
      <main className={isFullWidthRoute ? '' : 'max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8'}>
        <Outlet />
      </main>

      {/* Change Password Modal */}
      {showChangePassword && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-1">Change Password</h2>
            <p className="text-sm text-gray-500 mb-4">
              {passwordTargetUser?.firstName} {passwordTargetUser?.lastName}
            </p>

            {passwordError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                {passwordError}
              </div>
            )}
            {passwordSuccess && (
              <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
                {passwordSuccess}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
                <div className="relative">
                  <input
                    type={showNewPw ? 'text' : 'password'}
                    value={passwordForm.newPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPw(!showNewPw)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showNewPw ? (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" /></svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                    )}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Confirm New Password</label>
                <div className="relative">
                  <input
                    type={showConfirmPw ? 'text' : 'password'}
                    value={passwordForm.confirmPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPw(!showConfirmPw)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showConfirmPw ? (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" /></svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                    )}
                  </button>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowChangePassword(false)}
                className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleChangePassword}
                disabled={isChangingPassword}
                className="px-4 py-2 text-sm text-white bg-teal-600 rounded-lg hover:bg-teal-700 disabled:opacity-50"
              >
                {isChangingPassword ? 'Changing...' : 'Change Password'}
              </button>
            </div>
          </div>
        </div>
      )}

      <HelpChat />

      {/* CR-016 — In-app bug reporter floating trigger + modal. */}
      <BugReporter />

      {/* CR-052 — Tour + Hint + Toast layers. Mounted at the layout root
          so every authenticated route gets them. HintLayer + WelcomeTour
          read from their context providers (mounted in App.tsx around
          the protected route). */}
      <WelcomeTourAutoStart />
      <WelcomeTour />
      <HintLayer />
      <Toast />
    </div>
  );
}
