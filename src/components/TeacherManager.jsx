import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { getAdmins, updateAdminRole, deleteAdmin, createAdminAccount } from '../services/adminService.js';

export default function TeacherManager() {
  const { adminProfile, isSuperAdmin } = useAuth();
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Create new instructor form state
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createForm, setCreateForm] = useState({ fullName: '', email: '', role: 'teacher', tempPassword: '' });
  const [createLoading, setCreateLoading] = useState(false);
  const [createdCredentials, setCreatedCredentials] = useState(null); // { email, tempPassword }

  const loadAdmins = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getAdmins();
      setAdmins(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isSuperAdmin) {
      loadAdmins();
    }
  }, [isSuperAdmin]);

  if (!isSuperAdmin) {
    return (
      <div style={{ padding: 'var(--sp-6)', textAlign: 'center' }}>
        <p style={{ color: '#dc2626', fontWeight: 600 }}>
          Access restricted: Super-Admin privileges are required to access this panel.
        </p>
      </div>
    );
  }

  const handleRoleChange = async (targetAdmin, newRole) => {
    if (targetAdmin.id === adminProfile?.id && newRole !== 'super_admin') {
      if (!window.confirm('Warning: Demoting yourself from Super-Admin will revoke access to this control panel. Continue?')) {
        return;
      }
    }

    try {
      await updateAdminRole(targetAdmin.id, newRole);
      setSuccess(`Updated role for ${targetAdmin.full_name || targetAdmin.email} to ${newRole}.`);
      await loadAdmins();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDelete = async (targetAdmin) => {
    if (targetAdmin.id === adminProfile?.id) {
      alert('You cannot delete your own admin account from here.');
      return;
    }

    if (!window.confirm(`Are you sure you want to remove ${targetAdmin.full_name || targetAdmin.email}? This will delete their access.`)) {
      return;
    }

    try {
      await deleteAdmin(targetAdmin.id);
      setSuccess(`Removed ${targetAdmin.full_name || targetAdmin.email}.`);
      await loadAdmins();
    } catch (err) {
      setError(err.message);
    }
  };

  // Create new admin account handler
  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!createForm.email || !createForm.fullName || !createForm.tempPassword) {
      setError('All fields are required to create a new instructor account.');
      return;
    }
    if (createForm.tempPassword.length < 6) {
      setError('Temporary password must be at least 6 characters.');
      return;
    }

    setCreateLoading(true);
    try {
      await createAdminAccount({
        email: createForm.email,
        fullName: createForm.fullName,
        role: createForm.role,
        tempPassword: createForm.tempPassword,
      });

      setCreatedCredentials({ email: createForm.email, tempPassword: createForm.tempPassword });
      setSuccess(`New instructor account created for ${createForm.email}!`);
      setCreateForm({ fullName: '', email: '', role: 'teacher', tempPassword: '' });
      setShowCreateForm(false);
      await loadAdmins();
    } catch (err) {
      setError(err.message);
    } finally {
      setCreateLoading(false);
    }
  };

  return (
    <div style={{ padding: 'var(--sp-4)', maxWidth: '960px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px', marginBottom: 'var(--sp-6)' }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 700, margin: 0, color: 'var(--color-heading)' }}>
            Instructor & Admin Directory
          </h2>
          <p style={{ margin: '4px 0 0', color: 'var(--color-text-muted)', fontSize: '0.88rem' }}>
            Manage teacher accounts, assign platform roles, and grant Super-Admin privileges.
          </p>
        </div>
        <button
          className="btn btn-primary btn-sm"
          onClick={() => { setShowCreateForm(!showCreateForm); setCreatedCredentials(null); }}
          style={{ fontSize: '0.85rem' }}
        >
          {showCreateForm ? '✕ Cancel' : '➕ Create New Instructor'}
        </button>
      </div>

      {error && (
        <div style={{ padding: '12px 16px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', color: '#991b1b', marginBottom: '16px', fontSize: '0.9rem' }}>
          {error}
        </div>
      )}

      {success && (
        <div style={{ padding: '12px 16px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', color: '#166534', marginBottom: '16px', fontSize: '0.9rem' }}>
          {success}
        </div>
      )}

      {/* Credentials display after creation */}
      {createdCredentials && (
        <div style={{ padding: '16px', background: '#eff6ff', border: '1px solid #93c5fd', borderRadius: '8px', marginBottom: '16px' }}>
          <div style={{ fontWeight: 700, color: '#1d4ed8', marginBottom: '8px', fontSize: '0.9rem' }}>
            📋 Share these credentials with the new instructor:
          </div>
          <div style={{ fontFamily: 'monospace', fontSize: '0.88rem', background: '#fff', padding: '10px 14px', borderRadius: '6px', border: '1px solid #dbeafe' }}>
            <div><strong>Email:</strong> {createdCredentials.email}</div>
            <div><strong>Temporary Password:</strong> {createdCredentials.tempPassword}</div>
          </div>
          <p style={{ margin: '8px 0 0', fontSize: '0.78rem', color: '#1e40af' }}>
            The new instructor should change their password after first login.
          </p>
        </div>
      )}

      {/* Create New Instructor Form */}
      {showCreateForm && (
        <div className="card" style={{ padding: 'var(--sp-5)', border: '1px solid var(--color-primary)', marginBottom: 'var(--sp-5)', background: 'var(--color-primary-light)' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 'var(--sp-4)', color: 'var(--color-heading)' }}>
            ➕ Create New Instructor Account
          </h3>
          <form onSubmit={handleCreateSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
              <div className="form-group">
                <label className="form-label">Full Name *</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Juan Dela Cruz"
                  value={createForm.fullName}
                  onChange={(e) => setCreateForm((f) => ({ ...f, fullName: e.target.value }))}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Email *</label>
                <input
                  type="email"
                  className="form-input"
                  placeholder="instructor@school.edu"
                  value={createForm.email}
                  onChange={(e) => setCreateForm((f) => ({ ...f, email: e.target.value }))}
                  required
                />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
              <div className="form-group">
                <label className="form-label">Role</label>
                <select
                  className="form-input"
                  value={createForm.role}
                  onChange={(e) => setCreateForm((f) => ({ ...f, role: e.target.value }))}
                >
                  <option value="teacher">Teacher / Instructor</option>
                  <option value="super_admin">Super-Admin</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Temporary Password *</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Min. 6 characters"
                  value={createForm.tempPassword}
                  onChange={(e) => setCreateForm((f) => ({ ...f, tempPassword: e.target.value }))}
                  required
                  minLength={6}
                />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowCreateForm(false)} disabled={createLoading}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary btn-sm" disabled={createLoading}>
                {createLoading ? 'Creating…' : '✅ Create Account'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="card" style={{ padding: 'var(--sp-4)', border: '1px solid var(--color-border)', overflowX: 'auto' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '30px', color: 'var(--color-text-muted)' }}>
            Loading instructors...
          </div>
        ) : admins.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '30px', color: 'var(--color-text-muted)' }}>
            No admin accounts found.
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--color-border)', color: 'var(--color-text-muted)' }}>
                <th style={{ padding: '10px 12px' }}>Name</th>
                <th style={{ padding: '10px 12px' }}>Email</th>
                <th style={{ padding: '10px 12px' }}>Role</th>
                <th style={{ padding: '10px 12px' }}>Registered</th>
                <th style={{ padding: '10px 12px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {admins.map((adm) => {
                const isCurrent = adm.id === adminProfile?.id;
                return (
                  <tr key={adm.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <td style={{ padding: '12px', fontWeight: 600, color: 'var(--color-heading)' }}>
                      {adm.full_name || '—'} {isCurrent && <span style={{ fontSize: '0.72rem', color: 'var(--color-primary)' }}>(You)</span>}
                    </td>
                    <td style={{ padding: '12px', color: 'var(--color-text)' }}>
                      {adm.email}
                    </td>
                    <td style={{ padding: '12px' }}>
                      <select
                        value={adm.role}
                        onChange={(e) => handleRoleChange(adm, e.target.value)}
                        className="form-input"
                        style={{
                          fontSize: '0.8rem',
                          padding: '4px 8px',
                          borderRadius: '4px',
                          fontWeight: 600,
                          color: adm.role === 'super_admin' ? '#4338ca' : '#0369a1',
                          background: adm.role === 'super_admin' ? '#eef2ff' : '#f0f9ff',
                          borderColor: 'transparent',
                        }}
                      >
                        <option value="teacher">Teacher / Instructor</option>
                        <option value="super_admin">Super-Admin</option>
                      </select>
                    </td>
                    <td style={{ padding: '12px', color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>
                      {new Date(adm.created_at).toLocaleDateString()}
                    </td>
                    <td style={{ padding: '12px', textAlign: 'right' }}>
                      {!isCurrent && (
                        <button
                          className="btn btn-secondary"
                          style={{ fontSize: '0.75rem', padding: '4px 8px', color: '#dc2626' }}
                          onClick={() => handleDelete(adm)}
                          title="Remove Teacher"
                        >
                          🗑️ Remove
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
