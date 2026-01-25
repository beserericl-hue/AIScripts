import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import {
  Calendar,
  MapPin,
  Users,
  Plus,
  Edit2,
  Trash2,
  Clock,
  CheckCircle,
  AlertCircle,
  X,
  Loader2,
  Building2,
  User,
  CalendarClock,
} from 'lucide-react';
import { format, formatDistanceToNow, addDays } from 'date-fns';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

interface TeamMember {
  userId: string;
  userName: string;
  role: 'lead' | 'team_member' | 'observer';
}

interface SiteVisit {
  _id: string;
  submissionId: string;
  institutionId: { _id: string; name: string };
  institutionName: string;
  scheduledDate: string;
  scheduledTime?: string;
  duration?: number;
  location?: {
    address: string;
    city: string;
    state: string;
    zipCode: string;
    notes?: string;
  };
  status: 'scheduled' | 'confirmed' | 'completed' | 'cancelled' | 'rescheduled';
  teamMembers: TeamMember[];
  agenda?: string;
  notes?: string;
  createdAt: string;
}

interface Institution {
  _id: string;
  name: string;
  currentSubmissionId?: string;
}

interface User {
  _id: string;
  firstName: string;
  lastName: string;
  role: string;
}

interface SiteVisitSchedulerProps {
  submissionId?: string;
  institutionId?: string;
}

export function SiteVisitScheduler({
  submissionId,
  institutionId,
}: SiteVisitSchedulerProps) {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingVisit, setEditingVisit] = useState<SiteVisit | null>(null);
  const [formData, setFormData] = useState({
    institutionId: institutionId || '',
    submissionId: submissionId || '',
    scheduledDate: '',
    scheduledTime: '09:00',
    duration: 480,
    location: {
      address: '',
      city: '',
      state: '',
      zipCode: '',
      notes: '',
    },
    teamMembers: [] as TeamMember[],
    agenda: '',
    notes: '',
  });

  // Fetch site visits
  const { data: visitsData, isLoading: visitsLoading } = useQuery({
    queryKey: ['site-visits', { submissionId, institutionId }],
    queryFn: async () => {
      const params: any = {};
      if (submissionId) params.submissionId = submissionId;
      if (institutionId) params.institutionId = institutionId;
      const response = await axios.get(`${API_BASE}/site-visits`, { params });
      return response.data;
    },
  });

  // Fetch institutions for dropdown
  const { data: institutionsData } = useQuery({
    queryKey: ['institutions-list'],
    queryFn: async () => {
      const response = await axios.get(`${API_BASE}/institutions`, {
        params: { limit: 200 },
      });
      return response.data;
    },
    enabled: !institutionId,
  });

  // Fetch users (readers) for team assignment
  const { data: usersData } = useQuery({
    queryKey: ['users-readers'],
    queryFn: async () => {
      const response = await axios.get(`${API_BASE}/users`, {
        params: { roles: ['reader', 'lead_reader', 'admin'] },
      });
      return response.data;
    },
  });

  const siteVisits: SiteVisit[] = visitsData?.siteVisits || [];
  const institutions: Institution[] = institutionsData?.institutions || [];
  const users: User[] = usersData?.users || [];

  // Create site visit mutation
  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await axios.post(`${API_BASE}/site-visits`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['site-visits'] });
      resetForm();
    },
  });

  // Update site visit mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const response = await axios.put(`${API_BASE}/site-visits/${id}`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['site-visits'] });
      resetForm();
    },
  });

  // Delete site visit mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await axios.delete(`${API_BASE}/site-visits/${id}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['site-visits'] });
    },
  });

  const resetForm = () => {
    setShowForm(false);
    setEditingVisit(null);
    setFormData({
      institutionId: institutionId || '',
      submissionId: submissionId || '',
      scheduledDate: '',
      scheduledTime: '09:00',
      duration: 480,
      location: {
        address: '',
        city: '',
        state: '',
        zipCode: '',
        notes: '',
      },
      teamMembers: [],
      agenda: '',
      notes: '',
    });
  };

  const handleEdit = (visit: SiteVisit) => {
    setEditingVisit(visit);
    setFormData({
      institutionId: visit.institutionId?._id || '',
      submissionId: visit.submissionId || '',
      scheduledDate: format(new Date(visit.scheduledDate), 'yyyy-MM-dd'),
      scheduledTime: visit.scheduledTime || '09:00',
      duration: visit.duration || 480,
      location: visit.location || {
        address: '',
        city: '',
        state: '',
        zipCode: '',
        notes: '',
      },
      teamMembers: visit.teamMembers || [],
      agenda: visit.agenda || '',
      notes: visit.notes || '',
    });
    setShowForm(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingVisit) {
      updateMutation.mutate({ id: editingVisit._id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const addTeamMember = (userId: string) => {
    const user = users.find((u) => u._id === userId);
    if (!user) return;
    if (formData.teamMembers.some((m) => m.userId === userId)) return;

    setFormData((prev) => ({
      ...prev,
      teamMembers: [
        ...prev.teamMembers,
        {
          userId,
          userName: `${user.firstName} ${user.lastName}`,
          role: 'team_member' as const,
        },
      ],
    }));
  };

  const removeTeamMember = (userId: string) => {
    setFormData((prev) => ({
      ...prev,
      teamMembers: prev.teamMembers.filter((m) => m.userId !== userId),
    }));
  };

  const updateTeamMemberRole = (userId: string, role: TeamMember['role']) => {
    setFormData((prev) => ({
      ...prev,
      teamMembers: prev.teamMembers.map((m) =>
        m.userId === userId ? { ...m, role } : m
      ),
    }));
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed':
        return 'bg-green-100 text-green-700';
      case 'scheduled':
        return 'bg-blue-100 text-blue-700';
      case 'completed':
        return 'bg-gray-100 text-gray-700';
      case 'cancelled':
        return 'bg-red-100 text-red-700';
      case 'rescheduled':
        return 'bg-amber-100 text-amber-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <CalendarClock className="w-5 h-5 text-blue-500" />
          <h2 className="font-semibold text-gray-900">Site Visits</h2>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 text-sm bg-teal-600 text-white rounded-lg hover:bg-teal-700"
        >
          <Plus className="w-4 h-4" />
          Schedule Visit
        </button>
      </div>

      {/* Visit List */}
      <div className="divide-y divide-gray-100">
        {visitsLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        )}

        {!visitsLoading && siteVisits.length === 0 && (
          <div className="py-12 text-center text-gray-500">
            <Calendar className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>No site visits scheduled</p>
          </div>
        )}

        {siteVisits.map((visit) => (
          <div key={visit._id} className="p-4 hover:bg-gray-50">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <Building2 className="w-4 h-4 text-gray-400" />
                  <span className="font-medium text-gray-900">
                    {visit.institutionName || visit.institutionId?.name}
                  </span>
                  <span
                    className={`px-2 py-0.5 text-xs font-medium rounded ${getStatusColor(
                      visit.status
                    )}`}
                  >
                    {visit.status}
                  </span>
                </div>

                <div className="ml-7 space-y-1">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Calendar className="w-4 h-4 text-gray-400" />
                    {format(new Date(visit.scheduledDate), 'EEEE, MMMM d, yyyy')}
                    {visit.scheduledTime && ` at ${visit.scheduledTime}`}
                    {visit.duration && (
                      <span className="text-gray-400">
                        ({Math.floor(visit.duration / 60)}h{' '}
                        {visit.duration % 60}m)
                      </span>
                    )}
                  </div>

                  {visit.location?.address && (
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <MapPin className="w-4 h-4 text-gray-400" />
                      {visit.location.address}, {visit.location.city},{' '}
                      {visit.location.state} {visit.location.zipCode}
                    </div>
                  )}

                  {visit.teamMembers && visit.teamMembers.length > 0 && (
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Users className="w-4 h-4 text-gray-400" />
                      {visit.teamMembers.map((m) => m.userName).join(', ')}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400">
                  {formatDistanceToNow(new Date(visit.scheduledDate), {
                    addSuffix: true,
                  })}
                </span>
                <button
                  onClick={() => handleEdit(visit)}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => {
                    if (
                      confirm('Are you sure you want to delete this site visit?')
                    ) {
                      deleteMutation.mutate(visit._id);
                    }
                  }}
                  className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 sticky top-0 bg-white">
              <h3 className="text-lg font-bold text-gray-900">
                {editingVisit ? 'Edit Site Visit' : 'Schedule Site Visit'}
              </h3>
              <button
                onClick={resetForm}
                className="p-2 hover:bg-gray-100 rounded"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {/* Institution Selection */}
              {!institutionId && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Institution *
                  </label>
                  <select
                    value={formData.institutionId}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        institutionId: e.target.value,
                      }))
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                    required
                  >
                    <option value="">Select institution...</option>
                    {institutions.map((inst) => (
                      <option key={inst._id} value={inst._id}>
                        {inst.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Date and Time */}
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-1">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Date *
                  </label>
                  <input
                    type="date"
                    value={formData.scheduledDate}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        scheduledDate: e.target.value,
                      }))
                    }
                    min={format(new Date(), 'yyyy-MM-dd')}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                    required
                  />
                </div>
                <div className="col-span-1">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Start Time
                  </label>
                  <input
                    type="time"
                    value={formData.scheduledTime}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        scheduledTime: e.target.value,
                      }))
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
                <div className="col-span-1">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Duration (minutes)
                  </label>
                  <input
                    type="number"
                    value={formData.duration}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        duration: parseInt(e.target.value),
                      }))
                    }
                    min="60"
                    step="30"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
              </div>

              {/* Location */}
              <div className="p-4 bg-gray-50 rounded-lg space-y-4">
                <h4 className="text-sm font-semibold text-gray-700">Location</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <input
                      type="text"
                      value={formData.location.address}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          location: { ...prev.location, address: e.target.value },
                        }))
                      }
                      placeholder="Street Address"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                  </div>
                  <div>
                    <input
                      type="text"
                      value={formData.location.city}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          location: { ...prev.location, city: e.target.value },
                        }))
                      }
                      placeholder="City"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={formData.location.state}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          location: { ...prev.location, state: e.target.value },
                        }))
                      }
                      placeholder="State"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                    <input
                      type="text"
                      value={formData.location.zipCode}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          location: { ...prev.location, zipCode: e.target.value },
                        }))
                      }
                      placeholder="ZIP"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                  </div>
                </div>
                <textarea
                  value={formData.location.notes}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      location: { ...prev.location, notes: e.target.value },
                    }))
                  }
                  placeholder="Location notes (parking, building access, etc.)"
                  rows={2}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
                />
              </div>

              {/* Team Members */}
              <div className="p-4 bg-gray-50 rounded-lg space-y-4">
                <h4 className="text-sm font-semibold text-gray-700">
                  Site Visit Team
                </h4>
                <div className="flex gap-2">
                  <select
                    onChange={(e) => {
                      if (e.target.value) {
                        addTeamMember(e.target.value);
                        e.target.value = '';
                      }
                    }}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                  >
                    <option value="">Add team member...</option>
                    {users
                      .filter(
                        (u) =>
                          !formData.teamMembers.some((m) => m.userId === u._id)
                      )
                      .map((user) => (
                        <option key={user._id} value={user._id}>
                          {user.firstName} {user.lastName} ({user.role})
                        </option>
                      ))}
                  </select>
                </div>
                {formData.teamMembers.length > 0 && (
                  <div className="space-y-2">
                    {formData.teamMembers.map((member) => (
                      <div
                        key={member.userId}
                        className="flex items-center justify-between p-3 bg-white rounded border border-gray-200"
                      >
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-gray-400" />
                          <span className="text-sm font-medium">
                            {member.userName}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <select
                            value={member.role}
                            onChange={(e) =>
                              updateTeamMemberRole(
                                member.userId,
                                e.target.value as TeamMember['role']
                              )
                            }
                            className="px-2 py-1 text-xs border border-gray-300 rounded"
                          >
                            <option value="lead">Team Lead</option>
                            <option value="team_member">Team Member</option>
                            <option value="observer">Observer</option>
                          </select>
                          <button
                            type="button"
                            onClick={() => removeTeamMember(member.userId)}
                            className="p-1 text-gray-400 hover:text-red-600"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Agenda and Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Agenda
                </label>
                <textarea
                  value={formData.agenda}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, agenda: e.target.value }))
                  }
                  placeholder="Site visit agenda items..."
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Notes
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, notes: e.target.value }))
                  }
                  placeholder="Additional notes..."
                  rows={2}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
                />
              </div>

              {/* Error */}
              {(createMutation.isError || updateMutation.isError) && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-center gap-2 text-red-700 text-sm">
                    <AlertCircle className="w-4 h-4" />
                    <span>
                      {(createMutation.error as any)?.response?.data?.error ||
                        (updateMutation.error as any)?.response?.data?.error ||
                        'Failed to save site visit'}
                    </span>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={
                    !formData.scheduledDate ||
                    (!institutionId && !formData.institutionId) ||
                    createMutation.isPending ||
                    updateMutation.isPending
                  }
                  className="flex items-center gap-2 px-4 py-2 text-sm bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {(createMutation.isPending || updateMutation.isPending) && (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  )}
                  {editingVisit ? 'Update Visit' : 'Schedule Visit'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default SiteVisitScheduler;
