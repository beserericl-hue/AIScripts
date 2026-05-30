import { useParams } from 'react-router-dom';
import { CompilationTab } from '../features/leadReader/CompilationTab/CompilationTab';

export default function LeadReaderCompilationPage() {
  const { submissionId = '' } = useParams<{ submissionId: string }>();
  return <CompilationTab submissionId={submissionId} />;
}
