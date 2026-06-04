/**
 * Spec-assignment dropdowns on the Review wizard's CV + Evidence-Docs rails.
 *
 * The coordinator must be able to assign a Standard / Substandard to each
 * faculty CV, syllabus, and appendix paper from the Review surface. These
 * tests pin that contract:
 *
 *   - An unrouted CV / evidence doc shows an "Unassigned" badge + the
 *     Standard + Substandard dropdowns.
 *   - Picking a Standard records it in the store (and defaults the spec to
 *     the first substandard of that standard, so the pair is never half-set).
 *   - Picking a Substandard records the full (std, spec) pair.
 *   - For evidence docs the pick lands on routing.{std,spec} — the field the
 *     server reads at Apply to stamp SupportingEvidence.standardCode/specCode.
 */
import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useAIImportStore } from '../../../../../store/aiImportStore';

// The assignment dropdowns fetch the standards catalog on mount and POST the
// routing to the server on change.
vi.mock('../../../../../services/api', () => ({
  api: { get: vi.fn(), post: vi.fn() },
}));

import { api } from '../../../../../services/api';
import { ItemCardList } from './ItemCardList';
import { CVS_KEY, SYLLABI_KEY } from './SpecRail';
import { __resetStandardsCatalogCache } from './useStandardsCatalog';

const STANDARDS_CATALOG = [
  {
    code: '1',
    title: 'Mission',
    specifications: [
      { code: 'a', title: 'Statement' },
      { code: 'b', title: 'Goals' },
    ],
  },
  { code: '2', title: 'Governance', specifications: [{ code: 'a', title: 'Board' }] },
];

function baseProps(overrides: any = {}) {
  return {
    selectedKey: CVS_KEY,
    bucket: null,
    unplacedTags: [],
    placeholders: [],
    matrices: [],
    selectedSectionId: null,
    onSelect: () => {},
    onBulkAction: () => {},
    ...overrides,
  };
}

describe('Review spec-assignment dropdowns', () => {
  beforeEach(() => {
    useAIImportStore.getState().reset();
    __resetStandardsCatalogCache();
    (api.get as any).mockReset();
    (api.get as any).mockResolvedValue({ data: STANDARDS_CATALOG });
    (api.post as any).mockReset();
    (api.post as any).mockResolvedValue({ data: { ok: true } });
  });

  it('CV: shows Unassigned + dropdowns, and picking a standard routes it (defaults spec)', async () => {
    const cv: any = {
      sectionId: 'cv-1',
      facultyName: 'Dr. Alice',
      snippet: 'PhD ...',
      confidence: 0.9,
      routing: { source: 'matcher' as const },
    };
    useAIImportStore.getState().setCVs([cv]);

    render(<ItemCardList {...baseProps({ cvs: [cv] })} />);

    expect(screen.getByText('Unassigned')).toBeInTheDocument();
    // Catalog options arrive async.
    const stdSelect = await screen.findByTestId('cv-assign-cv-1-std');
    await waitFor(() =>
      expect(within(stdSelect).getByText('1 — Mission')).toBeInTheDocument()
    );

    await userEvent.selectOptions(stdSelect, '1');

    // Picking a standard records it and defaults the spec to the first
    // substandard ('a') so the CV is never left half-assigned.
    const stored = useAIImportStore.getState().cvs[0];
    expect(stored.resolvedStd).toBe('1');
    expect(stored.resolvedSpec).toBe('a');
  });

  it('CV: assignment is PERSISTED to the server and shows "Saved"', async () => {
    // submissionId set → Review surface → routing must persist server-side so
    // it survives reload + Re-run detectors (the reported bug).
    useAIImportStore.getState().setSubmissionId('sub-123');
    const cv: any = {
      sectionId: 'cv-9',
      facultyName: 'Dr. Persist',
      snippet: 'PhD ...',
      confidence: 0.9,
      routing: { source: 'matcher' as const },
    };
    useAIImportStore.getState().setCVs([cv]);

    render(<ItemCardList {...baseProps({ cvs: [cv] })} />);

    const stdSelect = await screen.findByTestId('cv-assign-cv-9-std');
    await waitFor(() =>
      expect(within(stdSelect).getByText('2 — Governance')).toBeInTheDocument()
    );
    await userEvent.selectOptions(stdSelect, '2');

    // The routing was POSTed to the route-evidence endpoint with the section id.
    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith(
        '/api/submissions/sub-123/review/route-evidence',
        { sectionId: 'cv-9', std: '2', spec: 'a' }
      );
    });
    // And the coordinator sees the save confirmation.
    await waitFor(() =>
      expect(screen.getByTestId('cv-assign-cv-9-savestate')).toHaveTextContent(/saved/i)
    );
  });

  it('CV: picking a substandard records the full (std, spec) pair', async () => {
    const cv: any = {
      sectionId: 'cv-2',
      facultyName: 'Dr. Bob',
      snippet: 'MD ...',
      confidence: 0.8,
      routing: { source: 'matcher' as const },
      resolvedStd: '1',
      resolvedSpec: 'a',
    };
    useAIImportStore.getState().setCVs([cv]);

    render(<ItemCardList {...baseProps({ cvs: [cv] })} />);

    const specSelect = await screen.findByTestId('cv-assign-cv-2-spec');
    await waitFor(() =>
      expect(within(specSelect).getByText('1.b — Goals')).toBeInTheDocument()
    );
    await userEvent.selectOptions(specSelect, 'b');

    const stored = useAIImportStore.getState().cvs[0];
    expect(stored.resolvedStd).toBe('1');
    expect(stored.resolvedSpec).toBe('b');
  });

  it('Evidence doc (syllabus): assignment lands on routing.{std,spec} for the server', async () => {
    const doc: any = {
      sectionId: 'syl-1',
      docSubKind: 'syllabus',
      title: 'PSY 101',
      summary: 'Intro',
      pageCountEstimate: 3,
      imageCount: 0,
    };
    useAIImportStore.getState().setEvidenceDocs([doc]);

    render(
      <ItemCardList {...baseProps({ selectedKey: SYLLABI_KEY, evidenceDocs: [doc] })} />
    );

    const stdSelect = await screen.findByTestId('evdoc-assign-syl-1-std');
    await waitFor(() =>
      expect(within(stdSelect).getByText('2 — Governance')).toBeInTheDocument()
    );
    await userEvent.selectOptions(stdSelect, '2');

    const stored = useAIImportStore.getState().evidenceDocs[0];
    expect(stored.resolvedStd).toBe('2');
    expect(stored.resolvedSpec).toBe('a');
    // The server reads routing.std/spec at Apply — must be set, not just the
    // display fields.
    expect(stored.routing?.std).toBe('2');
    expect(stored.routing?.spec).toBe('a');
  });
});
