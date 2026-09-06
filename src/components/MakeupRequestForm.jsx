import { useState } from 'react';
import { submitMakeupRequest } from '../services/studentService.js';

export default function MakeupRequestForm({ student, activity, onClose, onSuccess }) {
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    const res = await submitMakeupRequest({
      studentId:    student.id,
      activityId:   activity.id,
      studentNotes: notes.trim() || null,
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
      <div className="modal">
        <div className="modal-header">
          <h2 id="makeup-modal-title" style={{ fontSize: '1.1rem' }}>
            📩 Request Make-up Activity
          </h2>
          <button className="modal-close" onClick={onClose} aria-label="Close request form">×</button>
        </div>

        {/* Activity */}
        <div style={{
          background: 'var(--color-warning-light)',
          border: '1px solid #fcd34d',
          borderRadius: 'var(--radius-md)',
          padding: 'var(--sp-3) var(--sp-4)',
          marginBottom: 'var(--sp-5)',
          fontSize: '0.9rem',
        }}>
          <div className="text-muted" style={{ fontSize: '0.78rem', marginBottom: 2 }}>Missing Activity</div>
          <strong>{activity.title}</strong>
        </div>

        {/* What happens next */}
        <div className="alert alert-info" style={{ marginBottom: 'var(--sp-5)' }}>
          <span>ℹ️</span>
          <span>
            Your request will be sent to your teacher. Once submitted, check back here for status updates.
            Your teacher will review and respond as soon as possible.
          </span>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <div className="form-group" style={{ marginBottom: 'var(--sp-5)' }}>
            <label htmlFor="makeup-notes" className="form-label">
              Notes <span className="text-muted">(optional)</span>
            </label>
            <textarea
              id="makeup-notes"
              className="form-textarea"
              placeholder="Any context about why this activity is missing, or how you plan to submit it…"
              value={notes}
              onChange={(e) => { setNotes(e.target.value); setError(''); }}
              style={{ minHeight: 80 }}
            />
          </div>

          {error && (
            <div className="alert alert-error" style={{ marginBottom: 'var(--sp-4)' }}>
              <span>⚠️</span> {error}
            </div>
          )}

          <div className="flex gap-3">
            <button type="button" className="btn btn-ghost" onClick={onClose} style={{ flex: 1 }}>
              Cancel
            </button>
            <button
              id="makeup-submit-btn"
              type="submit"
              className="btn btn-primary"
              disabled={loading}
              style={{ flex: 2 }}
            >
              {loading ? 'Submitting…' : 'Send Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
