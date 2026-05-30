import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import SelfStudyPage from './pages/SelfStudyPage';
import AdminPage from './pages/AdminPage';
import AcceptInvitationPage from './pages/AcceptInvitationPage';
import ImpersonationSelector from './pages/ImpersonationSelector';
import ReaderDashboardPage from './pages/ReaderDashboardPage';
import ReaderReviewPage from './pages/ReaderReviewPage';
import LeadReaderDashboardPage from './pages/LeadReaderDashboardPage';
import LeadReaderCompilationPage from './pages/LeadReaderCompilationPage';
import SiteVisitChecklistPage from './pages/SiteVisitChecklistPage';
import Layout from './components/Layout';
// CR-052 — Tour + Hint providers wrap the protected (logged-in) subtree.
import { TourProvider } from './features/tour/TourProvider';
import { HintProvider } from './features/tour/HintProvider';

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
            {/* CR-052 — Help tour + Hint providers wrap the protected
                subtree so every authenticated route can read useTour()
                and useHint(). They are independent of one another. */}
            <TourProvider>
              <HintProvider>
                <Layout />
              </HintProvider>
            </TourProvider>
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="self-study/:submissionId?" element={<SelfStudyPage />} />
        {/* Sprint 3 — Reader review client. /reader is the queue; /reader/:id is the review screen. */}
        <Route path="reader" element={<ReaderDashboardPage />} />
        <Route path="reader/:submissionId" element={<ReaderReviewPage />} />
        {/* Sprint 5.1 — Lead-reader compilation. /lead-reader lists submissions; /lead-reader/:id is the side-by-side tab. */}
        <Route path="lead-reader" element={<LeadReaderDashboardPage />} />
        <Route path="lead-reader/:submissionId" element={<LeadReaderCompilationPage />} />
        {/* Sprint 6.1 — Site-visit partial-compliance checklist. */}
        <Route path="site-visit/:submissionId/checklist" element={<SiteVisitChecklistPage />} />
        <Route path="admin/*" element={<AdminPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
