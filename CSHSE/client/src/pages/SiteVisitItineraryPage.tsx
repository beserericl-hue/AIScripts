import { useParams } from 'react-router-dom';
import { Itinerary } from '../features/siteVisit/Itinerary/Itinerary';

export default function SiteVisitItineraryPage() {
  const { submissionId = '' } = useParams<{ submissionId: string }>();
  return <Itinerary submissionId={submissionId} />;
}
