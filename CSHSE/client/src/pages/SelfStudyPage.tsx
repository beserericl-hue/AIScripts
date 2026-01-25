import { useParams } from 'react-router-dom';
import { SelfStudyEditor } from '../features/selfStudy/Editor/SelfStudyEditor';

export default function SelfStudyPage() {
  const { submissionId } = useParams();

  if (!submissionId) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Self-Study Editor</h1>
        <p className="text-gray-600">Please select a submission from the dashboard to begin editing.</p>
      </div>
    );
  }

  return <SelfStudyEditor submissionId={submissionId} />;
}
