import { useState } from 'react';
import { submitAppeal } from '../services/studentService.js';

export default function AppealForm({ student, activity, onClose, onSuccess }) {
  const [form, setForm] = useState({ reason: '', notes: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.reason.trim()) {
      setError('Please provide a reason for your appeal.');
      return;
    }

    setLoading(true);
    const res = await submitAppeal({
      studentId:  student.id,
      activityId: activity.id,
      reason:     form.reason.trim(),
      notes:      form.notes.trim() || null,
    });
    setLoading(false);

    if (res.error) {
      setError(res.error);
    } else {
      onSuccess(res.data);
    }
  };

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="appeal-modal-title">
      <div className="modal">
        <div className="modal-header">
          <h2 id="appeal-modal-title" style={{ fontSize: '1.1rem' }}>
            📝 File an Appeal
          </h2>
          <button className="modal-close" onClick={onClose} aria-label="Close appeal form">×</button>
        </div>

        {/* Activity info */}
        <div className="appeal-activity-info">
          <span className="text-muted" style={{ fontSize: '0.82rem' }}>Activity</span>
          <strong>{activity.title}</strong>
          {activity.max_score > 0 && (
            <span className="text-muted">Max score: {activity.max_score}</span>
          )}
        </div>

        {/* Student info (read-only) */}
        <div className="appeal-student-info">
          <span className="text-muted" style={{ fontSize: '0.82rem' }}>Student</span>
          <span>{student.first_name} {student.surname}</span>
          {student.student_no && <span className="text-muted">#{student.student_no}</span>}
          <span className="badge badge-pending">{student.sectionName}</span>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <div className="form-group" style={{ marginBottom: 'var(--sp-4)' }}>
            <label htmlFor="appeal-reason" className="form-label">
              Reason for Appeal <span style={{ color: 'var(--color-danger)' }}>*</span>
            </label>
            <textarea
              id="appeal-reason"
              name="reason"
              className="form-textarea"
              placeholder="Explain why you are filing this appeal (e.g., score is wrong, activity marked missing but you submitted it)…"
              value={form.reason}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group" style={{ marginBottom: 'var(--sp-5)' }}>
            <label htmlFor="appeal-notes" className="form-label">
              Additional Notes / Evidence <span className="text-muted">(optional)</span>
            </label>
            <textarea
              id="appeal-notes"
              name="notes"
              className="form-textarea"
              placeholder="Any links, screenshots, or extra details…"
              value={form.notes}
              onChange={handleChange}
              style={{ minHeight: 70 }}
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
              id="appeal-submit-btn"
              type="submit"
              className="btn btn-primary"
              disabled={loading}
              style={{ flex: 2 }}
            >
              {loading ? 'Submitting…' : 'Submit Appeal'}
            </button>
          </div>
        </form>
      </div>

      <style>{`
        .appeal-activity-info,
        .appeal-student-info {
          display: flex;
          flex-direction: column;
          gap: 2px;
          background: var(--bg-card-alt);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-md);
          padding: var(--sp-3) var(--sp-4);
          margin-bottom: var(--sp-5);
          font-size: 0.9rem;
        }
        .appeal-student-info {
          flex-direction: row;
          align-items: center;
          flex-wrap: wrap;
          gap: var(--sp-2);
        }
      `}</style>
    </div>
  );
}
