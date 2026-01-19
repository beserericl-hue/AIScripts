import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
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
  User
} from 'lucide-react';

const Home = () => {
  const [pendingJobs, setPendingJobs] = useState([]);
  const [proposalJobs, setProposalJobs] = useState([]);
  const [selectedJob, setSelectedJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

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
    navigate('/proposal', { state: { job } });
  };

  const handleViewProposal = (job) => {
    navigate('/proposal', { state: { job, viewMode: true } });
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
            <span className="count-badge">{pendingJobs.length}</span>
          </div>

          <div className="jobs-list">
            {pendingJobs.length === 0 ? (
              <div className="empty-state-small">
                <FileText size={32} />
                <p>No pending jobs</p>
              </div>
            ) : (
              pendingJobs.map((job) => (
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
        </div>

        {/* Proposals List */}
        <div className="jobs-list-panel proposals-panel">
          <div className="panel-header">
            <h2>
              <CheckCircle size={20} />
              Proposals
            </h2>
            <span className="count-badge">{proposalJobs.length}</span>
          </div>

          <div className="jobs-list">
            {proposalJobs.length === 0 ? (
              <div className="empty-state-small">
                <FileText size={32} />
                <p>No proposals yet</p>
              </div>
            ) : (
              proposalJobs.map((job) => (
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
              <button
                className="btn-primary"
                onClick={() => handleCreateProposal(selectedJob)}
              >
                <FileText size={18} />
                Create Proposal
              </button>
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
