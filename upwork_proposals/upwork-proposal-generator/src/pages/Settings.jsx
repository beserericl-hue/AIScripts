import { useState, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
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
  RefreshCw
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
    mongodbDatabase: ''
  });

  // API Keys state
  const [apiKeys, setApiKeys] = useState([]);
  const [newKeyName, setNewKeyName] = useState('');
  const [newlyCreatedKey, setNewlyCreatedKey] = useState(null);
  const [copied, setCopied] = useState({});

  // Users state
  const [users, setUsers] = useState([]);
  const [newUser, setNewUser] = useState({ email: '', password: '', name: '', role: 'user' });

  // Password visibility
  const [showPasswords, setShowPasswords] = useState({});

  useEffect(() => {
    fetchSettings();
    fetchApiKeys();
    fetchUsers();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await api.get('/settings');
      setSettings(response.data);
    } catch (err) {
      console.error('Failed to fetch settings:', err);
    }
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
      setNewUser({ email: '', password: '', name: '', role: 'user' });
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
                                title={key.isActive ? 'Deactivate' : 'Activate'}
                              >
                                <RefreshCw size={16} />
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
                        <th>Created</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((u) => (
                        <tr key={u._id}>
                          <td>{u.name}</td>
                          <td>{u.email}</td>
                          <td>
                            <select
                              value={u.role}
                              onChange={(e) => updateUserRole(u._id, e.target.value)}
                              disabled={u._id === user._id}
                              className="role-select"
                            >
                              <option value="user">User</option>
                              <option value="administrator">Administrator</option>
                            </select>
                          </td>
                          <td>{new Date(u.createdAt).toLocaleDateString()}</td>
                          <td>
                            <button
                              onClick={() => deleteUser(u._id)}
                              className="btn-icon danger"
                              disabled={u._id === user._id}
                              title="Delete user"
                            >
                              <Trash2 size={16} />
                            </button>
                          </td>
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
    </div>
  );
};

export default Settings;
