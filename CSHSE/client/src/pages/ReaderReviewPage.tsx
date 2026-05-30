import { useAuthStore } from '../store/authStore';
import { ReaderReviewScreen } from '../features/reader/ReaderReviewScreen';

export default function ReaderReviewPage() {
  const { user } = useAuthStore();
  return (
    <ReaderReviewScreen
      userRole={user?.role as 'reader' | 'lead_reader' | 'admin' | 'program_coordinator' | undefined}
    />
  );
}
