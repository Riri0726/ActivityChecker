import { useState, useEffect } from 'react';
import { getAppeals, updateAppeal, getProofImageUrl } from '../services/adminService.js';

const STATUS_OPTIONS = ['pending', 'reviewed', 'resolved', 'rejected'];

export default function AppealsManager({ onUpdate }) {
  const [appeals, setAppeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('pending');
  const [expanded, setExpanded] = useState(null);
  const [remarks, setRemarks] = useState({});
  const [saving, setSaving] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    loadAppeals();
  }, [filter]);

  const loadAppeals = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getAppeals({ status: filter || undefined });
      setAppeals(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (appealId, newStatus) => {
    setSaving(appealId);
    try {
      await updateAppeal(appealId, {
        status: newStatus,
        instructorRemarks: remarks[appealId] || null,
      });
      await loadAppeals();
      onUpdate?.();
      setExpanded(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(null);
    }
  };

  return (
    <div>
      <div className="admin-section-header">
        <h2>📝 Appeals</h2>
        <p>Review and respond to student score disputes and "missing but submitted" claims.</p>
      </div>

      {/* Filter tabs */}
      <div className="filter-tabs" role="tablist">
        {['', ...STATUS_OPTIONS].map((s) => (
          <button
            key={s || 'all'}
            id={`appeals-filter-${s || 'all'}`}
            role="tab"
            className={`filter-tab ${filter === s ? 'active' : ''}`}
            onClick={() => { setFilter(s); setExpanded(null); }}
            aria-selected={filter === s}
          >
            {s ? s.charAt(0).toUpperCase() + s.slice(1) : 'All'}
          </button>
        ))}
      </div>

      {error && <div className="alert alert-error mb-4"><span>⚠️</span> {error}</div>}

      {loading ? (
        <div className="loading-center"><div className="spinner" /><span>Loading appeals…</span></div>
      ) : appeals.length === 0 ? (
        <div className="empty-state">
          <span aria-hidden="true">✅</span>
          <p>No {filter} appeals at the moment.</p>
        </div>
      ) : (
        <div className="appeals-list">
          {appeals.map((appeal) => {
            const student = appeal.students;
            const activity = appeal.activities;
            const isExpanded = expanded === appeal.id;

            return (
              <div key={appeal.id} className={`appeal-card ${isExpanded ? 'expanded' : ''}`}>
                <div
                  className="appeal-card-header"
                  onClick={() => setExpanded(isExpanded ? null : appeal.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && setExpanded(isExpanded ? null : appeal.id)}
                  aria-expanded={isExpanded}
                >
                  <div className="appeal-card-info">
                    <div className="appeal-card-name">
                      {student?.first_name} {student?.surname}
                      {student?.student_no && (
                        <span className="text-muted" style={{ fontSize: '0.78rem', marginLeft: 6 }}>
                          #{student.student_no}
                        </span>
                      )}
                    </div>
                    <div className="appeal-card-meta">
                      <span className="badge badge-pending" style={{ fontSize: '0.72rem' }}>
                        {student?.sections?.name}
                      </span>
                      <span className="text-muted">→</span>
                      <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>{activity?.title}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`badge badge-${appeal.status}`}>{appeal.status}</span>
                    <span className="text-muted" style={{ fontSize: '1rem' }}>
                      {isExpanded ? '▲' : '▼'}
                    </span>
                  </div>
                </div>

                {isExpanded && (
                  <div className="appeal-card-body">
                    <div className="appeal-detail-row">
                      <span className="appeal-detail-label">Reason</span>
                      <p className="appeal-detail-value">{appeal.reason}</p>
                    </div>
                    {appeal.notes && (
                      <div className="appeal-detail-row">
                        <span className="appeal-detail-label">Notes / Evidence</span>
                        <p className="appeal-detail-value">{appeal.notes}</p>
                      </div>
                    )}

                    {/* Attached Proof Screenshot */}
                    {appeal.storage_path && (
                      <div className="appeal-detail-row">
                        <span className="appeal-detail-label">Attached Proof</span>
                        <div className="appeal-proof-preview">
                          <a
                            href={getProofImageUrl(appeal.storage_path)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="appeal-proof-link"
                          >
                            <img
                              src={getProofImageUrl(appeal.storage_path)}
                              alt="Proof screenshot"
                              className="appeal-proof-img"
                            />
                            <span className="appeal-proof-zoom-hint">🔍 View full screenshot ↗</span>
                          </a>
                          <span className="text-muted" style={{ fontSize: '0.75rem', marginTop: 6, display: 'block' }}>
                            🛡️ Automatic cleanup: Image will be purged from storage upon approval or rejection.
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Proof Purged Audit Note */}
                    {appeal.proof_deleted_at && !appeal.storage_path && (
                      <div className="appeal-detail-row">
                        <span className="appeal-detail-label">Proof Storage</span>
                        <div style={{ fontSize: '0.82rem' }}>
                          <span className="badge badge-done" style={{ background: '#f3f4f6', color: 'var(--text-secondary)' }}>
                            🗑️ Proof screenshot purged on resolution ({new Date(appeal.proof_deleted_at).toLocaleDateString()})
                          </span>
                        </div>
                      </div>
                    )}

                    {appeal.instructor_remarks && (
                      <div className="appeal-detail-row">
                        <span className="appeal-detail-label">Previous Remarks</span>
                        <p className="appeal-detail-value">{appeal.instructor_remarks}</p>
                      </div>
                    )}

                    <div className="form-group" style={{ marginBottom: 'var(--sp-4)' }}>
                      <label className="form-label" htmlFor={`remarks-${appeal.id}`}>
                        Instructor Remarks (optional)
                      </label>
                      <textarea
                        id={`remarks-${appeal.id}`}
                        className="form-textarea"
                        style={{ minHeight: 70 }}
                        placeholder="Add a note for the student…"
                        value={remarks[appeal.id] ?? appeal.instructor_remarks ?? ''}
                        onChange={(e) => setRemarks((r) => ({ ...r, [appeal.id]: e.target.value }))}
                      />
                    </div>

                    <div className="appeal-actions">
                      {STATUS_OPTIONS.filter((s) => s !== appeal.status).map((s) => (
                        <button
                          key={s}
                          id={`appeal-${appeal.id}-set-${s}`}
                          className={`btn btn-sm ${s === 'rejected' ? 'btn-danger' : s === 'resolved' ? 'btn-success' : 'btn-ghost'}`}
                          onClick={() => handleStatusUpdate(appeal.id, s)}
                          disabled={saving === appeal.id}
                        >
                          {saving === appeal.id ? 'Saving…' : `Mark ${s}`}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <style>{`
        .filter-tabs {
          display: flex;
          gap: var(--sp-2);
          margin-bottom: var(--sp-5);
          flex-wrap: wrap;
        }
        .filter-tab {
          padding: 6px 16px;
          border-radius: var(--radius-full);
          font-size: 0.85rem;
          font-weight: 500;
          background: var(--bg-card);
          border: 1px solid var(--border-color);
          cursor: pointer;
          color: var(--text-secondary);
          transition: background var(--transition-fast), color var(--transition-fast);
        }
        .filter-tab:hover { background: var(--bg-card-alt); color: var(--text-primary); }
        .filter-tab.active {
          background: var(--color-primary);
          color: #fff;
          border-color: var(--color-primary);
        }

        .appeals-list { display: flex; flex-direction: column; gap: var(--sp-3); }

        .appeal-card {
          background: var(--bg-card);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-md);
          overflow: hidden;
          transition: box-shadow var(--transition-base);
        }
        .appeal-card.expanded { box-shadow: var(--shadow-md); }

        .appeal-card-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: var(--sp-4) var(--sp-5);
          cursor: pointer;
          gap: var(--sp-3);
        }
        .appeal-card-header:hover { background: var(--bg-card-alt); }

        .appeal-card-info { flex: 1; min-width: 0; }
        .appeal-card-name { font-weight: 600; margin-bottom: 4px; }
        .appeal-card-meta { display: flex; align-items: center; gap: var(--sp-2); flex-wrap: wrap; }

        .appeal-card-body {
          padding: var(--sp-5);
          border-top: 1px solid var(--border-color);
          background: var(--bg-card-alt);
          animation: slideUp 0.15s ease;
        }

        .appeal-detail-row { margin-bottom: var(--sp-4); }
        .appeal-detail-label {
          font-size: 0.78rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--text-muted);
          margin-bottom: 4px;
          display: block;
        }
        .appeal-detail-value {
          font-size: 0.9rem;
          color: var(--text-primary);
          line-height: 1.6;
          background: var(--bg-card);
          padding: var(--sp-3);
          border-radius: var(--radius-sm);
          border: 1px solid var(--border-color);
        }

        .appeal-proof-preview {
          margin-top: 4px;
        }
        .appeal-proof-link {
          display: inline-block;
          text-decoration: none;
          border: 1px solid var(--border-color);
          border-radius: var(--radius-md);
          overflow: hidden;
          background: var(--bg-card);
          transition: transform var(--transition-fast), box-shadow var(--transition-fast);
        }
        .appeal-proof-link:hover {
          transform: translateY(-2px);
          box-shadow: var(--shadow-md);
        }
        .appeal-proof-img {
          max-width: 260px;
          max-height: 180px;
          object-fit: cover;
          display: block;
        }
        .appeal-proof-zoom-hint {
          display: block;
          padding: 4px 8px;
          font-size: 0.75rem;
          color: var(--color-primary);
          text-align: center;
          background: var(--bg-card-alt);
          border-top: 1px solid var(--border-color);
        }

        .appeal-actions { display: flex; gap: var(--sp-2); flex-wrap: wrap; }

        .empty-state {
          text-align: center;
          padding: var(--sp-12) var(--sp-8);
          color: var(--text-muted);
          font-size: 0.9rem;
        }
        .empty-state span { font-size: 2rem; display: block; margin-bottom: var(--sp-3); }
      `}</style>
    </div>
  );
}
