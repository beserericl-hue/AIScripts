import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  Send,
  FileText,
  Copy,
  Check,
  AlertCircle,
  Loader,
  ExternalLink,
  Code,
  User,
  Save,
  Plus,
  ChevronDown,
  Trophy,
  XOctagon,
  ArrowLeft,
  Link,
  Star,
  MapPin,
  Briefcase,
  DollarSign,
  Tag
} from 'lucide-react';

const Proposal = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const initialJob = location.state?.job;

  // Form data for creating proposal
  const [formData, setFormData] = useState({
    title: initialJob?.title || '',
    description: initialJob?.description || '',
    profile: initialJob?.profile || '',
    url: initialJob?.url || ''
  });

  const [jobId, setJobId] = useState(initialJob?.jobId || null);
  const [mongoId, setMongoId] = useState(initialJob?._id || null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [proposalData, setProposalData] = useState(initialJob?.proposalData || null);
  const [copied, setCopied] = useState({});
  const [currentStatus, setCurrentStatus] = useState(initialJob?.status || 'pending');
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // Team members and profile management state
  const [teamMembers, setTeamMembers] = useState([user]);
  const [selectedUserId, setSelectedUserId] = useState(user._id);
  const [profiles, setProfiles] = useState([]);
  const [selectedProfileId, setSelectedProfileId] = useState(null);
  const [isCreatingNewProfile, setIsCreatingNewProfile] = useState(false);
  const [newProfileName, setNewProfileName] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  // Initialize on mount
  useEffect(() => {
    fetchTeamMembers();
    fetchUserProfiles(user._id);
  }, []);

  // When team members load, ensure current user is still selected
  useEffect(() => {
    if (teamMembers.length > 0) {
      const selectedInTeam = teamMembers.find(m => m._id === selectedUserId);
      if (!selectedInTeam) {
        const currentUserInTeam = teamMembers.find(m => m._id === user._id);
        if (currentUserInTeam) {
          setSelectedUserId(currentUserInTeam._id);
        } else {
          setSelectedUserId(teamMembers[0]._id);
        }
      }
    }
  }, [teamMembers, user._id]);

  // Fetch profiles when selected user changes
  useEffect(() => {
    if (selectedUserId) {
      fetchUserProfiles(selectedUserId);
    }
  }, [selectedUserId]);

  // Update form profile when profile selection changes
  useEffect(() => {
    if (selectedProfileId && profiles.length > 0) {
      const selectedProfile = profiles.find(p => p._id === selectedProfileId);
      if (selectedProfile) {
        setFormData(prev => ({ ...prev, profile: selectedProfile.content }));
      }
    }
  }, [selectedProfileId, profiles]);

  const fetchTeamMembers = async () => {
    try {
      const response = await api.get('/teams/my/members');
      setTeamMembers(response.data);
    } catch (err) {
      console.error('Failed to fetch team members:', err);
      setTeamMembers([user]);
      setSelectedUserId(user._id);
    }
  };

  const fetchUserProfiles = async (userId) => {
    try {
      const endpoint = userId === user._id ? '/profiles/my' : `/profiles/user/${userId}`;
      const response = await api.get(endpoint);
      setProfiles(response.data);

      if (response.data.length > 0) {
        const lastUsed = response.data.find(p => p.isLastUsed);
        setSelectedProfileId(lastUsed?._id || response.data[0]._id);
        setIsCreatingNewProfile(false);
      } else {
        setSelectedProfileId(null);
        if (userId === user._id) {
          setIsCreatingNewProfile(true);
        }
      }
    } catch (err) {
      console.error('Failed to fetch profiles:', err);
      setProfiles([]);
      setSelectedProfileId(null);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleUserChange = (e) => {
    const newUserId = e.target.value;
    setSelectedUserId(newUserId);
    setIsCreatingNewProfile(false);
    setNewProfileName('');
  };

  const handleProfileChange = (e) => {
    const profileId = e.target.value;
    if (profileId === 'new') {
      setIsCreatingNewProfile(true);
      setNewProfileName('');
      setFormData(prev => ({ ...prev, profile: '' }));
    } else {
      setSelectedProfileId(profileId);
      setIsCreatingNewProfile(false);
      setProfileAsActive(profileId);
    }
  };

  const setProfileAsActive = async (profileId) => {
    try {
      await api.post(`/profiles/${profileId}/set-active`);
    } catch (err) {
      console.error('Failed to set active profile:', err);
    }
  };

  const handleNewProfile = () => {
    setIsCreatingNewProfile(true);
    setNewProfileName('');
    setFormData(prev => ({ ...prev, profile: '' }));
  };

  const canEditProfile = selectedUserId === user?._id;
  const isNewProfileMode = isCreatingNewProfile || (profiles.length === 0 && canEditProfile);

  const saveProfile = async () => {
    if (isNewProfileMode) {
      if (!newProfileName.trim()) {
        setError('Profile name is required');
        return;
      }
      await createNewProfile();
    } else if (selectedProfileId) {
      await updateExistingProfile();
    }
  };

  const createNewProfile = async () => {
    setSavingProfile(true);
    setError('');

    try {
      const response = await api.post('/profiles', {
        name: newProfileName.trim(),
        content: formData.profile
      });

      await fetchUserProfiles(user._id);
      setSelectedProfileId(response.data._id);
      setIsCreatingNewProfile(false);
      setNewProfileName('');
      setSuccess('Profile created successfully');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create profile');
    } finally {
      setSavingProfile(false);
    }
  };

  const updateExistingProfile = async () => {
    setSavingProfile(true);
    setError('');

    try {
      const currentProfile = profiles.find(p => p._id === selectedProfileId);
      await api.put(`/profiles/${selectedProfileId}`, {
        name: currentProfile?.name,
        content: formData.profile
      });

      await fetchUserProfiles(selectedUserId);
      setSuccess('Profile saved successfully');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save profile');
    } finally {
      setSavingProfile(false);
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
        jobId: jobId || `job_${Date.now()}`,
        profileId: selectedProfileId
      });

      setJobId(response.data.job.jobId);
      setMongoId(response.data.job._id);
      setCurrentStatus('pending');
      setSuccess('Proposal generation initiated! The job has been sent to N8N for processing.');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to generate proposal');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (newStatus) => {
    if (!mongoId) return;

    setUpdatingStatus(true);
    setError('');

    try {
      await api.post(`/jobs/${mongoId}/status`, { status: newStatus });
      setCurrentStatus(newStatus);
      setSuccess(`Status updated to ${getStatusLabel(newStatus)}`);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update status');
    } finally {
      setUpdatingStatus(false);
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
      case 'pending':
        return 'Pending';
      default:
        return status;
    }
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
        return <FileText size={14} />;
    }
  };

  // Check if we have proposal data to show
  const hasProposal = proposalData && (proposalData.coverLetter || proposalData.docUrl || proposalData.mermaidDiagram);

  return (
    <div className="page-container proposal-page">
      {/* Back button */}
      <button className="btn-back" onClick={() => navigate('/')}>
        <ArrowLeft size={18} />
        Back to Dashboard
      </button>

      {error && (
        <div className="error-message">
          <AlertCircle size={18} />
          <span>{error}</span>
          <button onClick={() => setError('')}>×</button>
        </div>
      )}

      {success && (
        <div className="success-message">
          <Check size={18} />
          <span>{success}</span>
          <button onClick={() => setSuccess('')}>×</button>
        </div>
      )}

      <div className="proposal-layout proposal-two-column">
        {/* Left Side - Create Proposal Form */}
        <div className="proposal-form-panel">
          <div className="panel-card">
            <h2>Create Proposal</h2>

            <form onSubmit={handleSubmit}>
              {/* Job Reference Fields - Always show with N/A for missing data */}
              <div className="job-reference-section">
                {/* Score and Score Reason */}
                <div className="score-section">
                  <div className="score-display">
                    <Star size={14} className="score-icon" />
                    <span className="score-label">Score</span>
                    <span className={`score-value ${!(initialJob?.evaluationData?.scoreValue || initialJob?.rating) ? 'empty' : ''}`}>
                      {(initialJob?.evaluationData?.scoreValue || initialJob?.rating)
                        ? `${initialJob?.evaluationData?.scoreValue || initialJob?.rating} / 10`
                        : 'N/A'}
                    </span>
                  </div>
                  <div className="score-reason">
                    <label>Score Reason</label>
                    <p>{initialJob?.evaluationData?.scoreReasoning || 'No score reasoning available'}</p>
                  </div>
                </div>

                {/* Job Meta Fields */}
                <div className="job-meta-fields">
                  <div className="meta-field">
                    <Briefcase size={14} />
                    <span className="meta-label">Job Type</span>
                    <span className="meta-value">{initialJob?.evaluationData?.jobType || 'N/A'}</span>
                  </div>
                  <div className="meta-field">
                    <DollarSign size={14} />
                    <span className="meta-label">Price</span>
                    <span className="meta-value">{initialJob?.evaluationData?.price || 'N/A'}</span>
                  </div>
                  <div className="meta-field">
                    <MapPin size={14} />
                    <span className="meta-label">Country</span>
                    <span className="meta-value">{initialJob?.evaluationData?.country || 'N/A'}</span>
                  </div>
                </div>

                {/* Skills Tags */}
                <div className="skills-section">
                  <label>
                    <Tag size={14} />
                    Skills
                  </label>
                  <div className="skills-tags">
                    {initialJob?.evaluationData?.tags && initialJob.evaluationData.tags.length > 0 ? (
                      initialJob.evaluationData.tags.map((tag, index) => (
                        <span key={index} className="skill-tag">{tag}</span>
                      ))
                    ) : (
                      <span className="skill-tag empty">No skills specified</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Title */}
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
                />
              </div>

              {/* Description */}
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
                />
              </div>

              {/* Team Member and Profile Selection */}
              <div className="profile-selection-section">
                <h4>
                  <User size={16} />
                  Profile Selection
                </h4>

                <div className="form-row profile-dropdowns">
                  <div className="form-group">
                    <label htmlFor="teamMember">Team Member</label>
                    <div className="select-wrapper">
                      <select
                        id="teamMember"
                        value={selectedUserId || ''}
                        onChange={handleUserChange}
                      >
                        {teamMembers.map((member) => (
                          <option key={member._id} value={member._id}>
                            {member.name} {member._id === user._id ? '(You)' : ''}
                          </option>
                        ))}
                      </select>
                      <ChevronDown size={16} className="select-icon" />
                    </div>
                  </div>

                  <div className="form-group">
                    <label htmlFor="profileSelect">
                      Profile Name
                      {canEditProfile && !isCreatingNewProfile && profiles.length > 0 && (
                        <button
                          type="button"
                          className="btn-link"
                          onClick={handleNewProfile}
                        >
                          <Plus size={14} />
                          New Profile
                        </button>
                      )}
                    </label>
                    {(isCreatingNewProfile || (profiles.length === 0 && canEditProfile)) ? (
                      <input
                        type="text"
                        id="newProfileName"
                        value={newProfileName}
                        onChange={(e) => setNewProfileName(e.target.value)}
                        placeholder="Enter profile name"
                      />
                    ) : profiles.length === 0 ? (
                      <div className="select-wrapper">
                        <select id="profileSelect" disabled>
                          <option value="">No profiles available</option>
                        </select>
                        <ChevronDown size={16} className="select-icon" />
                      </div>
                    ) : (
                      <div className="select-wrapper">
                        <select
                          id="profileSelect"
                          value={selectedProfileId || ''}
                          onChange={handleProfileChange}
                        >
                          {profiles.map((profile) => (
                            <option key={profile._id} value={profile._id}>
                              {profile.name} {profile.isLastUsed ? '(Current)' : ''}
                            </option>
                          ))}
                          {canEditProfile && (
                            <option value="new">+ Create New Profile</option>
                          )}
                        </select>
                        <ChevronDown size={16} className="select-icon" />
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Profile Content */}
              <div className="form-group profile-content-group">
                <label htmlFor="profile">
                  Profile Content
                  {characterCount(formData.profile, 4000)}
                </label>
                <textarea
                  id="profile"
                  name="profile"
                  value={formData.profile}
                  onChange={handleInputChange}
                  placeholder="Enter your profile/expertise"
                  maxLength={4000}
                  rows={6}
                  disabled={!canEditProfile && !isNewProfileMode}
                />
                {canEditProfile && (
                  <button
                    type="button"
                    className="btn-secondary btn-save-profile"
                    onClick={saveProfile}
                    disabled={savingProfile || (!isNewProfileMode && !selectedProfileId)}
                  >
                    {savingProfile ? (
                      <>
                        <Loader size={14} className="spinning" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <>
                        <Save size={14} />
                        <span>{isNewProfileMode ? 'Create Profile' : 'Save Profile'}</span>
                      </>
                    )}
                  </button>
                )}
              </div>

              {/* Job URL */}
              <div className="form-group">
                <label htmlFor="url">
                  <Link size={14} />
                  Job URL
                </label>
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
                    <span>Creating Proposal...</span>
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
        </div>

        {/* Right Side - Generated Proposal Results */}
        <div className="proposal-results-panel">
          <div className="panel-card">
            <div className="panel-header">
              <h2>Generated Proposal</h2>
              {mongoId && currentStatus && (
                <span className={`status-badge status-${currentStatus}`}>
                  {getStatusIcon(currentStatus)}
                  {getStatusLabel(currentStatus)}
                </span>
              )}
            </div>

            {hasProposal ? (
              <div className="results-content">
                {/* Status Change Buttons */}
                {mongoId && (
                  <div className="status-actions">
                    <label>Update Status</label>
                    <div className="status-buttons">
                      <button
                        className={`btn-status btn-submitted ${currentStatus === 'submitted' ? 'active' : ''}`}
                        onClick={() => handleStatusChange('submitted')}
                        disabled={updatingStatus}
                      >
                        <Send size={14} />
                        Submitted
                      </button>
                      <button
                        className={`btn-status btn-won ${currentStatus === 'won' ? 'active' : ''}`}
                        onClick={() => handleStatusChange('won')}
                        disabled={updatingStatus}
                      >
                        <Trophy size={14} />
                        Won
                      </button>
                      <button
                        className={`btn-status btn-lost ${currentStatus === 'lost' ? 'active' : ''}`}
                        onClick={() => handleStatusChange('lost')}
                        disabled={updatingStatus}
                      >
                        <XOctagon size={14} />
                        Lost
                      </button>
                    </div>
                  </div>
                )}

                {/* Doc URL */}
                {proposalData.docUrl && (
                  <div className="result-card">
                    <div className="result-header">
                      <FileText size={18} />
                      <span>Google Document</span>
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
            ) : (
              <div className="no-proposal-placeholder">
                <FileText size={48} className="placeholder-icon" />
                <h3>No Proposal Generated Yet</h3>
                <p>Fill out the form and click "Create Proposal" to generate your proposal.</p>
                <p className="hint">The generated cover letter, document link, and workflow diagram will appear here.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Proposal;
