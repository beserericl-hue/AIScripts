/**
 * CR-019 / Sprint 8.3 — JointVentureBadge unit tests.
 *
 * The component issues a TanStack-Query fetch internally. The tests
 * intercept axios via a vi.spyOn so each case can shape the response.
 */
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { JointVentureBadge } from './JointVentureBadge';
import { api } from '../services/api';

afterEach(() => vi.restoreAllMocks());

function wrap(ui: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return <QueryClientProvider client={qc}>{ui}</QueryClientProvider>;
}

describe('JointVentureBadge', () => {
  it('renders nothing when institutionId is null', () => {
    render(wrap(<JointVentureBadge institutionId={null} />));
    expect(screen.queryByText(/Joint Venture/)).not.toBeInTheDocument();
  });

  it('renders nothing when the institution is not in any JV', async () => {
    vi.spyOn(api, 'get').mockResolvedValue({
      data: { jointVentures: [{ _id: 'jv1', name: 'Coast', institutionIds: ['other'], archived: false }] }
    } as any);
    render(wrap(<JointVentureBadge institutionId="not-in-any" />));
    await waitFor(() => expect((api.get as any).mock.calls.length).toBeGreaterThan(0));
    expect(screen.queryByText(/Joint Venture/)).not.toBeInTheDocument();
  });

  it('renders the chip when the institution belongs to an active JV', async () => {
    vi.spyOn(api, 'get').mockResolvedValue({
      data: {
        jointVentures: [
          { _id: 'jv1', name: 'Coastal Consortium', institutionIds: ['inst-1', 'inst-2'], archived: false }
        ]
      }
    } as any);
    render(wrap(<JointVentureBadge institutionId="inst-1" />));
    const chip = await screen.findByTestId('jv-badge-inst-1');
    expect(chip).toHaveTextContent(/Joint Venture: Coastal Consortium/);
  });

  it('does NOT render when the matching JV is archived', async () => {
    vi.spyOn(api, 'get').mockResolvedValue({
      data: {
        jointVentures: [
          { _id: 'jv1', name: 'Old JV', institutionIds: ['inst-1'], archived: true }
        ]
      }
    } as any);
    render(wrap(<JointVentureBadge institutionId="inst-1" />));
    // Give the query a tick.
    await new Promise((r) => setTimeout(r, 10));
    expect(screen.queryByText(/Joint Venture/)).not.toBeInTheDocument();
  });
});
