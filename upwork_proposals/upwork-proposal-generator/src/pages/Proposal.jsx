import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import api from '../services/api';
import {
  Send,
  FileText,
  Link,
  Copy,
  Check,
  AlertCircle,
  Loader,
  ExternalLink,
  Code
} from 'lucide-react';

const Proposal = () => {
  const location = useLocation();
  const initialJob = location.state?.job;

  const [formData, setFormData] = useState({
    title: initialJob?.title || '',
    description: initialJob?.description || '',
    profile: initialJob?.profile || '',
    url: initialJob?.url || ''
  });

  const [jobId, setJobId] = useState(initialJob?.jobId || null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [proposalData, setProposalData] = useState(initialJob?.proposalData || null);
  const [copied, setCopied] = useState({});
  const [iframeUrl, setIframeUrl] = useState(initialJob?.url || '');

  // Polling for proposal results
  useEffect(() => {
    let pollInterval;

    if (jobId && !proposalData) {
      pollInterval = setInterval(async () => {
        try {
          const response = await api.get(`/proposals/${jobId}`);
          if (response.data.proposalData?.coverLetter) {
            setProposalData(response.data.proposalData);
            clearInterval(pollInterval);
          }
        } catch (err) {
          // Silent fail for polling
        }
      }, 5000);
    }

    return () => {
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [jobId, proposalData]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));

    if (name === 'url') {
      setIframeUrl(value);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await api.post('/proposals/generate', {
        ...formData,
        jobId: jobId || `job_${Date.now()}`
      });

      setJobId(response.data.job.jobId);
      setSuccess('Proposal generation initiated! Results will appear below when ready.');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to generate proposal');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async (text, key) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied({ ...copied, [key]: true });
      setTimeout(() => setCopied({ ...copied, [key]: false }), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const characterCount = (text, max) => {
    const count = text?.length || 0;
    return (
      <span className={count > max ? 'char-count-over' : 'char-count'}>
        {count}/{max}
      </span>
    );
  };

  return (
    <div className="page-container proposal-page">
      <div className="proposal-layout">
        {/* Left Side - Iframe */}
        <div className="proposal-iframe-container">
          <div className="iframe-header">
            <h3>Job Preview</h3>
            {iframeUrl && (
              <a
                href={iframeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-icon"
              >
                <ExternalLink size={16} />
              </a>
            )}
          </div>
          <div className="iframe-wrapper">
            {iframeUrl ? (
              <iframe
                src={iframeUrl}
                title="Job Preview"
                sandbox="allow-same-origin allow-scripts"
              />
            ) : (
              <div className="iframe-placeholder">
                <Link size={48} />
                <p>Enter a job URL to preview</p>
              </div>
            )}
          </div>
        </div>

        {/* Right Side - Form and Results */}
        <div className="proposal-form-container">
          {/* Form Section */}
          <div className="form-section">
            <h2>Create Proposal</h2>

            {error && (
              <div className="error-message">
                <AlertCircle size={18} />
                <span>{error}</span>
              </div>
            )}

            {success && (
              <div className="success-message">
                <Check size={18} />
                <span>{success}</span>
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label htmlFor="title">
                  Title of Job
                  {characterCount(formData.title, 4000)}
                </label>
                <input
                  type="text"
                  id="title"
                  name="title"
                  value={formData.title}
                  onChange={handleInputChange}
                  placeholder="Enter job title"
                  maxLength={4000}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="description">
                  Full Description of the Job
                  {characterCount(formData.description, 4000)}
                </label>
                <textarea
                  id="description"
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  placeholder="Enter full job description"
                  maxLength={4000}
                  rows={6}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="profile">
                  Profile
                  {characterCount(formData.profile, 4000)}
                </label>
                <textarea
                  id="profile"
                  name="profile"
                  value={formData.profile}
                  onChange={handleInputChange}
                  placeholder="Enter your profile/expertise"
                  maxLength={4000}
                  rows={4}
                />
              </div>

              <div className="form-group">
                <label htmlFor="url">Job URL</label>
                <input
                  type="url"
                  id="url"
                  name="url"
                  value={formData.url}
                  onChange={handleInputChange}
                  placeholder="https://www.upwork.com/jobs/..."
                />
              </div>

              <button
                type="submit"
                className="btn-primary btn-full"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader size={18} className="spinning" />
                    <span>Generating Proposal...</span>
                  </>
                ) : (
                  <>
                    <Send size={18} />
                    <span>Create Proposal</span>
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Results Section */}
          {proposalData && (
            <div className="results-section">
              <h3>Generated Proposal</h3>

              {/* Doc URL */}
              {proposalData.docUrl && (
                <div className="result-card">
                  <div className="result-header">
                    <FileText size={18} />
                    <span>Word Document</span>
                    <a
                      href={proposalData.docUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-small"
                    >
                      <ExternalLink size={14} />
                      Open
                    </a>
                  </div>
                  <div className="result-content">
                    <code>{proposalData.docUrl}</code>
                  </div>
                </div>
              )}

              {/* Cover Letter */}
              {proposalData.coverLetter && (
                <div className="result-card">
                  <div className="result-header">
                    <FileText size={18} />
                    <span>Cover Letter</span>
                    <button
                      className="btn-small"
                      onClick={() => copyToClipboard(proposalData.coverLetter, 'coverLetter')}
                    >
                      {copied.coverLetter ? <Check size={14} /> : <Copy size={14} />}
                      {copied.coverLetter ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                  <div className="result-content cover-letter">
                    {proposalData.coverLetter}
                  </div>
                </div>
              )}

              {/* Mermaid Diagram */}
              {proposalData.mermaidDiagram && (
                <div className="result-card">
                  <div className="result-header">
                    <Code size={18} />
                    <span>Workflow Diagram (Mermaid)</span>
                    <button
                      className="btn-small"
                      onClick={() => copyToClipboard(proposalData.mermaidDiagram, 'mermaid')}
                    >
                      {copied.mermaid ? <Check size={14} /> : <Copy size={14} />}
                      {copied.mermaid ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                  <div className="result-content mermaid-code">
                    <pre>{proposalData.mermaidDiagram}</pre>
                  </div>
                  {proposalData.mermaidImageUrl && (
                    <div className="mermaid-image">
                      <img
                        src={proposalData.mermaidImageUrl}
                        alt="Workflow Diagram"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Proposal;
