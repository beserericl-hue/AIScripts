import { Dashboard } from '../features/dashboard/Dashboard';
import { BoardDashboard } from '../features/board/BoardDashboard';
import { useAuthStore } from '../store/authStore';

export default function DashboardPage() {
  // CSHSE Board sessions land on the completed Lead Reader Reports list.
  const role = useAuthStore((s) => s.getEffectiveRole());
  if (role === 'board') return <BoardDashboard />;
  return <Dashboard />;
}
