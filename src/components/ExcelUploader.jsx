import { useState, useRef } from 'react';
import { parseWorkbook } from '../services/excelParser.js';
import { importParsedWorkbook } from '../services/adminService.js';
import { downloadGradebookTemplate } from '../services/exportTemplate.js';

export default function ExcelUploader({ onUploadSuccess }) {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState('');
  const [results, setResults] = useState(null);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setResults(null);
    setError('');
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f && (f.name.endsWith('.xlsx') || f.name.endsWith('.csv'))) {
      setFile(f);
      setResults(null);
      setError('');
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setLoading(true);
    setError('');
    setProgress('Parsing Excel file…');

    try {
      const parsed = await parseWorkbook(file);
      if (!parsed || parsed.length === 0) {
        setError('No valid sheets found in the uploaded file.');
        setLoading(false);
        return;
      }

      setProgress(`Importing ${parsed.length} section(s) to Supabase…`);
      const summary = await importParsedWorkbook(parsed);
      setResults(summary);
      setProgress('');
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      onUploadSuccess?.();
    } catch (err) {
      setError(err.message || 'Upload failed. Please try again.');
      setProgress('');
    } finally {
      setLoading(false);
    }
  };

  const [templateSection, setTemplateSection] = useState('BSIT-3A');
  const [downloading, setDownloading] = useState(false);

  const handleDownloadTemplate = async () => {
    setDownloading(true);
    try {
      await downloadGradebookTemplate(templateSection || 'BSIT-3A');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="uploader-wrap">
      <div className="admin-section-header">
        <h2>📤 Upload Gradebook</h2>
        <p>Upload an Excel file (.xlsx) with one sheet tab per section. Each tab must have Surname, First Name, Student No. columns followed by activity columns formatted as <code>Activity Name [MaxScore]</code>.</p>
      </div>

      {/* Template Download */}
      <div className="template-download-box">
        <div className="template-download-info">
          <span className="template-download-icon" aria-hidden="true">📋</span>
          <div>
            <div className="template-download-title">Don't have the format yet?</div>
            <div className="template-download-sub">
              Download a ready-to-fill Excel template with sample data and instructions.
            </div>
          </div>
        </div>
        <div className="template-download-action">
          <input
            id="template-section-input"
            type="text"
            className="form-input"
            placeholder="Section name (e.g. BSIT-3A)"
            value={templateSection}
            onChange={(e) => setTemplateSection(e.target.value)}
            style={{ width: 180, padding: '8px 12px', fontSize: '0.85rem' }}
          />
          <button
            id="download-template-btn"
            className="btn btn-success"
            onClick={handleDownloadTemplate}
            disabled={downloading}
          >
            {downloading ? 'Generating…' : '⬇ Download Template'}
          </button>
        </div>
      </div>

      {/* Drop zone */}
      <div
        className={`drop-zone ${file ? 'drop-zone--has-file' : ''}`}
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        onClick={() => fileInputRef.current?.click()}
        role="button"
        tabIndex={0}
        aria-label="Click or drag to upload Excel file"
        onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
      >
        <input
          id="excel-file-input"
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.csv"
          onChange={handleFileChange}
          className="sr-only"
        />
        {file ? (
          <div className="drop-zone__file">
            <span aria-hidden="true">📄</span>
            <div>
              <div className="drop-zone__filename">{file.name}</div>
              <div className="text-muted" style={{ fontSize: '0.8rem' }}>
                {(file.size / 1024).toFixed(1)} KB — Click to change
              </div>
            </div>
          </div>
        ) : (
          <div className="drop-zone__prompt">
            <span className="drop-zone__icon" aria-hidden="true">📂</span>
            <div>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>Drop your Excel file here</div>
              <div className="text-muted" style={{ fontSize: '0.85rem' }}>or click to browse — .xlsx files only</div>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="alert alert-error mt-4">
          <span>⚠️</span> {error}
        </div>
      )}

      {progress && (
        <div className="alert alert-info mt-4">
          <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
          {progress}
        </div>
      )}

      {file && !loading && (
        <button
          id="upload-submit-btn"
          className="btn btn-primary mt-4"
          onClick={handleUpload}
        >
          📤 Import to Database
        </button>
      )}

      {/* Results summary */}
      {results && (
        <div className="upload-results mt-6">
          <h3 style={{ marginBottom: 'var(--sp-4)', fontSize: '1rem' }}>
            ✅ Upload Complete
          </h3>
          {results.map((r, i) => (
            <div key={i} className="upload-result-card">
              <div className="upload-result-section">{r.sectionName}</div>
              <div className="upload-result-stats">
                <span>👤 {r.studentsProcessed} students</span>
                <span>📋 {r.activitiesProcessed} activities</span>
                {r.archivedCount > 0 && (
                  <span className="text-muted">🗂 {r.archivedCount} archived</span>
                )}
              </div>

              {/* Duplicate warnings */}
              {r.duplicates?.length > 0 && (
                <div className="alert alert-warning" style={{ marginTop: 'var(--sp-3)' }}>
                  <div>
                    <strong>⚠️ Duplicate credentials detected ({r.duplicates.length})</strong>
                    <p style={{ marginTop: 4, marginBottom: 8 }}>
                      The following students would share the same login credentials.
                      Add or correct their Student No. to disambiguate.
                    </p>
                    <ul style={{ paddingLeft: 20, fontSize: '0.85rem' }}>
                      {r.duplicates.map((d, di) => (
                        <li key={di}>
                          Row {d.row}: <strong>{d.firstName} {d.surname}</strong>
                          {d.studentNo ? ` (No: ${d.studentNo})` : ' (No student no.)'}
                          {' '}— conflicts with row {d.conflictsWith}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <style>{`
        .uploader-wrap { max-width: 680px; }

        .drop-zone {
          border: 2px dashed var(--border-color);
          border-radius: var(--radius-lg);
          padding: var(--sp-10) var(--sp-8);
          text-align: center;
          cursor: pointer;
          transition: border-color var(--transition-base), background var(--transition-base);
          margin-top: var(--sp-6);
        }
        .drop-zone:hover, .drop-zone:focus-visible {
          border-color: var(--color-primary);
          background: var(--color-primary-light);
          outline: none;
        }
        .drop-zone--has-file {
          border-color: var(--color-accent);
          background: #f0fdf4;
        }
        @media (prefers-color-scheme: dark) {
          .drop-zone--has-file { background: #14532d22; }
        }

        .drop-zone__icon { font-size: 2.5rem; margin-bottom: var(--sp-3); display: block; }
        .drop-zone__prompt { display: flex; flex-direction: column; align-items: center; gap: var(--sp-3); }
        .drop-zone__file {
          display: flex;
          align-items: center;
          gap: var(--sp-4);
          font-size: 1.5rem;
        }
        .drop-zone__filename { font-weight: 600; font-size: 1rem; }

        .upload-results { }
        .upload-result-card {
          background: var(--bg-card);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-md);
          padding: var(--sp-5);
          margin-bottom: var(--sp-3);
        }
        .upload-result-section {
          font-weight: 700;
          font-size: 1rem;
          margin-bottom: var(--sp-2);
          color: var(--color-primary);
        }
        .upload-result-stats {
          display: flex;
          gap: var(--sp-4);
          flex-wrap: wrap;
          font-size: 0.88rem;
          color: var(--text-secondary);
        }

        /* Template download box */
        .template-download-box {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: var(--sp-5);
          background: linear-gradient(135deg, #f0fdf4, #dcfce7);
          border: 1.5px solid #86efac;
          border-radius: var(--radius-lg);
          padding: var(--sp-5) var(--sp-6);
          margin-bottom: var(--sp-6);
          flex-wrap: wrap;
        }
        @media (prefers-color-scheme: dark) {
          .template-download-box {
            background: linear-gradient(135deg, #14532d22, #14532d44);
            border-color: #166534;
          }
        }
        .template-download-info {
          display: flex;
          align-items: center;
          gap: var(--sp-4);
          flex: 1;
          min-width: 0;
        }
        .template-download-icon { font-size: 2rem; flex-shrink: 0; }
        .template-download-title {
          font-weight: 700;
          font-size: 0.95rem;
          color: #15803d;
          margin-bottom: 2px;
        }
        .template-download-sub {
          font-size: 0.82rem;
          color: var(--text-secondary);
        }
        .template-download-action {
          display: flex;
          align-items: center;
          gap: var(--sp-3);
          flex-shrink: 0;
          flex-wrap: wrap;
        }
        @media (max-width: 600px) {
          .template-download-box { flex-direction: column; align-items: flex-start; }
          .template-download-action { width: 100%; }
        }
      `}</style>
    </div>
  );
}
