import { useParams } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { Checklist } from '../features/siteVisit/Checklist/Checklist';

export default function SiteVisitChecklistPage() {
  const { submissionId = '' } = useParams<{ submissionId: string }>();
  const { getEffectiveRole, isSuperuser } = useAuthStore();
  const role = getEffectiveRole();
  // Lead readers + admins (and superusers impersonating either) can flip
  // verify and remove manual items. Readers can read but not write.
  const canWrite = role === 'lead_reader' || role === 'admin' || isSuperuser();
  return <Checklist submissionId={submissionId} canWrite={canWrite} />;
}
