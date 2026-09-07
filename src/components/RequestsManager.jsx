import { useState, useEffect } from 'react';
import { getMakeupRequests, decideMakeupRequest, getMakeupTasks } from '../services/adminService.js';
import { useAuth } from '../context/AuthContext.jsx';

const STATUS_TABS = [
  { id: '', label: 'All' },
  { id: 'pending_review', label: 'Pending Justification' },
  { id: 'approved_pending_submission', label: 'Approved (Pending Turn-In)' },
  { id: 'submitted', label: 'Student Submitted' },
  { id: 'completed', label: 'Completed' },
  { id: 'rejected', label: 'Rejected' },
];

export default function RequestsManager({ onUpdate }) {
  const { selectedSubjectId } = useAuth();
  const [requests, setRequests] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('pending_review');
  const [saving, setSaving] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Decision Modal State
  const [decisionModal, setDecisionModal] = useState(null); // { request, decision: 'approved' | 'rejected' | 'completed' }
  const [selectedTaskId, setSelectedTaskId] = useState('');
  const [remarks, setRemarks] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [reqData, taskData] = await Promise.all([
        getMakeupRequests({ status: filter || undefined }),
        getMakeupTasks(selectedSubjectId || null),
      ]);
      setRequests(reqData);
      setTasks(taskData);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [filter, selectedSubjectId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const openDecisionModal = (req, decision) => {
    setDecisionModal({ request: req, decision });
    setSelectedTaskId(req.makeup_task_id || (tasks[0]?.id || ''));
    setRemarks(req.instructor_remarks || '');
    setError('');
  };

  const closeDecisionModal = () => {
    setDecisionModal(null);
    setSelectedTaskId('');
    setRemarks('');
  };

  const handleConfirmDecision = async () => {
    if (!decisionModal) return;
    const { request: req, decision } = decisionModal;

    if (decision === 'rejected' && !remarks.trim()) {
      setError('Please provide instructor remarks/reason when rejecting a request.');
      return;
    }

    setSaving(req.id);
    setError('');
    try {
      const assignedTask = tasks.find((t) => t.id === selectedTaskId);
      await decideMakeupRequest({
        requestId: req.id,
        decision,
        makeupTaskId: decision === 'approved' ? (selectedTaskId || null) : req.makeup_task_id,
        instructorRemarks: remarks.trim(),
        studentEmail: req.student_email,
        studentName: `${req.students?.first_name} ${req.students?.surname}`,
        activityTitle: req.activities?.title,
        instructionsUrl: assignedTask?.submission_url || '',
      });

      setSuccess(`Request marked as ${decision}.`);
      closeDecisionModal();
      await loadData();
      onUpdate?.();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(null);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'pending_review':
      case 'pending':
        return <span style={{ background: '#fef3c7', color: '#b45309', padding: '3px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600 }}>⏳ Pending Review</span>;
      case 'approved_pending_submission':
      case 'approved':
        return <span style={{ background: '#dbeafe', color: '#1e40af', padding: '3px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600 }}>🔓 Approved / Awaiting Turn-In</span>;
      case 'submitted':
        return <span style={{ background: '#dcfce7', color: '#166534', padding: '3px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600 }}>📩 Work Submitted</span>;
      case 'completed':
        return <span style={{ background: '#f1f5f9', color: '#475569', padding: '3px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600 }}>✅ Completed & Graded</span>;
      case 'rejected':
      case 'denied':
        return <span style={{ background: '#fee2e2', color: '#991b1b', padding: '3px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600 }}>❌ Rejected</span>;
      default:
        return <span style={{ background: '#f1f5f9', color: '#64748b', padding: '3px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600 }}>{status}</span>;
    }
  };

  return (
    <div>
      <div className="admin-section-header" style={{ marginBottom: 'var(--sp-4)' }}>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 700, margin: 0, color: 'var(--color-heading)' }}>
          Two-Stage Make-Up Workflows
        </h2>
        <p style={{ margin: '4px 0 0', color: 'var(--color-text-muted)', fontSize: '0.88rem' }}>
          Stage 1: Review student justification. Stage 2: Reveal assigned instructions & verify submitted work.
        </p>
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: 'var(--sp-4)' }}>
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.id}
            className={`btn ${filter === tab.id ? 'btn-primary' : 'btn-secondary'}`}
            style={{ fontSize: '0.8rem', padding: '6px 12px', borderRadius: '20px' }}
            onClick={() => setFilter(tab.id)}
          >
            {tab.label}
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

      {/* Decision Modal */}
      {decisionModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px',
        }}>
          <div className="card" style={{ maxWidth: '540px', width: '100%', padding: '24px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ margin: '0 0 12px', fontSize: '1.2rem', fontWeight: 600 }}>
              {decisionModal.decision === 'approved' && 'Approve Make-Up Request'}
              {decisionModal.decision === 'rejected' && 'Reject Make-Up Request'}
              {decisionModal.decision === 'completed' && 'Mark Request as Completed'}
            </h3>

            <p style={{ margin: '0 0 16px', fontSize: '0.88rem', color: 'var(--color-text-muted)' }}>
              Student: <strong>{decisionModal.request.students?.first_name} {decisionModal.request.students?.surname}</strong> ({decisionModal.request.student_email || 'No email'})
              <br />
              Target Activity: <strong>{decisionModal.request.activities?.title}</strong>
            </p>

            {decisionModal.decision === 'approved' && (
              <div style={{ marginBottom: '16px' }}>
                <label className="form-label" style={{ display: 'block', marginBottom: '6px', fontWeight: 600, fontSize: '0.85rem' }}>
                  Assign Make-Up Task Instructions *
                </label>
                {tasks.length === 0 ? (
                  <div style={{ padding: '10px', background: '#fef3c7', borderRadius: '6px', fontSize: '0.82rem', color: '#b45309' }}>
                    No reusable make-up tasks created yet. Please create one in the Make-Up Tasks tab first, or instructions will remain generic.
                  </div>
                ) : (
                  <select
                    className="form-input"
                    value={selectedTaskId}
                    onChange={(e) => setSelectedTaskId(e.target.value)}
                    required
                  >
                    {tasks.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.title} ({t.submission_mode === 'gdrive_link' ? 'Google Drive' : t.submission_mode})
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}

            <div style={{ marginBottom: '20px' }}>
              <label className="form-label" style={{ display: 'block', marginBottom: '6px', fontWeight: 600, fontSize: '0.85rem' }}>
                Instructor Remarks / Feedback {decisionModal.decision === 'rejected' && '*'}
              </label>
              <textarea
                className="form-input"
                rows="3"
                placeholder={decisionModal.decision === 'rejected' ? 'Explain reason for rejection...' : 'Optional notes or instructions for the student...'}
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                required={decisionModal.decision === 'rejected'}
              />
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={closeDecisionModal}>
                Cancel
              </button>
              <button
                className={`btn ${decisionModal.decision === 'rejected' ? 'btn-danger' : 'btn-primary'}`}
                onClick={handleConfirmDecision}
                disabled={saving === decisionModal.request.id}
              >
                {saving === decisionModal.request.id ? 'Processing...' : 'Confirm Decision'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Requests List */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--color-text-muted)' }}>
          Loading requests...
        </div>
      ) : requests.length === 0 ? (
        <div className="card text-center" style={{ padding: '40px', border: '1px dashed var(--color-border)' }}>
          <div style={{ fontSize: '2rem', marginBottom: '8px' }}>✅</div>
          <h3 style={{ margin: '0 0 4px', fontSize: '1.1rem' }}>No requests in this category</h3>
          <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: '0.88rem' }}>
            All student submissions are up to date.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {requests.map((req) => {
            const student = req.students;
            const activity = req.activities;
            const makeup = req.makeup_tasks;
            const isPendingReview = req.status === 'pending_review' || req.status === 'pending';
            const isSubmitted = req.status === 'submitted';
            const isApproved = req.status === 'approved_pending_submission' || req.status === 'approved';

            return (
              <div
                key={req.id}
                className="card"
                style={{
                  padding: '18px',
                  border: '1px solid var(--color-border)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  gap: '16px',
                  flexWrap: 'wrap',
                }}
              >
                <div style={{ flex: 1, minWidth: '280px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                    <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 600, color: 'var(--color-heading)' }}>
                      {student?.first_name} {student?.surname}
                    </h3>
                    {student?.student_no && (
                      <span style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
                        #{student.student_no}
                      </span>
                    )}
                    <span style={{ fontSize: '0.78rem', background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px' }}>
                      {student?.sections?.name}
                    </span>
                    {getStatusBadge(req.status)}
                  </div>

                  <div style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginBottom: '10px' }}>
                    Target Activity: <strong style={{ color: 'var(--color-text)' }}>{activity?.title}</strong>
                    {req.student_email && (
                      <span style={{ marginLeft: '12px' }}>
                        ✉️ <a href={`mailto:${req.student_email}`} style={{ color: 'var(--color-primary)' }}>{req.student_email}</a>
                      </span>
                    )}
                  </div>

                  {/* Student Justification (Stage 1) */}
                  <div style={{ background: '#f8fafc', padding: '10px 14px', borderRadius: '6px', borderLeft: '4px solid var(--color-primary)', marginBottom: '10px' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '2px' }}>
                      Student Justification / Reason:
                    </div>
                    <div style={{ fontSize: '0.88rem', color: '#1e293b', whiteSpace: 'pre-wrap' }}>
                      {req.reason || req.student_notes || 'No reason provided.'}
                    </div>
                  </div>

                  {/* Assigned Task (Stage 2) */}
                  {makeup && (
                    <div style={{ background: '#f0f9ff', padding: '10px 14px', borderRadius: '6px', borderLeft: '4px solid #0284c7', marginBottom: '10px' }}>
                      <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#0369a1', textTransform: 'uppercase', marginBottom: '2px' }}>
                        Assigned Task: {makeup.title}
                      </div>
                      <div style={{ fontSize: '0.82rem', color: '#0c4a6e' }}>
                        {makeup.instructions}
                      </div>
                      {makeup.submission_url && (
                        <div style={{ fontSize: '0.8rem', marginTop: '4px' }}>
                          <a href={makeup.submission_url} target="_blank" rel="noopener noreferrer" style={{ color: '#0284c7', textDecoration: 'underline' }}>
                            View Submission Folder / Link ↗
                          </a>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Student Submission Proof Link */}
                  {(req.submission_link || req.student_submission_link) && (
                    <div style={{ background: '#f0fdf4', padding: '10px 14px', borderRadius: '6px', borderLeft: '4px solid #16a34a', marginBottom: '10px' }}>
                      <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#15803d', textTransform: 'uppercase', marginBottom: '2px' }}>
                        Student Submitted Deliverable Link:
                      </div>
                      <a
                        href={(req.submission_link || req.student_submission_link).startsWith('http') ? (req.submission_link || req.student_submission_link) : `https://${req.submission_link || req.student_submission_link}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ fontSize: '0.88rem', color: '#16a34a', fontWeight: 600, textDecoration: 'underline', wordBreak: 'break-all' }}
                      >
                        🔗 {req.submission_link || req.student_submission_link}
                      </a>
                    </div>
                  )}

                  {/* Instructor Remarks */}
                  {req.instructor_remarks && (
                    <div style={{ fontSize: '0.82rem', color: '#64748b', marginTop: '6px' }}>
                      Remarks: <em>{req.instructor_remarks}</em>
                    </div>
                  )}

                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '8px' }}>
                    Requested on: {new Date(req.created_at).toLocaleString()}
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minWidth: '160px', alignItems: 'stretch' }}>
                  {isPendingReview && (
                    <>
                      <button
                        className="btn btn-primary"
                        style={{ fontSize: '0.82rem', padding: '8px 12px' }}
                        onClick={() => openDecisionModal(req, 'approved')}
                      >
                        ✓ Approve & Assign
                      </button>
                      <button
                        className="btn btn-secondary"
                        style={{ fontSize: '0.82rem', padding: '8px 12px', color: '#dc2626' }}
                        onClick={() => openDecisionModal(req, 'rejected')}
                      >
                        ✕ Reject
                      </button>
                    </>
                  )}

                  {isSubmitted && (
                    <button
                      className="btn btn-primary"
                      style={{ fontSize: '0.82rem', padding: '8px 12px', background: '#16a34a', borderColor: '#16a34a' }}
                      onClick={() => openDecisionModal(req, 'completed')}
                    >
                      ✓ Mark Completed
                    </button>
                  )}

                  {isApproved && (
                    <div style={{ fontSize: '0.78rem', color: '#0369a1', textAlign: 'center', padding: '6px', background: '#f0f9ff', borderRadius: '4px' }}>
                      Awaiting student turn-in
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
