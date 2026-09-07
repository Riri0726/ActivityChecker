import { useState, useRef } from 'react';
import { submitAppeal, uploadAndCompressAppealProof } from '../services/studentService.js';

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

    // Strict image proof requirement
    if (!file) {
      setError('An image proof screenshot is strictly mandatory for score appeals.');
      return;
    }

    setLoading(true);
    setError('');

    let storagePath = null;

    setUploadStatus('Compressing image client-side under 500 KB…');
    const uploadRes = await uploadAndCompressAppealProof(file, student.section_id, student.id);
    if (uploadRes.error) {
      setError(uploadRes.error);
      setLoading(false);
      setUploadStatus('');
      return;
    }
    storagePath = uploadRes.storagePath;

    setUploadStatus('Submitting appeal record…');
    const res = await submitAppeal({
      studentId: student.id,
      activityId: activity.id,
      reason: form.reason.trim(),
      notes: form.notes.trim() || null,
      storagePath,
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
      <div className="modal" style={{ maxWidth: '520px' }}>
        <div className="modal-header">
          <h2 id="appeal-modal-title" style={{ fontSize: '1.1rem', fontWeight: 600 }}>
            📝 File an Appeal
          </h2>
          <button className="modal-close" onClick={onClose} aria-label="Close modal">✕</button>
        </div>

        <div className="modal-body">
          <div style={{ background: '#f8fafc', padding: '10px 14px', borderRadius: '6px', marginBottom: '14px', fontSize: '0.85rem' }}>
            Activity: <strong style={{ color: 'var(--color-heading)' }}>{activity.title}</strong>
          </div>

          <form onSubmit={handleSubmit} noValidate>
            <div className="form-group" style={{ marginBottom: '12px' }}>
              <label htmlFor="appeal-reason" className="form-label" style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                Reason for Appeal *
              </label>
              <select
                id="appeal-reason"
                name="reason"
                className="form-input"
                value={form.reason}
                onChange={handleChange}
                required
              >
                <option value="">-- Select a reason --</option>
                <option value="Submitted on time but marked missing">Submitted on time but marked missing</option>
                <option value="Score mismatch with actual grade received">Score mismatch with actual grade received</option>
                <option value="Submitted via alternative channel / email">Submitted via alternative channel / email</option>
                <option value="Other dispute">Other dispute</option>
              </select>
            </div>

            <div className="form-group" style={{ marginBottom: '12px' }}>
              <label htmlFor="appeal-notes" className="form-label" style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                Detailed Explanation
              </label>
              <textarea
                id="appeal-notes"
                name="notes"
                className="form-input"
                rows="3"
                placeholder="Explain the circumstances, date submitted, or platform used..."
                value={form.notes}
                onChange={handleChange}
              />
            </div>

            {/* Strict Image Proof */}
            <div className="form-group" style={{ marginBottom: '16px' }}>
              <label className="form-label" style={{ fontWeight: 600, fontSize: '0.85rem', display: 'flex', justifyContent: 'space-between' }}>
                <span>Screenshot Proof *</span>
                <span style={{ fontSize: '0.75rem', color: '#dc2626' }}>Mandatory</span>
              </label>

              {!file ? (
                <div
                  style={{
                    border: '2px dashed var(--color-border)',
                    borderRadius: '8px',
                    padding: '20px',
                    textAlign: 'center',
                    cursor: 'pointer',
                    background: '#f8fafc',
                  }}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <div style={{ fontSize: '1.8rem', marginBottom: '4px' }}>📷</div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-primary)' }}>
                    Attach Turn-in Screenshot / Receipt
                  </div>
                  <p style={{ margin: '4px 0 0', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                    PNG, JPG, or WEBP. Automatically compressed under 500 KB. Auto-purged once reviewed.
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    style={{ display: 'none' }}
                    onChange={handleFileChange}
                  />
                </div>
              ) : (
                <div style={{ border: '1px solid var(--color-border)', borderRadius: '8px', padding: '10px', background: '#fff' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#166534' }}>
                      ✓ Image attached ({Math.round(file.size / 1024)} KB)
                    </span>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ fontSize: '0.75rem', padding: '2px 8px', color: '#dc2626' }}
                      onClick={handleRemoveFile}
                    >
                      Remove
                    </button>
                  </div>
                  {previewUrl && (
                    <img
                      src={previewUrl}
                      alt="Proof Preview"
                      style={{ maxHeight: '160px', width: '100%', objectFit: 'contain', borderRadius: '4px', background: '#f1f5f9' }}
                    />
                  )}
                </div>
              )}
            </div>

            {uploadStatus && (
              <div style={{ fontSize: '0.82rem', color: 'var(--color-primary)', marginBottom: '12px', textAlign: 'center' }}>
                ⏳ {uploadStatus}
              </div>
            )}

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
                {loading ? 'Submitting…' : 'Submit Appeal'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
