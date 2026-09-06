import { useState, useEffect } from 'react';
import { getMakeupRequests, updateMakeupRequest } from '../services/adminService.js';

const STATUS_OPTIONS = ['pending', 'approved', 'denied', 'awaiting_assignment'];

export default function RequestsManager({ onUpdate }) {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [saving, setSaving] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    loadRequests();
  }, [filter]);

  const loadRequests = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getMakeupRequests({ status: filter || undefined });
      setRequests(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (requestId, newStatus) => {
    setSaving(requestId);
    try {
      await updateMakeupRequest(requestId, newStatus);
      await loadRequests();
      onUpdate?.();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(null);
    }
  };

  return (
    <div>
      <div className="admin-section-header">
        <h2>📩 Make-up Requests</h2>
        <p>Review student requests to submit missing activities.</p>
      </div>

      {/* Filter tabs */}
      <div className="filter-tabs" role="tablist">
        {['', ...STATUS_OPTIONS].map((s) => (
          <button
            key={s || 'all'}
            id={`requests-filter-${s || 'all'}`}
            role="tab"
            className={`filter-tab ${filter === s ? 'active' : ''}`}
            onClick={() => setFilter(s)}
            aria-selected={filter === s}
          >
            {s ? s.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : 'All'}
          </button>
        ))}
      </div>

      {error && <div className="alert alert-error mb-4"><span>⚠️</span> {error}</div>}

      {loading ? (
        <div className="loading-center"><div className="spinner" /><span>Loading requests…</span></div>
      ) : requests.length === 0 ? (
        <div className="empty-state">
          <span aria-hidden="true">✅</span>
          <p>No {filter ? filter.replace('_', ' ') : ''} make-up requests at the moment.</p>
        </div>
      ) : (
        <div className="requests-list">
          {requests.map((req) => {
            const student  = req.students;
            const activity = req.activities;
            const makeup   = req.makeup_activities;

            return (
              <div key={req.id} className="request-card">
                <div className="request-card-left">
                  <div className="request-card-name">
                    {student?.first_name} {student?.surname}
                    {student?.student_no && (
                      <span className="text-muted" style={{ fontSize: '0.78rem', marginLeft: 6 }}>
                        #{student.student_no}
                      </span>
                    )}
                  </div>
                  <div className="request-card-meta">
                    <span className="badge badge-pending" style={{ fontSize: '0.72rem' }}>
                      {student?.sections?.name}
                    </span>
                    <span className="text-muted">→</span>
                    <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>{activity?.title}</span>
                  </div>

                  {/* Assigned makeup task */}
                  {makeup ? (
                    <div className="request-makeup-task">
                      <span className="text-muted" style={{ fontSize: '0.72rem', fontWeight: 700 }}>
                        ASSIGNED MAKEUP TASK:
                      </span>
                      <div style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--color-primary)' }}>
                        {makeup.title}
                      </div>
                      <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: 2 }}>
                        {makeup.instructions}
                      </p>
                    </div>
                  ) : (
                    <div className="request-makeup-task">
                      <span className="badge badge-missing" style={{ fontSize: '0.75rem' }}>
                        ⚠️ No makeup task pre-linked (Awaiting assignment)
                      </span>
                    </div>
                  )}

                  {/* Student submission link */}
                  {req.student_submission_link && (
                    <div className="request-submission-box">
                      <span className="text-muted" style={{ fontSize: '0.72rem', fontWeight: 700 }}>
                        STUDENT SUBMISSION LINK:
                      </span>
                      <a
                        href={req.student_submission_link.startsWith('http') ? req.student_submission_link : `https://${req.student_submission_link}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="request-sub-link"
                      >
                        🔗 {req.student_submission_link}
                      </a>
                    </div>
                  )}

                  {req.student_notes && (
                    <div className="request-notes">
                      <span className="text-muted" style={{ fontSize: '0.78rem' }}>Student notes:</span>
                      <p style={{ fontSize: '0.88rem', marginTop: 2 }}>{req.student_notes}</p>
                    </div>
                  )}

                  <div className="text-muted" style={{ fontSize: '0.75rem', marginTop: 'var(--sp-2)' }}>
                    Submitted: {new Date(req.created_at).toLocaleString()}
                  </div>
                </div>

                <div className="request-card-actions">
                  <span className={`badge badge-${req.status}`}>{req.status.replace('_', ' ')}</span>
                  <div className="flex flex-col gap-2" style={{ marginTop: 'var(--sp-2)' }}>
                    {STATUS_OPTIONS.filter((s) => s !== req.status).map((s) => (
                      <button
                        key={s}
                        id={`request-${req.id}-set-${s}`}
                        className={`btn btn-sm ${s === 'denied' ? 'btn-danger' : s === 'approved' ? 'btn-success' : 'btn-ghost'}`}
                        onClick={() => handleStatusUpdate(req.id, s)}
                        disabled={saving === req.id}
                      >
                        {saving === req.id ? '…' : s.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                      </button>
                    ))}
                  </div>
                </div>
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

        .requests-list { display: flex; flex-direction: column; gap: var(--sp-3); }

        .request-card {
          background: var(--bg-card);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-md);
          padding: var(--sp-5);
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: var(--sp-5);
          flex-wrap: wrap;
        }
        .request-card-left { flex: 1; min-width: 0; }
        .request-card-name { font-weight: 600; margin-bottom: 4px; }
        .request-card-meta { display: flex; align-items: center; gap: var(--sp-2); flex-wrap: wrap; margin-bottom: var(--sp-2); }
        .request-notes {
          margin-top: var(--sp-3);
          padding: var(--sp-3);
          background: var(--bg-card-alt);
          border-radius: var(--radius-sm);
          border: 1px solid var(--border-color);
        }
        .request-makeup-task {
          margin-top: var(--sp-2);
          padding: var(--sp-3);
          background: var(--bg-card-alt);
          border-radius: var(--radius-sm);
          border: 1px solid var(--border-color);
        }
        .request-submission-box {
          margin-top: var(--sp-2);
          padding: var(--sp-3);
          background: #f0fdf4;
          border-radius: var(--radius-sm);
          border: 1px solid #bbf7d0;
        }
        @media (prefers-color-scheme: dark) {
          .request-submission-box {
            background: #14532d22;
            border-color: #15803d;
          }
        }
        .request-sub-link {
          color: var(--color-accent);
          font-weight: 500;
          text-decoration: none;
        }
        .request-sub-link:hover { text-decoration: underline; }
        .request-card-actions {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: var(--sp-2);
          flex-shrink: 0;
        }

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
