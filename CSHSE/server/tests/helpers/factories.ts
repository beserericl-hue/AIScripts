import jwt from 'jsonwebtoken';
import { User } from '../../src/models/User';
import { Assignment } from '../../src/models/Assignment';

type Role = 'admin' | 'program_coordinator' | 'lead_reader' | 'reader';

interface UserOverrides {
  email?: string;
  password?: string;
  firstName?: string;
  lastName?: string;
  role?: Role;
  isSuperuser?: boolean;
  status?: 'active' | 'pending' | 'disabled';
  isActive?: boolean;
  institutionId?: string | null;
}

let counter = 0;

export async function createUser(overrides: UserOverrides = {}) {
  counter += 1;
  const password = overrides.password ?? 'test-password-1234';

  const user = new User({
    email: overrides.email ?? `test-user-${counter}@example.com`,
    firstName: overrides.firstName ?? 'Test',
    lastName: overrides.lastName ?? `User${counter}`,
    role: overrides.role ?? 'program_coordinator',
    isSuperuser: overrides.isSuperuser ?? false,
    status: overrides.status ?? 'active',
    isActive: overrides.isActive ?? true,
    institutionId: overrides.institutionId ?? null,
    passwordHash: password, // pre('save') hook hashes this
  });
  await user.save();
  return { user, password };
}

/**
 * Give a reader / lead_reader an ACTIVE Assignment to a submission — the thing
 * the cross-tenant guard (submissionAccessGuard) requires for reviewer access.
 * Real submissions get these when a lead assigns readers; the integration
 * fixtures must create them too, or the guard correctly returns 403.
 */
export async function assignToSubmission(
  submission: { _id: any },
  user: { _id: any; firstName?: string; lastName?: string; email?: string },
  assignmentType: 'reader' | 'lead_reader' = 'reader'
) {
  return Assignment.create({
    submissionId: submission._id,
    userId: user._id,
    userName: `${user.firstName ?? 'Test'} ${user.lastName ?? 'Reader'}`,
    userEmail: user.email ?? 'reader@example.com',
    assignmentType,
    assignedBy: user._id,
    assignedByName: 'Test Lead',
    assignedByRole: 'lead_reader',
    status: 'active',
  } as any);
}

export function signTokenFor(
  user: { _id: any; email: string; firstName: string; lastName: string; role: string; institutionId?: any },
  opts: { expiresIn?: string } = {}
) {
  const secret = process.env.JWT_SECRET || 'test-secret';
  return jwt.sign(
    {
      id: user._id,
      email: user.email,
      name: `${user.firstName} ${user.lastName}`,
      role: user.role,
      institutionId: user.institutionId?.toString() ?? null,
    },
    secret,
    { expiresIn: opts.expiresIn ?? '1h' }
  );
}
