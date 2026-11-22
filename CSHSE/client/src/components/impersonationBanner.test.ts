import { describe, it, expect } from 'vitest';
import { impersonationBannerLabel } from './impersonationBanner';

const reader2 = { firstName: 'Reader', lastName: 'Two' };

describe('impersonation banner label', () => {
  it('POSITIVE: after switching to Reader · Stevenson the banner names that role and institution', () => {
    expect(impersonationBannerLabel({
      impersonatedUser: reader2, impersonatedRole: 'program_coordinator',
      activeContext: { role: 'reader', institutionName: 'Stevenson University' },
    })).toBe('Reader Two (Reader · Stevenson University)');
  });
  it('POSITIVE: switching back shows Program Coordinator · Kennesaw', () => {
    expect(impersonationBannerLabel({
      impersonatedUser: reader2, impersonatedRole: 'program_coordinator',
      activeContext: { role: 'program_coordinator', institutionName: 'Kennesaw State University' },
    })).toBe('Reader Two (Program Coordinator · Kennesaw State University)');
  });
  it('NEGATIVE: no active context → the impersonated role, no institution', () => {
    expect(impersonationBannerLabel({ impersonatedUser: reader2, impersonatedRole: 'lead_reader', activeContext: null }))
      .toBe('Reader Two (Lead Reader)');
  });
  it('NEGATIVE: role-only impersonation → just the role', () => {
    expect(impersonationBannerLabel({ impersonatedUser: null, impersonatedRole: 'program_coordinator' })).toBe('Program Coordinator');
  });
});
