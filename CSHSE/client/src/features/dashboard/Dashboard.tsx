import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../services/api';
import {
  LayoutDashboard,
  Bell,
  Calendar,
  Clock,
  FileCheck,
  AlertTriangle,
  Building2,
  Users,
  Filter,
  Search,
  ChevronRight,
  CheckCircle,
  XCircle,
  HourglassIcon,
  CalendarClock,
  RefreshCw,
  Eye,
  Loader2,
  ClipboardCheck,
} from 'lucide-react';
import { format, formatDistanceToNow, isWithinInterval, addDays } from 'date-fns';
import { useAuthStore } from '../../store/authStore';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

interface Institution {
  _id: string;
  name: string;
  type: 'university' | 'college' | 'community_college';
  accreditationDeadline?: string;
  programCoordinatorId?: { _id: string; firstName: string; lastName: string };
  assignedLeadReaderId?: { _id: string; firstName: string; lastName: string };
  assignedReaderIds: Array<{ _id: string; firstName: string; lastName: string }>;
  currentSubmissionId?: string;
  specId?: string;
  specName?: string;
}

interface ChangeRequest {
  _id: string;
  submissionId: { submissionId: string; institutionName: string };
  institutionName: string;
  type: 'deadline' | 'site_visit';
  currentValue: string;
  requestedValue: string;
  reason: string;
  requestedBy: { firstName: string; lastName: string };
  requestedByName: string;
  status: 'pending' | 'approved' | 'denied' | 'withdrawn';
  approvals: {
    admin: { approved?: boolean; userName?: string };
    leadReader: { approved?: boolean; userName?: string };
  };
  createdAt: string;
}

interface SiteVisit {
  _id: string;
  submissionId: string;
  institutionId: { _id: string; name: string };
  institutionName: string;
  scheduledDate: string;
  status: 'scheduled' | 'confirmed' | 'completed' | 'cancelled' | 'rescheduled';
  teamMembers: Array<{ userId: string; userName: string; role: string }>;
}

interface Submission {
  _id: string;
  submissionId: string;
  institutionName: string;
  status: string;
  standardsStatus?: Record<string, { status: string; validationStatus: string }>;
  readerLock?: {
    isLocked: boolean;
    lockedByName?: string;
    lockReason?: string;
  };
}

interface User {
  _id: string;
  firstName: string;
  lastName: string;
  role: string;
}

interface DashboardFilters {
  institutionType: string;
  institutionId: string;
  leadReaderId: string;
  readerId: string;
  search: string;
}

export function Dashboard() {
  const { getEffectiveRole, getEffectiveUser } = useAuthStore();
  const effectiveRole = getEffectiveRole();
  const effectiveUser = getEffectiveUser();
  const isProgramCoordinator = effectiveRole === 'program_coordinator';

  const [filters, setFilters] = useState<DashboardFilters>({
    institutionType: '',
    institutionId: '',
    leadReaderId: '',
    readerId: '',
    search: '',
  });

  // Fetch institutions
  const { data: institutionsData, isLoading: institutionsLoading } = useQuery({
    queryKey: ['institutions-dashboard'],
    queryFn: async () => {
      const response = await api.get(`${API_BASE}/institutions`, {
        params: { limit: 200 },
      });
      return response.data;
    },
    enabled: !isProgramCoordinator
  });

  // Fetch user's institution for Program Coordinator
  const { data: myInstitutionData, isLoading: myInstitutionLoading } = useQuery({
    queryKey: ['my-institution', effectiveUser?.institutionId],
    queryFn: async () => {
      if (!effectiveUser?.institutionId) return null;
      const response = await api.get(`${API_BASE}/institutions/${effectiveUser.institutionId}`);
      return response.data;
    },
    enabled: isProgramCoordinator && !!effectiveUser?.institutionId
  });

  // Fetch submission for Program Coordinator
  const { data: mySubmissionData, isLoading: mySubmissionLoading } = useQuery({
    queryKey: ['my-submission', effectiveUser?.institutionId],
    queryFn: async () => {
      if (!effectiveUser?.institutionId) return null;
      const response = await api.get(`${API_BASE}/submissions`, {
        params: { institutionId: effectiveUser.institutionId, limit: 1 }
      });
      return response.data;
    },
    enabled: isProgramCoordinator && !!effectiveUser?.institutionId
  });

  // Fetch pending change requests
  const { data: changeRequestsData, isLoading: changeRequestsLoading } = useQuery({
    queryKey: ['pending-change-requests'],
    queryFn: async () => {
      const response = await api.get(`${API_BASE}/change-requests/pending`);
      return response.data;
    },
  });

  // Fetch upcoming site visits
  const { data: siteVisitsData, isLoading: siteVisitsLoading } = useQuery({
    queryKey: ['upcoming-site-visits'],
    queryFn: async () => {
      const response = await api.get(`${API_BASE}/site-visits`, {
        params: { upcoming: true, limit: 20 },
      });
      return response.data;
    },
  });

  // Fetch users (readers and lead readers) - only for non-PC roles
  const { data: usersData } = useQuery({
    queryKey: ['users-readers'],
    queryFn: async () => {
      const response = await api.get(`${API_BASE}/users`, {
        params: { roles: ['reader', 'lead_reader'] },
      });
      return response.data;
    },
    enabled: !isProgramCoordinator
  });

  const institutions: Institution[] = institutionsData?.institutions || [];
  const myInstitution: Institution | null = myInstitutionData?.institution || null;
  const mySubmission: Submission | null = mySubmissionData?.submissions?.[0] || null;
  const changeRequests: ChangeRequest[] = changeRequestsData?.pendingRequests || [];
  const siteVisits: SiteVisit[] = siteVisitsData?.siteVisits || [];
  const users: User[] = usersData?.users || [];

  // Filter institutions (for non-PC roles)
  const filteredInstitutions = useMemo(() => {
    return institutions.filter((inst) => {
      if (filters.institutionType && inst.type !== filters.institutionType) {
        return false;
      }
      if (filters.institutionId && inst._id !== filters.institutionId) {
        return false;
      }
      if (
        filters.leadReaderId &&
        inst.assignedLeadReaderId?._id !== filters.leadReaderId
      ) {
        return false;
      }
      if (filters.readerId) {
        const hasReader = inst.assignedReaderIds?.some(
          (r) => r._id === filters.readerId
        );
        if (!hasReader) return false;
      }
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        if (!inst.name.toLowerCase().includes(searchLower)) {
          return false;
        }
      }
      return true;
    });
  }, [institutions, filters]);

  // Filter change requests
  const filteredChangeRequests = useMemo(() => {
    if (isProgramCoordinator && effectiveUser?.institutionId) {
      // For PC, only show their institution's requests
      return changeRequests.filter((cr) => {
        const instName = cr.institutionName || cr.submissionId?.institutionName;
        return instName?.toLowerCase() === myInstitution?.name?.toLowerCase();
      });
    }
    if (!filters.institutionId && !filters.search) {
      return changeRequests;
    }
    return changeRequests.filter((cr) => {
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        if (
          !cr.institutionName.toLowerCase().includes(searchLower) &&
          !cr.submissionId?.institutionName?.toLowerCase().includes(searchLower)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [changeRequests, filters, isProgramCoordinator, effectiveUser, myInstitution]);

  // Filter site visits for PC
  const filteredSiteVisits = useMemo(() => {
    if (isProgramCoordinator && effectiveUser?.institutionId) {
      return siteVisits.filter((sv) => {
        const instName = sv.institutionName || sv.institutionId?.name;
        return instName?.toLowerCase() === myInstitution?.name?.toLowerCase();
      });
    }
    return siteVisits;
  }, [siteVisits, isProgramCoordinator, effectiveUser, myInstitution]);

  // Calculate statistics for PC
  const pcStats = useMemo(() => {
    if (!mySubmission?.standardsStatus) {
      return { completedItems: 0, totalItems: 21 }; // 21 standards by default
    }

    const statuses = Object.values(mySubmission.standardsStatus);
    const completedItems = statuses.filter(
      (s) => s.status === 'complete' || s.status === 'submitted' || s.status === 'validated'
    ).length;

    return {
      completedItems,
      totalItems: statuses.length || 21
    };
  }, [mySubmission]);

  // Calculate statistics for Admin/other roles
  const stats = useMemo(() => {
    const upcomingDeadlines = filteredInstitutions.filter((inst) => {
      if (!inst.accreditationDeadline) return false;
      const deadline = new Date(inst.accreditationDeadline);
      return isWithinInterval(deadline, {
        start: new Date(),
        end: addDays(new Date(), 30),
      });
    }).length;

    const upcomingSiteVisits = siteVisits.filter((sv) => {
      const visitDate = new Date(sv.scheduledDate);
      return isWithinInterval(visitDate, {
        start: new Date(),
        end: addDays(new Date(), 14),
      });
    }).length;

    return {
      totalInstitutions: filteredInstitutions.length,
      pendingChangeRequests: filteredChangeRequests.length,
      upcomingDeadlines,
      upcomingSiteVisits,
    };
  }, [filteredInstitutions, filteredChangeRequests, siteVisits]);

  const leadReaders = users.filter((u) => u.role === 'lead_reader');
  const readers = users.filter((u) => u.role === 'reader');

  const isLoading = institutionsLoading || changeRequestsLoading || siteVisitsLoading ||
    (isProgramCoordinator && (myInstitutionLoading || mySubmissionLoading));

  // Program Coordinator Dashboard
  if (isProgramCoordinator) {
    // Unassigned state
    if (!effectiveUser?.institutionId) {
      return (
        <div className="min-h-screen bg-gray-50">
          <div className="max-w-4xl mx-auto px-6 py-12">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
              <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="w-8 h-8 text-amber-600" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                Unassigned University
              </h1>
              <p className="text-gray-600">
                You have not been assigned to a university yet. Please contact your administrator.
              </p>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-gray-50">
        {/* Spec Name Banner */}
        {myInstitution?.specName && (
          <div className="bg-primary-600 text-white">
            <div className="max-w-7xl mx-auto px-6 py-3">
              <div className="flex items-center gap-2">
                <FileCheck className="w-5 h-5" />
                <span className="font-medium">{myInstitution.specName}</span>
              </div>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-6 py-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <LayoutDashboard className="w-8 h-8 text-primary" />
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">
                    {myInstitution?.name || effectiveUser?.institutionName || 'My Dashboard'}
                  </h1>
                  <p className="text-sm text-gray-500">
                    Self-Study Progress Dashboard
                  </p>
                </div>
              </div>
              <button
                onClick={() => window.location.reload()}
                className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                <RefreshCw className="w-4 h-4" />
                Refresh
              </button>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-6 py-8">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Items In Spec Completed</p>
                  <p className="text-3xl font-bold text-primary-600">
                    {pcStats.completedItems}/{pcStats.totalItems}
                  </p>
                </div>
                <ClipboardCheck className="w-12 h-12 text-primary-100" />
              </div>
              <div className="mt-3 h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary-500 rounded-full transition-all"
                  style={{ width: `${(pcStats.completedItems / pcStats.totalItems) * 100}%` }}
                />
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Pending Requests</p>
                  <p className="text-3xl font-bold text-amber-600">
                    {filteredChangeRequests.length}
                  </p>
                </div>
                <Bell className="w-12 h-12 text-amber-100" />
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Deadline</p>
                  <p className="text-lg font-bold text-red-600">
                    {myInstitution?.accreditationDeadline
                      ? format(new Date(myInstitution.accreditationDeadline), 'MMM d, yyyy')
                      : 'Not set'}
                  </p>
                </div>
                <Clock className="w-12 h-12 text-red-100" />
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Site Visit</p>
                  <p className="text-lg font-bold text-blue-600">
                    {filteredSiteVisits.length > 0
                      ? format(new Date(filteredSiteVisits[0].scheduledDate), 'MMM d, yyyy')
                      : 'Not scheduled'}
                  </p>
                </div>
                <Calendar className="w-12 h-12 text-blue-100" />
              </div>
            </div>
          </div>

          {isLoading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
            </div>
          )}

          {!isLoading && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* My Change Requests */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                <div className="flex items-center justify-between p-6 border-b border-gray-200">
                  <div className="flex items-center gap-2">
                    <Bell className="w-5 h-5 text-amber-500" />
                    <h2 className="font-semibold text-gray-900">
                      My Change Requests
                    </h2>
                  </div>
                </div>
                <div className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
                  {filteredChangeRequests.length === 0 ? (
                    <div className="p-6 text-center text-gray-500">
                      <CheckCircle className="w-12 h-12 mx-auto mb-3 text-green-300" />
                      <p>No pending change requests</p>
                    </div>
                  ) : (
                    filteredChangeRequests.map((cr) => (
                      <div key={cr._id} className="p-4 hover:bg-gray-50">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <span className={`px-2 py-0.5 text-xs font-medium rounded ${
                              cr.type === 'deadline'
                                ? 'bg-purple-100 text-purple-700'
                                : 'bg-blue-100 text-blue-700'
                            }`}>
                              {cr.type === 'deadline' ? 'Deadline Change' : 'Site Visit Change'}
                            </span>
                            <p className="text-sm text-gray-500 mt-1">
                              {cr.currentValue} → {cr.requestedValue}
                            </p>
                            <p className="text-xs text-gray-400 mt-1">
                              {formatDistanceToNow(new Date(cr.createdAt), { addSuffix: true })}
                            </p>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            <div className="flex items-center gap-1">
                              {cr.approvals?.admin?.approved === true ? (
                                <CheckCircle className="w-4 h-4 text-green-500" />
                              ) : cr.approvals?.admin?.approved === false ? (
                                <XCircle className="w-4 h-4 text-red-500" />
                              ) : (
                                <HourglassIcon className="w-4 h-4 text-gray-400" />
                              )}
                              <span className="text-xs text-gray-500">Admin</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* My Site Visits */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                <div className="flex items-center justify-between p-6 border-b border-gray-200">
                  <div className="flex items-center gap-2">
                    <CalendarClock className="w-5 h-5 text-blue-500" />
                    <h2 className="font-semibold text-gray-900">
                      Scheduled Site Visits
                    </h2>
                  </div>
                </div>
                <div className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
                  {filteredSiteVisits.length === 0 ? (
                    <div className="p-6 text-center text-gray-500">
                      <Calendar className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                      <p>No scheduled site visits</p>
                    </div>
                  ) : (
                    filteredSiteVisits.map((sv) => (
                      <div key={sv._id} className="p-4 hover:bg-gray-50">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-medium text-gray-900">
                              {format(new Date(sv.scheduledDate), 'EEEE, MMMM d, yyyy')}
                            </p>
                            {sv.teamMembers && sv.teamMembers.length > 0 && (
                              <div className="flex items-center gap-1 mt-2">
                                <Users className="w-3 h-3 text-gray-400" />
                                <span className="text-xs text-gray-500">
                                  {sv.teamMembers.map((m) => m.userName).join(', ')}
                                </span>
                              </div>
                            )}
                          </div>
                          <span className={`px-2 py-0.5 text-xs font-medium rounded ${
                            sv.status === 'confirmed'
                              ? 'bg-green-100 text-green-700'
                              : sv.status === 'scheduled'
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-gray-100 text-gray-700'
                          }`}>
                            {sv.status}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Admin/Lead Reader/Reader Dashboard
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <LayoutDashboard className="w-8 h-8 text-primary" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
                <p className="text-sm text-gray-500">
                  Monitor submissions, change requests, and site visits
                </p>
              </div>
            </div>
            <button
              onClick={() => window.location.reload()}
              className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Filters */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
          <div className="flex items-center gap-2 mb-4">
            <Filter className="w-5 h-5 text-gray-500" />
            <h2 className="font-semibold text-gray-900">Filters</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {/* Search */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search institutions..."
                value={filters.search}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, search: e.target.value }))
                }
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
              />
            </div>

            {/* Institution Type */}
            <select
              value={filters.institutionType}
              onChange={(e) =>
                setFilters((f) => ({ ...f, institutionType: e.target.value }))
              }
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
            >
              <option value="">All Institution Types</option>
              <option value="university">University</option>
              <option value="college">College</option>
              <option value="community_college">Community College</option>
            </select>

            {/* Institution */}
            <select
              value={filters.institutionId}
              onChange={(e) =>
                setFilters((f) => ({ ...f, institutionId: e.target.value }))
              }
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
            >
              <option value="">All Institutions</option>
              {institutions.map((inst) => (
                <option key={inst._id} value={inst._id}>
                  {inst.name}
                </option>
              ))}
            </select>

            {/* Lead Reader */}
            <select
              value={filters.leadReaderId}
              onChange={(e) =>
                setFilters((f) => ({ ...f, leadReaderId: e.target.value }))
              }
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
            >
              <option value="">All Lead Readers</option>
              {leadReaders.map((user) => (
                <option key={user._id} value={user._id}>
                  {user.firstName} {user.lastName}
                </option>
              ))}
            </select>

            {/* Reader */}
            <select
              value={filters.readerId}
              onChange={(e) =>
                setFilters((f) => ({ ...f, readerId: e.target.value }))
              }
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
            >
              <option value="">All Readers</option>
              {readers.map((user) => (
                <option key={user._id} value={user._id}>
                  {user.firstName} {user.lastName}
                </option>
              ))}
            </select>
          </div>
          {(filters.search ||
            filters.institutionType ||
            filters.institutionId ||
            filters.leadReaderId ||
            filters.readerId) && (
            <button
              onClick={() =>
                setFilters({
                  institutionType: '',
                  institutionId: '',
                  leadReaderId: '',
                  readerId: '',
                  search: '',
                })
              }
              className="mt-4 text-sm text-primary-600 hover:text-primary-700"
            >
              Clear all filters
            </button>
          )}
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Institutions</p>
                <p className="text-3xl font-bold text-gray-900">
                  {stats.totalInstitutions}
                </p>
              </div>
              <Building2 className="w-12 h-12 text-primary-100" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Pending Requests</p>
                <p className="text-3xl font-bold text-amber-600">
                  {stats.pendingChangeRequests}
                </p>
              </div>
              <Bell className="w-12 h-12 text-amber-100" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Deadlines (30 days)</p>
                <p className="text-3xl font-bold text-red-600">
                  {stats.upcomingDeadlines}
                </p>
              </div>
              <Clock className="w-12 h-12 text-red-100" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Site Visits (14 days)</p>
                <p className="text-3xl font-bold text-blue-600">
                  {stats.upcomingSiteVisits}
                </p>
              </div>
              <Calendar className="w-12 h-12 text-blue-100" />
            </div>
          </div>
        </div>

        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
          </div>
        )}

        {!isLoading && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Change Requests */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="flex items-center justify-between p-6 border-b border-gray-200">
                <div className="flex items-center gap-2">
                  <Bell className="w-5 h-5 text-amber-500" />
                  <h2 className="font-semibold text-gray-900">
                    Pending Change Requests
                  </h2>
                </div>
                {filteredChangeRequests.length > 0 && (
                  <span className="px-2 py-1 text-xs font-medium bg-amber-100 text-amber-700 rounded-full">
                    {filteredChangeRequests.length} pending
                  </span>
                )}
              </div>
              <div className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
                {filteredChangeRequests.length === 0 ? (
                  <div className="p-6 text-center text-gray-500">
                    <CheckCircle className="w-12 h-12 mx-auto mb-3 text-green-300" />
                    <p>No pending change requests</p>
                  </div>
                ) : (
                  filteredChangeRequests.map((cr) => (
                    <div
                      key={cr._id}
                      className="p-4 hover:bg-gray-50 cursor-pointer"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span
                              className={`px-2 py-0.5 text-xs font-medium rounded ${
                                cr.type === 'deadline'
                                  ? 'bg-purple-100 text-purple-700'
                                  : 'bg-blue-100 text-blue-700'
                              }`}
                            >
                              {cr.type === 'deadline'
                                ? 'Deadline Change'
                                : 'Site Visit Change'}
                            </span>
                          </div>
                          <p className="font-medium text-gray-900 mt-1">
                            {cr.institutionName ||
                              cr.submissionId?.institutionName}
                          </p>
                          <p className="text-sm text-gray-500 mt-1">
                            {cr.currentValue} → {cr.requestedValue}
                          </p>
                          <p className="text-xs text-gray-400 mt-1">
                            Requested by {cr.requestedByName ||
                              `${cr.requestedBy?.firstName} ${cr.requestedBy?.lastName}`}{' '}
                            {formatDistanceToNow(new Date(cr.createdAt), {
                              addSuffix: true,
                            })}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <div className="flex items-center gap-1">
                            {cr.approvals?.admin?.approved === true ? (
                              <CheckCircle className="w-4 h-4 text-green-500" />
                            ) : cr.approvals?.admin?.approved === false ? (
                              <XCircle className="w-4 h-4 text-red-500" />
                            ) : (
                              <HourglassIcon className="w-4 h-4 text-gray-400" />
                            )}
                            <span className="text-xs text-gray-500">Admin</span>
                          </div>
                          <div className="flex items-center gap-1">
                            {cr.approvals?.leadReader?.approved === true ? (
                              <CheckCircle className="w-4 h-4 text-green-500" />
                            ) : cr.approvals?.leadReader?.approved === false ? (
                              <XCircle className="w-4 h-4 text-red-500" />
                            ) : (
                              <HourglassIcon className="w-4 h-4 text-gray-400" />
                            )}
                            <span className="text-xs text-gray-500">
                              Lead Reader
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
              {filteredChangeRequests.length > 0 && (
                <div className="p-4 border-t border-gray-200">
                  <button className="w-full text-sm text-primary-600 hover:text-primary-700">
                    View all change requests
                  </button>
                </div>
              )}
            </div>

            {/* Upcoming Site Visits */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="flex items-center justify-between p-6 border-b border-gray-200">
                <div className="flex items-center gap-2">
                  <CalendarClock className="w-5 h-5 text-blue-500" />
                  <h2 className="font-semibold text-gray-900">
                    Upcoming Site Visits
                  </h2>
                </div>
                {siteVisits.length > 0 && (
                  <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-700 rounded-full">
                    {siteVisits.length} scheduled
                  </span>
                )}
              </div>
              <div className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
                {siteVisits.length === 0 ? (
                  <div className="p-6 text-center text-gray-500">
                    <Calendar className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                    <p>No upcoming site visits</p>
                  </div>
                ) : (
                  siteVisits.map((sv) => (
                    <div
                      key={sv._id}
                      className="p-4 hover:bg-gray-50 cursor-pointer"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium text-gray-900">
                            {sv.institutionName || sv.institutionId?.name}
                          </p>
                          <p className="text-sm text-gray-500 mt-1">
                            {format(
                              new Date(sv.scheduledDate),
                              'EEEE, MMMM d, yyyy'
                            )}
                          </p>
                          {sv.teamMembers && sv.teamMembers.length > 0 && (
                            <div className="flex items-center gap-1 mt-2">
                              <Users className="w-3 h-3 text-gray-400" />
                              <span className="text-xs text-gray-500">
                                {sv.teamMembers.map((m) => m.userName).join(', ')}
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col items-end">
                          <span
                            className={`px-2 py-0.5 text-xs font-medium rounded ${
                              sv.status === 'confirmed'
                                ? 'bg-green-100 text-green-700'
                                : sv.status === 'scheduled'
                                ? 'bg-blue-100 text-blue-700'
                                : sv.status === 'rescheduled'
                                ? 'bg-amber-100 text-amber-700'
                                : 'bg-gray-100 text-gray-700'
                            }`}
                          >
                            {sv.status}
                          </span>
                          <span className="text-xs text-gray-400 mt-2">
                            {formatDistanceToNow(new Date(sv.scheduledDate), {
                              addSuffix: true,
                            })}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
              {siteVisits.length > 0 && (
                <div className="p-4 border-t border-gray-200">
                  <button className="w-full text-sm text-primary-600 hover:text-primary-700">
                    View all site visits
                  </button>
                </div>
              )}
            </div>

            {/* Institutions with Upcoming Deadlines */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 lg:col-span-2">
              <div className="flex items-center justify-between p-6 border-b border-gray-200">
                <div className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-red-500" />
                  <h2 className="font-semibold text-gray-900">
                    Institutions with Upcoming Deadlines
                  </h2>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Institution
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Type
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Deadline
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Lead Reader
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Readers
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredInstitutions
                      .filter((inst) => inst.accreditationDeadline)
                      .sort(
                        (a, b) =>
                          new Date(a.accreditationDeadline!).getTime() -
                          new Date(b.accreditationDeadline!).getTime()
                      )
                      .slice(0, 10)
                      .map((inst) => {
                        const deadline = new Date(inst.accreditationDeadline!);
                        const daysUntil = Math.ceil(
                          (deadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
                        );
                        const isUrgent = daysUntil <= 14;
                        const isWarning = daysUntil <= 30 && daysUntil > 14;

                        return (
                          <tr key={inst._id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <p className="font-medium text-gray-900">
                                {inst.name}
                              </p>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-700 rounded">
                                {inst.type.replace('_', ' ')}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center gap-2">
                                <span
                                  className={`font-medium ${
                                    isUrgent
                                      ? 'text-red-600'
                                      : isWarning
                                      ? 'text-amber-600'
                                      : 'text-gray-900'
                                  }`}
                                >
                                  {format(deadline, 'MMM d, yyyy')}
                                </span>
                                {isUrgent && (
                                  <AlertTriangle className="w-4 h-4 text-red-500" />
                                )}
                              </div>
                              <p className="text-xs text-gray-500">
                                {daysUntil > 0
                                  ? `${daysUntil} days remaining`
                                  : 'Past due'}
                              </p>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              {inst.assignedLeadReaderId ? (
                                <span className="text-sm text-gray-900">
                                  {inst.assignedLeadReaderId.firstName}{' '}
                                  {inst.assignedLeadReaderId.lastName}
                                </span>
                              ) : (
                                <span className="text-sm text-gray-400">
                                  Not assigned
                                </span>
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              {inst.assignedReaderIds &&
                              inst.assignedReaderIds.length > 0 ? (
                                <span className="text-sm text-gray-900">
                                  {inst.assignedReaderIds
                                    .map((r) => `${r.firstName} ${r.lastName}`)
                                    .join(', ')}
                                </span>
                              ) : (
                                <span className="text-sm text-gray-400">
                                  Not assigned
                                </span>
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <button className="text-primary-600 hover:text-primary-700">
                                <Eye className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
                {filteredInstitutions.filter((inst) => inst.accreditationDeadline)
                  .length === 0 && (
                  <div className="p-8 text-center text-gray-500">
                    <Building2 className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                    <p>No institutions with deadlines match your filters</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Dashboard;
