import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../services/api';
import {
  ExternalLink,
  Star,
  XCircle,
  FileText,
  RefreshCw,
  AlertCircle,
  Clock,
  CheckCircle,
  Trophy,
  XOctagon,
  Send,
  Radar,
  User,
  Lock,
  Ban,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Search,
  X
} from 'lucide-react';

// Date filter options
const DATE_FILTERS = {
  all: 'All',
  today: 'Today',
  thisWeek: 'This Week',
  thisMonth: 'This Month',
  lastMonth: 'Last Month'
};

// Helper function to check if a date falls within a filter range
const isDateInRange = (dateString, filter) => {
  if (filter === 'all') return true;

  const date = new Date(dateString);
  const now = new Date();

  // Reset time to start of day for comparisons
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  switch (filter) {
    case 'today':
      return date >= startOfToday;

    case 'thisWeek': {
      const dayOfWeek = now.getDay();
      const startOfWeek = new Date(startOfToday);
      startOfWeek.setDate(startOfWeek.getDate() - dayOfWeek);
      return date >= startOfWeek;
    }

    case 'thisMonth': {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      return date >= startOfMonth;
    }

    case 'lastMonth': {
      const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      return date >= startOfLastMonth && date < startOfThisMonth;
    }

    default:
      return true;
  }
};

// Helper function to test regex safely
const testRegex = (pattern, text) => {
  if (!pattern) return true;
  try {
    const regex = new RegExp(pattern, 'i');
    return regex.test(text);
  } catch {
    // If regex is invalid, fall back to simple includes
    return text.toLowerCase().includes(pattern.toLowerCase());
  }
};

const ITEMS_PER_PAGE = 10;

// Pagination Component
const Pagination = ({ currentPage, totalPages, onPageChange }) => {
  if (totalPages <= 1) return null;

  const getPageNumbers = () => {
    const pages = [];
    const showEllipsisStart = currentPage > 4;
    const showEllipsisEnd = currentPage < totalPages - 3;

    // Always show page 1
    pages.push(1);

    // Start ellipsis
    if (showEllipsisStart) {
      pages.push('...');
    }

    // Calculate range around current page
    let start = Math.max(2, currentPage - 2);
    let end = Math.min(totalPages - 1, currentPage + 2);

    // Adjust range if near start
    if (currentPage <= 4) {
      start = 2;
      end = Math.min(5, totalPages - 1);
    }

    // Adjust range if near end
    if (currentPage >= totalPages - 3) {
      start = Math.max(2, totalPages - 4);
      end = totalPages - 1;
    }

    for (let i = start; i <= end; i++) {
      if (i > 1 && i < totalPages && !pages.includes(i)) {
        pages.push(i);
      }
    }

    // End ellipsis
    if (showEllipsisEnd && !pages.includes('...', pages.lastIndexOf('...') + 1)) {
      // Check if we need end ellipsis
      const lastNum = pages.filter(p => typeof p === 'number').pop();
      if (lastNum < totalPages - 1) {
        pages.push('...');
      }
    }

    // Always show last page
    if (totalPages > 1 && !pages.includes(totalPages)) {
      pages.push(totalPages);
    }

    return pages;
  };

  return (
    <div className="pagination">
      <button
        className="pagination-btn pagination-first"
        onClick={() => onPageChange(1)}
        disabled={currentPage === 1}
        title="First page"
      >
        <ChevronsLeft size={16} />
      </button>
      <button
        className="pagination-btn pagination-prev"
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        title="Previous page"
      >
        <ChevronLeft size={16} />
      </button>

      <div className="pagination-numbers">
        {getPageNumbers().map((page, index) =>
          page === '...' ? (
            <span key={`ellipsis-${index}`} className="pagination-ellipsis">...</span>
          ) : (
            <button
              key={page}
              className={`pagination-btn pagination-number ${currentPage === page ? 'active' : ''}`}
              onClick={() => onPageChange(page)}
            >
              {page}
            </button>
          )
        )}
      </div>

      <button
        className="pagination-btn pagination-next"
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        title="Next page"
      >
        <ChevronRight size={16} />
      </button>
      <button
        className="pagination-btn pagination-last"
        onClick={() => onPageChange(totalPages)}
        disabled={currentPage === totalPages}
        title="Last page"
      >
        <ChevronsRight size={16} />
      </button>
    </div>
  );
};

const Home = () => {
  const [pendingJobs, setPendingJobs] = useState([]);
  const [proposalJobs, setProposalJobs] = useState([]);
  const [selectedJob, setSelectedJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Search and filter state
  const [pendingSearch, setPendingSearch] = useState('');
  const [proposalsSearch, setProposalsSearch] = useState('');
  const [pendingDateFilter, setPendingDateFilter] = useState('all');
  const [proposalsDateFilter, setProposalsDateFilter] = useState('all');

  // Get page numbers from URL params
  const pendingPage = parseInt(searchParams.get('pendingPage')) || 1;
  const proposalsPage = parseInt(searchParams.get('proposalsPage')) || 1;

  // Filter pending jobs by search and date
  const filteredPendingJobs = useMemo(() => {
    return pendingJobs.filter(job => {
      const matchesSearch = testRegex(pendingSearch, job.title);
      const matchesDate = isDateInRange(job.createdAt, pendingDateFilter);
      return matchesSearch && matchesDate;
    });
  }, [pendingJobs, pendingSearch, pendingDateFilter]);

  // Filter proposal jobs by search and date
  const filteredProposalJobs = useMemo(() => {
    return proposalJobs.filter(job => {
      const matchesSearch = testRegex(proposalsSearch, job.title);
      const matchesDate = isDateInRange(job.updatedAt, proposalsDateFilter);
      return matchesSearch && matchesDate;
    });
  }, [proposalJobs, proposalsSearch, proposalsDateFilter]);

  // Calculate pagination based on filtered data
  const pendingTotalPages = Math.ceil(filteredPendingJobs.length / ITEMS_PER_PAGE);
  const proposalsTotalPages = Math.ceil(filteredProposalJobs.length / ITEMS_PER_PAGE);

  // Get paginated data from filtered results
  const paginatedPendingJobs = filteredPendingJobs.slice(
    (pendingPage - 1) * ITEMS_PER_PAGE,
    pendingPage * ITEMS_PER_PAGE
  );
  const paginatedProposalJobs = filteredProposalJobs.slice(
    (proposalsPage - 1) * ITEMS_PER_PAGE,
    proposalsPage * ITEMS_PER_PAGE
  );

  // Reset to page 1 when search or filter changes
  useEffect(() => {
    if (pendingPage > 1 && pendingPage > pendingTotalPages) {
      setPendingPageParam(1);
    }
  }, [filteredPendingJobs.length]);

  useEffect(() => {
    if (proposalsPage > 1 && proposalsPage > proposalsTotalPages) {
      setProposalsPageParam(1);
    }
  }, [filteredProposalJobs.length]);

  // Update page in URL params
  const setPendingPageParam = (page) => {
    setSearchParams(prev => {
      const newParams = new URLSearchParams(prev);
      newParams.set('pendingPage', page.toString());
      return newParams;
    });
  };

  const setProposalsPageParam = (page) => {
    setSearchParams(prev => {
      const newParams = new URLSearchParams(prev);
      newParams.set('proposalsPage', page.toString());
      return newParams;
    });
  };

  const fetchJobs = useCallback(async () => {
    try {
      setLoading(true);
      const [pendingResponse, proposalResponse] = await Promise.all([
        api.get('/jobs/pending'),
        api.get('/jobs/with-proposals')
      ]);
      setPendingJobs(pendingResponse.data);
      setProposalJobs(proposalResponse.data);
    } catch (err) {
      setError('Failed to fetch jobs');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  // Subscribe to real-time proposal updates via SSE
  useEffect(() => {
    const token = localStorage.getItem('token') || document.cookie.split('token=')[1]?.split(';')[0];
    const baseUrl = import.meta.env.VITE_API_URL || '';
    const eventSource = new EventSource(`${baseUrl}/api/events/proposals?token=${token}`);

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'proposal_updated') {
        // Refresh the jobs list when a proposal is updated
        fetchJobs();
      }
    };

    eventSource.onerror = () => {
      // Silently handle SSE connection errors - will auto-reconnect
      console.log('SSE connection error, will auto-reconnect');
    };

    return () => {
      eventSource.close();
    };
  }, [fetchJobs]);

  const handleJobClick = async (job) => {
    try {
      const response = await api.get(`/jobs/${job._id}`);
      setSelectedJob(response.data);
    } catch (err) {
      setError('Failed to fetch job details');
    }
  };

  const handleReject = async (job, e) => {
    e.stopPropagation();
    try {
      await api.post(`/jobs/${job._id}/reject`);
      // Remove from pending list
      setPendingJobs(prev => prev.filter(j => j._id !== job._id));
      if (selectedJob?._id === job._id) {
        setSelectedJob(null);
      }
    } catch (err) {
      setError('Failed to reject job');
    }
  };

  const handleCreateProposal = (job) => {
    navigate('/proposal', { state: { job, returnParams: searchParams.toString() } });
  };

  const handleViewProposal = (job) => {
    navigate('/proposal', { state: { job, viewMode: true, returnParams: searchParams.toString() } });
  };

  const handleNoBid = async (job) => {
    try {
      await api.post(`/jobs/${job._id}/status`, { status: 'nobid' });
      // Remove from pending list
      setPendingJobs(prev => prev.filter(j => j._id !== job._id));
      if (selectedJob?._id === job._id) {
        setSelectedJob(null);
      }
    } catch (err) {
      setError('Failed to mark job as No Bid');
    }
  };

  const renderStars = (rating) => {
    return (
      <div className="rating-stars">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            size={14}
            className={star <= (rating || 0) ? 'star-filled' : 'star-empty'}
          />
        ))}
      </div>
    );
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'proposal_generated':
        return <FileText size={14} />;
      case 'submitted':
        return <Send size={14} />;
      case 'won':
        return <Trophy size={14} />;
      case 'lost':
        return <XOctagon size={14} />;
      case 'private':
        return <Lock size={14} />;
      default:
        return <Clock size={14} />;
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'proposal_generated':
        return 'Generated';
      case 'submitted':
        return 'Submitted';
      case 'won':
        return 'Won';
      case 'lost':
        return 'Lost';
      case 'private':
        return "Can't Bid";
      default:
        return status;
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="page-container">
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading jobs...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1>Upwork Proposal Generator</h1>
          <p className="subtitle">Manage your job leads and proposals.</p>
        </div>
        <button onClick={fetchJobs} className="btn-secondary">
          <RefreshCw size={18} />
          <span>Refresh</span>
        </button>
      </div>

      {error && (
        <div className="error-banner">
          <AlertCircle size={18} />
          <span>{error}</span>
          <button onClick={() => setError('')}>×</button>
        </div>
      )}

      <div className="home-content home-two-lists">
        {/* Pending Jobs List */}
        <div className="jobs-list-panel">
          <div className="panel-header">
            <h2>
              <Clock size={20} />
              Pending Jobs
            </h2>
            <span className="count-badge">{filteredPendingJobs.length}</span>
          </div>

          {/* Search and Filter Controls */}
          <div className="list-filters">
            <div className="search-box">
              <Search size={16} className="search-icon" />
              <input
                type="text"
                placeholder="Search by title (regex supported)..."
                value={pendingSearch}
                onChange={(e) => setPendingSearch(e.target.value)}
              />
              {pendingSearch && (
                <button
                  className="search-clear"
                  onClick={() => setPendingSearch('')}
                  title="Clear search"
                >
                  <X size={14} />
                </button>
              )}
            </div>
            <div className="date-filter-group">
              {Object.entries(DATE_FILTERS).map(([value, label]) => (
                <label key={value} className="date-filter-option">
                  <input
                    type="radio"
                    name="pendingDateFilter"
                    value={value}
                    checked={pendingDateFilter === value}
                    onChange={(e) => setPendingDateFilter(e.target.value)}
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="jobs-list">
            {filteredPendingJobs.length === 0 ? (
              <div className="empty-state-small">
                <FileText size={32} />
                <p>{pendingJobs.length === 0 ? 'No pending jobs' : 'No jobs match your search/filter'}</p>
              </div>
            ) : (
              paginatedPendingJobs.map((job) => (
                <div
                  key={job._id}
                  className={`job-list-item ${selectedJob?._id === job._id ? 'selected' : ''}`}
                  onClick={() => handleJobClick(job)}
                >
                  <div className="job-item-main">
                    <div className="job-item-title-row">
                      <h4 className="job-item-title">{job.title}</h4>
                      {job.source === 'gigradar' && (
                        <span className="source-badge source-gigradar" title="GigRadar">
                          <Radar size={12} />
                          GigRadar
                        </span>
                      )}
                    </div>
                    <div className="job-item-meta">
                      {job.rating && renderStars(job.rating)}
                      <span className="job-item-date">{formatDate(job.createdAt)}</span>
                    </div>
                  </div>
                  <div className="job-item-actions">
                    <button
                      className="btn-icon btn-reject"
                      onClick={(e) => handleReject(job, e)}
                      title="Reject"
                    >
                      <XCircle size={18} />
                    </button>
                    <button
                      className="btn-icon btn-create"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCreateProposal(job);
                      }}
                      title="Create Proposal"
                    >
                      <FileText size={18} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
          {pendingTotalPages > 1 && (
            <Pagination
              currentPage={pendingPage}
              totalPages={pendingTotalPages}
              onPageChange={setPendingPageParam}
            />
          )}
        </div>

        {/* Proposals List */}
        <div className="jobs-list-panel proposals-panel">
          <div className="panel-header">
            <h2>
              <CheckCircle size={20} />
              Proposals
            </h2>
            <span className="count-badge">{filteredProposalJobs.length}</span>
          </div>

          {/* Search and Filter Controls */}
          <div className="list-filters">
            <div className="search-box">
              <Search size={16} className="search-icon" />
              <input
                type="text"
                placeholder="Search by title (regex supported)..."
                value={proposalsSearch}
                onChange={(e) => setProposalsSearch(e.target.value)}
              />
              {proposalsSearch && (
                <button
                  className="search-clear"
                  onClick={() => setProposalsSearch('')}
                  title="Clear search"
                >
                  <X size={14} />
                </button>
              )}
            </div>
            <div className="date-filter-group">
              {Object.entries(DATE_FILTERS).map(([value, label]) => (
                <label key={value} className="date-filter-option">
                  <input
                    type="radio"
                    name="proposalsDateFilter"
                    value={value}
                    checked={proposalsDateFilter === value}
                    onChange={(e) => setProposalsDateFilter(e.target.value)}
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="jobs-list">
            {filteredProposalJobs.length === 0 ? (
              <div className="empty-state-small">
                <FileText size={32} />
                <p>{proposalJobs.length === 0 ? 'No proposals yet' : 'No proposals match your search/filter'}</p>
              </div>
            ) : (
              paginatedProposalJobs.map((job) => (
                <div
                  key={job._id}
                  className={`job-list-item ${selectedJob?._id === job._id ? 'selected' : ''}`}
                  onClick={() => handleJobClick(job)}
                >
                  <div className="job-item-main">
                    <div className="job-item-title-row">
                      <h4 className="job-item-title">{job.title}</h4>
                      {job.source === 'gigradar' && (
                        <span className="source-badge source-gigradar" title="GigRadar">
                          <Radar size={12} />
                          GigRadar
                        </span>
                      )}
                    </div>
                    <div className="job-item-meta">
                      <span className={`status-badge status-${job.status}`}>
                        {getStatusIcon(job.status)}
                        {getStatusLabel(job.status)}
                      </span>
                      <span className="job-item-date">{formatDate(job.updatedAt)}</span>
                    </div>
                    {job.createdBy?.name && (
                      <div className="job-item-creator">
                        <User size={12} />
                        <span>{job.createdBy.name}</span>
                      </div>
                    )}
                  </div>
                  <div className="job-item-actions">
                    <button
                      className="btn-icon btn-view"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleViewProposal(job);
                      }}
                      title="View Proposal"
                    >
                      <ExternalLink size={18} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
          {proposalsTotalPages > 1 && (
            <Pagination
              currentPage={proposalsPage}
              totalPages={proposalsTotalPages}
              onPageChange={setProposalsPageParam}
            />
          )}
        </div>
      </div>

      {/* Job Detail Preview */}
      {selectedJob && (
        <div className="job-preview-panel">
          <div className="preview-header">
            <h3>{selectedJob.title}</h3>
            {selectedJob.url && (
              <a
                href={selectedJob.url}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-secondary btn-small"
              >
                <ExternalLink size={14} />
                View on Upwork
              </a>
            )}
          </div>
          <div className="preview-content">
            <div className="preview-meta">
              {selectedJob.rating && (
                <div className="meta-item">
                  <span className="meta-label">Rating:</span>
                  {renderStars(selectedJob.rating)}
                </div>
              )}
              <div className="meta-item">
                <span className="meta-label">Status:</span>
                <span className={`status-badge status-${selectedJob.status}`}>
                  {getStatusIcon(selectedJob.status)}
                  {getStatusLabel(selectedJob.status)}
                </span>
              </div>
            </div>
            {selectedJob.description && (
              <div className="preview-description">
                <h4>Description</h4>
                <p>{selectedJob.description}</p>
              </div>
            )}
          </div>
          <div className="preview-actions">
            {selectedJob.status === 'pending' ? (
              <>
                <button
                  className="btn-primary"
                  onClick={() => handleCreateProposal(selectedJob)}
                >
                  <FileText size={18} />
                  Create Proposal
                </button>
                <button
                  className="btn-secondary btn-nobid"
                  onClick={() => handleNoBid(selectedJob)}
                >
                  <Ban size={18} />
                  No Bid
                </button>
              </>
            ) : (
              <button
                className="btn-primary"
                onClick={() => handleViewProposal(selectedJob)}
              >
                <ExternalLink size={18} />
                View Proposal
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Home;
