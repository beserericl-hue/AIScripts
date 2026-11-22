import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { ALL_INSTITUTIONS_LIMIT } from './institutionsQuery';

const ADMIN_SCREENS = [
  'features/admin/Settings/UserManagement.tsx',
  'features/admin/Settings/DataManagement.tsx',
  'features/admin/Settings/InstitutionManagement.tsx',
  'features/admin/JointVentureManagement/JointVentureManagement.tsx',
];

describe('admin screens load ALL institutions (not the server default page of 50)', () => {
  it('limit is far above the server default of 50', () => {
    expect(ALL_INSTITUTIONS_LIMIT).toBeGreaterThan(1000);
  });
  for (const f of ADMIN_SCREENS) {
    const src = readFileSync(resolve(__dirname, '..', f), 'utf8');
    it(`POSITIVE: ${f} requests limit=ALL_INSTITUTIONS_LIMIT`, () => {
      expect(src).toMatch(/api\.get\('\/api\/institutions', \{ params: \{ limit: ALL_INSTITUTIONS_LIMIT \} \}\)/);
      expect(src).toMatch(/import \{ ALL_INSTITUTIONS_LIMIT \} from '/);
    });
    it(`NEGATIVE: ${f} has no bare unpaged GET of /api/institutions`, () => {
      expect(src).not.toMatch(/api\.get\('\/api\/institutions'\)/);
    });
  }
});
