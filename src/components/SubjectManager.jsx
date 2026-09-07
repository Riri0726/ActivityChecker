import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { getSubjects, createSubject, updateSubject, deleteSubject } from '../services/adminService.js';

export default function SubjectManager() {
  const { adminProfile, isSuperAdmin, selectedSubjectId, setSelectedSubjectId, refreshAdmin } = useAuth();
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form states
  const [isAdding, setIsAdding] = useState(false);
  const [editingSubject, setEditingSubject] = useState(null);
  const [form, setForm] = useState({ code: '', name: '', description: '' });

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getSubjects(isSuperAdmin ? null : adminProfile?.id);
      setSubjects(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [adminProfile?.id, isSuperAdmin]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleStartAdd = () => {
    setEditingSubject(null);
    setForm({ code: '', name: '', description: '' });
    setIsAdding(true);
    setError('');
    setSuccess('');
  };

  const handleStartEdit = (subject) => {
    setIsAdding(false);
    setEditingSubject(subject);
    setForm({ code: subject.code, name: subject.name, description: subject.description || '' });
    setError('');
    setSuccess('');
  };

  const handleCancel = () => {
    setIsAdding(false);
    setEditingSubject(null);
    setForm({ code: '', name: '', description: '' });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.code.trim() || !form.name.trim()) {
      setError('Subject code and title are required.');
      return;
    }

    setError('');
    setSuccess('');
    try {
      if (editingSubject) {
        await updateSubject(editingSubject.id, {
          code: form.code,
          name: form.name,
          description: form.description,
        });
        setSuccess('Subject updated successfully!');
      } else {
        const newSub = await createSubject({
          code: form.code,
          name: form.name,
          description: form.description,
          adminId: adminProfile?.id,
        });
        setSuccess('Subject created successfully!');
        // Automatically activate if none active
        if (!selectedSubjectId) {
          setSelectedSubjectId(newSub.id);
        }
      }
      handleCancel();
      await loadData();
      await refreshAdmin();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDelete = async (subject) => {
    if (!window.confirm(`Are you sure you want to delete "${subject.code}: ${subject.name}"? This will delete all associated sections and grades!`)) {
      return;
    }

    try {
      await deleteSubject(subject.id);
      setSuccess(`Subject "${subject.code}" deleted.`);
      if (selectedSubjectId === subject.id) {
        setSelectedSubjectId('');
      }
      await loadData();
      await refreshAdmin();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div style={{ padding: 'var(--sp-4)', maxWidth: '960px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--sp-6)' }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 700, margin: 0, color: 'var(--color-heading)' }}>
            Course & Subject Management
          </h2>
          <p style={{ margin: '4px 0 0', color: 'var(--color-text-muted)', fontSize: '0.88rem' }}>
            {isSuperAdmin
              ? 'Super-Admin View: Manage all academic subjects across teachers.'
              : 'Manage your assigned subjects, courses, and syllabi.'}
          </p>
        </div>
        {!isAdding && !editingSubject && (
          <button
            className="btn btn-primary"
            onClick={handleStartAdd}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <span>+</span> Create New Subject
          </button>
        )}
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

      {/* Add / Edit Form Modal or Inline Card */}
      {(isAdding || editingSubject) && (
        <div className="card" style={{ padding: 'var(--sp-5)', marginBottom: 'var(--sp-6)', border: '1px solid var(--color-border)' }}>
          <h3 style={{ margin: '0 0 var(--sp-4)', fontSize: '1.1rem', fontWeight: 600 }}>
            {editingSubject ? `Edit Subject: ${editingSubject.code}` : 'Create New Subject'}
          </h3>
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 'var(--sp-4)', marginBottom: 'var(--sp-4)' }}>
              <div>
                <label className="form-label" style={{ display: 'block', marginBottom: '6px', fontWeight: 500, fontSize: '0.85rem' }}>
                  Subject Code *
                </label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. CS101, IT202"
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                  required
                />
              </div>
              <div>
                <label className="form-label" style={{ display: 'block', marginBottom: '6px', fontWeight: 500, fontSize: '0.85rem' }}>
                  Subject Title *
                </label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Introduction to Web Development"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                />
              </div>
            </div>

            <div style={{ marginBottom: 'var(--sp-5)' }}>
              <label className="form-label" style={{ display: 'block', marginBottom: '6px', fontWeight: 500, fontSize: '0.85rem' }}>
                Description / Notes (Optional)
              </label>
              <textarea
                className="form-input"
                rows="2"
                placeholder="e.g. 1st Semester A.Y. 2026-2027"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-secondary" onClick={handleCancel}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary">
                {editingSubject ? 'Save Changes' : 'Create Subject'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Subjects Grid */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--color-text-muted)' }}>
          Loading subjects...
        </div>
      ) : subjects.length === 0 ? (
        <div className="card text-center" style={{ padding: '40px', border: '1px dashed var(--color-border)' }}>
          <div style={{ fontSize: '2rem', marginBottom: '8px' }}>📚</div>
          <h3 style={{ margin: '0 0 6px', fontSize: '1.1rem' }}>No subjects created yet</h3>
          <p style={{ margin: '0 0 16px', color: 'var(--color-text-muted)', fontSize: '0.88rem' }}>
            Get started by creating your first subject or course offering.
          </p>
          <button className="btn btn-primary" onClick={handleStartAdd}>
            + Create Subject
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 'var(--sp-4)' }}>
          {subjects.map((subj) => {
            const isSelected = selectedSubjectId === subj.id;
            return (
              <div
                key={subj.id}
                className="card"
                style={{
                  padding: 'var(--sp-5)',
                  border: isSelected ? '2px solid var(--color-primary)' : '1px solid var(--color-border)',
                  position: 'relative',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  boxShadow: isSelected ? '0 4px 14px rgba(79, 110, 247, 0.15)' : 'none',
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                    <span
                      style={{
                        display: 'inline-block',
                        padding: '3px 8px',
                        background: isSelected ? 'var(--color-primary)' : '#f1f5f9',
                        color: isSelected ? '#fff' : '#475569',
                        borderRadius: '4px',
                        fontWeight: 700,
                        fontSize: '0.78rem',
                        letterSpacing: '0.5px',
                      }}
                    >
                      {subj.code}
                    </span>
                    {isSelected && (
                      <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-primary)' }}>
                        ✓ Active
                      </span>
                    )}
                  </div>

                  <h3 style={{ margin: '0 0 6px', fontSize: '1.05rem', fontWeight: 600, color: 'var(--color-heading)' }}>
                    {subj.name}
                  </h3>

                  {subj.description && (
                    <p style={{ margin: '0 0 12px', fontSize: '0.82rem', color: 'var(--color-text-muted)', lineHeight: 1.4 }}>
                      {subj.description}
                    </p>
                  )}

                  {isSuperAdmin && subj.admins && (
                    <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '6px' }}>
                      Teacher: <strong>{subj.admins.full_name || subj.admins.email}</strong>
                    </div>
                  )}
                </div>

                <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <button
                    className={`btn ${isSelected ? 'btn-secondary' : 'btn-primary'}`}
                    style={{ fontSize: '0.8rem', padding: '4px 10px' }}
                    onClick={() => setSelectedSubjectId(subj.id)}
                  >
                    {isSelected ? 'Selected' : 'Select'}
                  </button>

                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      className="btn btn-secondary"
                      style={{ fontSize: '0.78rem', padding: '4px 8px' }}
                      onClick={() => handleStartEdit(subj)}
                      title="Edit Subject"
                    >
                      ✏️ Edit
                    </button>
                    <button
                      className="btn btn-secondary"
                      style={{ fontSize: '0.78rem', padding: '4px 8px', color: '#dc2626' }}
                      onClick={() => handleDelete(subj)}
                      title="Delete Subject"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
