import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
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
  Building2
} from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

interface User {
  _id: string;
  email: string;
  firstName: string;
  lastName: string;
  name: string;
  role: string;
  status: string;
  institutionName?: string;
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
  const [activeTab, setActiveTab] = useState<'users' | 'invitations' | 'readers'>('users');
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteForm, setInviteForm] = useState({
    email: '',
    name: '',
    role: 'reader',
    institutionId: ''
  });

  // Fetch users
  const { data: usersData, isLoading: usersLoading } = useQuery({
    queryKey: ['users', roleFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (roleFilter) params.append('role', roleFilter);
      const response = await axios.get(`${API_BASE}/users?${params}`);
      return response.data;
    }
  });

  // Fetch invitations
  const { data: invitationsData, isLoading: invitationsLoading } = useQuery({
    queryKey: ['invitations'],
    queryFn: async () => {
      const response = await axios.get(`${API_BASE}/users/invitations`);
      return response.data;
    }
  });

  // Fetch readers committee
  const { data: readersData, isLoading: readersLoading } = useQuery({
    queryKey: ['readers-committee'],
    queryFn: async () => {
      const response = await axios.get(`${API_BASE}/users/readers-committee`);
      return response.data;
    }
  });

  // Fetch institutions for dropdown
  const { data: institutionsData } = useQuery({
    queryKey: ['institutions'],
    queryFn: async () => {
      const response = await axios.get(`${API_BASE}/institutions`);
      return response.data;
    }
  });

  // Create invitation mutation
  const inviteMutation = useMutation({
    mutationFn: async (data: typeof inviteForm) => {
      const response = await axios.post(`${API_BASE}/users/invite`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invitations'] });
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setShowInviteModal(false);
      setInviteForm({ email: '', name: '', role: 'reader', institutionId: '' });
    }
  });

  // Resend invitation mutation
  const resendMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await axios.post(`${API_BASE}/users/invitations/${id}/resend`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invitations'] });
    }
  });

  // Disable user mutation
  const disableMutation = useMutation({
    mutationFn: async (id: string) => {
      await axios.delete(`${API_BASE}/users/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    }
  });

  const users: User[] = usersData?.users || [];
  const invitations: Invitation[] = invitationsData?.invitations || [];
  const institutions = institutionsData?.institutions || [];

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
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className={`px-2 py-1 text-xs rounded-full ${roleColors[user.role]}`}>
                        {roleLabels[user.role]}
                      </span>
                      {user.institutionName && (
                        <span className="flex items-center gap-1 text-sm text-gray-500">
                          <Building2 className="w-4 h-4" />
                          {user.institutionName}
                        </span>
                      )}
                      <span className="text-sm text-gray-400">
                        Last login: {formatDate(user.lastLogin)}
                      </span>
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
                Send Invitation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default UserManagement;
