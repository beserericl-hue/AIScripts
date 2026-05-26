/**
 * Component unit tests for CR-033 StandaloneCVReview.
 *
 * Rendered by ReviewStep when only CV.docx files were uploaded. The
 * three-column workspace is too heavy for that case; this surface is
 * a single list with name + (standard, spec) per CV and one Apply button.
 *
 * We assert:
 *   - Empty-state ("expected at least one CV") with Start Over link
 *   - One card per CV with the faculty name field + Standard/Spec dropdowns
 *   - Faculty-name edits call updateCvFacultyName
 *   - Standard change calls updateCvRouting with the first spec of the
 *     chosen standard (the spec dropdown can't be empty)
 *   - Spec change calls updateCvRouting(sectionId, std, spec)
 *   - Apply button disabled while any CV is missing routing
 *   - Apply button enabled and fires apply + setStep('apply') when all
 *     CVs have (resolvedStd, resolvedSpec)
 *   - Catalog load error banner surfaces
 */
import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useAIImportStore } from '../../../../../store/aiImportStore';

// Mock the api module — StandaloneCVReview fetches /api/standards on mount.
vi.mock('../../../../../services/api', () => ({
  api: {
    get: vi.fn(),
  },
}));

import { api } from '../../../../../services/api';
import { StandaloneCVReview } from './StandaloneCVReview';

const STANDARDS_CATALOG = [
  {
    code: '1',
    title: 'Mission',
    specifications: [
      { code: 'a', title: 'Statement' },
      { code: 'b', title: 'Goals' },
    ],
  },
  {
    code: '2',
    title: 'Governance',
    specifications: [{ code: 'a', title: 'Board' }],
  },
];

function seedCV(overrides: Partial<{
  sectionId: string;
  facultyName: string;
  snippet: string;
  resolvedStd?: string;
  resolvedSpec?: string;
}> = {}): any {
  return {
    sectionId: overrides.sectionId ?? 'cv-1',
    facultyName: overrides.facultyName ?? 'Dr. Alice',
    snippet: overrides.snippet ?? 'PhD, taught at ...',
    confidence: 0.9,
    routing: { source: 'matcher' as const },
    resolvedStd: overrides.resolvedStd,
    resolvedSpec: overrides.resolvedSpec,
  };
}

describe('<StandaloneCVReview />', () => {
  beforeEach(() => {
    useAIImportStore.getState().reset();
    (api.get as any).mockReset();
    (api.get as any).mockResolvedValue({ data: STANDARDS_CATALOG });
  });

  it('renders empty-state with a Start Over button when no CVs are detected', async () => {
    render(<StandaloneCVReview />);
    expect(screen.getByText(/expected at least one CV/i)).toBeInTheDocument();
    const startOver = screen.getByRole('button', { name: /start over/i });
    await userEvent.click(startOver);
    expect(useAIImportStore.getState().step).toBe('upload');
  });

  it('renders one card per CV with the faculty name + Standard/Spec selects', async () => {
    useAIImportStore.setState({
      cvs: [seedCV({ sectionId: 'cv-a', facultyName: 'Dr. Alice' }), seedCV({ sectionId: 'cv-b', facultyName: 'Dr. Bob' })],
    });
    render(<StandaloneCVReview />);
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/api/standards'));
    expect(screen.getByDisplayValue('Dr. Alice')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Dr. Bob')).toBeInTheDocument();
    // Each card should render two selects (standard + spec).
    expect(screen.getAllByRole('combobox').length).toBe(4);
  });

  it('updates faculty name via updateCvFacultyName on every keystroke', async () => {
    useAIImportStore.setState({ cvs: [seedCV({ sectionId: 'cv-1', facultyName: 'A' })] });
    render(<StandaloneCVReview />);
    await waitFor(() => expect(api.get).toHaveBeenCalled());
    const input = screen.getByDisplayValue('A');
    await userEvent.type(input, 'lice');
    expect(useAIImportStore.getState().cvs[0].facultyName).toBe('Alice');
  });

  it('picking a Standard auto-selects the first spec for that standard', async () => {
    useAIImportStore.setState({ cvs: [seedCV({ sectionId: 'cv-1' })] });
    render(<StandaloneCVReview />);
    await waitFor(() => expect(api.get).toHaveBeenCalled());
    const selects = screen.getAllByRole('combobox');
    const stdSelect = selects[0];
    await userEvent.selectOptions(stdSelect, '1');
    const cv = useAIImportStore.getState().cvs[0];
    expect(cv.resolvedStd).toBe('1');
    expect(cv.resolvedSpec).toBe('a'); // first spec under Standard 1
  });

  it('changing the Spec dropdown updates resolvedSpec without changing standard', async () => {
    useAIImportStore.setState({
      cvs: [seedCV({ sectionId: 'cv-1', resolvedStd: '1', resolvedSpec: 'a' })],
    });
    render(<StandaloneCVReview />);
    await waitFor(() => expect(api.get).toHaveBeenCalled());
    const selects = screen.getAllByRole('combobox');
    // selects[1] is the spec dropdown for the only CV.
    await userEvent.selectOptions(selects[1], 'b');
    const cv = useAIImportStore.getState().cvs[0];
    expect(cv.resolvedStd).toBe('1');
    expect(cv.resolvedSpec).toBe('b');
  });

  it('Apply button is disabled while any CV is missing a (std, spec)', async () => {
    useAIImportStore.setState({
      cvs: [
        seedCV({ sectionId: 'cv-1', resolvedStd: '1', resolvedSpec: 'a' }),
        seedCV({ sectionId: 'cv-2' }), // unrouted
      ],
    });
    render(<StandaloneCVReview />);
    await waitFor(() => expect(api.get).toHaveBeenCalled());
    expect(screen.getByRole('button', { name: /apply/i })).toBeDisabled();
  });

  it('Apply button is enabled and fires apply() + setStep("apply") when fully routed', async () => {
    useAIImportStore.setState({
      cvs: [seedCV({ sectionId: 'cv-1', resolvedStd: '2', resolvedSpec: 'a' })],
    });
    const applySpy = vi.spyOn(useAIImportStore.getState(), 'apply').mockResolvedValue(undefined as any);
    const setStepSpy = vi.spyOn(useAIImportStore.getState(), 'setStep');
    render(<StandaloneCVReview />);
    await waitFor(() => expect(api.get).toHaveBeenCalled());
    const btn = screen.getByRole('button', { name: /apply/i });
    expect(btn).not.toBeDisabled();
    await userEvent.click(btn);
    expect(applySpy).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(setStepSpy).toHaveBeenCalledWith('apply'));
    applySpy.mockRestore();
    setStepSpy.mockRestore();
  });

  it('renders a load-error banner when /api/standards rejects', async () => {
    (api.get as any).mockRejectedValue(new Error('boom'));
    useAIImportStore.setState({ cvs: [seedCV()] });
    render(<StandaloneCVReview />);
    await waitFor(() =>
      expect(screen.getByText(/Couldn.t load the standards catalog/i)).toBeInTheDocument()
    );
  });

  it('shows Applying… spinner state when status === "applying"', async () => {
    useAIImportStore.setState({
      cvs: [seedCV({ resolvedStd: '1', resolvedSpec: 'a' })],
      status: 'applying',
    });
    render(<StandaloneCVReview />);
    await waitFor(() => expect(api.get).toHaveBeenCalled());
    expect(screen.getByRole('button', { name: /applying/i })).toBeInTheDocument();
  });

  it('shows ✓ Applied state when status === "applied"', async () => {
    useAIImportStore.setState({
      cvs: [seedCV({ resolvedStd: '1', resolvedSpec: 'a' })],
      status: 'applied',
    });
    render(<StandaloneCVReview />);
    await waitFor(() => expect(api.get).toHaveBeenCalled());
    expect(screen.getByRole('button', { name: /Applied/i })).toBeInTheDocument();
  });
});
