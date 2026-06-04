/**
 * MoveTextModal — selecting text + a destination and clicking Move calls back
 * with the split halves and the chosen (std, spec).
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('../../../../../services/api', () => ({ api: { get: vi.fn() } }));
import { api } from '../../../../../services/api';
import { MoveTextModal } from './MoveTextModal';
import { __resetStandardsCatalogCache } from './useStandardsCatalog';

const CATALOG = [
  { code: '2', title: 'Governance', specifications: [{ code: 'a', title: 'A' }, { code: 'b', title: 'B' }, { code: 'c', title: 'C' }] },
];

describe('<MoveTextModal />', () => {
  beforeEach(() => {
    __resetStandardsCatalogCache();
    (api.get as any).mockReset();
    (api.get as any).mockResolvedValue({ data: CATALOG });
  });

  it('moves the selected paragraph to the chosen subspec', async () => {
    const onMove = vi.fn();
    render(
      <MoveTextModal
        html="<p>Keep one.</p><p>MOVE me.</p><p>Keep two.</p>"
        currentStd="2"
        currentSpec="a"
        onCancel={() => {}}
        onMove={onMove}
      />
    );

    const body = screen.getByTestId('move-text-body');

    // Destination first (userEvent interactions can collapse a DOM selection):
    // Standard 2 → Substandard b. (2.a is excluded as current.)
    const stdSel = await screen.findByTestId('move-text-std');
    await waitFor(() => expect(within(stdSel).getByText('2 — Governance')).toBeInTheDocument());
    await userEvent.selectOptions(stdSel, '2');
    await userEvent.selectOptions(screen.getByTestId('move-text-spec'), 'b');

    // Now select the middle <p> (child index 1..2) and refresh the preview.
    const range = document.createRange();
    range.setStart(body, 1);
    range.setEnd(body, 2);
    const sel = window.getSelection()!;
    sel.removeAllRanges();
    sel.addRange(range);
    fireEvent.mouseUp(body);
    await waitFor(() =>
      expect(screen.getByTestId('move-text-selection')).toHaveTextContent(/MOVE me/i)
    );

    fireEvent.click(screen.getByTestId('move-text-confirm'));

    expect(onMove).toHaveBeenCalledTimes(1);
    const arg = onMove.mock.calls[0][0];
    expect(arg.targetStd).toBe('2');
    expect(arg.targetSpec).toBe('b');
    expect(arg.movedHtml).toBe('<p>MOVE me.</p>');
    expect(arg.remainderHtml).toBe('<p>Keep one.</p><p>Keep two.</p>');
  });

  it('the current subspec is excluded from the destination list', async () => {
    render(
      <MoveTextModal
        html="<p>x</p>"
        currentStd="2"
        currentSpec="a"
        onCancel={() => {}}
        onMove={() => {}}
      />
    );
    const stdSel = await screen.findByTestId('move-text-std');
    await userEvent.selectOptions(stdSel, '2');
    const specSel = screen.getByTestId('move-text-spec');
    // 2.b and 2.c present, 2.a (current) absent.
    expect(within(specSel).queryByText(/^2\.a/)).toBeNull();
    expect(within(specSel).getByText(/^2\.b/)).toBeInTheDocument();
  });
});
