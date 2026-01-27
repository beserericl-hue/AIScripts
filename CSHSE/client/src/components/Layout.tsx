import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

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
  } = useAuthStore();

  const effectiveRole = getEffectiveRole();
  const effectiveUser = getEffectiveUser();
  const showSettings = canAccessAdminSettings();
  const isCurrentlySuperuser = isSuperuser();

  const navigation = [
    { name: 'Home', href: '/dashboard', icon: HomeIcon },
    { name: 'Self-Study', href: '/self-study', icon: DocumentIcon },
  ];

  // Show Settings for admin role or superuser (not impersonating)
  if (showSettings) {
    navigation.push({ name: 'Settings', href: '/admin', icon: CogIcon });
  }

  const displayName = effectiveUser
    ? `${effectiveUser.firstName} ${effectiveUser.lastName}`
    : `${user?.firstName} ${user?.lastName}`;

  const displayRole = impersonation.isImpersonating
    ? impersonation.impersonatedRole
    : user?.role;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Impersonation Banner */}
      {impersonation.isImpersonating && (
        <div className="bg-amber-500 text-white px-4 py-2">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
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
        <div className="app-header-content">
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
              <button
                onClick={logout}
                className="logout-btn"
              >
                <LogoutIcon />
                <span className="hidden sm:inline">Logout</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <Outlet />
      </main>
    </div>
  );
}
