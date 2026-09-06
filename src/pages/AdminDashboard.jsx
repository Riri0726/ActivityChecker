import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import ExcelUploader from '../components/ExcelUploader.jsx';
import Gradebook from '../components/Gradebook.jsx';
import AppealsManager from '../components/AppealsManager.jsx';
import RequestsManager from '../components/RequestsManager.jsx';
import MakeupManager from '../components/MakeupManager.jsx';
import { getPendingCounts } from '../services/adminService.js';
import './AdminDashboard.css';

const TABS = [
  { id: 'upload',    label: 'Upload',      icon: '📤' },
  { id: 'gradebook', label: 'Gradebook',   icon: '📊' },
  { id: 'appeals',   label: 'Appeals',     icon: '📝', badgeKey: 'pendingAppeals' },
  { id: 'requests',  label: 'Requests',    icon: '📩', badgeKey: 'pendingRequests' },
  { id: 'makeups',   label: 'Makeup Bank', icon: '📦' },
];

export default function AdminDashboard() {
  const { session, signOut } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('upload');
  const [badges, setBadges] = useState({ pendingAppeals: 0, pendingRequests: 0 });
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    loadBadges();
  }, []);

  const loadBadges = async () => {
    try {
      const counts = await getPendingCounts();
      setBadges(counts);
    } catch {
      // silent — badges are non-critical
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/admin');
  };

  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    setSidebarOpen(false);
    if (['appeals', 'requests'].includes(tabId)) {
      loadBadges(); // refresh counts when viewing those tabs
    }
  };

  return (
    <div className="admin-layout">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="sidebar-overlay"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside className={`admin-sidebar ${sidebarOpen ? 'sidebar-open' : ''}`}>
        <div className="sidebar-logo">
          <span aria-hidden="true">🛡️</span>
          <span>Admin Portal</span>
        </div>

        <nav className="sidebar-nav" aria-label="Admin navigation">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              id={`nav-tab-${tab.id}`}
              className={`sidebar-nav-item ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => handleTabChange(tab.id)}
              aria-current={activeTab === tab.id ? 'page' : undefined}
            >
              <span aria-hidden="true">{tab.icon}</span>
              <span>{tab.label}</span>
              {tab.badgeKey && badges[tab.badgeKey] > 0 && (
                <span className="notif-badge" aria-label={`${badges[tab.badgeKey]} pending`}>
                  {badges[tab.badgeKey]}
                </span>
              )}
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="sidebar-user-avatar" aria-hidden="true">
              {session?.user?.email?.[0]?.toUpperCase() ?? '?'}
            </div>
            <div className="sidebar-user-info">
              <div className="sidebar-user-email">{session?.user?.email}</div>
              <div className="text-muted" style={{ fontSize: '0.72rem' }}>Instructor</div>
            </div>
          </div>
          <button
            id="admin-signout-btn"
            className="btn btn-ghost btn-sm w-full"
            style={{ marginTop: 'var(--sp-3)' }}
            onClick={handleSignOut}
          >
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="admin-main">
        {/* Mobile topbar */}
        <div className="admin-topbar">
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open navigation"
            aria-expanded={sidebarOpen}
          >
            ☰
          </button>
          <span className="admin-topbar-title">
            {TABS.find((t) => t.id === activeTab)?.icon}{' '}
            {TABS.find((t) => t.id === activeTab)?.label}
          </span>
        </div>

        <div className="admin-content">
          {activeTab === 'upload'    && <ExcelUploader onUploadSuccess={loadBadges} />}
          {activeTab === 'gradebook' && <Gradebook />}
          {activeTab === 'appeals'   && <AppealsManager onUpdate={loadBadges} />}
          {activeTab === 'requests'  && <RequestsManager onUpdate={loadBadges} />}
          {activeTab === 'makeups'   && <MakeupManager />}
        </div>
      </main>
    </div>
  );
}
