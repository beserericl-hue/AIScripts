import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import RoleSwitcher from './RoleSwitcher';
import { useAuthStore } from '../store/authStore';

const base = { id: 'nk', email: 'nk@example.com', firstName: 'Nicole', lastName: 'Kras', role: 'program_coordinator' as const, institutionId: 'g', institutionName: 'Guttman' };
const noImp = { isImpersonating: false, originalUser: null, impersonatedRole: undefined, impersonatedUser: undefined };
function setUser(roleAssignments: any[]) {
  useAuthStore.setState({ user: { ...base, roleAssignments }, token: 't', isAuthenticated: true, isLoading: false, impersonation: noImp, activeContext: null, needsImpersonationSelection: false });
}
const ui = () => render(<MemoryRouter><RoleSwitcher /></MemoryRouter>);

describe('RoleSwitcher', () => {
  beforeEach(() => localStorage.clear());

  it('renders nothing for a single-role user', () => {
    setUser([{ role: 'program_coordinator', institutionId: 'g', institutionName: 'Guttman' }]);
    const { container } = ui();
    expect(container.firstChild).toBeNull();
  });

  it('shows the current role and lets a board member switch to Reader at AACC', () => {
    setUser([{ role: 'reader', institutionId: 'a', institutionName: 'Anne Arundel' }, { role: 'program_coordinator', institutionId: 'g', institutionName: 'Guttman' }]);
    ui();
    expect(screen.getByTestId('role-switcher-button').textContent).toContain('Program Coordinator');
    expect(screen.getByTestId('role-switcher-button').textContent).toContain('Guttman');
    fireEvent.click(screen.getByTestId('role-switcher-button'));
    expect(screen.getByTestId('role-switcher-menu')).toBeTruthy();
    expect(screen.getByTestId('role-switcher-option-1').getAttribute('aria-checked')).toBe('true');
    fireEvent.click(screen.getByTestId('role-switcher-option-0'));
    expect(useAuthStore.getState().getEffectiveRole()).toBe('reader');
    expect(useAuthStore.getState().getEffectiveUser()?.institutionId).toBe('a');
    expect(screen.queryByTestId('role-switcher-menu')).toBeNull();
  });

  it('choosing the role already in use changes nothing', () => {
    setUser([{ role: 'reader', institutionId: 'a', institutionName: 'Anne Arundel' }, { role: 'program_coordinator', institutionId: 'g', institutionName: 'Guttman' }]);
    ui();
    fireEvent.click(screen.getByTestId('role-switcher-button'));
    fireEvent.click(screen.getByTestId('role-switcher-option-1'));
    expect(useAuthStore.getState().activeContext).toBeNull();
  });
});
