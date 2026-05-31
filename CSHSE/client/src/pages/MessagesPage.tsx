import { useParams } from 'react-router-dom';
import { Messages } from '../features/reader/Messages/Messages';

// CR-010 / S12.2 — host page for the reader / lead-reader Messages (DM) view.
// Reachable at /messages/:submissionId from the reader workspace. PCs never
// see threads (the server 403s the DM endpoints); the nav link is role-gated.
export default function MessagesPage() {
  const { submissionId } = useParams<{ submissionId: string }>();
  if (!submissionId) {
    return (
      <div className="m-6 rounded border border-slate-200 bg-white p-6 text-sm text-slate-600">
        Open a submission to view its conversations.
      </div>
    );
  }
  return <Messages submissionId={submissionId} />;
}
