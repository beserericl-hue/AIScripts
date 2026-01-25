import { User, Permission } from '../models/User';

/**
 * Superuser Initialization Service
 *
 * Creates a superuser account on system deployment using environment variables:
 * - SU_NAME: Full name of the superuser (e.g., "Eric Beser")
 * - SU_EMAIL: Email address for superuser login
 * - SU_PASSWORD: Password for superuser account
 *
 * The superuser:
 * - Has admin role with all permissions
 * - Has isSuperuser flag set to true
 * - Has visibility to everything in the system
 * - Can create test users or actual users
 * - Is created only once (checks for existing account)
 */

interface SuperuserConfig {
  name: string;
  email: string;
  password: string;
}

/**
 * Parse superuser configuration from environment variables
 */
function getSuperuserConfig(): SuperuserConfig | null {
  const name = process.env.SU_NAME;
  const email = process.env.SU_EMAIL;
  const password = process.env.SU_PASSWORD;

  // All three environment variables are required
  if (!name || !email || !password) {
    if (name || email || password) {
      console.warn(
        '[Superuser Init] Partial superuser config detected. All three variables required: SU_NAME, SU_EMAIL, SU_PASSWORD'
      );
    }
    return null;
  }

  return { name, email, password };
}

/**
 * Parse name into first and last name
 */
function parseName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: '' };
  }
  const firstName = parts[0];
  const lastName = parts.slice(1).join(' ');
  return { firstName, lastName };
}

/**
 * All permissions available in the system
 */
const ALL_PERMISSIONS: Permission[] = [
  'edit_self_study',
  'view_comments',
  'add_comments',
  'manage_users',
  'manage_institutions',
  'assign_readers',
  'schedule_site_visits',
  'approve_changes'
];

/**
 * Initialize the superuser account
 * This should be called during server startup after database connection
 */
export async function initializeSuperuser(): Promise<void> {
  const config = getSuperuserConfig();

  if (!config) {
    console.log('[Superuser Init] No superuser configuration found. Skipping initialization.');
    return;
  }

  try {
    // Check if superuser already exists
    const existingUser = await User.findOne({ email: config.email.toLowerCase() });

    if (existingUser) {
      // Update existing user to ensure superuser status
      if (!existingUser.isSuperuser) {
        existingUser.isSuperuser = true;
        existingUser.role = 'admin';
        existingUser.status = 'active';
        existingUser.permissions = ALL_PERMISSIONS;
        await existingUser.save();
        console.log(`[Superuser Init] Updated existing user "${config.email}" to superuser status.`);
      } else {
        console.log(`[Superuser Init] Superuser "${config.email}" already exists.`);
      }
      return;
    }

    // Create new superuser account
    const { firstName, lastName } = parseName(config.name);

    const superuser = new User({
      email: config.email.toLowerCase(),
      passwordHash: config.password, // Will be hashed by pre-save hook
      firstName,
      lastName,
      role: 'admin',
      status: 'active',
      permissions: ALL_PERMISSIONS,
      isSuperuser: true,
      isActive: true,
      accountCreatedAt: new Date()
    });

    await superuser.save();

    console.log('='.repeat(60));
    console.log('[Superuser Init] Superuser account created successfully!');
    console.log(`  Name:  ${config.name}`);
    console.log(`  Email: ${config.email}`);
    console.log(`  Role:  admin (superuser)`);
    console.log('='.repeat(60));

  } catch (error) {
    console.error('[Superuser Init] Failed to initialize superuser:', error);
    // Don't throw - let the server continue even if superuser creation fails
  }
}

/**
 * Check if a user is a superuser
 * Superusers have visibility to everything in the system
 */
export function isSuperuser(user: { isSuperuser?: boolean; role?: string }): boolean {
  return user.isSuperuser === true;
}

/**
 * Check if user has global access (superuser or admin)
 * Used for access control decisions
 */
export function hasGlobalAccess(user: { isSuperuser?: boolean; role?: string }): boolean {
  return user.isSuperuser === true || user.role === 'admin';
}

export default {
  initializeSuperuser,
  isSuperuser,
  hasGlobalAccess
};
