import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import SelfStudyPage from './pages/SelfStudyPage';
import AdminPage from './pages/AdminPage';
import AcceptInvitationPage from './pages/AcceptInvitationPage';
import ImpersonationSelector from './pages/ImpersonationSelector';
import Layout from './components/Layout';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, needsImpersonationSelection, user } = useAuthStore();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // If superuser needs to select impersonation mode, redirect to selector
  if (user?.isSuperuser && needsImpersonationSelection) {
    return <Navigate to="/impersonate" replace />;
  }

  return <>{children}</>;
}

function ImpersonationRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, user, needsImpersonationSelection } = useAuthStore();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Only allow superusers who need to select impersonation
  if (!user?.isSuperuser || !needsImpersonationSelection) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/accept-invitation" element={<AcceptInvitationPage />} />
      <Route
        path="/impersonate"
        element={
          <ImpersonationRoute>
            <ImpersonationSelector />
          </ImpersonationRoute>
        }
      />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="self-study/:submissionId?" element={<SelfStudyPage />} />
        <Route path="admin/*" element={<AdminPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
