/**
 * Numbered parts (4.a.1 …) in the Review rail: listed under their spec, each
 * with an Approve box that saves; specs without parts show none.
 */
import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('../../../../../services/api', () => ({ api: { get: vi.fn(), post: vi.fn() } }));
import { api } from '../../../../../services/api';
import { SpecRail } from './SpecRail';
import type { SpecBucket } from '../../../../../store/aiImportStore';

const bucket = (standardCode: string, specCode: string): SpecBucket => ({
  standardCode, specCode, standardTitle: 'Program Evaluation', specPrompt: 'p',
  narratives: [], evidenceText: [], evidenceFiles: [],
  coverageScore: null, coverageCovered: null, coverageGaps: [], coverageStrengths: [],
});

function renderRail() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <SpecRail
        buckets={{ '4.a': bucket('4', 'a'), '4.d': bucket('4', 'd') }}
        tags={[]} placeholders={[]} selectedKey={null} onSelect={() => {}}
        submissionId="sub1"
      />
    </QueryClientProvider>
  );
}

describe('<SpecRail /> numbered parts', () => {
  beforeEach(() => {
    (api.get as any).mockResolvedValue({ data: {
      parts: { '4_a': [{ n: 1, text: 'Measurable student learning outcomes' }, { n: 2, text: 'Assessment plan' }] },
      approvals: { '4_a': { '1': { approvedAt: '2026-11-01' } } },
    } });
    (api.post as any).mockResolvedValue({ data: { specPartApprovals: { '4_a': { '1': {}, '2': {} } } } });
  });

  it('POSITIVE: lists each part under its spec with its approval state and a count badge', async () => {
    renderRail();
    expect(await screen.findByTestId('rail-parts-4-a')).toBeInTheDocument();
    expect(screen.getByText('4.a.1')).toBeInTheDocument();
    expect(screen.getByText('4.a.2')).toBeInTheDocument();
    expect((screen.getByTestId('rail-parts-4-a-1') as HTMLInputElement).checked).toBe(true);
    expect((screen.getByTestId('rail-parts-4-a-2') as HTMLInputElement).checked).toBe(false);
    expect(screen.getByTestId('parts-badge-4-a')).toHaveTextContent('1/2 parts');
  });

  it('POSITIVE: ticking a part saves its approval', async () => {
    renderRail();
    await userEvent.click(await screen.findByTestId('rail-parts-4-a-2'));
    expect(api.post).toHaveBeenCalledWith('/api/submissions/sub1/spec-parts/approval', { standardCode: '4', specCode: 'a', n: 2, approved: true });
    await waitFor(() => expect(screen.getByTestId('parts-badge-4-a')).toHaveTextContent('2/2 parts'));
  });

  it('NEGATIVE: a spec without numbered parts gets no list and no badge', async () => {
    renderRail();
    await screen.findByTestId('rail-parts-4-a');
    expect(screen.queryByTestId('rail-parts-4-d')).toBeNull();
    expect(screen.queryByTestId('parts-badge-4-d')).toBeNull();
  });
});
