import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { getAdmins, updateAdminRole, deleteAdmin } from '../services/adminService.js';

export default function TeacherManager() {
  const { adminProfile, isSuperAdmin } = useAuth();
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

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

  return (
    <div style={{ padding: 'var(--sp-4)', maxWidth: '960px', margin: '0 auto' }}>
      <div style={{ marginBottom: 'var(--sp-6)' }}>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 700, margin: 0, color: 'var(--color-heading)' }}>
          Instructor & Admin Directory
        </h2>
        <p style={{ margin: '4px 0 0', color: 'var(--color-text-muted)', fontSize: '0.88rem' }}>
          Manage teacher accounts, assign platform roles, and grant Super-Admin privileges.
        </p>
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
