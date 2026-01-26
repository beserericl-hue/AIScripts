import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../services/api';
import {
  Building2,
  Plus,
  Edit2,
  Trash2,
  Users,
  Calendar,
  MapPin,
  Mail,
  Phone,
  Globe,
  Loader2,
  Search,
  CheckCircle,
  Clock,
  UserCheck,
  FileText
} from 'lucide-react';

interface Institution {
  _id: string;
  name: string;
  type: 'college' | 'university';
  address: {
    street: string;
    city: string;
    state: string;
    zip: string;
  };
  primaryContact: {
    name: string;
    email: string;
    phone: string;
  };
  website?: string;
  accreditationDeadline?: string;
  specId?: string;
  specName?: string;
  programCoordinatorId?: {
    _id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  assignedLeadReaderId?: {
    _id: string;
    firstName: string;
    lastName: string;
  };
  status: string;
  currentSubmissionId?: string;
}

interface Spec {
  _id: string;
  name: string;
  version: string;
  status: string;
}

// Format phone number as (XXX) XXX-XXXX
const formatPhoneNumber = (value: string): string => {
  // Remove all non-digits
  const digits = value.replace(/\D/g, '');

  // Format based on length
  if (digits.length === 0) return '';
  if (digits.length <= 3) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
};

export function InstitutionManagement() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingInstitution, setEditingInstitution] = useState<Institution | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    type: 'university' as 'college' | 'university',
    address: {
      street: '',
      city: '',
      state: '',
      zip: ''
    },
    primaryContact: {
      name: '',
      email: '',
      phone: ''
    },
    website: '',
    accreditationDeadline: '',
    specId: '',
    programCoordinatorEmail: '',
    programCoordinatorName: ''
  });

  // Fetch institutions
  const { data: institutionsData, isLoading } = useQuery({
    queryKey: ['institutions'],
    queryFn: async () => {
      const response = await api.get('/api/institutions');
      return response.data;
    }
  });

  // Fetch lead readers for assignment
  const { data: leadReadersData } = useQuery({
    queryKey: ['lead-readers'],
    queryFn: async () => {
      const response = await api.get('/api/users?role=lead_reader');
      return response.data;
    }
  });

  // Fetch specs for assignment
  const { data: specsData } = useQuery({
    queryKey: ['specs'],
    queryFn: async () => {
      const response = await api.get('/api/specs?status=active');
      return response.data;
    }
  });

  // Create institution mutation
  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const response = await api.post('/api/institutions', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['institutions'] });
      setShowCreateModal(false);
      setFormError(null);
      resetForm();
    },
    onError: (error: any) => {
      const details = error.response?.data?.details;
      const message = error.response?.data?.error || 'Failed to create institution';
      setFormError(details ? `${message}: ${details.join(', ')}` : message);
    }
  });

  // Update institution mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const response = await api.put(`/api/institutions/${id}`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['institutions'] });
      setEditingInstitution(null);
      setFormError(null);
      resetForm();
    },
    onError: (error: any) => {
      const details = error.response?.data?.details;
      const message = error.response?.data?.error || 'Failed to update institution';
      setFormError(details ? `${message}: ${details.join(', ')}` : message);
    }
  });

  // Assign lead reader mutation
  const assignLeadReaderMutation = useMutation({
    mutationFn: async ({ institutionId, leadReaderId }: { institutionId: string; leadReaderId: string }) => {
      const response = await api.post(`/api/institutions/${institutionId}/lead-reader`, { leadReaderId });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['institutions'] });
    }
  });

  // Archive institution mutation
  const archiveMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/api/institutions/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['institutions'] });
    }
  });

  const resetForm = () => {
    setFormData({
      name: '',
      type: 'university',
      address: { street: '', city: '', state: '', zip: '' },
      primaryContact: { name: '', email: '', phone: '' },
      website: '',
      accreditationDeadline: '',
      specId: '',
      programCoordinatorEmail: '',
      programCoordinatorName: ''
    });
    setFormError(null);
  };

  const handleCreate = () => {
    createMutation.mutate(formData);
  };

  const handleUpdate = () => {
    if (editingInstitution) {
      updateMutation.mutate({
        id: editingInstitution._id,
        data: formData
      });
    }
  };

  const openEditModal = (institution: Institution) => {
    setEditingInstitution(institution);
    setFormError(null);
    setFormData({
      name: institution.name,
      type: institution.type,
      address: institution.address,
      primaryContact: institution.primaryContact,
      website: institution.website || '',
      accreditationDeadline: institution.accreditationDeadline
        ? new Date(institution.accreditationDeadline).toISOString().split('T')[0]
        : '',
      specId: institution.specId || '',
      programCoordinatorEmail: '',
      programCoordinatorName: ''
    });
  };

  const institutions: Institution[] = institutionsData?.institutions || [];
  const leadReaders = leadReadersData?.users || [];
  const specs: Spec[] = specsData?.specs || [];

  const filteredInstitutions = institutions.filter(inst =>
    inst.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    inst.address.city.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Not set';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-center h-48">
          <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <Building2 className="w-6 h-6 text-gray-600" />
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Institutions</h2>
              <p className="text-sm text-gray-500">
                Manage colleges and universities
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Institution
          </button>
        </div>

        {/* Search */}
        <div className="p-4 bg-gray-50 border-b border-gray-200">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search institutions..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
        </div>

        {/* Institution List */}
        <div className="divide-y divide-gray-100">
          {filteredInstitutions.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <Building2 className="w-12 h-12 mx-auto text-gray-300 mb-3" />
              <p>No institutions found</p>
            </div>
          ) : (
            filteredInstitutions.map((institution) => (
              <div key={institution._id} className="p-6 hover:bg-gray-50">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h3 className="text-lg font-medium text-gray-900">
                        {institution.name}
                      </h3>
                      <span className={`px-2 py-0.5 text-xs rounded-full ${
                        institution.type === 'university'
                          ? 'bg-purple-100 text-purple-700'
                          : 'bg-blue-100 text-blue-700'
                      }`}>
                        {institution.type}
                      </span>
                      {institution.currentSubmissionId && (
                        <span className="px-2 py-0.5 text-xs bg-green-100 text-green-700 rounded-full flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" />
                          Active Submission
                        </span>
                      )}
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-gray-500">
                      <span className="flex items-center gap-1">
                        <MapPin className="w-4 h-4" />
                        {institution.address.city}, {institution.address.state}
                      </span>
                      <span className="flex items-center gap-1">
                        <Mail className="w-4 h-4" />
                        {institution.primaryContact.email}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        Deadline: {formatDate(institution.accreditationDeadline)}
                      </span>
                      {institution.specName && (
                        <span className="flex items-center gap-1 text-primary-600">
                          <FileText className="w-4 h-4" />
                          {institution.specName}
                        </span>
                      )}
                    </div>

                    <div className="mt-3 flex items-center gap-4">
                      {institution.programCoordinatorId ? (
                        <span className="flex items-center gap-1 text-sm text-teal-600">
                          <UserCheck className="w-4 h-4" />
                          Coordinator: {institution.programCoordinatorId.firstName} {institution.programCoordinatorId.lastName}
                        </span>
                      ) : (
                        <span className="text-sm text-amber-600">No coordinator assigned</span>
                      )}

                      {institution.assignedLeadReaderId ? (
                        <span className="flex items-center gap-1 text-sm text-blue-600">
                          <Users className="w-4 h-4" />
                          Lead Reader: {institution.assignedLeadReaderId.firstName} {institution.assignedLeadReaderId.lastName}
                        </span>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-gray-400">No lead reader</span>
                          <select
                            onChange={(e) => {
                              if (e.target.value) {
                                assignLeadReaderMutation.mutate({
                                  institutionId: institution._id,
                                  leadReaderId: e.target.value
                                });
                              }
                            }}
                            className="text-sm px-2 py-1 border border-gray-300 rounded"
                            defaultValue=""
                          >
                            <option value="">Assign...</option>
                            {leadReaders.map((lr: any) => (
                              <option key={lr._id} value={lr._id}>
                                {lr.firstName} {lr.lastName}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => openEditModal(institution)}
                      className="p-2 text-gray-400 hover:text-teal-600 hover:bg-teal-50 rounded"
                      title="Edit"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => archiveMutation.mutate(institution._id)}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                      title="Archive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Create/Edit Modal */}
      {(showCreateModal || editingInstitution) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 overflow-y-auto py-8">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                {editingInstitution ? 'Edit Institution' : 'Add New Institution'}
              </h3>
            </div>

            <div className="p-6 space-y-6 max-h-[60vh] overflow-y-auto">
              {/* Error Display */}
              {formError && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700">
                  <span className="text-sm">{formError}</span>
                </div>
              )}

              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Institution Name *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Type *
                  </label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value as 'college' | 'university' })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                  >
                    <option value="university">University</option>
                    <option value="college">College</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Website
                  </label>
                  <input
                    type="url"
                    value={formData.website}
                    onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                    placeholder="https://..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
              </div>

              {/* Address */}
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-3">Address *</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <input
                      type="text"
                      value={formData.address.street}
                      onChange={(e) => setFormData({
                        ...formData,
                        address: { ...formData.address, street: e.target.value }
                      })}
                      placeholder="Street Address *"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                  </div>
                  <input
                    type="text"
                    value={formData.address.city}
                    onChange={(e) => setFormData({
                      ...formData,
                      address: { ...formData.address, city: e.target.value }
                    })}
                    placeholder="City *"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <input
                      type="text"
                      value={formData.address.state}
                      onChange={(e) => setFormData({
                        ...formData,
                        address: { ...formData.address, state: e.target.value }
                      })}
                      placeholder="State *"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                    <input
                      type="text"
                      value={formData.address.zip}
                      onChange={(e) => setFormData({
                        ...formData,
                        address: { ...formData.address, zip: e.target.value }
                      })}
                      placeholder="ZIP *"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                  </div>
                </div>
              </div>

              {/* Primary Contact */}
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-3">Primary Contact *</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <input
                      type="text"
                      value={formData.primaryContact.name}
                      onChange={(e) => setFormData({
                        ...formData,
                        primaryContact: { ...formData.primaryContact, name: e.target.value }
                      })}
                      placeholder="Contact Name *"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                  </div>
                  <input
                    type="email"
                    value={formData.primaryContact.email}
                    onChange={(e) => setFormData({
                      ...formData,
                      primaryContact: { ...formData.primaryContact, email: e.target.value }
                    })}
                    placeholder="Email *"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                  <input
                    type="tel"
                    value={formData.primaryContact.phone}
                    onChange={(e) => setFormData({
                      ...formData,
                      primaryContact: { ...formData.primaryContact, phone: formatPhoneNumber(e.target.value) }
                    })}
                    placeholder="Phone * (XXX) XXX-XXXX"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
              </div>

              {/* Accreditation */}
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-3">Accreditation</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Spec Document</label>
                    <select
                      value={formData.specId}
                      onChange={(e) => setFormData({ ...formData, specId: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                    >
                      <option value="">Select a spec...</option>
                      {specs.map((spec) => (
                        <option key={spec._id} value={spec._id}>
                          {spec.name} v{spec.version}
                        </option>
                      ))}
                    </select>
                    {specs.length === 0 && (
                      <p className="text-xs text-amber-600 mt-1">
                        No specs available. Add specs in Settings first.
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Deadline</label>
                    <input
                      type="date"
                      value={formData.accreditationDeadline}
                      onChange={(e) => setFormData({ ...formData, accreditationDeadline: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                  </div>
                </div>
              </div>

              {/* Program Coordinator (only for new institutions) */}
              {!editingInstitution && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 mb-3">
                    Program Coordinator Invitation (Optional)
                  </h4>
                  <p className="text-xs text-gray-500 mb-3">
                    An invitation email will be sent to create their account
                  </p>
                  <div className="grid grid-cols-2 gap-4">
                    <input
                      type="text"
                      value={formData.programCoordinatorName}
                      onChange={(e) => setFormData({ ...formData, programCoordinatorName: e.target.value })}
                      placeholder="Coordinator Name"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                    <input
                      type="email"
                      value={formData.programCoordinatorEmail}
                      onChange={(e) => setFormData({ ...formData, programCoordinatorEmail: e.target.value })}
                      placeholder="Coordinator Email"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 p-4 border-t border-gray-200 bg-gray-50">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setEditingInstitution(null);
                  resetForm();
                }}
                className="px-4 py-2 text-sm text-gray-700 hover:text-gray-900"
              >
                Cancel
              </button>
              <button
                onClick={editingInstitution ? handleUpdate : handleCreate}
                disabled={
                  !formData.name ||
                  !formData.address.street ||
                  !formData.address.city ||
                  !formData.address.state ||
                  !formData.address.zip ||
                  !formData.primaryContact.name ||
                  !formData.primaryContact.email ||
                  !formData.primaryContact.phone ||
                  createMutation.isPending ||
                  updateMutation.isPending
                }
                className="flex items-center gap-2 px-4 py-2 text-sm bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50"
              >
                {(createMutation.isPending || updateMutation.isPending) ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle className="w-4 h-4" />
                )}
                {editingInstitution ? 'Save Changes' : 'Create Institution'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default InstitutionManagement;
