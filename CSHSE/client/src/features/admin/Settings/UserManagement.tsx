import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../services/api';
import { useToastStore } from '../../../store/toastStore';
import { useAuthStore } from '../../../store/authStore';
import {
  Users,
  UserPlus,
  Mail,
  Trash2,
  Edit2,
  MoreVertical,
  Search,
  Filter,
  CheckCircle,
  Clock,
  XCircle,
  Loader2,
  Send,
  Building2,
  ShieldCheck
} from 'lucide-react';

interface RoleAssignment {
  role: 'program_coordinator' | 'reader' | 'lead_reader';
  institutionId: string;
  institutionName?: string;
}

interface User {
  _id: string;
  email: string;
  firstName: string;
  lastName: string;
  name: string;
  role: string;
  status: string;
  institutionId?: string;
  institutionName?: string;
  isSuperuser?: boolean;
  // How the account signs in: 'both' (MemberClick or the password UI) or
  // 'memberclick-only' (MemberClick SSO only — no password).
  loginMethod?: 'both' | 'memberclick-only';
  // CR-060 — per-institution roles (PC at A, Reader/Lead at B). May be absent on
  // legacy records that predate the migration.
  roleAssignments?: RoleAssignment[];
  lastLogin?: string;
  createdAt: string;
}

interface Invitation {
  _id: string;
  email: string;
  name: string;
  role: string;
  institutionName?: string;
  status: string;
  expiresAt: string;
  createdAt: string;
}

const roleLabels: Record<string, string> = {
  admin: 'Administrator',
  lead_reader: 'Lead Reader',
  reader: 'Reader',
  program_coordinator: 'Program Coordinator'
};

const roleColors: Record<string, string> = {
  admin: 'bg-purple-100 text-purple-800',
  lead_reader: 'bg-blue-100 text-blue-800',
  reader: 'bg-green-100 text-green-800',
  program_coordinator: 'bg-teal-100 text-teal-800'
};

const statusIcons: Record<string, React.ReactNode> = {
  active: <CheckCircle className="w-4 h-4 text-green-600" />,
  pending: <Clock className="w-4 h-4 text-amber-600" />,
  disabled: <XCircle className="w-4 h-4 text-red-600" />
};

export function UserManagement() {
  const queryClient = useQueryClient();
  const pushToast = useToastStore((s) => s.push);
  const [activeTab, setActiveTab] = useState<'users' | 'invitations' | 'readers'>('users');
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteForm, setInviteForm] = useState({
    email: '',
    name: '',
    role: 'reader',
    institutionId: '',
    // When true, add the user immediately as ACTIVE with NO invitation email —
    // they sign in via MemberClick SSO. Registers the email + trusts the domain.
    noEmail: false
  });
  // CR-060 — manage-roles modal state.
  const [roleUser, setRoleUser] = useState<User | null>(null);
  const [roleDraft, setRoleDraft] = useState<RoleAssignment[]>([]);
  const [roleError, setRoleError] = useState<string | null>(null);

  // Fetch users
  const { data: usersData, isLoading: usersLoading } = useQuery({
    queryKey: ['users', roleFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (roleFilter) params.append('role', roleFilter);
      const response = await api.get(`/api/users?${params}`);
      return response.data;
    }
  });

  // Fetch invitations
  const { data: invitationsData, isLoading: invitationsLoading } = useQuery({
    queryKey: ['invitations'],
    queryFn: async () => {
      const response = await api.get('/api/users/invitations');
      return response.data;
    }
  });

  // Fetch readers committee
  const { data: readersData, isLoading: readersLoading } = useQuery({
    queryKey: ['readers-committee'],
    queryFn: async () => {
      const response = await api.get('/api/users/readers-committee');
      return response.data;
    }
  });

  // Fetch institutions for dropdown
  const { data: institutionsData } = useQuery({
    queryKey: ['institutions'],
    queryFn: async () => {
      const response = await api.get('/api/institutions');
      return response.data;
    }
  });

  // ── Superuser management (visible only to a real, non-impersonating superuser) ──
  const canManageSuperusers = useAuthStore(
    (s) => s.user?.isSuperuser === true && !s.impersonation.isImpersonating
  );
  const currentUserId = useAuthStore((s) => s.user?.id);
  const [suPick, setSuPick] = useState('');

  // Current superusers (independent of the role filter / pagination above).
  const { data: superusersData } = useQuery({
    queryKey: ['superusers'],
    enabled: canManageSuperusers,
    queryFn: async () => {
      const response = await api.get('/api/users/superusers');
      return response.data;
    }
  });

  // Every user (unfiltered) so the "Add superuser" picker can offer non-superusers.
  const { data: allUsersData } = useQuery({
    queryKey: ['users-all-for-su'],
    enabled: canManageSuperusers,
    queryFn: async () => {
      const response = await api.get('/api/users?limit=500');
      return response.data;
    }
  });

  const invalidateSuperuserViews = () => {
    queryClient.invalidateQueries({ queryKey: ['superusers'] });
    queryClient.invalidateQueries({ queryKey: ['users-all-for-su'] });
    queryClient.invalidateQueries({ queryKey: ['users'] });
  };

  const grantSuperuserMutation = useMutation({
    mutationFn: async (userId: string) => {
      const response = await api.post(`/api/users/${userId}/superuser`);
      return response.data;
    },
    onSuccess: (data) => {
      invalidateSuperuserViews();
      setSuPick('');
      pushToast(data?.message || 'Superuser granted', 'success');
    },
    onError: (err: any) => {
      pushToast(err?.response?.data?.error || 'Failed to grant superuser', 'error');
    }
  });

  const revokeSuperuserMutation = useMutation({
    mutationFn: async (userId: string) => {
      const response = await api.delete(`/api/users/${userId}/superuser`);
      return response.data;
    },
    onSuccess: (data) => {
      invalidateSuperuserViews();
      pushToast(data?.message || 'Superuser removed', 'success');
    },
    onError: (err: any) => {
      pushToast(err?.response?.data?.error || 'Failed to remove superuser', 'error');
    }
  });

  // Create invitation mutation
  const inviteMutation = useMutation({
    mutationFn: async (data: typeof inviteForm) => {
      if (data.noEmail) {
        // Direct active-user creation — no email, no verification. Split the
        // single name field into first/last for the server.
        const parts = (data.name || '').trim().split(/\s+/);
        const firstName = parts.shift() || '';
        const lastName = parts.join(' ');
        const response = await api.post('/api/users/create-active', {
          email: data.email,
          firstName,
          lastName,
          role: data.role,
          institutionId: data.institutionId || undefined
        });
        return response.data;
      }
      const response = await api.post('/api/users/invite', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invitations'] });
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setShowInviteModal(false);
      setInviteForm({ email: '', name: '', role: 'reader', institutionId: '', noEmail: false });
    }
  });

  // Resend invitation mutation. The server returns { invitation: { email, emailSent } };
  // surface the outcome via the global toast so the click has visible feedback
  // (otherwise a successful resend silently refetches an identical-looking list).
  const resendMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await api.post(`/api/users/invitations/${id}/resend`);
      return response.data;
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['invitations'] });
      const email = data?.invitation?.email;
      if (data?.invitation?.emailSent === false) {
        pushToast(
          `Invitation updated, but the email could not be sent${email ? ` to ${email}` : ''}. Check email settings.`,
          'error'
        );
      } else {
        pushToast(`Invitation resent${email ? ` to ${email}` : ''}.`, 'success');
      }
    },
    onError: (err: any) => {
      pushToast(err?.response?.data?.error || 'Failed to resend invitation.', 'error');
    }
  });

  // Disable user mutation
  const disableMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/api/users/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    }
  });

  const users: User[] = usersData?.users || [];
  const invitations: Invitation[] = invitationsData?.invitations || [];
  const institutions = institutionsData?.institutions || [];

  // CR-060 — save a user's role assignments.
  const roleMutation = useMutation({
    mutationFn: async ({ userId, roleAssignments }: { userId: string; roleAssignments: RoleAssignment[] }) => {
      const response = await api.put(`/api/users/${userId}/role-assignments`, { roleAssignments });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['institutions'] });
      setRoleUser(null);
      setRoleDraft([]);
      setRoleError(null);
    },
    onError: (err: any) => {
      setRoleError(err?.response?.data?.error || 'Failed to save roles');
    }
  });

  // Open the manage-roles modal seeded with the user's current assignments
  // (falling back to the legacy single role/institution for un-migrated users).
  const openRoleModal = (user: User) => {
    setRoleError(null);
    const seed: RoleAssignment[] =
      user.roleAssignments && user.roleAssignments.length > 0
        ? user.roleAssignments.map((a) => ({ ...a }))
        : (user.institutionId && user.role !== 'admin'
            ? [{ role: user.role as RoleAssignment['role'], institutionId: user.institutionId, institutionName: user.institutionName }]
            : []);
    setRoleUser(user);
    setRoleDraft(seed);
  };

  // Client-side mirror of the server's Rule 1 (no PC + reviewer in one
  // institution) so the admin gets instant feedback before saving.
  const roleConflict = (): string | null => {
    const byInst = new Map<string, Set<string>>();
    for (const a of roleDraft) {
      if (!a.institutionId) return 'Pick an institution for every role row.';
      if (!byInst.has(a.institutionId)) byInst.set(a.institutionId, new Set());
      byInst.get(a.institutionId)!.add(a.role);
    }
    for (const [, roles] of byInst) {
      const pc = roles.has('program_coordinator');
      const reviewer = roles.has('reader') || roles.has('lead_reader');
      if (pc && reviewer) {
        return 'A user cannot be Program Coordinator and Reader/Lead Reader at the same institution.';
      }
    }
    return null;
  };

  const filteredUsers = users.filter(
    user =>
      user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const handleInvite = () => {
    inviteMutation.mutate(inviteForm);
  };

  return (
    <div className="space-y-6">
      {/* Superusers — visible only to a real, non-impersonating superuser. */}
      {canManageSuperusers && (() => {
        const superusers: Array<{ id: string; email: string; name: string; role: string; isBootstrap: boolean }> =
          superusersData?.superusers || [];
        const allUsers: User[] = allUsersData?.users || [];
        const candidates = allUsers
          .filter((u) => !u.isSuperuser)
          .sort((a, b) => (a.name || a.email).localeCompare(b.name || b.email));
        return (
          <div className="bg-white rounded-lg shadow-sm border border-purple-200">
            <div className="flex items-center gap-3 p-6 border-b border-gray-200">
              <ShieldCheck className="w-6 h-6 text-purple-600" />
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Superusers</h2>
                <p className="text-sm text-gray-500">
                  Full system access and the ability to impersonate any user. Only superusers can see or change this. Grant sparingly.
                </p>
              </div>
            </div>

            <div className="divide-y divide-gray-100">
              {superusers.map((su) => {
                const isSelf = String(su.id) === String(currentUserId);
                const locked = isSelf || su.isBootstrap;
                return (
                  <div key={su.id} className="flex items-center justify-between px-6 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-purple-100 flex items-center justify-center text-purple-700 font-medium">
                        {(su.name || su.email).charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900">{su.name || su.email}</span>
                          {isSelf && (
                            <span className="text-[11px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">You</span>
                          )}
                          {su.isBootstrap && (
                            <span className="text-[11px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">Built-in</span>
                          )}
                        </div>
                        <div className="text-sm text-gray-500">{su.email}</div>
                      </div>
                    </div>
                    <button
                      onClick={() => revokeSuperuserMutation.mutate(su.id)}
                      disabled={locked || revokeSuperuserMutation.isPending}
                      title={
                        isSelf
                          ? 'You cannot remove your own superuser access'
                          : su.isBootstrap
                          ? 'Built-in superuser (set via server config) — cannot be removed here'
                          : 'Remove superuser'
                      }
                      className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-md border border-gray-200 text-gray-600 hover:bg-red-50 hover:text-red-700 hover:border-red-200 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-gray-600 disabled:hover:border-gray-200"
                    >
                      <Trash2 className="w-4 h-4" />
                      Remove
                    </button>
                  </div>
                );
              })}

              {/* Add a superuser */}
              <div className="flex items-center gap-3 px-6 py-4 bg-gray-50">
                <select
                  value={suPick}
                  onChange={(e) => setSuPick(e.target.value)}
                  className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="">Select a user to make a superuser…</option>
                  {candidates.map((u) => (
                    <option key={u._id} value={u._id}>
                      {(u.name || `${u.firstName} ${u.lastName}`).trim()} — {u.email}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => suPick && grantSuperuserMutation.mutate(suPick)}
                  disabled={!suPick || grantSuperuserMutation.isPending}
                  className="flex items-center gap-1.5 text-sm px-4 py-2 rounded-md bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ShieldCheck className="w-4 h-4" />
                  Make superuser
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <Users className="w-6 h-6 text-gray-600" />
            <div>
              <h2 className="text-lg font-semibold text-gray-900">User Management</h2>
              <p className="text-sm text-gray-500">
                Manage users, assign roles, and send invitations
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowInviteModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
          >
            <UserPlus className="w-4 h-4" />
            Invite User
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setActiveTab('users')}
            className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'users'
                ? 'border-teal-600 text-teal-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            All Users ({users.length})
          </button>
          <button
            onClick={() => setActiveTab('invitations')}
            className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'invitations'
                ? 'border-teal-600 text-teal-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Pending Invitations ({invitations.filter(i => i.status === 'pending').length})
          </button>
          <button
            onClick={() => setActiveTab('readers')}
            className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'readers'
                ? 'border-teal-600 text-teal-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Readers Committee
          </button>
        </div>

        {/* Filters */}
        {activeTab === 'users' && (
          <div className="p-4 bg-gray-50 border-b border-gray-200 flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search users..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              <option value="">All Roles</option>
              <option value="admin">Administrators</option>
              <option value="lead_reader">Lead Readers</option>
              <option value="reader">Readers</option>
              <option value="program_coordinator">Program Coordinators</option>
            </select>
          </div>
        )}

        {/* Content */}
        <div className="divide-y divide-gray-100">
          {activeTab === 'users' && (
            usersLoading ? (
              <div className="p-8 text-center">
                <Loader2 className="w-8 h-8 animate-spin text-gray-400 mx-auto" />
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <Users className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                <p>No users found</p>
              </div>
            ) : (
              filteredUsers.map((user) => (
                <div key={user._id} className="p-4 hover:bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 font-medium">
                        {user.firstName[0]}{user.lastName[0]}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-gray-900">{user.name}</p>
                          {statusIcons[user.status]}
                        </div>
                        <p className="text-sm text-gray-500">{user.email}</p>
                        {/* How this account signs in. */}
                        {user.loginMethod === 'memberclick-only' ? (
                          <span
                            className="mt-1 inline-block rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700"
                            title="Signs in through MemberClick only (no password)"
                          >
                            MemberClick only
                          </span>
                        ) : (
                          <span
                            className="mt-1 inline-block rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-[11px] text-gray-500"
                            title="Can sign in through MemberClick or the CSHSE password login"
                          >
                            MemberClick or password
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {/* CR-060 — show every per-institution role; admins are global. */}
                      <div className="flex max-w-md flex-wrap items-center justify-end gap-1.5">
                        {user.role === 'admin' || user.isSuperuser ? (
                          <span className={`px-2 py-1 text-xs rounded-full ${roleColors['admin']}`}>{roleLabels['admin']}</span>
                        ) : user.roleAssignments && user.roleAssignments.length > 0 ? (
                          user.roleAssignments.map((a, i) => (
                            <span
                              key={i}
                              className={`px-2 py-0.5 text-xs rounded-full ${roleColors[a.role]}`}
                              title={`${roleLabels[a.role]} at ${a.institutionName || a.institutionId}`}
                            >
                              {roleLabels[a.role]} · {a.institutionName || '—'}
                            </span>
                          ))
                        ) : (
                          <span className={`px-2 py-1 text-xs rounded-full ${roleColors[user.role]}`}>
                            {roleLabels[user.role]}{user.institutionName ? ` · ${user.institutionName}` : ''}
                          </span>
                        )}
                      </div>
                      <span className="whitespace-nowrap text-sm text-gray-400">
                        Last login: {formatDate(user.lastLogin)}
                      </span>
                      {!(user.role === 'admin' || user.isSuperuser) && (
                        <button
                          onClick={() => openRoleModal(user)}
                          className="rounded p-2 text-gray-400 hover:bg-teal-50 hover:text-teal-600"
                          title="Manage roles"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => disableMutation.mutate(user._id)}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                        title="Disable user"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )
          )}

          {activeTab === 'invitations' && (
            invitationsLoading ? (
              <div className="p-8 text-center">
                <Loader2 className="w-8 h-8 animate-spin text-gray-400 mx-auto" />
              </div>
            ) : invitations.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <Mail className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                <p>No pending invitations</p>
              </div>
            ) : (
              invitations.map((invitation) => (
                <div key={invitation._id} className="p-4 hover:bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-gray-900">{invitation.name}</p>
                        <span className={`px-2 py-0.5 text-xs rounded-full ${
                          invitation.status === 'pending'
                            ? 'bg-amber-100 text-amber-700'
                            : invitation.status === 'accepted'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-red-100 text-red-700'
                        }`}>
                          {invitation.status}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500">{invitation.email}</p>
                      {invitation.institutionName && (
                        <p className="text-sm text-gray-400 flex items-center gap-1 mt-1">
                          <Building2 className="w-3 h-3" />
                          {invitation.institutionName}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-4">
                      <span className={`px-2 py-1 text-xs rounded-full ${roleColors[invitation.role]}`}>
                        {roleLabels[invitation.role]}
                      </span>
                      <span className="text-sm text-gray-400">
                        Expires: {formatDate(invitation.expiresAt)}
                      </span>
                      {invitation.status === 'pending' && (
                        <button
                          onClick={() => resendMutation.mutate(invitation._id)}
                          disabled={resendMutation.isPending}
                          className="flex items-center gap-1 px-3 py-1 text-sm text-teal-600 hover:bg-teal-50 rounded"
                        >
                          <Send className="w-3 h-3" />
                          Resend
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )
          )}

          {activeTab === 'readers' && (
            readersLoading ? (
              <div className="p-8 text-center">
                <Loader2 className="w-8 h-8 animate-spin text-gray-400 mx-auto" />
              </div>
            ) : (
              <div className="p-6">
                {/* Lead Readers */}
                <h3 className="text-sm font-semibold text-gray-700 mb-3">
                  Lead Readers ({readersData?.totals?.leadReaders || 0})
                </h3>
                <div className="space-y-2 mb-6">
                  {readersData?.leadReaders?.map((reader: any) => (
                    <div key={reader._id} className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-200 flex items-center justify-center text-blue-700 text-sm font-medium">
                          {reader.firstName[0]}{reader.lastName[0]}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{reader.name}</p>
                          <p className="text-xs text-gray-500">{reader.email}</p>
                        </div>
                      </div>
                      <span className="text-sm text-gray-500">
                        {reader.assignmentCount} assignments
                      </span>
                    </div>
                  ))}
                </div>

                {/* Readers */}
                <h3 className="text-sm font-semibold text-gray-700 mb-3">
                  Readers ({readersData?.totals?.readers || 0})
                </h3>
                <div className="space-y-2">
                  {readersData?.readers?.map((reader: any) => (
                    <div key={reader._id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 text-sm font-medium">
                          {reader.firstName[0]}{reader.lastName[0]}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{reader.name}</p>
                          <p className="text-xs text-gray-500">{reader.email}</p>
                        </div>
                      </div>
                      <span className="text-sm text-gray-500">
                        {reader.assignmentCount} assignments
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )
          )}
        </div>
      </div>

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Invite New User</h3>
              <p className="text-sm text-gray-500 mt-1">
                Send an invitation email to create an account
              </p>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  value={inviteForm.name}
                  onChange={(e) => setInviteForm({ ...inviteForm, name: e.target.value })}
                  placeholder="John Doe"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email Address *
                </label>
                <input
                  type="email"
                  value={inviteForm.email}
                  onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                  placeholder="john@university.edu"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Role *
                </label>
                <select
                  value={inviteForm.role}
                  onChange={(e) => setInviteForm({ ...inviteForm, role: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                >
                  <option value="reader">Reader</option>
                  <option value="lead_reader">Lead Reader</option>
                  <option value="program_coordinator">Program Coordinator</option>
                  <option value="admin">Administrator</option>
                </select>
              </div>

              {inviteForm.role === 'program_coordinator' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Institution
                  </label>
                  <select
                    value={inviteForm.institutionId}
                    onChange={(e) => setInviteForm({ ...inviteForm, institutionId: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                  >
                    <option value="">Select institution...</option>
                    {institutions.map((inst: any) => (
                      <option key={inst._id} value={inst._id}>{inst.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Add immediately, no email — for members who sign in via
                  MemberClick SSO. Registers the email + trusts the domain so
                  their sign-in works right away, no verification step. */}
              <label className="flex items-start gap-2 rounded-lg border border-gray-200 bg-gray-50 p-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={inviteForm.noEmail}
                  onChange={(e) => setInviteForm({ ...inviteForm, noEmail: e.target.checked })}
                  className="mt-0.5 rounded text-teal-600 focus:ring-teal-500"
                />
                <span className="text-sm text-gray-700">
                  <span className="font-medium">Add now without an email</span>
                  <span className="block text-xs text-gray-500">
                    Creates the account immediately (no invitation email / verification).
                    Use for members who sign in through MemberClick.
                  </span>
                </span>
              </label>
            </div>

            <div className="flex justify-end gap-3 p-4 border-t border-gray-200 bg-gray-50">
              <button
                onClick={() => setShowInviteModal(false)}
                className="px-4 py-2 text-sm text-gray-700 hover:text-gray-900"
              >
                Cancel
              </button>
              <button
                onClick={handleInvite}
                disabled={!inviteForm.name || !inviteForm.email || inviteMutation.isPending}
                className="flex items-center gap-2 px-4 py-2 text-sm bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50"
              >
                {inviteMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Mail className="w-4 h-4" />
                )}
                {inviteForm.noEmail ? 'Add user' : 'Send Invitation'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CR-060 — Manage Roles modal: assign per-institution roles to a user. */}
      {roleUser && (() => {
        const conflict = roleConflict();
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-2xl rounded-lg bg-white shadow-xl">
              <div className="flex items-center justify-between border-b border-gray-200 p-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Manage roles — {roleUser.name}</h3>
                  <p className="text-sm text-gray-500">{roleUser.email}</p>
                </div>
                <button onClick={() => { setRoleUser(null); setRoleError(null); }} className="rounded p-1 text-gray-400 hover:bg-gray-100">
                  <XCircle className="h-5 w-5" />
                </button>
              </div>

              <div className="max-h-[60vh] space-y-3 overflow-y-auto p-4">
                <p className="text-sm text-gray-600">
                  A user can hold different roles at different institutions (e.g. Program Coordinator at one,
                  Reader/Lead Reader at another). They cannot be a Program Coordinator and a reviewer at the
                  <em> same</em> institution.
                </p>

                {roleDraft.length === 0 && (
                  <p className="rounded border border-dashed border-gray-300 p-4 text-center text-sm text-gray-400">
                    No roles assigned. Add one below.
                  </p>
                )}

                {roleDraft.map((a, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <select
                      value={a.role}
                      onChange={(e) => setRoleDraft((d) => d.map((x, i) => i === idx ? { ...x, role: e.target.value as RoleAssignment['role'] } : x))}
                      className="rounded border border-gray-300 px-2 py-1.5 text-sm"
                    >
                      <option value="program_coordinator">Program Coordinator</option>
                      <option value="reader">Reader</option>
                      <option value="lead_reader">Lead Reader</option>
                    </select>
                    <span className="text-sm text-gray-400">at</span>
                    <select
                      value={a.institutionId}
                      onChange={(e) => {
                        const inst = institutions.find((i: any) => i._id === e.target.value);
                        setRoleDraft((d) => d.map((x, i) => i === idx ? { ...x, institutionId: e.target.value, institutionName: inst?.name } : x));
                      }}
                      className="flex-1 rounded border border-gray-300 px-2 py-1.5 text-sm"
                    >
                      <option value="">— select institution —</option>
                      {institutions.map((inst: any) => (
                        <option key={inst._id} value={inst._id}>{inst.name}</option>
                      ))}
                    </select>
                    <button
                      onClick={() => setRoleDraft((d) => d.filter((_, i) => i !== idx))}
                      className="rounded p-2 text-gray-400 hover:bg-red-50 hover:text-red-600"
                      title="Remove role"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}

                <button
                  onClick={() => setRoleDraft((d) => [...d, { role: 'reader', institutionId: '', institutionName: undefined }])}
                  className="flex items-center gap-1 rounded border border-teal-300 px-3 py-1.5 text-sm font-medium text-teal-700 hover:bg-teal-50"
                >
                  <UserPlus className="h-4 w-4" /> Add role
                </button>

                {(conflict || roleError) && (
                  <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{conflict || roleError}</p>
                )}
              </div>

              <div className="flex justify-end gap-3 border-t border-gray-200 bg-gray-50 p-4">
                <button onClick={() => { setRoleUser(null); setRoleError(null); }} className="px-4 py-2 text-sm text-gray-700 hover:text-gray-900">
                  Cancel
                </button>
                <button
                  onClick={() => roleMutation.mutate({ userId: roleUser._id, roleAssignments: roleDraft })}
                  disabled={!!conflict || roleMutation.isPending}
                  className="flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm text-white hover:bg-teal-700 disabled:opacity-50"
                >
                  {roleMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                  Save roles
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

export default UserManagement;
