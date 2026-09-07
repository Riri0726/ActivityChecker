import { useState } from 'react';
import { submitTwoStageMakeupRequest } from '../services/studentService.js';

export default function MakeupRequestForm({ student, activity, onClose, onSuccess }) {
  const [email, setEmail] = useState('');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim() || !email.includes('@')) {
      setError('Please provide a valid email address for status notifications.');
      return;
    }
    if (!reason.trim()) {
      setError('Please provide a justification for missing this activity.');
      return;
    }

    setLoading(true);
    setError('');

    const res = await submitTwoStageMakeupRequest({
      studentId: student.id,
      activityId: activity.id,
      studentEmail: email.trim(),
      reason: reason.trim(),
      notes: notes.trim(),
    });

    setLoading(false);

    if (res.error && !res.existing) {
      setError(res.error);
    } else {
      onSuccess(res.data ?? res.existing);
    }
  };

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="makeup-modal-title">
      <div className="modal" style={{ maxWidth: '520px' }}>
        <div className="modal-header">
          <h2 id="makeup-modal-title" style={{ fontSize: '1.1rem', fontWeight: 600 }}>
            📩 Request Make-Up Activity (Stage 1)
          </h2>
          <button className="modal-close" onClick={onClose} aria-label="Close form">✕</button>
        </div>

        <div className="modal-body">
          {/* Missing Activity Info */}
          <div style={{ background: '#f8fafc', padding: '10px 14px', borderRadius: '6px', marginBottom: '14px', borderLeft: '4px solid var(--color-primary)' }}>
            <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: '#64748b', fontWeight: 700 }}>
              Target Missing Activity
            </div>
            <div style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--color-heading)', marginTop: '2px' }}>
              {activity.title}
            </div>
            {activity.max_score > 0 && (
              <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                Max score: {activity.max_score} pts
              </div>
            )}
          </div>

          <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '6px', padding: '10px 14px', marginBottom: '16px', fontSize: '0.82rem', color: '#1e40af', lineHeight: 1.4 }}>
            ℹ️ <strong>Two-Stage Gatekept Request:</strong> Submit your contact email and justification. Your instructor will review your request. Once approved, the specific make-up assignment guidelines and submission link will be unlocked on your dashboard.
          </div>

          <form onSubmit={handleSubmit} noValidate>
            <div className="form-group" style={{ marginBottom: '12px' }}>
              <label htmlFor="student-email" className="form-label" style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                Your Email Address *
              </label>
              <input
                id="student-email"
                type="email"
                className="form-input"
                placeholder="e.g. student@school.edu"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError(''); }}
                required
              />
              <p style={{ margin: '4px 0 0', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                Used to notify you when your instructor approves or reviews your request.
              </p>
            </div>

            <div className="form-group" style={{ marginBottom: '12px' }}>
              <label htmlFor="student-reason" className="form-label" style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                Justification / Reason for Missing *
              </label>
              <textarea
                id="student-reason"
                className="form-input"
                rows="3"
                placeholder="Explain why you were unable to submit on time (e.g. medical emergency, excused school event, technical difficulties)..."
                value={reason}
                onChange={(e) => { setReason(e.target.value); setError(''); }}
                required
              />
            </div>

            <div className="form-group" style={{ marginBottom: '16px' }}>
              <label htmlFor="student-notes" className="form-label" style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                Additional Notes / Supporting Details (Optional)
              </label>
              <input
                id="student-notes"
                type="text"
                className="form-input"
                placeholder="e.g. Excused slip submitted to teacher"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            {error && (
              <div style={{ padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', color: '#991b1b', fontSize: '0.85rem', marginBottom: '14px' }}>
                ⚠️ {error}
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? 'Submitting Request…' : 'Submit Justification'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
