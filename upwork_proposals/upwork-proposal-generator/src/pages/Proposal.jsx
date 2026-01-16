import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  Send,
  FileText,
  Link,
  Copy,
  Check,
  AlertCircle,
  Loader,
  ExternalLink,
  Code,
  User,
  Save,
  Plus,
  ChevronDown
} from 'lucide-react';

const Proposal = () => {
  const location = useLocation();
  const { user } = useAuth();
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

  // Team members and profile management state
  // Initialize with current user to avoid empty dropdown
  const [teamMembers, setTeamMembers] = useState([user]);
  const [selectedUserId, setSelectedUserId] = useState(user._id);
  const [profiles, setProfiles] = useState([]);
  const [selectedProfileId, setSelectedProfileId] = useState(null);
  const [isCreatingNewProfile, setIsCreatingNewProfile] = useState(false);
  const [newProfileName, setNewProfileName] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  // Initialize on mount - fetch team members and profiles for current user
  useEffect(() => {
    fetchTeamMembers();
    // Also fetch profiles for current user immediately
    fetchUserProfiles(user._id);
  }, []);

  // When team members load, ensure current user is still selected
  useEffect(() => {
    if (teamMembers.length > 0) {
      // Verify the selected user is in the team members list
      const selectedInTeam = teamMembers.find(m => m._id === selectedUserId);
      if (!selectedInTeam) {
        // Default to current logged-in user
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
      // If no team, just show current user
      setTeamMembers([user]);
      setSelectedUserId(user._id);
    }
  };

  const fetchUserProfiles = async (userId) => {
    try {
      const endpoint = userId === user._id ? '/profiles/my' : `/profiles/user/${userId}`;
      const response = await api.get(endpoint);
      setProfiles(response.data);

      // Select the last used profile or first profile
      if (response.data.length > 0) {
        const lastUsed = response.data.find(p => p.isLastUsed);
        setSelectedProfileId(lastUsed?._id || response.data[0]._id);
        setIsCreatingNewProfile(false);
      } else {
        setSelectedProfileId(null);
        // If no profiles exist, start in create mode
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
      // Set as active profile
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

  const saveProfile = async () => {
    // Creating new profile (either explicit or no profiles exist)
    if (isCreatingNewProfile || (profiles.length === 0 && canEditProfile)) {
      if (!newProfileName.trim()) {
        setError('Profile name is required');
        return;
      }
      await createNewProfile();
    } else if (selectedProfileId) {
      await updateExistingProfile();
    }
  };

  // Computed property to determine if we're in "new profile mode"
  const isNewProfileMode = isCreatingNewProfile || (profiles.length === 0 && canEditProfile);

  const createNewProfile = async () => {
    setSavingProfile(true);
    setError('');

    try {
      const response = await api.post('/profiles', {
        name: newProfileName.trim(),
        content: formData.profile
      });

      // Refresh profiles and select the new one
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

      // Refresh profiles
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

  // Check if current user can edit profiles for selected user
  const canEditProfile = selectedUserId === user._id;

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

              {/* Team Member and Profile Selection */}
              <div className="profile-selection-section">
                <h4>
                  <User size={16} />
                  Profile Selection
                </h4>

                {/* Team Member Dropdown */}
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

                  {/* Profile Dropdown or Name Input */}
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
                    {/* Show text input when creating new profile OR when no profiles exist for current user */}
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
                  rows={4}
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
