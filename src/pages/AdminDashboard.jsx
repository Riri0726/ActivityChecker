import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import ExcelUploader from '../components/ExcelUploader.jsx';
import Gradebook from '../components/Gradebook.jsx';
import AppealsManager from '../components/AppealsManager.jsx';
import RequestsManager from '../components/RequestsManager.jsx';
import MakeupTaskManager from '../components/MakeupTaskManager.jsx';
import SubjectManager from '../components/SubjectManager.jsx';
import TeacherManager from '../components/TeacherManager.jsx';
import { getPendingCounts, updateAdminTheme } from '../services/adminService.js';
import DarkModeToggle from '../components/DarkModeToggle.jsx';
import './AdminDashboard.css';

export default function AdminDashboard() {
  const {
    session, signOut, adminProfile, isSuperAdmin, subjects,
    selectedSubjectId, setSelectedSubjectId, refreshAdmin,
    effectiveAdminId, viewAsAdminId, setViewAsAdminId, allAdmins,
  } = useAuth();
  const VALID_TABS = ['upload', 'gradebook', 'appeals', 'requests', 'makeups', 'subjects', 'teachers'];

  const [activeTab, setActiveTab] = useState(() => {
    const hash = window.location.hash.replace('#', '');
    if (VALID_TABS.includes(hash)) return hash;
    const stored = localStorage.getItem('activity_tracker_admin_tab');
    if (VALID_TABS.includes(stored)) return stored;
    return 'upload';
  });

  const [badges, setBadges] = useState({ pendingAppeals: 0, pendingRequests: 0 });
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const TABS = [
    { id: 'upload', label: 'Upload', icon: '📤' },
    { id: 'gradebook', label: 'Gradebook', icon: '📊' },
    { id: 'appeals', label: 'Appeals', icon: '📝', badgeKey: 'pendingAppeals' },
    { id: 'requests', label: 'Make-Up Queue', icon: '📩', badgeKey: 'pendingRequests' },
    { id: 'makeups', label: 'Make-Up Tasks', icon: '📂' },
    { id: 'subjects', label: 'My Subjects', icon: '📚' },
    ...(isSuperAdmin ? [{ id: 'teachers', label: 'Instructors (Super)', icon: '👥' }] : []),
  ];

  const loadBadges = async () => {
    try {
      const counts = await getPendingCounts(effectiveAdminId);
      setBadges(counts);
    } catch {
      // Non-critical badge count
    }
  };

  useEffect(() => {
    if (effectiveAdminId) {
      loadBadges();
    }
  }, [effectiveAdminId]);

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '');
      if (VALID_TABS.includes(hash)) {
        setActiveTab(hash);
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const handleSignOut = async () => {
    await signOut();
    navigate('/admin');
  };

  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    localStorage.setItem('activity_tracker_admin_tab', tabId);
    window.location.hash = tabId;
    setSidebarOpen(false);
    if (['appeals', 'requests'].includes(tabId)) {
      loadBadges();
    }
  };

  const activeSubject = subjects.find((s) => s.id === selectedSubjectId);

  // Determine the "View as" label for the banner
  const viewAsAdmin = viewAsAdminId ? allAdmins.find((a) => a.id === viewAsAdminId) : null;

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
          <span>Faculty Portal</span>
        </div>

        {/* View As Teacher (Super Admin Only) */}
        {isSuperAdmin && allAdmins.length > 1 && (
          <div style={{ padding: '0 var(--sp-3)', marginBottom: 'var(--sp-3)' }}>
            <label style={{ fontSize: '0.72rem', color: '#fbbf24', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '4px', fontWeight: 600 }}>
              👁️ View As Teacher
            </label>
            <select
              className="form-input"
              style={{
                fontSize: '0.8rem',
                padding: '6px 8px',
                background: viewAsAdminId ? 'rgba(251,191,36,0.15)' : 'rgba(255,255,255,0.08)',
                color: '#fff',
                borderColor: viewAsAdminId ? 'rgba(251,191,36,0.4)' : 'rgba(255,255,255,0.15)',
                width: '100%',
              }}
              value={viewAsAdminId || ''}
              onChange={(e) => setViewAsAdminId(e.target.value || null)}
            >
              <option value="" style={{ color: '#000' }}>
                My Own Data
              </option>
              {allAdmins
                .filter((a) => a.id !== adminProfile?.id)
                .map((a) => (
                  <option key={a.id} value={a.id} style={{ color: '#000' }}>
                    {a.full_name} ({a.email}) {a.role === 'super_admin' ? '⭐' : ''}
                  </option>
                ))}
            </select>
          </div>
        )}

        {/* Active Subject Switcher */}
        {subjects.length > 0 && (
          <div style={{ padding: '0 var(--sp-3)', marginBottom: 'var(--sp-4)' }}>
            <label style={{ fontSize: '0.72rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '4px', fontWeight: 600 }}>
              Active Course
            </label>
            <select
              className="form-input"
              style={{
                fontSize: '0.8rem',
                padding: '6px 8px',
                background: 'rgba(255,255,255,0.08)',
                color: '#fff',
                borderColor: 'rgba(255,255,255,0.15)',
                width: '100%',
              }}
              value={selectedSubjectId}
              onChange={(e) => setSelectedSubjectId(e.target.value)}
            >
              <option value="" style={{ color: '#000' }}>All Courses / Global</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id} style={{ color: '#000' }}>
                  {s.code} - {s.name}
                </option>
              ))}
            </select>
          </div>
        )}

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
          {/* Theme Picker */}
          <div style={{ padding: '0 0 var(--sp-3)', borderBottom: '1px solid rgba(255,255,255,0.08)', marginBottom: 'var(--sp-3)' }}>
            <div style={{ fontSize: '0.72rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px', fontWeight: 600 }}>
              Theme
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              {[
                { id: 'blue', color: '#4f6ef7', label: 'Blue' },
                { id: 'black', color: '#334155', label: 'Black' },
                { id: 'purple', color: '#7c3aed', label: 'Purple' },
                { id: 'green', color: '#059669', label: 'Green' },
              ].map((t) => (
                <button
                  key={t.id}
                  title={t.label}
                  onClick={async () => {
                    if (adminProfile?.id) {
                      document.documentElement.setAttribute('data-theme', t.id);
                      try {
                        await updateAdminTheme(adminProfile.id, t.id);
                        await refreshAdmin();
                      } catch (e) {
                        console.warn('Theme update failed:', e);
                      }
                    }
                  }}
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '50%',
                    background: t.color,
                    border: (adminProfile?.theme || 'blue') === t.id ? '3px solid #fff' : '2px solid rgba(255,255,255,0.2)',
                    cursor: 'pointer',
                    transition: 'transform 0.15s ease, border 0.15s ease',
                    transform: (adminProfile?.theme || 'blue') === t.id ? 'scale(1.15)' : 'scale(1)',
                    boxShadow: (adminProfile?.theme || 'blue') === t.id ? `0 0 8px ${t.color}88` : 'none',
                  }}
                  aria-label={`Set theme to ${t.label}`}
                />
              ))}
            </div>
          </div>

          {/* Dark Mode Toggle Switch */}
          <DarkModeToggle variant="switch" />

          <div className="sidebar-user">
            <div className="sidebar-user-avatar" aria-hidden="true">
              {adminProfile?.full_name?.[0] || session?.user?.email?.[0]?.toUpperCase() || 'A'}
            </div>
            <div className="sidebar-user-info">
              <div className="sidebar-user-email">
                {adminProfile?.full_name || session?.user?.email}
              </div>
              <div style={{ fontSize: '0.72rem', color: isSuperAdmin ? '#a5b4fc' : '#94a3b8', fontWeight: 600 }}>
                {isSuperAdmin ? '⭐ Super-Admin' : 'Instructor'}
              </div>
            </div>
          </div>
          <button
            id="admin-logout-btn"
            className="btn btn-ghost btn-sm w-full"
            style={{ marginTop: 'var(--sp-2)', color: '#94a3b8' }}
            onClick={handleSignOut}
          >
            Sign Out
          </button>
          <div style={{ textAlign: 'center', marginTop: '12px', fontSize: '0.72rem', color: '#64748b', letterSpacing: '0.05em' }}>
            ActivityChecker v0.9.0
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="admin-main">
        {/* Top bar on mobile/desktop */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--sp-4)', flexWrap: 'wrap', gap: '8px' }}>
          <button
            className="btn btn-ghost mobile-menu-btn"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open sidebar"
          >
            ☰ Menu
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            {viewAsAdmin && (
              <div style={{
                fontSize: '0.82rem',
                background: '#fef3c7',
                color: '#b45309',
                padding: '4px 12px',
                borderRadius: '6px',
                fontWeight: 600,
                border: '1px solid #fbbf24',
              }}>
                👁️ Viewing as: {viewAsAdmin.full_name}
              </div>
            )}
            {activeSubject && (
              <div style={{ fontSize: '0.85rem', color: 'var(--color-primary)', fontWeight: 600 }}>
                Viewing: {activeSubject.code} — {activeSubject.name}
              </div>
            )}
          </div>
        </div>

        {activeTab === 'upload' && <ExcelUploader onUploadSuccess={loadBadges} />}
        {activeTab === 'gradebook' && <Gradebook />}
        {activeTab === 'appeals' && <AppealsManager onUpdate={loadBadges} />}
        {activeTab === 'requests' && <RequestsManager onUpdate={loadBadges} />}
        {activeTab === 'makeups' && <MakeupTaskManager />}
        {activeTab === 'subjects' && <SubjectManager />}
        {activeTab === 'teachers' && isSuperAdmin && <TeacherManager />}
      </main>
    </div>
  );
}
