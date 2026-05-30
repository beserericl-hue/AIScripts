/**
 * S3.2 — ReaderReviewScreenView unit tests.
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReaderReviewScreenView } from './ReaderReviewScreen';

function wrap(children: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <MemoryRouter>
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    </MemoryRouter>
  );
}

const submission = {
  _id: 'sub-1',
  submissionId: '2026-001',
  institutionName: 'Stevenson University',
  programName: 'Human Services',
  programLevel: 'bachelors' as const,
  status: 'under_review',
  narratives: {
    '1': { a: { content: '<p>Accredited by MSCHE.</p>' } },
    '2': { a: { content: '<p>Faculty governance.</p>' } },
  },
  standardsStatus: {
    '2_a': { excluded: true, excludedReason: 'Not applicable' },
  },
};

const standards = [
  { code: '1', specifications: [{ code: 'a' }] },
  { code: '2', specifications: [{ code: 'a' }] },
];

describe('ReaderReviewScreenView', () => {
  it('renders loading', () => {
    render(wrap(<ReaderReviewScreenView submission={null} standards={[]} scoresByKey={{}} canScore canOverride isLoading />));
    expect(screen.getByTestId('reader-review-loading')).toBeInTheDocument();
  });

  it('renders error state on failure', () => {
    render(
      wrap(
        <ReaderReviewScreenView
          submission={null}
          standards={[]}
          scoresByKey={{}}
          canScore
          canOverride
          isLoading={false}
          error="boom"
        />
      )
    );
    expect(screen.getByTestId('reader-review-error')).toBeInTheDocument();
  });

  it('renders the submission header + spec rows', () => {
    render(
      wrap(
        <ReaderReviewScreenView
          submission={submission as any}
          standards={standards}
          scoresByKey={{}}
          canScore
          canOverride
          isLoading={false}
        />
      )
    );
    expect(screen.getByText('Stevenson University')).toBeInTheDocument();
    expect(screen.getByText(/Human Services/)).toBeInTheDocument();
    expect(screen.getByTestId('reader-spec-row-1-a')).toBeInTheDocument();
    expect(screen.getByTestId('reader-spec-row-2-a')).toBeInTheDocument();
    // 2.a is excluded — should render the N/A chip.
    expect(screen.getByText(/Marked Not Applicable/)).toBeInTheDocument();
  });

  it('renders an empty-state when no submission is returned', () => {
    render(
      wrap(<ReaderReviewScreenView submission={null} standards={[]} scoresByKey={{}} canScore canOverride isLoading={false} />)
    );
    expect(screen.getByTestId('reader-review-empty')).toBeInTheDocument();
  });
});
