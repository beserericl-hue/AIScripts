import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { SettingsPage } from '../features/admin/Settings/SettingsPage';

export default function AdminPage() {
  const { canAccessAdminSettings } = useAuthStore();

  if (!canAccessAdminSettings()) {
    return (
      <div className="p-8">
        <div className="card max-w-md mx-auto p-8 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-gray-900">Access Denied</h1>
          <p className="text-gray-500 mt-2">You do not have permission to access this page.</p>
        </div>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="settings" element={<SettingsPage />} />
      <Route path="*" element={<Navigate to="settings" replace />} />
    </Routes>
  );
}
