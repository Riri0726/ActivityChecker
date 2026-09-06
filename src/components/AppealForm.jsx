import { useState, useRef } from 'react';
import { submitAppeal, uploadAppealProof } from '../services/studentService.js';

export default function AppealForm({ student, activity, onClose, onSuccess }) {
  const [form, setForm] = useState({ reason: '', notes: '' });
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);

  const handleChange = (e) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
    setError('');
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setError('');

    // Type check
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(selectedFile.type)) {
      setError('Only JPG, PNG, and WEBP image files are supported.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    // 5MB limit
    if (selectedFile.size > 5 * 1024 * 1024) {
      setError('File exceeds 5MB maximum size. Please upload a smaller image.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setFile(selectedFile);
    const objectUrl = URL.createObjectURL(selectedFile);
    setPreviewUrl(objectUrl);
  };

  const handleRemoveFile = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(null);
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.reason.trim()) {
      setError('Please provide a reason for your appeal.');
      return;
    }

    setLoading(true);
    setError('');

    let storagePath = null;

    // Upload image proof if attached
    if (file) {
      setUploadStatus('Uploading proof image…');
      const uploadRes = await uploadAppealProof(file, student.section_id, student.id);
      if (uploadRes.error) {
        setError(uploadRes.error);
        setLoading(false);
        setUploadStatus('');
        return;
      }
      storagePath = uploadRes.storagePath;
    }

    setUploadStatus('Submitting appeal…');
    const res = await submitAppeal({
      studentId:   student.id,
      activityId:  activity.id,
      reason:      form.reason.trim(),
      notes:       form.notes.trim() || null,
      storagePath: storagePath || null,
    });
    setLoading(false);
    setUploadStatus('');

    if (res.error) {
      setError(res.error);
    } else {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
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

          <div className="form-group" style={{ marginBottom: 'var(--sp-4)' }}>
            <label htmlFor="appeal-notes" className="form-label">
              Additional Notes <span className="text-muted">(optional)</span>
            </label>
            <textarea
              id="appeal-notes"
              name="notes"
              className="form-textarea"
              placeholder="Any links or extra context…"
              value={form.notes}
              onChange={handleChange}
              style={{ minHeight: 60 }}
            />
          </div>

          {/* Proof Screenshot Upload (Optional, auto-purged on resolution) */}
          <div className="form-group" style={{ marginBottom: 'var(--sp-5)' }}>
            <label className="form-label">
              Proof Screenshot <span className="text-muted">(optional, max 5MB)</span>
            </label>
            <p className="text-muted" style={{ fontSize: '0.78rem', marginTop: -4, marginBottom: 8 }}>
              Upload submission receipt, LMS screenshot, or photo of work. Image is automatically purged from storage once resolved.
            </p>

            {!file ? (
              <div
                className="appeal-upload-drop"
                onClick={() => fileInputRef.current?.click()}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handleFileChange}
                  className="sr-only"
                />
                <span aria-hidden="true" style={{ fontSize: '1.2rem' }}>📷</span>
                <span style={{ fontSize: '0.88rem', fontWeight: 500 }}>
                  Click to select proof screenshot (PNG, JPG, WEBP)
                </span>
              </div>
            ) : (
              <div className="appeal-file-selected">
                <img src={previewUrl} alt="Proof preview" className="appeal-thumb-preview" />
                <div className="appeal-file-meta">
                  <div className="appeal-file-name">{file.name}</div>
                  <div className="text-muted" style={{ fontSize: '0.78rem' }}>
                    {(file.size / 1024).toFixed(1)} KB
                  </div>
                  <button
                    type="button"
                    className="btn btn-sm btn-ghost"
                    onClick={handleRemoveFile}
                    style={{ color: 'var(--color-danger)', marginTop: 4, padding: '2px 8px' }}
                  >
                    ✕ Remove image
                  </button>
                </div>
              </div>
            )}
          </div>

          {uploadStatus && (
            <div className="alert alert-info" style={{ marginBottom: 'var(--sp-4)' }}>
              <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />
              {uploadStatus}
            </div>
          )}

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
              {loading ? (uploadStatus || 'Submitting…') : 'Submit Appeal'}
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

        .appeal-upload-drop {
          border: 1px dashed var(--border-color);
          border-radius: var(--radius-md);
          padding: var(--sp-4);
          text-align: center;
          cursor: pointer;
          background: var(--bg-card-alt);
          display: flex;
          align-items: center;
          justify-content: center;
          gap: var(--sp-2);
          transition: border-color var(--transition-fast), background var(--transition-fast);
        }
        .appeal-upload-drop:hover {
          border-color: var(--color-primary);
          background: var(--color-primary-light);
        }
        .appeal-file-selected {
          display: flex;
          align-items: center;
          gap: var(--sp-3);
          padding: var(--sp-3);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-md);
          background: var(--bg-card);
        }
        .appeal-thumb-preview {
          width: 64px;
          height: 64px;
          object-fit: cover;
          border-radius: var(--radius-sm);
          border: 1px solid var(--border-color);
        }
        .appeal-file-meta {
          flex: 1;
          min-width: 0;
        }
        .appeal-file-name {
          font-size: 0.85rem;
          font-weight: 500;
          color: var(--text-primary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
      `}</style>
    </div>
  );
}
