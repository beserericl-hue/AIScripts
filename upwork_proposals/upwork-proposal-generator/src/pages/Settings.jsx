import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import WebhookDebugPopup from '../components/WebhookDebugPopup';
import {
  Save,
  Key,
  Database,
  Webhook,
  Users,
  Trash2,
  Plus,
  Copy,
  Check,
  AlertCircle,
  Eye,
  EyeOff,
  Shield,
  RefreshCw,
  UsersRound,
  UserPlus,
  UserMinus,
  Pencil,
  X,
  FlaskConical
} from 'lucide-react';

const Settings = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('webhooks');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Settings state
  const [settings, setSettings] = useState({
    n8nWebhookUrl: '',
    n8nEvaluationWebhookUrl: '',
    mongodbUrl: '',
    mongodbUser: '',
    mongodbPassword: '',
    mongodbDatabase: '',
    webhookTestMode: false
  });

  // Webhook test mode state
  const [pendingWebhooks, setPendingWebhooks] = useState([]);
  const [selectedWebhookData, setSelectedWebhookData] = useState(null);
  const [showDebugPopup, setShowDebugPopup] = useState(false);

  // API Keys state
  const [apiKeys, setApiKeys] = useState([]);
  const [newKeyName, setNewKeyName] = useState('');
  const [newlyCreatedKey, setNewlyCreatedKey] = useState(null);
  const [copied, setCopied] = useState({});

  // Users state
  const [users, setUsers] = useState([]);
  const [newUser, setNewUser] = useState({ email: '', password: '', name: '', role: 'user', teamId: '' });
  const [editingUser, setEditingUser] = useState(null);
  const [editUserForm, setEditUserForm] = useState({ name: '', email: '', role: 'user', teamId: '' });

  // Teams state
  const [teams, setTeams] = useState([]);
  const [newTeam, setNewTeam] = useState({ name: '', description: '' });
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [teamMembers, setTeamMembers] = useState([]);
  const [unassignedUsers, setUnassignedUsers] = useState([]);

  // Password visibility
  const [showPasswords, setShowPasswords] = useState({});

  useEffect(() => {
    fetchSettings();
    fetchApiKeys();
    fetchUsers();
    fetchTeams();
  }, []);

  // Poll for pending webhooks when test mode is active
  useEffect(() => {
    let pollInterval;
    if (settings.webhookTestMode && apiKeys.length > 0) {
      fetchPendingWebhooks();
      pollInterval = setInterval(fetchPendingWebhooks, 5000);
    }
    return () => {
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [settings.webhookTestMode, apiKeys]);

  useEffect(() => {
    if (selectedTeam) {
      fetchTeamMembers(selectedTeam._id);
    }
  }, [selectedTeam]);

  useEffect(() => {
    // Calculate unassigned users when users or teams change
    const assigned = users.filter(u => u.teamId);
    const unassigned = users.filter(u => !u.teamId);
    setUnassignedUsers(unassigned);
  }, [users]);

  const fetchSettings = async () => {
    try {
      const response = await api.get('/settings');
      setSettings(response.data);
    } catch (err) {
      console.error('Failed to fetch settings:', err);
    }
  };

  const fetchPendingWebhooks = useCallback(async () => {
    if (apiKeys.length === 0) return;

    try {
      // Use the first active API key for authentication
      const activeKey = apiKeys.find(k => k.isActive);
      if (!activeKey) return;

      const response = await api.get('/webhooks/test-data', {
        headers: { 'X-API-Key': activeKey.key }
      });

      if (response.data.data) {
        setPendingWebhooks(response.data.data);

        // Auto-show popup for new webhooks
        if (response.data.data.length > 0 && !showDebugPopup) {
          setSelectedWebhookData(response.data.data[0]);
          setShowDebugPopup(true);
        }
      }
    } catch (err) {
      console.error('Failed to fetch pending webhooks:', err);
    }
  }, [apiKeys, showDebugPopup]);

  const handleConfirmWebhook = async () => {
    if (!selectedWebhookData) return;

    try {
      const activeKey = apiKeys.find(k => k.isActive);
      if (!activeKey) {
        setError('No active API key found');
        return;
      }

      await api.post(`/webhooks/test-data/${selectedWebhookData.jobId}/confirm`, {}, {
        headers: { 'X-API-Key': activeKey.key }
      });

      setSuccess('Webhook data confirmed and saved to database');
      setShowDebugPopup(false);
      setSelectedWebhookData(null);
      fetchPendingWebhooks();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to confirm webhook data');
    }
  };

  const handleDiscardWebhook = async () => {
    if (!selectedWebhookData) return;

    try {
      const activeKey = apiKeys.find(k => k.isActive);
      if (!activeKey) {
        setError('No active API key found');
        return;
      }

      await api.delete(`/webhooks/test-data/${selectedWebhookData.jobId}`, {
        headers: { 'X-API-Key': activeKey.key }
      });

      setSuccess('Webhook data discarded');
      setShowDebugPopup(false);
      setSelectedWebhookData(null);
      fetchPendingWebhooks();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to discard webhook data');
    }
  };

  const handleToggleTestMode = async () => {
    const newTestMode = !settings.webhookTestMode;
    setSettings(prev => ({ ...prev, webhookTestMode: newTestMode }));

    try {
      await api.put('/settings', { ...settings, webhookTestMode: newTestMode });
      if (newTestMode) {
        setSuccess('Webhook test mode enabled - webhooks will NOT save to database');
      } else {
        setSuccess('Webhook test mode disabled - normal operation resumed');
        setPendingWebhooks([]);
      }
    } catch (err) {
      setError('Failed to update test mode setting');
      setSettings(prev => ({ ...prev, webhookTestMode: !newTestMode }));
    }
  };

  const viewPendingWebhook = (webhookData) => {
    setSelectedWebhookData(webhookData);
    setShowDebugPopup(true);
  };

  const fetchApiKeys = async () => {
    try {
      const response = await api.get('/api-keys');
      setApiKeys(response.data);
    } catch (err) {
      console.error('Failed to fetch API keys:', err);
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await api.get('/auth/users');
      setUsers(response.data);
    } catch (err) {
      console.error('Failed to fetch users:', err);
    }
  };

  const fetchTeams = async () => {
    try {
      const response = await api.get('/teams');
      setTeams(response.data);
    } catch (err) {
      console.error('Failed to fetch teams:', err);
    }
  };

  const fetchTeamMembers = async (teamId) => {
    try {
      const response = await api.get(`/teams/${teamId}`);
      setTeamMembers(response.data.members || []);
    } catch (err) {
      console.error('Failed to fetch team members:', err);
    }
  };

  const handleSettingsChange = (e) => {
    const { name, value } = e.target;
    setSettings(prev => ({ ...prev, [name]: value }));
  };

  const saveSettings = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      await api.put('/settings', settings);
      setSuccess('Settings saved successfully');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save settings');
    } finally {
      setLoading(false);
    }
  };

  const generateApiKey = async () => {
    if (!newKeyName.trim()) {
      setError('API key name is required');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await api.post('/api-keys', { name: newKeyName });
      setNewlyCreatedKey(response.data);
      setNewKeyName('');
      fetchApiKeys();
      setSuccess('API key generated! Save it now - it won\'t be shown again.');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to generate API key');
    } finally {
      setLoading(false);
    }
  };

  const toggleApiKey = async (id) => {
    try {
      await api.patch(`/api-keys/${id}/toggle`);
      fetchApiKeys();
    } catch (err) {
      setError('Failed to toggle API key');
    }
  };

  const deleteApiKey = async (id) => {
    if (!confirm('Are you sure you want to delete this API key?')) return;

    try {
      await api.delete(`/api-keys/${id}`);
      fetchApiKeys();
      setSuccess('API key deleted');
    } catch (err) {
      setError('Failed to delete API key');
    }
  };

  const addUser = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await api.post('/auth/register', newUser);
      setNewUser({ email: '', password: '', name: '', role: 'user', teamId: '' });
      fetchUsers();
      setSuccess('User added successfully');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to add user');
    } finally {
      setLoading(false);
    }
  };

  const updateUserRole = async (id, role) => {
    try {
      await api.patch(`/auth/users/${id}/role`, { role });
      fetchUsers();
      setSuccess('User role updated');
    } catch (err) {
      setError('Failed to update user role');
    }
  };

  const deleteUser = async (id) => {
    if (!confirm('Are you sure you want to delete this user?')) return;

    try {
      await api.delete(`/auth/users/${id}`);
      fetchUsers();
      setSuccess('User deleted');
    } catch (err) {
      setError('Failed to delete user');
    }
  };

  const startEditingUser = (u) => {
    setEditingUser(u._id);
    setEditUserForm({
      name: u.name,
      email: u.email,
      role: u.role,
      teamId: u.teamId || ''
    });
  };

  const cancelEditingUser = () => {
    setEditingUser(null);
    setEditUserForm({ name: '', email: '', role: 'user', teamId: '' });
  };

  const saveUserEdit = async (id) => {
    setLoading(true);
    setError('');

    try {
      await api.put(`/auth/users/${id}`, editUserForm);
      setEditingUser(null);
      setEditUserForm({ name: '', email: '', role: 'user', teamId: '' });
      fetchUsers();
      setSuccess('User updated successfully');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update user');
    } finally {
      setLoading(false);
    }
  };

  // Team management functions
  const createTeam = async (e) => {
    e.preventDefault();
    if (!newTeam.name.trim()) {
      setError('Team name is required');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await api.post('/teams', newTeam);
      setNewTeam({ name: '', description: '' });
      fetchTeams();
      setSuccess('Team created successfully');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create team');
    } finally {
      setLoading(false);
    }
  };

  const deleteTeam = async (id) => {
    if (!confirm('Are you sure you want to delete this team? All members must be removed first.')) return;

    try {
      await api.delete(`/teams/${id}`);
      fetchTeams();
      if (selectedTeam?._id === id) {
        setSelectedTeam(null);
        setTeamMembers([]);
      }
      setSuccess('Team deleted');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete team');
    }
  };

  const assignUserToTeam = async (userId) => {
    if (!selectedTeam) {
      setError('Please select a team first');
      return;
    }

    try {
      await api.post(`/teams/${selectedTeam._id}/members`, { userId });
      fetchUsers();
      fetchTeamMembers(selectedTeam._id);
      fetchTeams();
      setSuccess('User assigned to team');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to assign user to team');
    }
  };

  const removeUserFromTeam = async (userId) => {
    if (!selectedTeam) return;

    try {
      await api.delete(`/teams/${selectedTeam._id}/members/${userId}`);
      fetchUsers();
      fetchTeamMembers(selectedTeam._id);
      fetchTeams();
      setSuccess('User removed from team');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to remove user from team');
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

  const tabs = [
    { id: 'webhooks', label: 'Webhooks', icon: Webhook },
    { id: 'apikeys', label: 'API Keys', icon: Key },
    { id: 'database', label: 'Database', icon: Database },
    { id: 'teams', label: 'Teams', icon: UsersRound },
    { id: 'users', label: 'Users', icon: Users }
  ];

  return (
    <div className="page-container settings-page">
      <div className="page-header">
        <h1>Settings</h1>
        <p className="subtitle">Configure your application settings</p>
      </div>

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

      <div className="settings-layout">
        {/* Tabs Navigation */}
        <div className="settings-tabs">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={`tab-button ${activeTab === id ? 'active' : ''}`}
              onClick={() => setActiveTab(id)}
            >
              <Icon size={18} />
              <span>{label}</span>
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="settings-content">
          {/* Webhooks Tab */}
          {activeTab === 'webhooks' && (
            <div className="settings-section">
              <h2>N8N Webhook Configuration</h2>

              {/* Test Mode Toggle */}
              <div className={`test-mode-toggle ${settings.webhookTestMode ? 'active' : ''}`}>
                <FlaskConical size={24} />
                <div className="toggle-info">
                  <h4>Webhook Test Mode</h4>
                  <p>
                    {settings.webhookTestMode
                      ? 'Test mode is ON - Webhook callbacks will be captured but NOT saved to the database'
                      : 'Test mode is OFF - Webhooks operate normally'
                    }
                  </p>
                </div>
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={settings.webhookTestMode}
                    onChange={handleToggleTestMode}
                  />
                  <span className="toggle-slider"></span>
                </label>
              </div>

              {/* Pending Webhooks */}
              {settings.webhookTestMode && pendingWebhooks.length > 0 && (
                <div className="pending-webhooks">
                  <h4>Pending Webhook Data ({pendingWebhooks.length})</h4>
                  {pendingWebhooks.map((webhook) => (
                    <div key={webhook.jobId} className="pending-webhook-item">
                      <div className="webhook-info">
                        <span className="webhook-type">
                          {webhook.type === 'evaluation' ? 'Evaluation Webhook' : 'Proposal Result Webhook'}
                        </span>
                        <span className="webhook-id">Job ID: {webhook.jobId}</span>
                      </div>
                      <span className="webhook-time">
                        {new Date(webhook.timestamp).toLocaleTimeString()}
                      </span>
                      <button
                        onClick={() => viewPendingWebhook(webhook)}
                        className="btn-secondary btn-view"
                      >
                        View
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <form onSubmit={saveSettings}>
                <div className="form-group">
                  <label htmlFor="n8nWebhookUrl">
                    <Webhook size={16} />
                    Proposal Generation Webhook URL
                  </label>
                  <input
                    type="url"
                    id="n8nWebhookUrl"
                    name="n8nWebhookUrl"
                    value={settings.n8nWebhookUrl}
                    onChange={handleSettingsChange}
                    placeholder="https://your-n8n-instance.com/webhook/..."
                  />
                  <small>URL called when generating a new proposal</small>
                </div>

                <div className="form-group">
                  <label htmlFor="n8nEvaluationWebhookUrl">
                    <Webhook size={16} />
                    Proposal Evaluation Webhook URL
                  </label>
                  <input
                    type="url"
                    id="n8nEvaluationWebhookUrl"
                    name="n8nEvaluationWebhookUrl"
                    value={settings.n8nEvaluationWebhookUrl}
                    onChange={handleSettingsChange}
                    placeholder="https://your-n8n-instance.com/webhook/..."
                  />
                  <small>URL called for proposal evaluation</small>
                </div>

                <button type="submit" className="btn-primary" disabled={loading}>
                  <Save size={18} />
                  <span>{loading ? 'Saving...' : 'Save Webhook Settings'}</span>
                </button>
              </form>
            </div>
          )}

          {/* API Keys Tab */}
          {activeTab === 'apikeys' && (
            <div className="settings-section">
              <h2>API Keys</h2>
              <p className="section-description">
                Generate API keys for N8N webhook callbacks
              </p>

              {/* New Key Created Alert */}
              {newlyCreatedKey && (
                <div className="new-key-alert">
                  <Shield size={18} />
                  <div className="new-key-content">
                    <strong>New API Key Created!</strong>
                    <p>Save this key now - it won't be shown again:</p>
                    <div className="key-display">
                      <code>{newlyCreatedKey.key}</code>
                      <button
                        onClick={() => copyToClipboard(newlyCreatedKey.key, 'newKey')}
                        className="btn-icon"
                      >
                        {copied.newKey ? <Check size={16} /> : <Copy size={16} />}
                      </button>
                    </div>
                  </div>
                  <button onClick={() => setNewlyCreatedKey(null)} className="btn-close">×</button>
                </div>
              )}

              {/* Generate New Key Form */}
              <div className="generate-key-form">
                <div className="form-row">
                  <input
                    type="text"
                    value={newKeyName}
                    onChange={(e) => setNewKeyName(e.target.value)}
                    placeholder="API Key Name (e.g., 'N8N Production')"
                  />
                  <button
                    onClick={generateApiKey}
                    className="btn-primary"
                    disabled={loading || !newKeyName.trim()}
                  >
                    <Plus size={18} />
                    <span>Generate Key</span>
                  </button>
                </div>
              </div>

              {/* Existing Keys */}
              <div className="api-keys-list">
                <h3>Existing API Keys</h3>
                {apiKeys.length === 0 ? (
                  <p className="empty-message">No API keys generated yet</p>
                ) : (
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Key</th>
                        <th>Status</th>
                        <th>Last Used</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {apiKeys.map((key) => (
                        <tr key={key._id}>
                          <td>{key.name}</td>
                          <td><code>{key.key}</code></td>
                          <td>
                            <span className={`status-badge ${key.isActive ? 'active' : 'inactive'}`}>
                              {key.isActive ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td>{key.lastUsed ? new Date(key.lastUsed).toLocaleDateString() : 'Never'}</td>
                          <td>
                            <div className="action-buttons">
                              <button
                                onClick={() => toggleApiKey(key._id)}
                                className="btn-icon"
                                title={key.isActive ? 'Click to deactivate this API key' : 'Click to activate this API key'}
                              >
                                {key.isActive ? <EyeOff size={16} /> : <Eye size={16} />}
                              </button>
                              <button
                                onClick={() => deleteApiKey(key._id)}
                                className="btn-icon danger"
                                title="Delete"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {/* Database Tab */}
          {activeTab === 'database' && (
            <div className="settings-section">
              <h2>MongoDB Configuration</h2>
              <form onSubmit={saveSettings}>
                <div className="form-group">
                  <label htmlFor="mongodbUrl">
                    <Database size={16} />
                    MongoDB URL
                  </label>
                  <input
                    type="text"
                    id="mongodbUrl"
                    name="mongodbUrl"
                    value={settings.mongodbUrl}
                    onChange={handleSettingsChange}
                    placeholder="mongodb://localhost:27017"
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="mongodbUser">Username</label>
                    <input
                      type="text"
                      id="mongodbUser"
                      name="mongodbUser"
                      value={settings.mongodbUser}
                      onChange={handleSettingsChange}
                      placeholder="Database username"
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="mongodbPassword">Password</label>
                    <div className="password-input">
                      <input
                        type={showPasswords.mongodb ? 'text' : 'password'}
                        id="mongodbPassword"
                        name="mongodbPassword"
                        value={settings.mongodbPassword}
                        onChange={handleSettingsChange}
                        placeholder="Database password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPasswords(prev => ({ ...prev, mongodb: !prev.mongodb }))}
                        className="btn-icon"
                      >
                        {showPasswords.mongodb ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="mongodbDatabase">Database Name</label>
                  <input
                    type="text"
                    id="mongodbDatabase"
                    name="mongodbDatabase"
                    value={settings.mongodbDatabase}
                    onChange={handleSettingsChange}
                    placeholder="upwork_proposals"
                  />
                </div>

                <button type="submit" className="btn-primary" disabled={loading}>
                  <Save size={18} />
                  <span>{loading ? 'Saving...' : 'Save Database Settings'}</span>
                </button>
              </form>
            </div>
          )}

          {/* Teams Tab */}
          {activeTab === 'teams' && (
            <div className="settings-section">
              <h2>Team Management</h2>
              <p className="section-description">
                Create teams and assign users. Data is filtered by team - users only see their team's jobs.
              </p>

              {/* Create New Team Form */}
              <div className="add-team-form">
                <h3>Create New Team</h3>
                <form onSubmit={createTeam}>
                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="newTeamName">Team Name</label>
                      <input
                        type="text"
                        id="newTeamName"
                        value={newTeam.name}
                        onChange={(e) => setNewTeam({ ...newTeam, name: e.target.value })}
                        placeholder="e.g., Sales Team A"
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label htmlFor="newTeamDescription">Description</label>
                      <input
                        type="text"
                        id="newTeamDescription"
                        value={newTeam.description}
                        onChange={(e) => setNewTeam({ ...newTeam, description: e.target.value })}
                        placeholder="Optional description"
                      />
                    </div>
                  </div>
                  <button type="submit" className="btn-primary" disabled={loading || !newTeam.name.trim()}>
                    <Plus size={18} />
                    <span>Create Team</span>
                  </button>
                </form>
              </div>

              {/* Teams List */}
              <div className="teams-list">
                <h3>Existing Teams</h3>
                {teams.length === 0 ? (
                  <p className="empty-message">No teams created yet</p>
                ) : (
                  <div className="teams-grid">
                    {teams.map((team) => (
                      <div
                        key={team._id}
                        className={`team-card ${selectedTeam?._id === team._id ? 'selected' : ''}`}
                        onClick={() => setSelectedTeam(team)}
                      >
                        <div className="team-card-header">
                          <h4>{team.name}</h4>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteTeam(team._id);
                            }}
                            className="btn-icon danger"
                            title="Delete team"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                        <p className="team-description">{team.description || 'No description'}</p>
                        <div className="team-id-row">
                          <span className="team-id-label">ID:</span>
                          <code className="team-id-value">{team._id}</code>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              navigator.clipboard.writeText(team._id);
                              setSuccess(`Team ID copied: ${team._id}`);
                              setTimeout(() => setSuccess(''), 2000);
                            }}
                            className="btn-icon-small"
                            title="Copy Team ID"
                          >
                            <Copy size={12} />
                          </button>
                        </div>
                        <div className="team-meta">
                          <span className="member-count">
                            <Users size={14} />
                            {team.memberCount || 0} members
                          </span>
                          <span className={`status-badge ${team.isActive ? 'active' : 'inactive'}`}>
                            {team.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Team Members Management */}
              {selectedTeam && (
                <div className="team-members-section">
                  <h3>
                    <UsersRound size={18} />
                    Members of "{selectedTeam.name}"
                  </h3>

                  {/* Current Members */}
                  <div className="current-members">
                    <h4>Current Members</h4>
                    {teamMembers.length === 0 ? (
                      <p className="empty-message">No members in this team</p>
                    ) : (
                      <div className="member-list">
                        {teamMembers.map((member) => (
                          <div key={member._id} className="member-item">
                            <div className="member-info">
                              <span className="member-name">{member.name}</span>
                              <span className="member-email">{member.email}</span>
                              <span className={`role-badge ${member.role}`}>{member.role}</span>
                            </div>
                            <button
                              onClick={() => removeUserFromTeam(member._id)}
                              className="btn-icon danger"
                              title="Remove from team"
                            >
                              <UserMinus size={16} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Add Members */}
                  <div className="add-members">
                    <h4>Add Members</h4>
                    {unassignedUsers.length === 0 ? (
                      <p className="empty-message">All users are assigned to teams</p>
                    ) : (
                      <div className="member-list">
                        {unassignedUsers.map((u) => (
                          <div key={u._id} className="member-item unassigned">
                            <div className="member-info">
                              <span className="member-name">{u.name}</span>
                              <span className="member-email">{u.email}</span>
                              <span className={`role-badge ${u.role}`}>{u.role}</span>
                            </div>
                            <button
                              onClick={() => assignUserToTeam(u._id)}
                              className="btn-icon success"
                              title="Add to team"
                            >
                              <UserPlus size={16} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Users Tab */}
          {activeTab === 'users' && (
            <div className="settings-section">
              <h2>User Management</h2>

              {/* Add New User Form */}
              <div className="add-user-form">
                <h3>Add New User</h3>
                <form onSubmit={addUser}>
                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="newUserName">Name</label>
                      <input
                        type="text"
                        id="newUserName"
                        value={newUser.name}
                        onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                        placeholder="Full name"
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label htmlFor="newUserEmail">Email</label>
                      <input
                        type="email"
                        id="newUserEmail"
                        value={newUser.email}
                        onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                        placeholder="Email address"
                        required
                      />
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="newUserPassword">Password</label>
                      <input
                        type="password"
                        id="newUserPassword"
                        value={newUser.password}
                        onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                        placeholder="Password"
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label htmlFor="newUserRole">Role</label>
                      <select
                        id="newUserRole"
                        value={newUser.role}
                        onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                      >
                        <option value="user">User</option>
                        <option value="administrator">Administrator</option>
                      </select>
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="newUserTeam">Team</label>
                      <select
                        id="newUserTeam"
                        value={newUser.teamId}
                        onChange={(e) => setNewUser({ ...newUser, teamId: e.target.value })}
                      >
                        <option value="">No team</option>
                        {teams.map((t) => (
                          <option key={t._id} value={t._id}>{t.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <button type="submit" className="btn-primary" disabled={loading}>
                    <Plus size={18} />
                    <span>Add User</span>
                  </button>
                </form>
              </div>

              {/* Users List */}
              <div className="users-list">
                <h3>Existing Users</h3>
                {users.length === 0 ? (
                  <p className="empty-message">No users found</p>
                ) : (
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Email</th>
                        <th>Role</th>
                        <th>Team</th>
                        <th>Created</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((u) => (
                        <tr key={u._id}>
                          {editingUser === u._id ? (
                            <>
                              <td>
                                <input
                                  type="text"
                                  value={editUserForm.name}
                                  onChange={(e) => setEditUserForm({ ...editUserForm, name: e.target.value })}
                                  className="edit-input"
                                />
                              </td>
                              <td>
                                <input
                                  type="email"
                                  value={editUserForm.email}
                                  onChange={(e) => setEditUserForm({ ...editUserForm, email: e.target.value })}
                                  className="edit-input"
                                />
                              </td>
                              <td>
                                <select
                                  value={editUserForm.role}
                                  onChange={(e) => setEditUserForm({ ...editUserForm, role: e.target.value })}
                                  className="role-select"
                                  disabled={u._id === user._id}
                                  title={u._id === user._id ? "Cannot change your own role" : ""}
                                >
                                  <option value="user">User</option>
                                  <option value="administrator">Administrator</option>
                                </select>
                              </td>
                              <td>
                                <select
                                  value={editUserForm.teamId}
                                  onChange={(e) => setEditUserForm({ ...editUserForm, teamId: e.target.value })}
                                  className="team-select"
                                >
                                  <option value="">No team</option>
                                  {teams.map((t) => (
                                    <option key={t._id} value={t._id}>{t.name}</option>
                                  ))}
                                </select>
                              </td>
                              <td>{new Date(u.createdAt).toLocaleDateString()}</td>
                              <td>
                                <div className="action-buttons">
                                  <button
                                    onClick={() => saveUserEdit(u._id)}
                                    className="btn-icon success"
                                    disabled={loading}
                                    title="Save changes"
                                  >
                                    <Check size={16} />
                                  </button>
                                  <button
                                    onClick={cancelEditingUser}
                                    className="btn-icon"
                                    title="Cancel"
                                  >
                                    <X size={16} />
                                  </button>
                                </div>
                              </td>
                            </>
                          ) : (
                            <>
                              <td>{u.name}</td>
                              <td>{u.email}</td>
                              <td>
                                <span className={`role-badge ${u.role}`}>{u.role}</span>
                              </td>
                              <td>
                                <span className={u.teamId ? 'team-assigned' : 'team-unassigned'}>
                                  {teams.find(t => t._id === u.teamId)?.name || 'No team'}
                                </span>
                              </td>
                              <td>{new Date(u.createdAt).toLocaleDateString()}</td>
                              <td>
                                <div className="action-buttons">
                                  <button
                                    onClick={() => startEditingUser(u)}
                                    className="btn-icon"
                                    title="Edit user"
                                  >
                                    <Pencil size={16} />
                                  </button>
                                  <button
                                    onClick={() => deleteUser(u._id)}
                                    className="btn-icon danger"
                                    disabled={u._id === user._id}
                                    title={u._id === user._id ? "Cannot delete yourself" : "Delete user"}
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                </div>
                              </td>
                            </>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Webhook Debug Popup */}
      {showDebugPopup && selectedWebhookData && (
        <WebhookDebugPopup
          data={selectedWebhookData}
          onConfirm={handleConfirmWebhook}
          onDiscard={handleDiscardWebhook}
          onClose={() => {
            setShowDebugPopup(false);
            setSelectedWebhookData(null);
          }}
        />
      )}
    </div>
  );
};

export default Settings;
