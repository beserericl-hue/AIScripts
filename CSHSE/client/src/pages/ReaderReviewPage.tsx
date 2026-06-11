import { Navigate, useParams } from 'react-router-dom';

/**
 * The reader/lead reader reviews a submission in the SAME Self-Study Editor the
 * PC uses (standards sidebar + narrative + supporting evidence + comments on the
 * side + scoring + Reader Report) — exactly as in production. The old flat
 * `/reader/:id` review screen is deprecated, so this route simply redirects to
 * the editor. Direct links / bookmarks to /reader/:id keep working.
 */
export default function ReaderReviewPage() {
  const { submissionId } = useParams<{ submissionId: string }>();
  return <Navigate to={`/self-study/${submissionId}`} replace />;
}
