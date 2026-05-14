import jwt from 'jsonwebtoken';
import { User } from '../../src/models/User';

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
