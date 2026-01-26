import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../services/api';
import {
  FileText,
  Plus,
  Edit2,
  Trash2,
  Loader2,
  Search,
  CheckCircle,
  Archive,
  Clock,
  Building2,
  AlertCircle
} from 'lucide-react';
import { format } from 'date-fns';

interface Spec {
  _id: string;
  name: string;
  version: string;
  description?: string;
  documentUrl?: string;
  standardsCount: number;
  status: 'active' | 'archived' | 'draft';
  uploadedAt: string;
  uploadedBy?: {
    _id: string;
    firstName: string;
    lastName: string;
  };
  createdAt: string;
  updatedAt: string;
}

export function SpecManagement() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingSpec, setEditingSpec] = useState<Spec | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    version: '',
    description: '',
    documentUrl: '',
    standardsCount: 21
  });

  // Fetch specs
  const { data: specsData, isLoading, error: fetchError } = useQuery({
    queryKey: ['specs-management'],
    queryFn: async () => {
      const response = await api.get('/api/specs');
      return response.data;
    }
  });

  // Create spec mutation
  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const response = await api.post('/api/specs', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['specs-management'] });
      queryClient.invalidateQueries({ queryKey: ['specs'] });
      setShowCreateModal(false);
      setError(null);
      resetForm();
    },
    onError: (err: any) => {
      setError(err.response?.data?.error || 'Failed to create spec');
    }
  });

  // Update spec mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const response = await api.put(`/api/specs/${id}`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['specs-management'] });
      queryClient.invalidateQueries({ queryKey: ['specs'] });
      setEditingSpec(null);
      setError(null);
      resetForm();
    },
    onError: (err: any) => {
      setError(err.response?.data?.error || 'Failed to update spec');
    }
  });

  // Archive spec mutation
  const archiveMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/api/specs/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['specs-management'] });
      queryClient.invalidateQueries({ queryKey: ['specs'] });
    },
    onError: (err: any) => {
      alert(err.response?.data?.error || 'Failed to archive spec');
    }
  });

  const resetForm = () => {
    setFormData({
      name: '',
      version: '',
      description: '',
      documentUrl: '',
      standardsCount: 21
    });
  };

  const handleCreate = () => {
    createMutation.mutate(formData);
  };

  const handleUpdate = () => {
    if (editingSpec) {
      updateMutation.mutate({
        id: editingSpec._id,
        data: formData
      });
    }
  };

  const openEditModal = (spec: Spec) => {
    setEditingSpec(spec);
    setFormData({
      name: spec.name,
      version: spec.version,
      description: spec.description || '',
      documentUrl: spec.documentUrl || '',
      standardsCount: spec.standardsCount
    });
  };

  const specs: Spec[] = specsData?.specs || [];

  const filteredSpecs = specs.filter(spec =>
    spec.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    spec.version.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const activeSpecs = filteredSpecs.filter(s => s.status === 'active');
  const archivedSpecs = filteredSpecs.filter(s => s.status === 'archived');

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
            <FileText className="w-6 h-6 text-gray-600" />
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Spec Documents</h2>
              <p className="text-sm text-gray-500">
                Manage accreditation spec documents and versions
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              setShowCreateModal(true);
              setError(null);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Spec
          </button>
        </div>

        {/* Search */}
        <div className="p-4 bg-gray-50 border-b border-gray-200">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search specs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
        </div>

        {/* Spec List */}
        <div className="divide-y divide-gray-100">
          {filteredSpecs.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <FileText className="w-12 h-12 mx-auto text-gray-300 mb-3" />
              <p>No specs found</p>
              <p className="text-sm mt-1">Add your first spec document to get started</p>
            </div>
          ) : (
            <>
              {/* Active Specs */}
              {activeSpecs.length > 0 && (
                <div>
                  <div className="px-6 py-2 bg-gray-50 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Active Specs ({activeSpecs.length})
                  </div>
                  {activeSpecs.map((spec) => (
                    <SpecRow
                      key={spec._id}
                      spec={spec}
                      onEdit={openEditModal}
                      onArchive={() => archiveMutation.mutate(spec._id)}
                      isArchiving={archiveMutation.isPending}
                    />
                  ))}
                </div>
              )}

              {/* Archived Specs */}
              {archivedSpecs.length > 0 && (
                <div>
                  <div className="px-6 py-2 bg-gray-100 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Archived Specs ({archivedSpecs.length})
                  </div>
                  {archivedSpecs.map((spec) => (
                    <SpecRow
                      key={spec._id}
                      spec={spec}
                      onEdit={openEditModal}
                      onArchive={() => {}}
                      isArchiving={false}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Create/Edit Modal */}
      {(showCreateModal || editingSpec) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 overflow-y-auto py-8">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                {editingSpec ? 'Edit Spec' : 'Add New Spec'}
              </h3>
            </div>

            <div className="p-6 space-y-4">
              {/* Error Display */}
              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  <span className="text-sm">{error}</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Spec Name *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., CSHSE Standards"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Version *
                  </label>
                  <input
                    type="text"
                    value={formData.version}
                    onChange={(e) => setFormData({ ...formData, version: e.target.value })}
                    placeholder="e.g., 2024"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Standards Count
                  </label>
                  <input
                    type="number"
                    value={formData.standardsCount}
                    onChange={(e) => setFormData({ ...formData, standardsCount: parseInt(e.target.value) || 21 })}
                    min="1"
                    max="100"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={3}
                    placeholder="Brief description of this spec version..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Document URL
                  </label>
                  <input
                    type="url"
                    value={formData.documentUrl}
                    onChange={(e) => setFormData({ ...formData, documentUrl: e.target.value })}
                    placeholder="https://..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Link to the official spec document (PDF)
                  </p>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 p-4 border-t border-gray-200 bg-gray-50">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setEditingSpec(null);
                  setError(null);
                  resetForm();
                }}
                className="px-4 py-2 text-sm text-gray-700 hover:text-gray-900"
              >
                Cancel
              </button>
              <button
                onClick={editingSpec ? handleUpdate : handleCreate}
                disabled={
                  !formData.name ||
                  !formData.version ||
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
                {editingSpec ? 'Save Changes' : 'Create Spec'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface SpecRowProps {
  spec: Spec;
  onEdit: (spec: Spec) => void;
  onArchive: () => void;
  isArchiving: boolean;
}

function SpecRow({ spec, onEdit, onArchive, isArchiving }: SpecRowProps) {
  const [showInstitutions, setShowInstitutions] = useState(false);
  const { data: institutionsData } = useQuery({
    queryKey: ['spec-institutions', spec._id],
    queryFn: async () => {
      const response = await api.get(`/api/specs/${spec._id}/institutions`);
      return response.data;
    },
    enabled: showInstitutions
  });

  return (
    <div className="p-6 hover:bg-gray-50">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-medium text-gray-900">
              {spec.name}
            </h3>
            <span className="px-2 py-0.5 text-xs bg-primary-100 text-primary-700 rounded-full">
              v{spec.version}
            </span>
            {spec.status === 'archived' && (
              <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded-full flex items-center gap-1">
                <Archive className="w-3 h-3" />
                Archived
              </span>
            )}
          </div>

          {spec.description && (
            <p className="text-sm text-gray-600 mt-1">{spec.description}</p>
          )}

          <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-gray-500">
            <span className="flex items-center gap-1">
              <FileText className="w-4 h-4" />
              {spec.standardsCount} standards
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              Added {format(new Date(spec.createdAt), 'MMM d, yyyy')}
            </span>
            {spec.uploadedBy && (
              <span className="text-gray-400">
                by {spec.uploadedBy.firstName} {spec.uploadedBy.lastName}
              </span>
            )}
          </div>

          {/* Institutions using this spec */}
          <div className="mt-3">
            <button
              onClick={() => setShowInstitutions(!showInstitutions)}
              className="text-sm text-teal-600 hover:text-teal-700 flex items-center gap-1"
            >
              <Building2 className="w-4 h-4" />
              {showInstitutions ? 'Hide' : 'Show'} institutions using this spec
            </button>

            {showInstitutions && institutionsData && (
              <div className="mt-2 p-3 bg-gray-50 rounded-lg">
                {institutionsData.institutions.length === 0 ? (
                  <p className="text-sm text-gray-500">No institutions are using this spec</p>
                ) : (
                  <ul className="text-sm space-y-1">
                    {institutionsData.institutions.map((inst: any) => (
                      <li key={inst._id} className="text-gray-700">
                        {inst.name}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onEdit(spec)}
            className="p-2 text-gray-400 hover:text-teal-600 hover:bg-teal-50 rounded"
            title="Edit"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          {spec.status !== 'archived' && (
            <button
              onClick={onArchive}
              disabled={isArchiving}
              className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded disabled:opacity-50"
              title="Archive"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default SpecManagement;
