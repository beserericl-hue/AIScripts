import { describe, expect, it } from 'vitest';
import { User } from '../../src/models/User';
import { createUser } from '../helpers/factories';

describe('User model', () => {
  it('hashes a plaintext password on save', async () => {
    const { user } = await createUser({ password: 'plaintext-1234' });
    expect(user.passwordHash).toBeDefined();
    expect(user.passwordHash).not.toBe('plaintext-1234');
    expect(user.passwordHash!.startsWith('$2')).toBe(true);
  });

  it('does not double-hash an already-hashed password on re-save', async () => {
    const { user } = await createUser({ password: 'plaintext-1234' });
    const firstHash = user.passwordHash!;
    user.firstName = 'Renamed';
    await user.save();
    expect(user.passwordHash).toBe(firstHash);
  });

  it('comparePassword returns true for the correct password and false for a wrong one', async () => {
    const { user, password } = await createUser({ password: 'correct-horse-battery' });
    expect(await user.comparePassword(password)).toBe(true);
    expect(await user.comparePassword('wrong')).toBe(false);
  });

  it('lowercases email on save', async () => {
    const { user } = await createUser({ email: 'MiXeD@Example.COM' });
    expect(user.email).toBe('mixed@example.com');
  });

  it('omits passwordHash when serialized to JSON', async () => {
    const { user } = await createUser();
    const json = user.toJSON() as Record<string, unknown>;
    expect(json.passwordHash).toBeUndefined();
  });

  it('rejects an invalid email format', async () => {
    await expect(
      new User({
        email: 'not-an-email',
        firstName: 'A',
        lastName: 'B',
        role: 'reader',
      }).save()
    ).rejects.toThrow();
  });
});
