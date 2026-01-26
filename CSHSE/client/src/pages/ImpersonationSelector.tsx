import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { api } from '../services/api';

interface UserOption {
  _id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'admin' | 'program_coordinator' | 'lead_reader' | 'reader';
  institutionId?: string;
  institutionName?: string;
}

const roles = [
  {
    id: 'admin',
    name: 'Administrator',
    description: 'Full system access including user and institution management',
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    id: 'lead_reader',
    name: 'Lead Reader',
    description: 'Compile reader assessments, resolve disagreements, approve changes',
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
  },
  {
    id: 'reader',
    name: 'Reader',
    description: 'Review and assess self-study submissions',
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
      </svg>
    ),
  },
  {
    id: 'program_coordinator',
    name: 'Program Coordinator',
    description: 'Edit and submit self-study documents for their institution',
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
];

export default function ImpersonationSelector() {
  const navigate = useNavigate();
  const { user, startImpersonation, skipImpersonation } = useAuthStore();
  const [mode, setMode] = useState<'select' | 'role' | 'user'>('select');
  const [selectedRole, setSelectedRole] = useState<string>('');
  const [users, setUsers] = useState<UserOption[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<UserOption[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Fetch users when entering user mode
  useEffect(() => {
    if (mode === 'user') {
      fetchUsers();
    }
  }, [mode]);

  // Filter users when search term changes
  useEffect(() => {
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      setFilteredUsers(
        users.filter(
          (u) =>
            u.firstName.toLowerCase().includes(term) ||
            u.lastName.toLowerCase().includes(term) ||
            u.email.toLowerCase().includes(term) ||
            u.institutionName?.toLowerCase().includes(term)
        )
      );
    } else {
      setFilteredUsers(users);
    }
  }, [searchTerm, users]);

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      const response = await api.get('/api/users', { params: { limit: 200 } });
      // Filter out the superuser from the list
      const userList = (response.data.users || []).filter(
        (u: any) => !u.isSuperuser && u._id !== user?.id
      );
      setUsers(userList);
      setFilteredUsers(userList);
    } catch (error) {
      console.error('Failed to fetch users:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRoleSelect = (roleId: string) => {
    startImpersonation(roleId, null);
    navigate('/dashboard');
  };

  const handleUserSelect = (selectedUser: UserOption) => {
    // Convert to User format expected by startImpersonation
    const userObj = {
      id: selectedUser._id,
      email: selectedUser.email,
      firstName: selectedUser.firstName,
      lastName: selectedUser.lastName,
      role: selectedUser.role,
      institutionId: selectedUser.institutionId,
      institutionName: selectedUser.institutionName,
    };
    startImpersonation(selectedUser.role, userObj);
    navigate('/dashboard');
  };

  const handleContinueAsSuperuser = () => {
    skipImpersonation();
    navigate('/dashboard');
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'admin':
        return 'bg-purple-100 text-purple-700';
      case 'lead_reader':
        return 'bg-blue-100 text-blue-700';
      case 'reader':
        return 'bg-green-100 text-green-700';
      case 'program_coordinator':
        return 'bg-orange-100 text-orange-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-12">
      <div className="max-w-2xl w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <img
            src="/cshse-logo.svg"
            alt="CSHSE"
            className="mx-auto h-20 w-20"
          />
          <h1 className="mt-4 text-2xl font-bold text-gray-900">
            Welcome, {user?.firstName}
          </h1>
          <p className="mt-2 text-sm text-gray-500">
            As a Superuser, you can view the system from different perspectives
          </p>
        </div>

        {/* Selection Mode */}
        {mode === 'select' && (
          <div className="card p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-6">
              How would you like to proceed?
            </h2>

            <div className="space-y-4">
              {/* Continue as Superuser */}
              <button
                onClick={handleContinueAsSuperuser}
                className="w-full p-4 border-2 border-primary rounded-lg hover:bg-primary-50 transition-colors text-left flex items-center space-x-4"
              >
                <div className="flex-shrink-0 w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center text-primary">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                  </svg>
                </div>
                <div>
                  <div className="font-semibold text-gray-900">Continue as Superuser</div>
                  <div className="text-sm text-gray-500">
                    Full system access with webhook and API key management
                  </div>
                </div>
              </button>

              {/* Impersonate a Role */}
              <button
                onClick={() => setMode('role')}
                className="w-full p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-left flex items-center space-x-4"
              >
                <div className="flex-shrink-0 w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center text-gray-600">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <div>
                  <div className="font-semibold text-gray-900">Impersonate a Role</div>
                  <div className="text-sm text-gray-500">
                    View the system as Admin, Lead Reader, Reader, or Program Coordinator
                  </div>
                </div>
              </button>

              {/* Impersonate a User */}
              <button
                onClick={() => setMode('user')}
                className="w-full p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-left flex items-center space-x-4"
              >
                <div className="flex-shrink-0 w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center text-gray-600">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <div>
                  <div className="font-semibold text-gray-900">Impersonate a Specific User</div>
                  <div className="text-sm text-gray-500">
                    View the system as a specific user with their role and institution
                  </div>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* Role Selection */}
        {mode === 'role' && (
          <div className="card p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-gray-900">
                Select a Role to Impersonate
              </h2>
              <button
                onClick={() => setMode('select')}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                &larr; Back
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {roles.map((role) => (
                <button
                  key={role.id}
                  onClick={() => handleRoleSelect(role.id)}
                  className="p-4 border border-gray-200 rounded-lg hover:border-primary hover:bg-primary-50 transition-colors text-left"
                >
                  <div className="text-primary mb-2">{role.icon}</div>
                  <div className="font-semibold text-gray-900">{role.name}</div>
                  <div className="text-xs text-gray-500 mt-1">{role.description}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* User Selection */}
        {mode === 'user' && (
          <div className="card p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-gray-900">
                Select a User to Impersonate
              </h2>
              <button
                onClick={() => setMode('select')}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                &larr; Back
              </button>
            </div>

            {/* Search */}
            <div className="relative mb-4">
              <svg
                className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              <input
                type="text"
                placeholder="Search by name, email, or institution..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="form-input pl-10"
              />
            </div>

            {/* User List */}
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="spinner w-8 h-8"></div>
              </div>
            ) : (
              <div className="max-h-96 overflow-y-auto divide-y divide-gray-100">
                {filteredUsers.length === 0 ? (
                  <div className="py-8 text-center text-gray-500">
                    No users found
                  </div>
                ) : (
                  filteredUsers.map((u) => (
                    <button
                      key={u._id}
                      onClick={() => handleUserSelect(u)}
                      className="w-full p-3 hover:bg-gray-50 transition-colors text-left flex items-center justify-between"
                    >
                      <div>
                        <div className="font-medium text-gray-900">
                          {u.firstName} {u.lastName}
                        </div>
                        <div className="text-sm text-gray-500">{u.email}</div>
                        {u.institutionName && (
                          <div className="text-xs text-gray-400 mt-1">
                            {u.institutionName}
                          </div>
                        )}
                      </div>
                      <span
                        className={`text-xs px-2 py-1 rounded-full ${getRoleBadgeColor(
                          u.role
                        )}`}
                      >
                        {u.role.replace('_', ' ')}
                      </span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
