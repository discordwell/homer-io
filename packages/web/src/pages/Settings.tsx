import { useState } from 'react';
import { OrganizationTab } from '../components/settings/OrganizationTab.js';
import { TeamTab } from '../components/settings/TeamTab.js';
import { ApiKeysTab } from '../components/settings/ApiKeysTab.js';
import { C, F } from '../theme.js';

const tabs = [
  { id: 'organization', label: 'Organization' },
  { id: 'team', label: 'Team' },
  { id: 'api-keys', label: 'API Keys' },
] as const;

type TabId = (typeof tabs)[number]['id'];

export function SettingsPage() {
  const [activeTab, setActiveTab] = useState<TabId>('organization');

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontFamily: F.display, fontSize: 24, marginBottom: 4 }}>Settings</h2>
        <p style={{ color: C.dim, fontSize: 14 }}>Manage your organization, team, and integrations</p>
      </div>

      <div style={{
        display: 'flex', gap: 4, marginBottom: 24,
        borderBottom: `1px solid ${C.border}`, paddingBottom: 0,
      }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '10px 20px',
              borderRadius: '8px 8px 0 0',
              border: 'none',
              borderBottom: activeTab === tab.id ? `2px solid ${C.accent}` : '2px solid transparent',
              background: activeTab === tab.id ? C.bg3 : 'transparent',
              color: activeTab === tab.id ? C.accent : C.dim,
              cursor: 'pointer',
              fontFamily: F.body,
              fontSize: 14,
              fontWeight: activeTab === tab.id ? 600 : 400,
              transition: 'all 0.15s ease',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'organization' && <OrganizationTab />}
      {activeTab === 'team' && <TeamTab />}
      {activeTab === 'api-keys' && <ApiKeysTab />}
    </div>
  );
}
