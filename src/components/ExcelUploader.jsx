import { useState, useRef } from 'react';
import { supabase } from '../services/supabase.js';
import { parseWorkbook } from '../services/excelParser.js';
import { importParsedWorkbook } from '../services/adminService.js';
import { downloadGradebookTemplate } from '../services/exportTemplate.js';
import FilePreview from './FilePreview.jsx';
import { useAuth } from '../context/AuthContext.jsx';

export default function ExcelUploader({ onUploadSuccess }) {
  const { selectedSubjectId, subjects, adminProfile } = useAuth();
  const [file, setFile] = useState(null);
  const [parsing, setParsing] = useState(false);
  const [parsedSheets, setParsedSheets] = useState(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState('');
  const [results, setResults] = useState(null);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);

  // Toast System
  const [toasts, setToasts] = useState([]);
  
  const addToast = (type, message) => {
    const id = Date.now() + Math.random().toString();
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  };

  /**
   * Compute live diff against Supabase for visual preview before import
   */
  const computeWorkbookDiff = async (sheets) => {
    try {
      for (const sheet of sheets) {
        const { sectionName, students, activities, scores } = sheet;

        const { data: section, error: sectionErr } = await supabase
          .from('sections')
          .select('id')
          .eq('name', sectionName)
          .maybeSingle();

        if (sectionErr) {
          console.warn('[ExcelUploader] Error fetching section:', sectionErr);
        }

        if (!section) {
          sheet.diff = {
            addedStudents: students,
            modifiedScores: [],
            unchangedCount: 0,
            archivedActivities: [],
          };
          continue;
        }

        // Fetch existing students in DB
        const { data: dbStudents, error: studentErr } = await supabase
          .from('students')
          .select('id, access_key')
          .eq('section_id', section.id);

        if (studentErr) {
          console.warn('[ExcelUploader] Error fetching students:', studentErr);
        }

        const dbStudentMap = new Map();
        (dbStudents || []).forEach((s) => dbStudentMap.set(s.access_key, s.id));

        // Fetch existing activities in DB
        const { data: dbActivities, error: actErr } = await supabase
          .from('activities')
          .select('id, title')
          .eq('section_id', section.id)
          .eq('archived', false);

        if (actErr) {
          console.warn('[ExcelUploader] Error fetching activities:', actErr);
        }

        const dbActMap = new Map();
        (dbActivities || []).forEach((a) => dbActMap.set(a.title.toLowerCase().trim(), a.id));

        const uploadedTitlesSet = new Set(activities.map((a) => a.title.toLowerCase().trim()));
        const archivedActs = (dbActivities || []).filter((a) => !uploadedTitlesSet.has(a.title.toLowerCase().trim()));

        // Fetch existing scores in DB
        const studentIds = Array.from(dbStudentMap.values());
        const dbScoresMap = new Map();
        if (studentIds.length > 0) {
          const { data: dbScores, error: scoreErr } = await supabase
            .from('scores')
            .select('student_id, activity_id, score, status')
            .in('student_id', studentIds);
          
          if (scoreErr) {
            console.warn('[ExcelUploader] Error fetching scores:', scoreErr);
          }

          (dbScores || []).forEach((sc) => {
            dbScoresMap.set(`${sc.student_id}_${sc.activity_id}`, sc);
          });
        }

        const addedStudents = [];
        const modifiedScores = [];
        let unchangedCount = 0;

        for (let i = 0; i < students.length; i++) {
          const st = students[i];
          const dbStudentId = dbStudentMap.get(st.accessKey);
          if (!dbStudentId) {
            addedStudents.push(st);
          }

          const rowScores = scores[i]?.studentScores || [];
          for (const sc of rowScores) {
            const actId = dbActMap.get(sc.activityTitle.toLowerCase().trim());
            if (!dbStudentId || !actId) continue;

            const existingSc = dbScoresMap.get(`${dbStudentId}_${actId}`);
            const newScoreVal = sc.score;
            const oldScoreVal = existingSc ? existingSc.score : null;

            if (existingSc && oldScoreVal === newScoreVal) {
              unchangedCount++;
            } else if (newScoreVal !== null || existingSc) {
              modifiedScores.push({
                accessKey: st.accessKey,
                activityTitle: sc.activityTitle,
                oldScore: oldScoreVal,
                newScore: newScoreVal,
              });
            }
          }
        }

        sheet.diff = {
          addedStudents,
          modifiedScores,
          unchangedCount,
          archivedActivities: archivedActs,
        };
      }
    } catch (err) {
      console.error('[ExcelUploader] Error computing diff:', err);
    }
  };

  const processFile = async (f) => {
    if (!f) return;
    setFile(f);
    setResults(null);
    setError('');
    setParsing(true);
    setParsedSheets(null);
    addToast('info', 'Reading Excel file...');

    try {
      const parsed = await parseWorkbook(f);
      if (!parsed || parsed.length === 0) {
        const msg = 'No valid sheets found in the uploaded file. Ensure sheets have student columns.';
        setError(msg);
        addToast('error', msg);
        setFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
      } else {
        await computeWorkbookDiff(parsed);
        setParsedSheets(parsed);
        addToast('success', 'File parsed successfully! Review the changes below.');
      }
    } catch (err) {
      console.error('[ExcelUploader] Parse error:', err);
      let errMsg = err.message || 'Unknown error. The file may be corrupted or in an unsupported format.';
      
      if (f.name.toLowerCase().endsWith('.csv')) {
        errMsg = 'CSV files are not supported. Please save your file as .xlsx (Excel Workbook) format.';
      } else if (err.message && err.message.includes('corrupted')) {
        errMsg = 'The Excel file appears to be corrupted or invalid.';
      }
      
      setError(errMsg);
      addToast('error', 'Failed to parse file: ' + errMsg);
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } finally {
      setParsing(false);
    }
  };

  const handleFileChange = (e) => {
    const f = e.target.files?.[0];
    if (f) {
      const name = f.name.toLowerCase();
      if (name.endsWith('.csv') || name.endsWith('.xls')) {
        addToast('error', 'Invalid file type. Please upload a .xlsx file.');
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }
      processFile(f);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f) {
      const name = f.name.toLowerCase();
      if (name.endsWith('.csv') || name.endsWith('.xls')) {
        addToast('error', 'Invalid file type. Please upload a .xlsx file.');
        return;
      }
      if (name.endsWith('.xlsx')) {
        processFile(f);
      } else {
        addToast('error', 'Unsupported file format. Only .xlsx files are allowed.');
      }
    }
  };

  const handleCancelPreview = () => {
    setFile(null);
    setParsedSheets(null);
    setError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleConfirmImport = async () => {
    if (!parsedSheets || parsedSheets.length === 0) return;
    setLoading(true);
    setError('');
    setProgress(`Importing ${parsedSheets.length} section(s) to Supabase…`);
    addToast('info', 'Starting import...');

    try {
      const summary = await importParsedWorkbook(
        parsedSheets,
        selectedSubjectId || null,
        adminProfile?.id || null
      );
      setResults(summary);
      setProgress('');
      setFile(null);
      setParsedSheets(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      addToast('success', 'Import completed successfully!');
      onUploadSuccess?.();
    } catch (err) {
      const errorMessage = err.message || 'Upload failed. Please try again.';
      setError(errorMessage);
      addToast('error', 'Import failed: ' + errorMessage);
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

  const activeSubject = subjects.find((s) => s.id === selectedSubjectId);

  const getToastColor = (type) => {
    switch(type) {
      case 'error': return '#ef4444';
      case 'success': return '#22c55e';
      case 'warning': return '#f59e0b';
      case 'info': return '#3b82f6';
      default: return '#3b82f6';
    }
  };

  try {
    return (
      <div className="uploader-wrap">
        <style>
          {`
            @keyframes slideInFade {
              from { opacity: 0; transform: translateX(20px); }
              to { opacity: 1; transform: translateX(0); }
            }
          `}
        </style>
        <div className="admin-section-header">
          <h2>📤 Upload Gradebook</h2>
          <p>
            Upload an Excel file (.xlsx) with one sheet tab per section.
            {activeSubject && (
              <span style={{ marginLeft: '6px', fontWeight: 600, color: 'var(--color-primary)' }}>
                Assigned Course: {activeSubject.code} ({activeSubject.name})
              </span>
            )}
          </p>
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

        {/* Drop zone - shown when no preview active */}
        {!parsedSheets && !results && (
          <label
            htmlFor="excel-file-input"
            className={`drop-zone ${file ? 'drop-zone--has-file' : ''}`}
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            style={{ display: 'block', cursor: 'pointer' }}
          >
            <input
              id="excel-file-input"
              ref={fileInputRef}
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
              onChange={handleFileChange}
              onClick={(e) => { e.target.value = null; }}
              style={{
                position: 'absolute',
                width: '1px',
                height: '1px',
                padding: 0,
                margin: '-1px',
                overflow: 'hidden',
                clip: 'rect(0,0,0,0)',
                whiteSpace: 'nowrap',
                border: 0,
              }}
            />
            {file ? (
              <div className="drop-zone__file">
                <span aria-hidden="true">📄</span>
                <div>
                  <div className="drop-zone__filename">{file.name}</div>
                  <div className="text-muted" style={{ fontSize: '0.8rem' }}>
                    {(file.size / 1024).toFixed(1)} KB — Comparing against database…
                  </div>
                </div>
              </div>
            ) : (
              <div className="drop-zone__prompt">
                <span className="drop-zone__icon" aria-hidden="true">📂</span>
                <div>
                  <div style={{ fontWeight: 600, marginBottom: 4, fontSize: '1.05rem' }}>Drop your Excel file here</div>
                  <div className="text-muted" style={{ fontSize: '0.85rem', marginBottom: 12 }}>
                    or tap below to browse from your device (.xlsx only)
                  </div>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    style={{ pointerEvents: 'none' }}
                    tabIndex={-1}
                  >
                    📁 Select Excel File
                  </button>
                </div>
              </div>
            )}
          </label>
        )}

        {parsing && (
          <div className="alert alert-info mt-4" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
            <span>Parsing sheets and computing visual diff against existing records…</span>
          </div>
        )}

        {error && (
          <div className="alert alert-error mt-4" role="alert">
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        )}

        {/* Visual Diff Preview Modal / Component */}
        {parsedSheets && !results && (
          <FilePreview
            parsedSheets={parsedSheets}
            onConfirm={handleConfirmImport}
            onCancel={handleCancelPreview}
            importing={loading}
          />
        )}

        {progress && (
          <div className="alert alert-info mt-4">
            <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
            <span>{progress}</span>
          </div>
        )}

        {/* Results banner */}
        {results && (
          <div className="results-card card mt-6">
            <div className="results-header">
              <span style={{ fontSize: '1.5rem' }}>🎉</span>
              <div>
                <h3>Import Complete!</h3>
                <p className="text-muted" style={{ fontSize: '0.88rem' }}>
                  Your gradebook has been synchronized with Supabase.
                </p>
              </div>
            </div>

            <div className="results-list">
              {results.map((r, i) => (
                <div key={i} className="result-item">
                  <div className="result-item__title">📂 {r.sectionName}</div>
                  <div className="result-item__stats">
                    <span>✓ {r.studentsProcessed} students</span>
                    <span>✓ {r.activitiesProcessed} activities</span>
                    {r.archivedCount > 0 && (
                      <span className="text-muted">({r.archivedCount} archived)</span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <button
              className="btn btn-secondary mt-4"
              onClick={() => setResults(null)}
            >
              Upload Another File
            </button>
          </div>
        )}

        {/* Toast Container */}
        <div style={{
          position: 'fixed',
          top: '16px',
          right: '16px',
          left: '16px',
          zIndex: 99999,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          pointerEvents: 'none',
          gap: '8px'
        }}>
          {toasts.map(toast => (
            <div
              key={toast.id}
              style={{
                padding: '12px 16px',
                background: '#fff',
                color: '#333',
                boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
                borderRadius: '8px',
                borderLeft: `5px solid ${getToastColor(toast.type)}`,
                animation: 'slideInFade 0.3s ease-out forwards',
                maxWidth: '420px',
                width: 'auto',
                pointerEvents: 'auto',
                wordWrap: 'break-word',
                fontSize: '0.9rem',
                fontWeight: 500
              }}
            >
              {toast.message}
            </div>
          ))}
        </div>
      </div>
    );
  } catch (err) {
    return (
      <div className="alert alert-error">
        <h3>Component Error</h3>
        <p>Something went wrong rendering the Excel Uploader. Please refresh the page.</p>
        <pre>{err.message}</pre>
      </div>
    );
  }
}
