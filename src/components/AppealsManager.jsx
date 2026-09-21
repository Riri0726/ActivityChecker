import { useState, useEffect, useCallback, useRef } from 'react';
import { getAppeals, updateAppealWithPurge, getProofSignedUrl, deleteAppeal } from '../services/adminService.js';
import { useAuth } from '../context/AuthContext.jsx';

const STATUS_OPTIONS = ['pending', 'reviewed', 'resolved', 'rejected'];

export default function AppealsManager({ onUpdate }) {
  const { effectiveAdminId } = useAuth();
  const [appeals, setAppeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState(
    () => localStorage.getItem('activity_tracker_appeals_filter') || 'pending'
  );
  const [expanded, setExpanded] = useState(null);
  const [remarks, setRemarks] = useState({});
  const [adjustedScores, setAdjustedScores] = useState({});
  const [signedUrls, setSignedUrls] = useState({});
  const [saving, setSaving] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [deleteModal, setDeleteModal] = useState(null); // { appealId, studentName, activityTitle }
  const [deleteLoading, setDeleteLoading] = useState(false);
  const remarksRefs = useRef({});

  const loadAppeals = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getAppeals({ status: filter || undefined, adminId: effectiveAdminId });
      setAppeals(data);

      const urls = {};
      for (const a of data) {
        if (a.storage_path) {
          const u = await getProofSignedUrl(a.storage_path);
          if (u) urls[a.id] = u;
        }
      }
      setSignedUrls(urls);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [filter, effectiveAdminId]);

  useEffect(() => {
    loadAppeals();
  }, [loadAppeals]);

  const handleFilterChange = (newFilter) => {
    setFilter(newFilter);
    localStorage.setItem('activity_tracker_appeals_filter', newFilter);
    setExpanded(null);
  };

  const handleStatusUpdate = async (appeal, newStatus) => {
    const appealId = appeal.id;
    const instructorRemark = remarks[appealId] || appeal.instructor_remarks || '';
    const scoreVal = adjustedScores[appealId];

    if (newStatus === 'rejected' && !instructorRemark.trim()) {
      setError('Please provide feedback/reason when rejecting an appeal.');
      // Scroll the remarks input into view and highlight it
      const remarksEl = remarksRefs.current[appealId];
      if (remarksEl) {
        remarksEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        remarksEl.focus();
        remarksEl.style.borderColor = '#dc2626';
        remarksEl.style.boxShadow = '0 0 0 3px rgba(220,38,38,0.2)';
        setTimeout(() => {
          remarksEl.style.borderColor = '';
          remarksEl.style.boxShadow = '';
        }, 3000);
      }
      return;
    }

    setSaving(appealId);
    setError('');
    setSuccess('');
    try {
      await updateAppealWithPurge(appealId, {
        status: newStatus,
        instructorRemarks: instructorRemark.trim(),
        adjustedScore: newStatus === 'resolved' && scoreVal !== undefined ? scoreVal : null,
        studentId: appeal.students?.id,
        activityId: appeal.activities?.id,
        studentEmail: appeal.students?.student_no ? `${appeal.students?.student_no}@school.edu` : null,
        studentName: `${appeal.students?.first_name} ${appeal.students?.surname}`,
        activityTitle: appeal.activities?.title,
      });

      setSuccess(`Appeal for ${appeal.students?.surname} marked as ${newStatus}. Image proof auto-purged.`);
      await loadAppeals();
      onUpdate?.();
      setExpanded(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(null);
    }
  };

  const handleDeleteAppeal = async () => {
    if (!deleteModal) return;
    setDeleteLoading(true);
    try {
      await deleteAppeal(deleteModal.appealId);
      setSuccess(`Appeal from ${deleteModal.studentName} has been permanently deleted.`);
      setDeleteModal(null);
      await loadAppeals();
      onUpdate?.();
    } catch (e) {
      setError(e.message);
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div>
      <div className="admin-section-header" style={{ marginBottom: 'var(--sp-4)' }}>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 700, margin: 0, color: 'var(--color-heading)' }}>
          Student Grade Appeals
        </h2>
        <p style={{ margin: '4px 0 0', color: 'var(--color-text-muted)', fontSize: '0.88rem' }}>
          Disputes and "missing but submitted" claims. Screenshot proofs are strictly auto-purged upon resolution to preserve storage.
        </p>
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: 'var(--sp-4)' }}>
        {['', ...STATUS_OPTIONS].map((s) => (
          <button
            key={s || 'all'}
            className={`btn ${filter === s ? 'btn-primary' : 'btn-secondary'}`}
            style={{ fontSize: '0.8rem', padding: '6px 14px', borderRadius: '20px' }}
            onClick={() => handleFilterChange(s)}
          >
            {s ? s.charAt(0).toUpperCase() + s.slice(1) : 'All'}
          </button>
        ))}
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

      {/* Delete Confirmation Modal */}
      {deleteModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center',
          justifyContent: 'center', zIndex: 1000, padding: '20px',
        }}>
          <div className="card" style={{ maxWidth: '440px', width: '100%', padding: '24px' }}>
            <h3 style={{ margin: '0 0 12px', fontSize: '1.15rem', fontWeight: 600, color: '#dc2626' }}>
              🗑️ Delete Appeal
            </h3>
            <p style={{ margin: '0 0 16px', fontSize: '0.9rem', color: 'var(--color-text-muted)' }}>
              Permanently delete the appeal from <strong>{deleteModal.studentName}</strong> for <strong>{deleteModal.activityTitle}</strong>?
              <br /><br />
              This action cannot be undone. Any associated proof images will also be removed.
            </p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setDeleteModal(null)}>
                Cancel
              </button>
              <button
                className="btn"
                style={{ background: '#dc2626', color: '#fff', border: 'none', minHeight: '44px' }}
                onClick={handleDeleteAppeal}
                disabled={deleteLoading}
              >
                {deleteLoading ? 'Deleting...' : '🗑️ Delete Permanently'}
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--color-text-muted)' }}>
          Loading appeals...
        </div>
      ) : appeals.length === 0 ? (
        <div className="card text-center" style={{ padding: '40px', border: '1px dashed var(--color-border)' }}>
          <div style={{ fontSize: '2rem', marginBottom: '8px' }}>✅</div>
          <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
            No {filter} appeals found.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {appeals.map((appeal) => {
            const student = appeal.students;
            const activity = appeal.activities;
            const isExpanded = expanded === appeal.id;
            const imageUrl = signedUrls[appeal.id];
            const isPurged = !appeal.storage_path && (appeal.proof_purged_at || appeal.proof_deleted_at);

            return (
              <div
                key={appeal.id}
                className="card"
                style={{
                  padding: '18px',
                  border: isExpanded ? '2px solid var(--color-primary)' : '1px solid var(--color-border)',
                  borderRadius: '8px',
                }}
              >
                <div
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', flexWrap: 'wrap', gap: '10px' }}
                  onClick={() => setExpanded(isExpanded ? null : appeal.id)}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 600, fontSize: '1.05rem', color: 'var(--color-heading)' }}>
                        {student?.first_name} {student?.surname}
                      </span>
                      {student?.student_no && (
                        <span style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
                          #{student.student_no}
                        </span>
                      )}
                      <span style={{ fontSize: '0.75rem', background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px' }}>
                        {student?.sections?.name}
                      </span>
                      <span
                        style={{
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          padding: '3px 8px',
                          borderRadius: '4px',
                          background: appeal.status === 'resolved' ? '#dcfce7' : appeal.status === 'rejected' ? '#fee2e2' : '#fef3c7',
                          color: appeal.status === 'resolved' ? '#166534' : appeal.status === 'rejected' ? '#991b1b' : '#b45309',
                        }}
                      >
                        {appeal.status.toUpperCase()}
                      </span>
                    </div>

                    <div style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
                      Activity: <strong style={{ color: 'var(--color-text)' }}>{activity?.title}</strong> (Max: {activity?.max_score})
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    {isPurged && (
                      <span style={{ fontSize: '0.72rem', background: '#f8fafc', border: '1px solid #cbd5e1', color: '#64748b', padding: '3px 8px', borderRadius: '4px' }}>
                        🧹 Proof Auto-Purged
                      </span>
                    )}
                    <span style={{ fontSize: '0.85rem', color: 'var(--color-primary)' }}>
                      {isExpanded ? '▲ Hide Details' : '▼ Review & Action'}
                    </span>
                  </div>
                </div>

                {isExpanded && (
                  <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--color-border)' }}>
                    {/* Student Reason */}
                    <div style={{ background: '#f8fafc', padding: '12px 16px', borderRadius: '6px', marginBottom: '14px' }}>
                      <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '4px' }}>
                        Student's Explanation:
                      </div>
                      <div style={{ fontSize: '0.9rem', color: '#1e293b', whiteSpace: 'pre-wrap' }}>
                        {appeal.reason}
                      </div>
                      {appeal.notes && (
                        <div style={{ fontSize: '0.82rem', color: '#475569', marginTop: '6px' }}>
                          Additional notes: {appeal.notes}
                        </div>
                      )}
                    </div>

                    {/* Screenshot Proof Preview */}
                    <div style={{ marginBottom: '16px' }}>
                      <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '6px' }}>
                        Mandatory Screenshot Proof:
                      </div>
                      {imageUrl ? (
                        <div style={{ border: '1px solid var(--color-border)', borderRadius: '6px', overflow: 'hidden', maxWidth: '480px' }}>
                          <a href={imageUrl} target="_blank" rel="noopener noreferrer">
                            <img
                              src={imageUrl}
                              alt="Appeal proof"
                              style={{ width: '100%', maxHeight: '320px', objectFit: 'contain', background: '#000' }}
                            />
                          </a>
                          <div style={{ padding: '6px 10px', background: '#f8fafc', fontSize: '0.75rem', color: '#64748b', textAlign: 'center' }}>
                            Click image to open full resolution ↗
                          </div>
                        </div>
                      ) : isPurged ? (
                        <div style={{ padding: '12px', background: '#f1f5f9', borderRadius: '6px', fontSize: '0.82rem', color: '#64748b' }}>
                          Proof screenshot was automatically purged from storage upon resolution on{' '}
                          {new Date(appeal.proof_purged_at || appeal.proof_deleted_at).toLocaleString()} to keep database storage free.
                        </div>
                      ) : (
                        <div style={{ padding: '12px', background: '#fef2f2', borderRadius: '6px', fontSize: '0.82rem', color: '#991b1b' }}>
                          No image proof found.
                        </div>
                      )}
                    </div>

                    {/* Resolution Form */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '14px', marginBottom: '16px' }}>
                      <div>
                        <label className="form-label" style={{ display: 'block', marginBottom: '6px', fontSize: '0.82rem', fontWeight: 600 }}>
                          Adjusted Score (if approving)
                        </label>
                        <input
                          type="number"
                          step="0.5"
                          max={activity?.max_score}
                          className="form-input"
                          placeholder={`Max ${activity?.max_score}`}
                          value={adjustedScores[appeal.id] ?? ''}
                          onChange={(e) => setAdjustedScores({ ...adjustedScores, [appeal.id]: e.target.value })}
                          style={{ minHeight: '44px' }}
                        />
                      </div>
                      <div>
                        <label className="form-label" style={{ display: 'block', marginBottom: '6px', fontSize: '0.82rem', fontWeight: 600 }}>
                          Instructor Feedback / Remarks {appeal.status === 'pending' && <span style={{ color: '#dc2626' }}>(required for reject)</span>}
                        </label>
                        <input
                          ref={(el) => { remarksRefs.current[appeal.id] = el; }}
                          type="text"
                          className="form-input"
                          placeholder="e.g. Verified canvas submission, full points awarded."
                          value={remarks[appeal.id] ?? appeal.instructor_remarks ?? ''}
                          onChange={(e) => setRemarks({ ...remarks, [appeal.id]: e.target.value })}
                          style={{ minHeight: '44px', transition: 'border-color 0.3s, box-shadow 0.3s' }}
                        />
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                      <button
                        className="btn btn-secondary"
                        style={{ color: '#dc2626', fontSize: '0.82rem', minHeight: '44px' }}
                        onClick={() => setDeleteModal({
                          appealId: appeal.id,
                          studentName: `${student?.first_name} ${student?.surname}`,
                          activityTitle: activity?.title,
                        })}
                      >
                        🗑️ Delete
                      </button>
                      <button
                        className="btn btn-secondary"
                        style={{ color: '#dc2626', minHeight: '44px' }}
                        onClick={() => {
                          // Pre-populate default remark if empty
                          if (!remarks[appeal.id]?.trim() && !appeal.instructor_remarks?.trim()) {
                            setRemarks({ ...remarks, [appeal.id]: 'Appeal rejected.' });
                          }
                          handleStatusUpdate(appeal, 'rejected');
                        }}
                        disabled={saving === appeal.id}
                      >
                        ✕ Reject Appeal
                      </button>
                      <button
                        className="btn btn-primary"
                        style={{ background: '#16a34a', borderColor: '#16a34a', minHeight: '44px' }}
                        onClick={() => handleStatusUpdate(appeal, 'resolved')}
                        disabled={saving === appeal.id}
                      >
                        ✓ Resolve & Award Score
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
