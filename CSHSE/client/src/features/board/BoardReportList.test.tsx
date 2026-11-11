/**
 * CSHSE Board — completed Lead Reader Reports list + the "Board · CSHSE" role
 * switcher entry. The list is read-only: open + Word / PDF download only.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { BoardReportList } from './BoardReportList';
import type { BoardReportRow } from './boardApi';
import RoleSwitcher from '../../components/RoleSwitcher';
import { useAuthStore } from '../../store/authStore';

const rows: BoardReportRow[] = [
  {
    submissionId: 's1',
    institutionName: 'Stevenson University',
    programName: 'Human Services',
    programLevel: 'bachelors',
    status: 'review_complete',
    recommendation: 'conditional',
    decisionOutcome: null,
    completedAt: '2026-10-01T12:00:00.000Z',
    hasAuthoredReport: true,
  },
  {
    submissionId: 's2',
    institutionName: 'Anne Arundel CC',
    programName: 'Human Services AAS',
    programLevel: 'associate',
    status: 'compliant',
    recommendation: '',
    decisionOutcome: 'accept',
    completedAt: '2026-09-15T12:00:00.000Z',
    hasAuthoredReport: false,
  },
];

describe('BoardReportList', () => {
  it('lists institution, program, level, completed date and recommendation for each report', () => {
    render(<BoardReportList reports={rows} onOpen={vi.fn()} onDownload={vi.fn()} />);
    const r1 = within(screen.getByTestId('board-report-row-s1'));
    expect(r1.getByText('Stevenson University')).toBeTruthy();
    expect(r1.getByText('Human Services')).toBeTruthy();
    expect(r1.getByText('Baccalaureate')).toBeTruthy();
    expect(r1.getByText('Oct 1, 2026')).toBeTruthy();
    expect(r1.getByText('Conditional accreditation')).toBeTruthy();
    expect(r1.getByText('Awaiting board decision')).toBeTruthy();
    const r2 = within(screen.getByTestId('board-report-row-s2'));
    expect(r2.getByText('Associate')).toBeTruthy();
    expect(r2.getByText('Not recorded')).toBeTruthy();
  });

  it('Open / Word / PDF call back with the right row + format', () => {
    const onOpen = vi.fn();
    const onDownload = vi.fn();
    render(<BoardReportList reports={rows} onOpen={onOpen} onDownload={onDownload} />);
    fireEvent.click(screen.getByTestId('board-open-s1'));
    expect(onOpen).toHaveBeenCalledWith(rows[0]);
    fireEvent.click(screen.getByTestId('board-docx-s2'));
    expect(onDownload).toHaveBeenCalledWith(rows[1], 'docx');
    fireEvent.click(screen.getByTestId('board-pdf-s1'));
    expect(onDownload).toHaveBeenCalledWith(rows[0], 'pdf');
  });

  it('NEGATIVE: renders no edit controls (no text inputs other than the filter, no save button)', () => {
    const { container } = render(<BoardReportList reports={rows} onOpen={vi.fn()} onDownload={vi.fn()} />);
    expect(container.querySelectorAll('textarea')).toHaveLength(0);
    const inputs = Array.from(container.querySelectorAll('input'));
    expect(inputs.map((i) => i.getAttribute('data-testid'))).toEqual(['board-reports-filter']);
    expect(screen.queryByText(/\bsave\b/i)).toBeNull();
    expect(screen.queryByText(/\bedit\b/i)).toBeNull();
  });

  it('filters by institution / program', () => {
    render(<BoardReportList reports={rows} onOpen={vi.fn()} onDownload={vi.fn()} />);
    fireEvent.change(screen.getByTestId('board-reports-filter'), { target: { value: 'arundel' } });
    expect(screen.queryByTestId('board-report-row-s1')).toBeNull();
    expect(screen.getByTestId('board-report-row-s2')).toBeTruthy();
  });

  it('shows an empty state when there are no completed reports', () => {
    render(<BoardReportList reports={[]} onOpen={vi.fn()} onDownload={vi.fn()} />);
    expect(screen.getByTestId('board-reports-empty').textContent).toContain('No completed Lead Reader Reports');
  });
});

describe('Board · CSHSE in the role switcher', () => {
  const noImp = { isImpersonating: false, originalUser: null, impersonatedRole: undefined, impersonatedUser: undefined };
  beforeEach(() => localStorage.clear());

  it('a reader who is a board member can switch to "Board · CSHSE"', () => {
    useAuthStore.setState({
      user: {
        id: 'b', email: 'b@example.com', firstName: 'Bea', lastName: 'Board', role: 'reader',
        institutionId: 'a', institutionName: 'Anne Arundel', isBoardMember: true,
        roleAssignments: [{ role: 'reader', institutionId: 'a', institutionName: 'Anne Arundel' }],
      },
      token: 't', isAuthenticated: true, isLoading: false, impersonation: noImp, activeContext: null, needsImpersonationSelection: false,
    });
    render(<MemoryRouter><RoleSwitcher /></MemoryRouter>);
    fireEvent.click(screen.getByTestId('role-switcher-button'));
    const opt = screen.getByTestId('role-switcher-option-1');
    expect(opt.textContent).toContain('Board');
    expect(opt.textContent).toContain('CSHSE');
    fireEvent.click(opt);
    expect(useAuthStore.getState().getEffectiveRole()).toBe('board');
    expect(useAuthStore.getState().activeContext).toEqual({ role: 'board', institutionId: 'cshse', institutionName: 'CSHSE' });
  });

  it('NEGATIVE: a non-board reader is not offered Board', () => {
    useAuthStore.setState({
      user: {
        id: 'r', email: 'r@example.com', firstName: 'Rae', lastName: 'Reader', role: 'reader',
        roleAssignments: [
          { role: 'reader', institutionId: 'a', institutionName: 'Anne Arundel' },
          { role: 'program_coordinator', institutionId: 'g', institutionName: 'Guttman' },
        ],
      },
      token: 't', isAuthenticated: true, isLoading: false, impersonation: noImp, activeContext: null, needsImpersonationSelection: false,
    });
    render(<MemoryRouter><RoleSwitcher /></MemoryRouter>);
    fireEvent.click(screen.getByTestId('role-switcher-button'));
    expect(screen.getByTestId('role-switcher-menu').textContent).not.toContain('CSHSE');
    // A forged active context is not honoured client-side either.
    useAuthStore.setState({ activeContext: { role: 'board', institutionId: 'cshse' } });
    expect(useAuthStore.getState().getEffectiveRole()).not.toBe('board');
  });
});
