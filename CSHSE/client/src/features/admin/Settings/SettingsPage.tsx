import React, { useState, useMemo } from 'react';
import {
  Settings,
  Webhook,
  Key,
  Users,
  Building2,
  ChevronRight,
  FileText
} from 'lucide-react';
import { useAuthStore } from '../../../store/authStore';
import { WebhookSettings } from '../WebhookSettings';
import { APIKeySettings } from './APIKeySettings';
import { UserManagement } from './UserManagement';
import { InstitutionManagement } from './InstitutionManagement';
import { SpecManagement } from './SpecManagement';

type SettingsSection = 'webhook' | 'api-keys' | 'users' | 'institutions' | 'specs';

interface NavItem {
  id: SettingsSection;
  label: string;
  icon: React.ReactNode;
  description: string;
  // Who can access this section
  access: 'superuser' | 'admin' | 'both';
}

const allNavItems: NavItem[] = [
  {
    id: 'webhook',
    label: 'N8N Webhook',
    icon: <Webhook className="w-5 h-5" />,
    description: 'Configure N8N validation webhook integration',
    access: 'superuser'
  },
  {
    id: 'api-keys',
    label: 'API Keys',
    icon: <Key className="w-5 h-5" />,
    description: 'Manage API keys for webhook callbacks',
    access: 'superuser'
  },
  {
    id: 'users',
    label: 'Users',
    icon: <Users className="w-5 h-5" />,
    description: 'Manage users, roles, and invitations',
    access: 'admin'
  },
  {
    id: 'institutions',
    label: 'Institutions',
    icon: <Building2 className="w-5 h-5" />,
    description: 'Manage colleges and universities',
    access: 'admin'
  },
  {
    id: 'specs',
    label: 'Spec Documents',
    icon: <FileText className="w-5 h-5" />,
    description: 'Manage accreditation spec versions',
    access: 'admin'
  }
];

export function SettingsPage() {
  const { isSuperuser, getEffectiveRole, impersonation, user } = useAuthStore();

  // Determine which sections to show based on user type
  const isActuallySuperuser = isSuperuser(); // SU not impersonating
  const effectiveRole = getEffectiveRole();
  const isImpersonatingAdmin = impersonation.isImpersonating && impersonation.impersonatedRole === 'admin';

  // Filter nav items based on access rules
  const navItems = useMemo(() => {
    return allNavItems.filter(item => {
      if (item.access === 'superuser') {
        // Only actual SU (not impersonating) can see webhook and API keys
        return isActuallySuperuser;
      }
      if (item.access === 'admin') {
        // Admin role or SU impersonating admin can see users/institutions
        // But NOT actual SU (they should use webhook/api-keys)
        return !isActuallySuperuser && (effectiveRole === 'admin' || isImpersonatingAdmin);
      }
      return true;
    });
  }, [isActuallySuperuser, effectiveRole, isImpersonatingAdmin]);

  // Set default active section based on available items
  const defaultSection = navItems[0]?.id || 'webhook';
  const [activeSection, setActiveSection] = useState<SettingsSection>(defaultSection);

  // If active section is not in the available items, switch to the first available
  React.useEffect(() => {
    if (!navItems.find(item => item.id === activeSection)) {
      setActiveSection(navItems[0]?.id || 'webhook');
    }
  }, [navItems, activeSection]);

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
      case 'specs':
        return <SpecManagement />;
      default:
        return null;
    }
  };

  const getHeaderDescription = () => {
    if (isActuallySuperuser) {
      return 'Configure webhook integration and API keys';
    }
    return 'Manage users, institutions, and spec documents';
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center gap-3">
            <Settings className="w-8 h-8 text-primary" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {isActuallySuperuser ? 'Superuser Settings' : 'Admin Settings'}
              </h1>
              <p className="text-sm text-gray-500">
                {getHeaderDescription()}
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
                      ? 'bg-primary-50 border-l-4 border-l-primary'
                      : 'hover:bg-gray-50 border-l-4 border-l-transparent'
                  }`}
                >
                  <div
                    className={`${
                      activeSection === item.id
                        ? 'text-primary'
                        : 'text-gray-400'
                    }`}
                  >
                    {item.icon}
                  </div>
                  <div className="flex-1">
                    <p
                      className={`font-medium ${
                        activeSection === item.id
                          ? 'text-primary-900'
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
                        ? 'text-primary'
                        : 'text-gray-300'
                    }`}
                  />
                </button>
              ))}
            </nav>

            {/* Role indicator */}
            <div className="mt-4 p-4 bg-gray-100 rounded-lg">
              <p className="text-xs text-gray-500 mb-1">Logged in as</p>
              <p className="text-sm font-medium text-gray-900">
                {user?.firstName} {user?.lastName}
              </p>
              <span className={`inline-block mt-1 text-xs px-2 py-0.5 rounded-full ${
                isActuallySuperuser
                  ? 'bg-purple-100 text-purple-700'
                  : 'bg-primary-50 text-primary-700'
              }`}>
                {isActuallySuperuser ? 'Superuser' : effectiveRole?.replace('_', ' ')}
              </span>
            </div>
          </div>

          {/* Content Area */}
          <div className="flex-1">{renderSection()}</div>
        </div>
      </div>
    </div>
  );
}

export default SettingsPage;
