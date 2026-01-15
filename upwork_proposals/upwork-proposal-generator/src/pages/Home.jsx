import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import {
  ChevronDown,
  ExternalLink,
  Star,
  XCircle,
  FileText,
  RefreshCw,
  AlertCircle
} from 'lucide-react';

const Home = () => {
  const [jobs, setJobs] = useState([]);
  const [selectedJob, setSelectedJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const navigate = useNavigate();

  const fetchJobs = async () => {
    try {
      setLoading(true);
      const response = await api.get('/jobs/pending');
      setJobs(response.data);
      if (response.data.length > 0 && !selectedJob) {
        const job = await api.get(`/jobs/${response.data[0]._id}`);
        setSelectedJob(job.data);
      }
    } catch (err) {
      setError('Failed to fetch jobs');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
  }, []);

  const handleJobSelect = async (job) => {
    try {
      const response = await api.get(`/jobs/${job._id}`);
      setSelectedJob(response.data);
      setDropdownOpen(false);
    } catch (err) {
      setError('Failed to fetch job details');
    }
  };

  const handleReject = async () => {
    if (!selectedJob) return;

    try {
      await api.post(`/jobs/${selectedJob._id}/reject`);

      // Find next job
      const currentIndex = jobs.findIndex(j => j._id === selectedJob._id);
      const updatedJobs = jobs.filter(j => j._id !== selectedJob._id);
      setJobs(updatedJobs);

      if (updatedJobs.length > 0) {
        const nextIndex = Math.min(currentIndex, updatedJobs.length - 1);
        const nextJob = await api.get(`/jobs/${updatedJobs[nextIndex]._id}`);
        setSelectedJob(nextJob.data);
      } else {
        setSelectedJob(null);
      }
    } catch (err) {
      setError('Failed to reject job');
    }
  };

  const handleViewProposal = () => {
    if (selectedJob) {
      navigate('/proposal', { state: { job: selectedJob } });
    }
  };

  const renderStars = (rating) => {
    return (
      <div className="rating-stars">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            size={16}
            className={star <= (rating || 0) ? 'star-filled' : 'star-empty'}
          />
        ))}
      </div>
    );
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
          <p className="subtitle">Generate an Upwork Proposal for recommended leads.</p>
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

      <div className="home-content">
        <div className="jobs-panel">
          {/* Job Selector Dropdown */}
          <div className="dropdown-container">
            <label className="dropdown-label">Select Job</label>
            <div className="custom-dropdown">
              <button
                className="dropdown-trigger"
                onClick={() => setDropdownOpen(!dropdownOpen)}
              >
                <span>
                  {selectedJob ? selectedJob.title : 'Select a job...'}
                </span>
                <ChevronDown
                  size={18}
                  className={dropdownOpen ? 'rotated' : ''}
                />
              </button>

              {dropdownOpen && (
                <div className="dropdown-menu">
                  {jobs.length === 0 ? (
                    <div className="dropdown-empty">No pending jobs</div>
                  ) : (
                    jobs.map((job) => (
                      <button
                        key={job._id}
                        className={`dropdown-item ${selectedJob?._id === job._id ? 'selected' : ''}`}
                        onClick={() => handleJobSelect(job)}
                      >
                        <span className="dropdown-item-title">{job.title}</span>
                        {job.rating && renderStars(job.rating)}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Job Details Table */}
          {selectedJob ? (
            <div className="job-details-card">
              <table className="job-details-table">
                <tbody>
                  <tr>
                    <th>Proposal Title</th>
                    <td>{selectedJob.title}</td>
                  </tr>
                  <tr>
                    <th>Proposal Details</th>
                    <td>
                      <div className="description-cell">
                        {selectedJob.description || 'No description available'}
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <th>Live URL</th>
                    <td>
                      {selectedJob.url ? (
                        <a
                          href={selectedJob.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="url-link"
                          onClick={(e) => {
                            e.preventDefault();
                            navigate('/proposal', { state: { job: selectedJob } });
                          }}
                        >
                          <span>{selectedJob.url}</span>
                          <ExternalLink size={14} />
                        </a>
                      ) : (
                        'No URL'
                      )}
                    </td>
                  </tr>
                  <tr>
                    <th>Rating</th>
                    <td>{renderStars(selectedJob.rating)}</td>
                  </tr>
                </tbody>
              </table>

              <div className="job-actions">
                <button onClick={handleReject} className="btn-danger">
                  <XCircle size={18} />
                  <span>Reject Job</span>
                </button>
                <button onClick={handleViewProposal} className="btn-primary">
                  <FileText size={18} />
                  <span>View in Proposal</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="empty-state">
              <FileText size={48} />
              <h3>No Jobs Available</h3>
              <p>There are no pending jobs to review.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Home;
