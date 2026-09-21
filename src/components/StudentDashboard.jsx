import { useState, useMemo } from 'react';
import AppealForm from './AppealForm.jsx';
import MakeupRequestForm from './MakeupRequestForm.jsx';
import DarkModeToggle from './DarkModeToggle.jsx';
import { submitMakeupProofLink } from '../services/studentService.js';
import './StudentDashboard.css';

function calcPercentage(score, maxScore) {
  if (score === null || score === undefined || maxScore === 0) return null;
  return Math.round((score / maxScore) * 100);
}

function ScoreSummary({ activities, scores }) {
  const { totalScore, totalMax } = useMemo(() => {
    let totalScore = 0, totalMax = 0;
    for (const act of activities) {
      const sc = scores.find((s) => s.activity_id === act.id);
      totalMax += act.max_score || 0;
      if (sc && sc.status === 'done' && sc.score !== null) {
        totalScore += sc.score;
      }
    }
    return { totalScore, totalMax };
  }, [activities, scores]);

  const pct = totalMax > 0 ? Math.round((totalScore / totalMax) * 100) : null;

  return (
    <div className="score-summary">
      <div className="score-summary__label">Total Score</div>
      <div className="score-summary__value">
        {totalScore} <span className="score-summary__max">/ {totalMax}</span>
      </div>
      {pct !== null && (
        <div className="score-summary__pct">{pct}%</div>
      )}
      <div className="score-summary__bar-wrap">
        <div
          className="score-summary__bar"
          style={{ width: `${Math.min(pct ?? 0, 100)}%` }}
        />
      </div>
    </div>
  );
}

export default function StudentDashboard({
  student, activities, scores, appeals, makeupRequests, onBack
}) {
  const [appealTarget, setAppealTarget] = useState(null);
  const [makeupTarget, setMakeupTarget] = useState(null);
  const [viewingRequest, setViewingRequest] = useState(null); // request with unlocked instructions
  const [turnInLink, setTurnInLink] = useState('');
  const [turnInLoading, setTurnInLoading] = useState(false);
  const [turnInError, setTurnInError] = useState('');
  const [localAppeals, setLocalAppeals] = useState(appeals ?? []);
  const [localRequests, setLocalRequests] = useState(makeupRequests ?? []);

  const getScore = (actId) => scores.find((s) => s.activity_id === actId);
  const getAppeal = (actId) => localAppeals.find((a) => a.activity_id === actId);
  const getRequest = (actId) => localRequests.find((r) => r.activity_id === actId);

  const handleTurnInSubmit = async (e) => {
    e.preventDefault();
    if (!turnInLink.trim()) {
      setTurnInError('Please provide your deliverable link or Google Drive URL.');
      return;
    }

    setTurnInLoading(true);
    setTurnInError('');
    try {
      const res = await submitMakeupProofLink(viewingRequest.id, turnInLink.trim());
      if (res.error) {
        setTurnInError(res.error);
      } else {
        setLocalRequests((prev) =>
          prev.map((r) => (r.id === viewingRequest.id ? { ...r, ...res.data, status: 'submitted' } : r))
        );
        setViewingRequest(null);
        setTurnInLink('');
      }
    } catch (err) {
      setTurnInError(err.message);
    } finally {
      setTurnInLoading(false);
    }
  };

  return (
    <div className="dashboard-page">
      <div className="container">
        {/* Header */}
        <header className="dashboard-header">
          <button
            id="back-to-lookup-btn"
            className="btn btn-ghost btn-sm"
            onClick={onBack}
            aria-label="Back to lookup form"
          >
            ← Back
          </button>
          <div className="student-info">
            <div className="student-avatar" aria-hidden="true">
              {student.first_name?.[0]}{student.surname?.[0]}
            </div>
            <div>
              <h1 className="student-name">
                {student.first_name} {student.surname}
              </h1>
              <div className="student-meta">
                <span className="badge badge-pending">{student.sectionName}</span>
                {student.student_no && (
                  <span className="text-muted" style={{ fontSize: '0.85rem' }}>
                    #{student.student_no}
                  </span>
                )}
              </div>
            </div>
          </div>
          <DarkModeToggle variant="header" />
        </header>

        {/* Score Summary (top) */}
        <ScoreSummary activities={activities} scores={scores} />

        {/* Activities Table */}
        <section className="activities-section">
          <h2 className="section-title">Activities</h2>

          {activities.length === 0 ? (
            <div className="card text-center" style={{ padding: 'var(--sp-10)' }}>
              <p>No activities found for your section yet.</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table aria-label="Activity scores">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Activity</th>
                    <th>Status</th>
                    <th>Score</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {activities.map((act, idx) => {
                    const sc = getScore(act.id);
                    const appeal = getAppeal(act.id);
                    const request = getRequest(act.id);
                    const isMissing = !sc || sc.status === 'missing';
                    const pct = sc && !isMissing
                      ? calcPercentage(sc.score, act.max_score)
                      : null;

                    const isClosed = act.accepting_requests === false || (act.request_deadline && new Date(act.request_deadline) < new Date());

                    return (
                      <tr
                        key={act.id}
                        className={isMissing ? 'row-missing' : ''}
                      >
                        <td className="text-muted" style={{ width: 40 }}>{idx + 1}</td>
                        <td>
                          <span className="act-title">{act.title}</span>
                          {act.max_score > 0 && (
                            <span className="act-max text-muted"> / {act.max_score} pts</span>
                          )}
                          {act.request_deadline && (
                            <div style={{ fontSize: '0.72rem', color: isClosed ? '#dc2626' : '#64748b', marginTop: '2px' }}>
                              Make-up Cutoff: {new Date(act.request_deadline).toLocaleDateString()}
                            </div>
                          )}
                        </td>
                        <td>
                          {isMissing
                            ? <span className="badge badge-missing">⚠ Missing</span>
                            : <span className="badge badge-done">✓ Done</span>
                          }
                        </td>
                        <td>
                          {isMissing ? (
                            <span className="text-muted">—</span>
                          ) : (
                            <span className="score-cell">
                              <strong>{sc.score}</strong>
                              {act.max_score > 0 && (
                                <span className="text-muted"> / {act.max_score}</span>
                              )}
                              {pct !== null && (
                                <span className="score-pct">{pct}%</span>
                              )}
                            </span>
                          )}
                        </td>
                        <td>
                          <div className="act-actions" style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'flex-start' }}>
                            {/* Appeal button — any activity */}
                            {appeal ? (
                              <span className={`badge badge-${appeal.status === 'resolved' ? 'done' : appeal.status === 'rejected' ? 'missing' : 'pending'}`} style={{ fontSize: '0.75rem' }}>
                                Appeal: {appeal.status}
                              </span>
                            ) : (
                              <button
                                id={`appeal-btn-${act.id}`}
                                className="btn btn-ghost btn-sm"
                                style={{ fontSize: '0.75rem', padding: '2px 8px' }}
                                onClick={() => setAppealTarget(act)}
                              >
                                📝 Appeal
                              </button>
                            )}

                            {/* Two-Stage Make-up Status / Request */}
                            {isMissing && (
                              request ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                  {request.status === 'pending_review' || request.status === 'pending' ? (
                                    <span style={{ fontSize: '0.75rem', background: '#fef3c7', color: '#b45309', padding: '2px 8px', borderRadius: '4px', fontWeight: 600 }}>
                                      ⏳ Justification Pending
                                    </span>
                                  ) : request.status === 'approved_pending_submission' || request.status === 'approved' ? (
                                    <button
                                      className="btn btn-sm"
                                      style={{ fontSize: '0.75rem', padding: '3px 10px', background: '#22c55e', color: '#fff', border: 'none' }}
                                      onClick={() => {
                                        setViewingRequest(request);
                                        setTurnInLink(request.submission_link || '');
                                      }}
                                    >
                                      🔓 View Task & Turn In
                                    </button>
                                  ) : request.status === 'submitted' ? (
                                    <span style={{ fontSize: '0.75rem', background: '#dcfce7', color: '#166534', padding: '2px 8px', borderRadius: '4px', fontWeight: 600 }}>
                                      ✓ Work Submitted
                                    </span>
                                  ) : request.status === 'completed' ? (
                                    <span style={{ fontSize: '0.75rem', background: '#f1f5f9', color: '#475569', padding: '2px 8px', borderRadius: '4px', fontWeight: 600 }}>
                                      ✅ Completed
                                    </span>
                                  ) : (
                                    <div style={{ fontSize: '0.75rem', color: '#dc2626' }}>
                                      ❌ Request Rejected
                                      {request.instructor_remarks && (
                                        <div style={{ fontSize: '0.7rem', color: '#64748b' }}>({request.instructor_remarks})</div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              ) : isClosed ? (
                                <span style={{ fontSize: '0.72rem', color: '#94a3b8', fontStyle: 'italic' }}>
                                  Requests Closed
                                </span>
                              ) : (
                                <button
                                  id={`makeup-btn-${act.id}`}
                                  className="btn btn-sm"
                                  style={{
                                    fontSize: '0.75rem',
                                    padding: '3px 8px',
                                    background: 'var(--color-warning-light)',
                                    color: '#92400e',
                                    border: '1px solid #fcd34d',
                                  }}
                                  onClick={() => setMakeupTarget(act)}
                                >
                                  Request Make-Up
                                </button>
                              )
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Score Summary (bottom) */}
        <ScoreSummary activities={activities} scores={scores} />
      </div>

      {/* Stage 2: View Unlocked Make-Up Task & Turn-In Modal */}
      {viewingRequest && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal" style={{ maxWidth: '560px' }}>
            <div className="modal-header">
              <h2 style={{ fontSize: '1.15rem', fontWeight: 600, color: '#15803d' }}>
                🎉 Make-Up Request Approved
              </h2>
              <button className="modal-close" onClick={() => setViewingRequest(null)}>✕</button>
            </div>

            <div className="modal-body">
              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '14px', marginBottom: '16px' }}>
                <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#166534', fontWeight: 700 }}>
                  Assigned Assignment
                </div>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#14532d', margin: '4px 0' }}>
                  {viewingRequest.makeup_tasks?.title || 'Custom Make-Up Task'}
                </div>

                <div style={{ fontSize: '0.88rem', color: '#166534', whiteSpace: 'pre-wrap', marginTop: '8px', lineHeight: 1.5 }}>
                  {viewingRequest.makeup_tasks?.instructions || 'Follow instructor guidelines.'}
                </div>

                {viewingRequest.makeup_tasks?.submission_url && (
                  <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px solid #bbf7d0' }}>
                    <a
                      href={viewingRequest.makeup_tasks.submission_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-primary"
                      style={{ fontSize: '0.82rem', padding: '6px 12px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                    >
                      📁 Open Submission Folder / Form ↗
                    </a>
                  </div>
                )}
              </div>

              {viewingRequest.instructor_remarks && (
                <div style={{ background: '#f8fafc', padding: '10px 14px', borderRadius: '6px', fontSize: '0.82rem', color: '#475569', marginBottom: '16px' }}>
                  <strong>Instructor Remarks:</strong> {viewingRequest.instructor_remarks}
                </div>
              )}

              {/* Turn-in form */}
              <form onSubmit={handleTurnInSubmit}>
                <div className="form-group" style={{ marginBottom: '14px' }}>
                  <label className="form-label" style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                    Your Submission Link / Google Drive URL *
                  </label>
                  <input
                    type="url"
                    className="form-input"
                    placeholder="https://drive.google.com/file/d/..."
                    value={turnInLink}
                    onChange={(e) => { setTurnInLink(e.target.value); setTurnInError(''); }}
                    required
                  />
                  <p style={{ margin: '4px 0 0', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                    Paste the view/edit link to your completed deliverable or Google Drive upload.
                  </p>
                </div>

                {turnInError && (
                  <div style={{ padding: '8px 12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', color: '#991b1b', fontSize: '0.82rem', marginBottom: '14px' }}>
                    ⚠️ {turnInError}
                  </div>
                )}

                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setViewingRequest(null)} disabled={turnInLoading}>
                    Close
                  </button>
                  <button type="submit" className="btn btn-primary" style={{ background: '#16a34a', borderColor: '#16a34a' }} disabled={turnInLoading}>
                    {turnInLoading ? 'Submitting…' : 'Mark as Submitted'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Appeal Modal */}
      {appealTarget && (
        <AppealForm
          student={student}
          activity={appealTarget}
          onClose={() => setAppealTarget(null)}
          onSuccess={(newAppeal) => {
            setLocalAppeals((prev) => [newAppeal, ...prev]);
            setAppealTarget(null);
          }}
        />
      )}

      {/* Makeup Request Modal */}
      {makeupTarget && (
        <MakeupRequestForm
          student={student}
          activity={makeupTarget}
          onClose={() => setMakeupTarget(null)}
          onSuccess={(newReq) => {
            setLocalRequests((prev) => [newReq, ...prev]);
            setMakeupTarget(null);
          }}
        />
      )}

      <footer style={{ textAlign: 'center', margin: '36px 0 18px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
        ActivityChecker v0.9.0
      </footer>
    </div>
  );
}
