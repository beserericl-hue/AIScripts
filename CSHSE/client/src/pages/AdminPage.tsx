import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { SettingsPage } from '../features/admin/Settings/SettingsPage';

export default function AdminPage() {
  const user = useAuthStore((state) => state.user);

  if (user?.role !== 'admin') {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold text-red-600">Access Denied</h1>
        <p className="text-gray-600 mt-2">You do not have permission to access this page.</p>
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
