import { useState, useEffect } from 'react';
import { submitMakeupRequest, getMakeupOptionsForActivity } from '../services/studentService.js';

export default function MakeupRequestForm({ student, activity, onClose, onSuccess }) {
  const [options, setOptions] = useState([]);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [selectedOptionId, setSelectedOptionId] = useState('');
  const [submissionLink, setSubmissionLink] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadOptions();
  }, [activity.id]);

  const loadOptions = async () => {
    setLoadingOptions(true);
    try {
      const data = await getMakeupOptionsForActivity(activity.id);
      setOptions(data);
      if (data.length > 0) {
        setSelectedOptionId(data[0].id);
      }
    } catch (e) {
      console.warn('Failed to load makeup options:', e);
    } finally {
      setLoadingOptions(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const res = await submitMakeupRequest({
      studentId:              student.id,
      activityId:             activity.id,
      makeupActivityId:       selectedOptionId || null,
      studentSubmissionLink:  submissionLink.trim() || null,
      studentNotes:           notes.trim() || null,
    });
    setLoading(false);

    if (res.error && !res.existing) {
      setError(res.error);
    } else {
      onSuccess(res.data ?? res.existing);
    }
  };

  const selectedOption = options.find((opt) => opt.id === selectedOptionId);

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="makeup-modal-title">
      <div className="modal" style={{ maxWidth: 560 }}>
        <div className="modal-header">
          <h2 id="makeup-modal-title" style={{ fontSize: '1.1rem' }}>
            📩 Request Make-up Activity
          </h2>
          <button className="modal-close" onClick={onClose} aria-label="Close request form">×</button>
        </div>

        {/* Activity Banner */}
        <div className="makeup-activity-banner">
          <div className="text-muted" style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Missing Activity
          </div>
          <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)', marginTop: 2 }}>
            {activity.title}
          </div>
          {activity.max_score > 0 && (
            <div className="text-muted" style={{ fontSize: '0.8rem', marginTop: 2 }}>
              Max score: {activity.max_score} pts
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} noValidate>
          {loadingOptions ? (
            <div className="loading-center" style={{ padding: 'var(--sp-4) 0' }}>
              <div className="spinner" style={{ width: 18, height: 18 }} />
              <span style={{ fontSize: '0.88rem' }}>Loading makeup activity options…</span>
            </div>
          ) : options.length > 0 ? (
            <div className="form-group mb-4">
              <label className="form-label">
                Choose Make-up Assignment
              </label>
              <div className="makeup-options-list">
                {options.map((opt) => (
                  <label
                    key={opt.id}
                    className={`makeup-option-card ${selectedOptionId === opt.id ? 'selected' : ''}`}
                  >
                    <input
                      type="radio"
                      name="makeup_task"
                      value={opt.id}
                      checked={selectedOptionId === opt.id}
                      onChange={() => setSelectedOptionId(opt.id)}
                      className="sr-only"
                    />
                    <div className="makeup-option-radio">
                      <span className="makeup-radio-dot" />
                    </div>
                    <div className="makeup-option-info">
                      <div className="makeup-option-title">{opt.title}</div>
                      {opt.description && (
                        <div className="makeup-option-desc">{opt.description}</div>
                      )}
                    </div>
                  </label>
                ))}
              </div>

              {/* Instructions Box for the selected makeup task */}
              {selectedOption && (
                <div className="makeup-instructions-display mt-3">
                  <div className="instructions-header">
                    <span>📋 Instructions & Submission Requirements</span>
                  </div>
                  <p className="instructions-text">
                    {selectedOption.instructions}
                  </p>
                </div>
              )}

              {/* Submission Link input */}
              <div className="form-group mt-3">
                <label className="form-label" htmlFor="submission-link">
                  Submission Link / URL <span className="text-muted">(e.g. Google Drive, GitHub)</span>
                </label>
                <input
                  id="submission-link"
                  type="url"
                  className="form-input"
                  placeholder="https://drive.google.com/… or link to work"
                  value={submissionLink}
                  onChange={(e) => setSubmissionLink(e.target.value)}
                />
              </div>
            </div>
          ) : (
            <div className="alert alert-info mb-4">
              <span>ℹ️</span>
              <div>
                <strong>No makeup activity pre-assigned yet</strong>
                <p style={{ marginTop: 4, fontSize: '0.85rem' }}>
                  Your teacher has not linked a specific alternative task for this activity yet.
                  You can still send this request to notify them that you wish to make it up.
                </p>
              </div>
            </div>
          )}

          {/* Notes field */}
          <div className="form-group mb-4">
            <label htmlFor="makeup-notes" className="form-label">
              Notes for Teacher <span className="text-muted">(optional)</span>
            </label>
            <textarea
              id="makeup-notes"
              className="form-textarea"
              placeholder="Any context or remarks about this missing activity…"
              value={notes}
              onChange={(e) => { setNotes(e.target.value); setError(''); }}
              style={{ minHeight: 65 }}
            />
          </div>

          {error && (
            <div className="alert alert-error mb-4">
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
              disabled={loading || loadingOptions}
              style={{ flex: 2 }}
            >
              {loading ? 'Submitting…' : 'Send Make-up Request'}
            </button>
          </div>
        </form>
      </div>

      <style>{`
        .makeup-activity-banner {
          background: #fffbeb;
          border: 1px solid #fef3c7;
          border-left: 4px solid var(--color-warning);
          border-radius: var(--radius-md);
          padding: var(--sp-3) var(--sp-4);
          margin-bottom: var(--sp-4);
        }
        @media (prefers-color-scheme: dark) {
          .makeup-activity-banner {
            background: #451a0322;
            border-color: #78350f;
          }
        }
        .makeup-options-list {
          display: flex;
          flex-direction: column;
          gap: var(--sp-2);
        }
        .makeup-option-card {
          display: flex;
          align-items: flex-start;
          gap: var(--sp-3);
          padding: var(--sp-3);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-md);
          cursor: pointer;
          background: var(--bg-card);
          transition: border-color var(--transition-fast), background var(--transition-fast);
        }
        .makeup-option-card:hover {
          border-color: var(--color-primary);
          background: var(--bg-card-alt);
        }
        .makeup-option-card.selected {
          border-color: var(--color-primary);
          background: var(--color-primary-light);
        }
        .makeup-option-radio {
          width: 18px;
          height: 18px;
          border-radius: 50%;
          border: 2px solid var(--border-color);
          display: flex;
          align-items: center;
          justify-content: center;
          margin-top: 2px;
          flex-shrink: 0;
        }
        .makeup-option-card.selected .makeup-option-radio {
          border-color: var(--color-primary);
        }
        .makeup-radio-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: transparent;
        }
        .makeup-option-card.selected .makeup-radio-dot {
          background: var(--color-primary);
        }
        .makeup-option-info {
          flex: 1;
        }
        .makeup-option-title {
          font-size: 0.92rem;
          font-weight: 600;
          color: var(--text-primary);
        }
        .makeup-option-desc {
          font-size: 0.8rem;
          color: var(--text-secondary);
          margin-top: 2px;
        }
        .makeup-instructions-display {
          background: var(--bg-card-alt);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-md);
          padding: var(--sp-3) var(--sp-4);
        }
        .instructions-header {
          font-size: 0.78rem;
          font-weight: 700;
          color: var(--text-primary);
          text-transform: uppercase;
          letter-spacing: 0.04em;
          margin-bottom: 4px;
        }
        .instructions-text {
          font-size: 0.85rem;
          line-height: 1.5;
          color: var(--text-primary);
          white-space: pre-wrap;
          word-break: break-word;
        }
      `}</style>
    </div>
  );
}
