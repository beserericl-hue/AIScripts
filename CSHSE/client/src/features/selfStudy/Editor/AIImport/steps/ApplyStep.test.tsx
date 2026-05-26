/**
 * Component unit tests for ApplyStep — the wizard's final step.
 *
 * ApplyStep computes per-bucket totals, lets the coordinator pick a
 * merge mode, and either fires apply() directly or routes through a
 * DiffModal when mergeMode === 'per_spec'. We assert:
 *   - Totals row reflects narratives + evidenceText + evidenceFiles + tags + placeholders
 *   - Merge-mode radios update the store
 *   - "Back" button returns to the review step
 *   - "Apply & finish" calls store.apply() for merge / replace modes
 *   - "Apply & finish" opens the DiffModal for per_spec mode (doesn't apply yet)
 *   - Applying state disables the Apply button + shows "Applying…"
 *   - Applied state shows "Applied ✓" and the count summary
 *   - applyError surfaces in a red banner
 */
import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useAIImportStore } from '../../../../../store/aiImportStore';

// Stub the DiffModal — we just want to know that it gets passed open=true.
vi.mock('../apply/DiffModal', () => ({
  DiffModal: ({ open }: { open: boolean }) =>
    open ? <div data-testid="diff-modal-open" /> : <div data-testid="diff-modal-closed" />,
}));

import { ApplyStep } from './ApplyStep';

function seedBucket(std: string, spec: string, narratives = 0, evidenceText = 0, evidenceFiles = 0) {
  const mk = (i: number) => ({
    sectionId: `${std}-${spec}-${i}`,
    heading: 'h',
    snippet: 's',
    confidence: 0.9,
    wordCount: 100,
    rationale: '',
  });
  return {
    standardCode: std,
    specCode: spec,
    standardTitle: 'T',
    specPrompt: 'p',
    narratives: Array.from({ length: narratives }, (_, i) => mk(i)),
    evidenceText: Array.from({ length: evidenceText }, (_, i) => mk(i + 100)),
    evidenceFiles: Array.from({ length: evidenceFiles }, (_, i) => mk(i + 200)),
    matrixCells: [],
    coverageScore: null,
    coverageCovered: null,
    coverageGaps: [],
    coverageStrengths: [],
  };
}

describe('<ApplyStep />', () => {
  beforeEach(() => {
    useAIImportStore.getState().reset();
  });

  it('renders the "Ready to apply" heading when status is idle/parsed', () => {
    useAIImportStore.setState({ status: 'parsed' });
    render(<ApplyStep />);
    expect(screen.getByRole('heading', { name: /Ready to apply/i })).toBeInTheDocument();
  });

  it('renders the "Imported" heading when status === "applied"', () => {
    useAIImportStore.setState({
      status: 'applied',
      appliedCounts: { narratives: 3, evidenceText: 2, evidenceFiles: 1, tags: 0, placeholders: 0 } as any,
    });
    render(<ApplyStep />);
    expect(screen.getByRole('heading', { name: /Imported/i })).toBeInTheDocument();
  });

  it('totals row reflects narratives + evidenceText + evidenceFiles across buckets', () => {
    useAIImportStore.setState({
      buckets: {
        '1.a': seedBucket('1', 'a', 2, 1, 0) as any,
        '1.b': seedBucket('1', 'b', 1, 0, 1) as any,
      },
      tags: [{ tagId: 't1' } as any, { tagId: 't2' } as any],
      placeholderSections: [{ paragraphIndex: 0 } as any],
    });
    render(<ApplyStep />);
    expect(screen.getByText('3 items')).toBeInTheDocument(); // 2 + 1 narratives
    expect(screen.getByText('1 items')).toBeInTheDocument(); // 1 evidenceText
    expect(screen.getByText('1 files')).toBeInTheDocument(); // 1 evidenceFile
    expect(screen.getByText('2 items')).toBeInTheDocument(); // tags
    expect(screen.getByText('1 sections')).toBeInTheDocument(); // placeholders
  });

  it('selecting a merge-mode radio updates the store', async () => {
    render(<ApplyStep />);
    expect(useAIImportStore.getState().mergeMode).toBe('merge'); // default
    await userEvent.click(screen.getByRole('radio', { name: /Replace/i }));
    expect(useAIImportStore.getState().mergeMode).toBe('replace');
    await userEvent.click(screen.getByRole('radio', { name: /Per-spec/i }));
    expect(useAIImportStore.getState().mergeMode).toBe('per_spec');
  });

  it('"Back" button rewinds the wizard to the review step', async () => {
    const spy = vi.spyOn(useAIImportStore.getState(), 'setStep');
    render(<ApplyStep />);
    await userEvent.click(screen.getByRole('button', { name: /Back/i }));
    expect(spy).toHaveBeenCalledWith('review');
    spy.mockRestore();
  });

  it('"Apply & finish" fires store.apply() directly when mergeMode is "merge"', async () => {
    const apply = vi.spyOn(useAIImportStore.getState(), 'apply').mockResolvedValue(undefined as any);
    render(<ApplyStep />);
    await userEvent.click(screen.getByRole('button', { name: /Apply & finish/i }));
    expect(apply).toHaveBeenCalledTimes(1);
    apply.mockRestore();
  });

  it('"Apply & finish" fires store.apply() directly when mergeMode is "replace"', async () => {
    useAIImportStore.setState({ mergeMode: 'replace' });
    const apply = vi.spyOn(useAIImportStore.getState(), 'apply').mockResolvedValue(undefined as any);
    render(<ApplyStep />);
    await userEvent.click(screen.getByRole('button', { name: /Apply & finish/i }));
    expect(apply).toHaveBeenCalledTimes(1);
    apply.mockRestore();
  });

  it('"Apply & finish" opens the DiffModal (no apply yet) when mergeMode is "per_spec"', async () => {
    useAIImportStore.setState({ mergeMode: 'per_spec' });
    const apply = vi.spyOn(useAIImportStore.getState(), 'apply').mockResolvedValue(undefined as any);
    render(<ApplyStep />);
    // Before click: modal is closed
    expect(screen.getByTestId('diff-modal-closed')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Apply & finish/i }));
    // After click: modal opens, apply() NOT yet called
    expect(screen.getByTestId('diff-modal-open')).toBeInTheDocument();
    expect(apply).not.toHaveBeenCalled();
    apply.mockRestore();
  });

  it('Apply button is disabled and shows "Applying…" while status === "applying"', () => {
    useAIImportStore.setState({ status: 'applying' });
    render(<ApplyStep />);
    const btn = screen.getByRole('button', { name: /Applying…/i });
    expect(btn).toBeDisabled();
  });

  it('Apply button is disabled and shows "Applied ✓" once status === "applied"', () => {
    useAIImportStore.setState({
      status: 'applied',
      appliedCounts: { narratives: 1, evidenceText: 0, evidenceFiles: 0, tags: 0, placeholders: 0 } as any,
    });
    render(<ApplyStep />);
    const btn = screen.getByRole('button', { name: /Applied ✓/i });
    expect(btn).toBeDisabled();
  });

  it('applied summary banner shows the appliedCounts', () => {
    useAIImportStore.setState({
      status: 'applied',
      appliedCounts: {
        narratives: 4,
        evidenceText: 2,
        evidenceFiles: 3,
        tags: 7,
        placeholders: 5,
      } as any,
    });
    render(<ApplyStep />);
    expect(
      screen.getByText(/Imported 4 narratives, 2 evidence text, 3 files\. 7 items need review/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/5 unwritten prompts noted/i)).toBeInTheDocument();
  });

  it('applyError surfaces in a red banner', () => {
    useAIImportStore.setState({ applyError: 'Network timeout' });
    render(<ApplyStep />);
    expect(screen.getByText('Network timeout')).toBeInTheDocument();
  });
});
