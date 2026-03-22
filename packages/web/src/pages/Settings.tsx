import { useState, useMemo } from 'react';
import { OrganizationTab } from '../components/settings/OrganizationTab.js';
import { TeamTab } from '../components/settings/TeamTab.js';
import { ApiKeysTab } from '../components/settings/ApiKeysTab.js';
import { NotificationsTab } from '../components/settings/NotificationsTab.js';
import { CustomerNotificationLog } from '../components/settings/CustomerNotificationLog.js';
import { WebhooksTab } from '../components/settings/WebhooksTab.js';
import { BillingTab } from '../components/settings/BillingTab.js';
import { IntegrationsTab } from '../components/settings/IntegrationsTab.js';
import { PrivacyTab } from '../components/settings/PrivacyTab.js';
import { HealthDashboard } from '../components/settings/HealthDashboard.js';
import { CannabisTab } from '../components/settings/CannabisTab.js';
import { FloristTab } from '../components/settings/FloristTab.js';
import { useSettingsStore } from '../stores/settings.js';
import { C, F } from '../theme.js';

const BASE_TABS = [
  { id: 'organization', label: 'Organization' },
  { id: 'team', label: 'Team' },
  { id: 'billing', label: 'Billing' },
  { id: 'integrations', label: 'Integrations' },
  { id: 'api-keys', label: 'API Keys' },
  { id: 'notifications', label: 'Notifications' },
  { id: 'webhooks', label: 'Webhooks' },
  { id: 'privacy', label: 'Privacy' },
  { id: 'health', label: 'Health' },
] as const;

type TabId = (typeof BASE_TABS)[number]['id'] | 'cannabis' | 'florist';

export function SettingsPage() {
  const [activeTab, setActiveTab] = useState<TabId>('organization');
  const [showLog, setShowLog] = useState(false);
  const { orgSettings } = useSettingsStore();

  const tabs = useMemo(() => {
    const all: Array<{ id: TabId; label: string }> = [...BASE_TABS];
    if (orgSettings?.industry === 'cannabis') {
      // Insert cannabis tab after integrations
      const idx = all.findIndex(t => t.id === 'integrations');
      all.splice(idx + 1, 0, { id: 'cannabis', label: 'Cannabis Compliance' });
    }
    if (orgSettings?.industry === 'florist') {
      // Insert florist tab after integrations
      const idx = all.findIndex(t => t.id === 'integrations');
      all.splice(idx + 1, 0, { id: 'florist', label: 'Florist' });
    }
    return all;
  }, [orgSettings?.industry]);

  // When viewing the notification log, render it full-screen in the tab area
  if (activeTab === 'notifications' && showLog) {
    return (
      <div>
        <div style={{ marginBottom: 24 }}>
          <h2 style={{ fontFamily: F.display, fontSize: 24, marginBottom: 4 }}>Settings</h2>
          <p style={{ color: C.dim, fontSize: 14 }}>Manage your organization, team, and integrations</p>
        </div>
        <CustomerNotificationLog onBack={() => setShowLog(false)} />
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontFamily: F.display, fontSize: 24, marginBottom: 4 }}>Settings</h2>
        <p style={{ color: C.dim, fontSize: 14 }}>Manage your organization, team, and integrations</p>
      </div>

      <div className="settings-tabs" style={{
        display: 'flex', gap: 4, marginBottom: 24,
        borderBottom: `1px solid ${C.border}`, paddingBottom: 0,
        overflowX: 'auto',
      }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => { setActiveTab(tab.id); setShowLog(false); }}
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
              whiteSpace: 'nowrap',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'organization' && <OrganizationTab />}
      {activeTab === 'team' && <TeamTab />}
      {activeTab === 'billing' && <BillingTab />}
      {activeTab === 'integrations' && <IntegrationsTab />}
      {activeTab === 'api-keys' && <ApiKeysTab />}
      {activeTab === 'notifications' && <NotificationsTab onViewLog={() => setShowLog(true)} />}
      {activeTab === 'webhooks' && <WebhooksTab />}
      {activeTab === 'privacy' && <PrivacyTab />}
      {activeTab === 'health' && <HealthDashboard />}
      {activeTab === 'cannabis' && <CannabisTab />}
      {activeTab === 'florist' && <FloristTab />}
    </div>
  );
}
