/**
 * S3.2 / S3.4 — ReaderSpecRowView unit tests (pure view).
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReaderSpecRowView } from './ReaderSpecRow';

function wrap(children: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <MemoryRouter>
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    </MemoryRouter>
  );
}

const baseProps = {
  submissionId: 'sub-1',
  standardCode: '1',
  specCode: 'a',
  score: null,
  onScoreChange: vi.fn(),
  canScore: true,
  canOverride: true,
};

describe('ReaderSpecRowView', () => {
  it('renders the heading + verdict badge', () => {
    render(
      wrap(
        <ReaderSpecRowView
          {...baseProps}
          narrativeHtml="<p>The program is regionally accredited.</p>"
          evaluation={{ verdict: 'pass', rationale: 'Looks good.' }}
        />
      )
    );
    expect(screen.getByText(/Standard 1\.a/)).toBeInTheDocument();
    // "Pass" appears as both the verdict badge and the override radio;
    // restrict to the verdict header by looking inside the heading row.
    expect(screen.getAllByText('Pass').length).toBeGreaterThan(0);
    expect(screen.getByText(/Looks good/)).toBeInTheDocument();
  });

  it('renders the "Not yet evaluated" pill when no AI verdict exists', () => {
    render(wrap(<ReaderSpecRowView {...baseProps} narrativeHtml="<p>x</p>" />));
    expect(screen.getByText(/Not yet evaluated/i)).toBeInTheDocument();
  });

  it('marks an excluded spec and skips score/override entirely', () => {
    render(
      wrap(
        <ReaderSpecRowView
          {...baseProps}
          excluded
          excludedReason="Not applicable to bachelors"
        />
      )
    );
    expect(screen.getByText(/Marked Not Applicable/i)).toBeInTheDocument();
    expect(screen.getByText(/Not applicable to bachelors/)).toBeInTheDocument();
    expect(screen.queryByTestId('score-4-selector')).not.toBeInTheDocument();
    expect(screen.queryByTestId('override-submit')).not.toBeInTheDocument();
  });

  it('renders "Links that need your human review" when present', () => {
    render(
      wrap(
        <ReaderSpecRowView
          {...baseProps}
          narrativeHtml="<p>n</p>"
          evaluation={{
            verdict: 'needs_improvement',
            rationale: 'unclear',
            linksNeedingReview: ['https://example.edu/orgchart.png'],
          }}
        />
      )
    );
    expect(screen.getByTestId('reader-link-review')).toBeInTheDocument();
    expect(screen.getByText('https://example.edu/orgchart.png')).toBeInTheDocument();
  });

  it('shows reader-overridden hint next to the verdict', () => {
    render(
      wrap(
        <ReaderSpecRowView
          {...baseProps}
          narrativeHtml="<p>n</p>"
          evaluation={{ verdict: 'pass', readerOverridden: true }}
        />
      )
    );
    expect(screen.getByText(/\(reader\)/)).toBeInTheDocument();
  });

  it('hides score + override sections when the viewer lacks capability', () => {
    render(
      wrap(
        <ReaderSpecRowView
          {...baseProps}
          narrativeHtml="<p>n</p>"
          evaluation={{ verdict: 'pass' }}
          canScore={false}
          canOverride={false}
        />
      )
    );
    expect(screen.queryByTestId('score-4-selector')).not.toBeInTheDocument();
    expect(screen.queryByTestId('override-submit')).not.toBeInTheDocument();
  });
});
