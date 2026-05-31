/**
 * CR-023 / S11.2 — RelayConsolePage host page.
 *
 * Pins the wiring that closed the "orphaned RelayConsole" gap:
 *   - access guard: PC / plain reader are refused; admin + lead_reader pass.
 *   - picker: only submissions in review statuses are listed (drafts hidden).
 *   - per-submission route renders the RelayConsole queue.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HintProvider } from '../features/tour/HintProvider';
import RelayConsolePage from './RelayConsolePage';

// --- mocks -----------------------------------------------------------------
const mockGet = vi.fn();
vi.mock('../services/api', () => ({
  api: { get: (...args: any[]) => mockGet(...args) },
}));

let mockRole = 'admin';
let mockSuper = false;
vi.mock('../store/authStore', () => ({
  useAuthStore: () => ({
    getEffectiveRole: () => mockRole,
    isSuperuser: () => mockSuper,
  }),
}));

function renderAt(path: string) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <HintProvider>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/relay" element={<RelayConsolePage />} />
            <Route path="/relay/:submissionId" element={<RelayConsolePage />} />
          </Routes>
        </MemoryRouter>
      </HintProvider>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  mockGet.mockReset();
  mockRole = 'admin';
  mockSuper = false;
});

describe('RelayConsolePage — access guard', () => {
  it('denies a program coordinator', () => {
    mockRole = 'program_coordinator';
    renderAt('/relay');
    expect(screen.getByText('Access Denied')).toBeInTheDocument();
  });

  it('denies a plain reader', () => {
    mockRole = 'reader';
    renderAt('/relay');
    expect(screen.getByText('Access Denied')).toBeInTheDocument();
  });

  it('allows a lead reader', async () => {
    mockRole = 'lead_reader';
    mockGet.mockResolvedValue({ data: { submissions: [] } });
    renderAt('/relay');
    expect(screen.queryByText('Access Denied')).not.toBeInTheDocument();
    await waitFor(() => expect(mockGet).toHaveBeenCalledWith('/api/submissions', expect.anything()));
  });
});

describe('RelayConsolePage — picker', () => {
  it('lists only review-status submissions (drafts hidden)', async () => {
    mockGet.mockResolvedValue({
      data: {
        submissions: [
          { _id: 's1', institutionName: 'Alpha U', programName: 'HS', programLevel: 'bachelors', status: 'draft' },
          { _id: 's2', institutionName: 'Beta U', programName: 'HS', programLevel: 'bachelors', status: 'under_review' },
          { _id: 's3', institutionName: 'Gamma U', programName: 'HS', programLevel: 'masters', status: 'review_complete' },
        ],
      },
    });
    renderAt('/relay');
    await waitFor(() => expect(screen.getByTestId('relay-pick-s2')).toBeInTheDocument());
    expect(screen.getByTestId('relay-pick-s3')).toBeInTheDocument();
    // The draft must not be offered for relay.
    expect(screen.queryByTestId('relay-pick-s1')).not.toBeInTheDocument();
  });
});

describe('RelayConsolePage — per-submission queue', () => {
  it('renders the RelayConsole queue for a chosen submission', async () => {
    // The RelayConsole container fetches the relay-queue for this id.
    mockGet.mockResolvedValue({ data: { comments: [] } });
    renderAt('/relay/sub-123');
    // Empty queue state from the embedded RelayConsole.
    await waitFor(() => expect(screen.getByTestId('relay-console-empty')).toBeInTheDocument());
    expect(mockGet).toHaveBeenCalledWith('/api/submissions/sub-123/comments/relay-queue');
  });
});
