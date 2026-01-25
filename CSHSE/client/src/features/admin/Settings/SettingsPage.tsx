import React, { useState } from 'react';
import {
  Settings,
  Webhook,
  Key,
  Users,
  Building2,
  ChevronRight
} from 'lucide-react';
import { WebhookSettings } from '../WebhookSettings';
import { APIKeySettings } from './APIKeySettings';
import { UserManagement } from './UserManagement';
import { InstitutionManagement } from './InstitutionManagement';

type SettingsSection = 'webhook' | 'api-keys' | 'users' | 'institutions';

interface NavItem {
  id: SettingsSection;
  label: string;
  icon: React.ReactNode;
  description: string;
}

const navItems: NavItem[] = [
  {
    id: 'webhook',
    label: 'N8N Webhook',
    icon: <Webhook className="w-5 h-5" />,
    description: 'Configure N8N validation webhook integration'
  },
  {
    id: 'api-keys',
    label: 'API Keys',
    icon: <Key className="w-5 h-5" />,
    description: 'Manage API keys for webhook callbacks'
  },
  {
    id: 'users',
    label: 'Users',
    icon: <Users className="w-5 h-5" />,
    description: 'Manage users, roles, and invitations'
  },
  {
    id: 'institutions',
    label: 'Institutions',
    icon: <Building2 className="w-5 h-5" />,
    description: 'Manage colleges and universities'
  }
];

export function SettingsPage() {
  const [activeSection, setActiveSection] = useState<SettingsSection>('webhook');

  const renderSection = () => {
    switch (activeSection) {
      case 'webhook':
        return <WebhookSettings />;
      case 'api-keys':
        return <APIKeySettings />;
      case 'users':
        return <UserManagement />;
      case 'institutions':
        return <InstitutionManagement />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center gap-3">
            <Settings className="w-8 h-8 text-gray-600" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Admin Settings</h1>
              <p className="text-sm text-gray-500">
                Configure system settings and manage users
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex gap-8">
          {/* Navigation Sidebar */}
          <div className="w-72 flex-shrink-0">
            <nav className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setActiveSection(item.id)}
                  className={`w-full flex items-center gap-3 px-4 py-4 text-left border-b border-gray-100 last:border-b-0 transition-colors ${
                    activeSection === item.id
                      ? 'bg-teal-50 border-l-4 border-l-teal-600'
                      : 'hover:bg-gray-50 border-l-4 border-l-transparent'
                  }`}
                >
                  <div
                    className={`${
                      activeSection === item.id
                        ? 'text-teal-600'
                        : 'text-gray-400'
                    }`}
                  >
                    {item.icon}
                  </div>
                  <div className="flex-1">
                    <p
                      className={`font-medium ${
                        activeSection === item.id
                          ? 'text-teal-900'
                          : 'text-gray-900'
                      }`}
                    >
                      {item.label}
                    </p>
                    <p className="text-xs text-gray-500">{item.description}</p>
                  </div>
                  <ChevronRight
                    className={`w-4 h-4 ${
                      activeSection === item.id
                        ? 'text-teal-600'
                        : 'text-gray-300'
                    }`}
                  />
                </button>
              ))}
            </nav>
          </div>

          {/* Content Area */}
          <div className="flex-1">{renderSection()}</div>
        </div>
      </div>
    </div>
  );
}

export default SettingsPage;
