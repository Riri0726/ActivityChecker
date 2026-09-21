import { useState, useRef } from 'react';
import { supabase } from '../services/supabase.js';
import { parseWorkbook } from '../services/excelParser.js';
import { importParsedWorkbook } from '../services/adminService.js';
import { downloadGradebookTemplate } from '../services/exportTemplate.js';
import EditablePreview from './EditablePreview.jsx';
import UploadDiagnosticsModal from './UploadDiagnosticsModal.jsx';
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
  const [lastRawError, setLastRawError] = useState(null);
  const [showDiagnosticsModal, setShowDiagnosticsModal] = useState(false);
  const [uploadLogs, setUploadLogs] = useState([]);
  const fileInputRef = useRef(null);

  const logEvent = (msg) => {
    const time = new Date().toLocaleTimeString();
    setUploadLogs((prev) => [...prev.slice(-40), `[${time}] ${msg}`]);
  };

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
            removedStudents: [],
          };
          continue;
        }

        // Fetch existing students in DB
        const { data: dbStudents, error: studentErr } = await supabase
          .from('students')
          .select('id, surname, first_name, student_no, access_key')
          .eq('section_id', section.id);

        if (studentErr) {
          console.warn('[ExcelUploader] Error fetching students:', studentErr);
        }

        const dbStudentMap = new Map();
        const dbStudentNameMap = new Map();
        const dbStudentNoMap = new Map();
        (dbStudents || []).forEach((s) => {
          dbStudentMap.set(s.access_key, s.id);
          // Build name-based map for matching
          const nameKey = `${(s.surname || '').trim().toUpperCase()}_${(s.first_name || '').trim().toUpperCase()}`;
          dbStudentNameMap.set(nameKey, s);
          if (s.student_no) {
            dbStudentNoMap.set(s.student_no.toString().trim().toUpperCase(), s);
          }
        });

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

        // Detect removed students: students in DB but NOT in the new upload
        const uploadedNameKeys = new Set(
          students.map((s) => `${(s.surname || '').trim().toUpperCase()}_${(s.firstName || '').trim().toUpperCase()}`)
        );
        const uploadedStudentNos = new Set(
          students.filter((s) => s.studentNo).map((s) => s.studentNo.toString().trim().toUpperCase())
        );
        const uploadedAccessKeys = new Set(students.map((s) => s.accessKey));
        
        const removedStudents = (dbStudents || []).filter((s) => {
          const nameKey = `${(s.surname || '').trim().toUpperCase()}_${(s.first_name || '').trim().toUpperCase()}`;
          const sno = s.student_no ? s.student_no.toString().trim().toUpperCase() : null;
          // Student is "removed" if neither their student_no, name, nor access_key matches any uploaded student
          const matchedByNo = sno && uploadedStudentNos.has(sno);
          const matchedByName = uploadedNameKeys.has(nameKey);
          const matchedByKey = uploadedAccessKeys.has(s.access_key);
          return !matchedByNo && !matchedByName && !matchedByKey;
        });

        const addedStudents = [];
        const modifiedScores = [];
        let unchangedCount = 0;

        for (let i = 0; i < students.length; i++) {
          const st = students[i];
          const nameKey = `${(st.surname || '').trim().toUpperCase()}_${(st.firstName || '').trim().toUpperCase()}`;
          const cleanNo = st.studentNo ? st.studentNo.toString().trim().toUpperCase() : null;

          const dbStudentByNo = cleanNo ? dbStudentNoMap.get(cleanNo) : null;
          const dbStudentByName = dbStudentNameMap.get(nameKey);
          const dbStudentId = dbStudentByNo?.id || dbStudentByName?.id || dbStudentMap.get(st.accessKey);
          
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
          removedStudents,
        };
      }
    } catch (err) {
      console.error('[ExcelUploader] Error computing diff:', err);
    }
  };

  /**
   * Validate file — supports broader MIME types and Android/tablet file providers
   */
  const isValidExcelFile = (f) => {
    if (!f) return false;
    const name = (f.name || '').toLowerCase();
    
    // Valid xlsx extension
    if (name.endsWith('.xlsx')) return true;

    // Explicitly reject non-spreadsheet formats
    const invalidExts = ['.csv', '.xls', '.pdf', '.txt', '.doc', '.docx', '.png', '.jpg', '.jpeg'];
    if (invalidExts.some((ext) => name.endsWith(ext))) return false;

    // Standard & mobile MIME types
    const validMimes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'application/octet-stream',
      'application/zip',
      'application/x-zip-compressed',
      'application/wps-office.xlsx',
      '',
    ];

    if (validMimes.includes(f.type || '')) return true;

    return true; // Attempt to parse if not an explicitly blocked extension
  };

  const getFileTypeWarning = (f) => {
    const name = (f.name || '').toLowerCase();
    if (name.endsWith('.xls')) {
      return 'You uploaded an .xls file (old Excel format). Please save it as .xlsx (Excel Workbook) format and try again.';
    }
    if (name.endsWith('.csv')) {
      return 'CSV files are not supported. Please save your file as .xlsx (Excel Workbook) format.';
    }
    return null;
  };

  const processFile = async (f) => {
    if (!f) return;

    logEvent(`File chosen: "${f.name}", size=${f.size} bytes (${(f.size / 1024).toFixed(1)} KB), type="${f.type || 'none'}"`);

    // Check for unsupported formats
    const typeWarning = getFileTypeWarning(f);
    if (typeWarning) {
      logEvent(`File type warning: ${typeWarning}`);
      setError(typeWarning);
      setLastRawError(new Error(typeWarning));
      addToast('error', typeWarning);
      return;
    }

    if (!isValidExcelFile(f)) {
      const msg = 'Unsupported file format. Only .xlsx (Excel Workbook) files are accepted.';
      logEvent(`Validation failed: ${msg}`);
      setError(msg);
      setLastRawError(new Error(msg));
      addToast('error', msg);
      return;
    }

    setFile(f);
    setResults(null);
    setError('');
    setLastRawError(null);
    setParsing(true);
    setParsedSheets(null);
    addToast('info', 'Reading Excel file...');
    logEvent('Starting parseWorkbook with ExcelJS...');

    try {
      const parsed = await parseWorkbook(f);
      logEvent(`parseWorkbook completed successfully! Extracted ${parsed?.length || 0} sheet(s).`);

      if (!parsed || parsed.length === 0) {
        const msg = 'No valid sheets found in the uploaded file. Ensure sheets have student columns.';
        logEvent(`Empty workbook: ${msg}`);
        setError(msg);
        setLastRawError(new Error(msg));
        addToast('error', msg);
        setFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
      } else {
        logEvent('Computing workbook live diff against Supabase records...');
        await computeWorkbookDiff(parsed);
        logEvent('Diff computed successfully! Displaying Editable Preview.');
        setParsedSheets(parsed);
        addToast('success', 'File parsed successfully! Review and edit the data below.');
      }
    } catch (err) {
      console.error('[ExcelUploader] Parse error:', err);
      logEvent(`Parse error: ${err.message || String(err)}`);
      setLastRawError(err);
      
      let errMsg = err.message || 'Unknown error. The file may be corrupted or in an unsupported format.';
      if ((f.name || '').toLowerCase().endsWith('.csv')) {
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
      processFile(f);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f) {
      processFile(f);
    }
  };

  const handleCancelPreview = () => {
    setFile(null);
    setParsedSheets(null);
    setError('');
    setLastRawError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleConfirmImport = async () => {
    if (!parsedSheets || parsedSheets.length === 0) return;
    setLoading(true);
    setError('');
    setLastRawError(null);
    setProgress(`Importing ${parsedSheets.length} section(s) to Supabase…`);
    addToast('info', 'Starting import...');
    logEvent(`Starting database import for ${parsedSheets.length} sections...`);

    try {
      const summary = await importParsedWorkbook(
        parsedSheets,
        selectedSubjectId || null,
        adminProfile?.id || null
      );
      logEvent('Import completed successfully!');
      setResults(summary);
      setProgress('');
      setFile(null);
      setParsedSheets(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      addToast('success', 'Import completed successfully!');
      onUploadSuccess?.();
    } catch (err) {
      const errorMessage = err.message || 'Upload failed. Please try again.';
      logEvent(`Import error: ${errorMessage}`);
      setLastRawError(err);
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
              style={{ minHeight: '44px' }}
            >
              {downloading ? 'Generating…' : '⬇ Download Template'}
            </button>
          </div>
        </div>

        {/* Mobile Helper & Troubleshooter Toolbar */}
        {!parsedSheets && !results && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '10px',
              padding: '10px 14px',
              marginBottom: '12px',
              borderRadius: '10px',
              background: 'var(--color-surface, #ffffff)',
              border: '1px solid var(--color-border, #e2e8f0)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: 'var(--color-text-muted, #64748b)' }}>
              <span>📱</span>
              <span>Mobile / Tablet / Brave user? Use direct picker or diagnostics if upload is blocked.</span>
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => fileInputRef.current?.click()}
                style={{ padding: '6px 12px', fontSize: '0.82rem', minHeight: '36px' }}
              >
                📁 Pick File from Device
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setShowDiagnosticsModal(true)}
                style={{ padding: '6px 12px', fontSize: '0.82rem', minHeight: '36px' }}
              >
                🛠️ Error Checker & Diagnostics
              </button>
            </div>
          </div>
        )}

        {/* Drop zone - shown when no preview active */}
        {!parsedSheets && !results && (
          <div
            className={`drop-zone ${file ? 'drop-zone--has-file' : ''}`}
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            onClick={() => fileInputRef.current?.click()}
            style={{ position: 'relative', overflow: 'hidden', cursor: 'pointer' }}
          >
            <input
              id="excel-file-input"
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,application/octet-stream,application/zip,application/x-zip-compressed,*/*"
              onChange={handleFileChange}
              onClick={(e) => { e.stopPropagation(); e.target.value = null; }}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                opacity: 0,
                cursor: 'pointer',
                zIndex: 10,
              }}
              aria-label="Upload Excel file"
            />
            {file ? (
              <div className="drop-zone__file" style={{ pointerEvents: 'none' }}>
                <span aria-hidden="true">📄</span>
                <div>
                  <div className="drop-zone__filename">{file.name}</div>
                  <div className="text-muted" style={{ fontSize: '0.8rem' }}>
                    {(file.size / 1024).toFixed(1)} KB — Comparing against database…
                  </div>
                </div>
              </div>
            ) : (
              <div className="drop-zone__prompt" style={{ pointerEvents: 'none' }}>
                <span className="drop-zone__icon" aria-hidden="true">📂</span>
                <div>
                  <div style={{ fontWeight: 600, marginBottom: 4, fontSize: '1.05rem' }}>Drop your Excel file here</div>
                  <div className="text-muted" style={{ fontSize: '0.85rem', marginBottom: 12 }}>
                    or tap anywhere in this box to browse from your device (.xlsx only)
                  </div>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    style={{ minHeight: '44px' }}
                    tabIndex={-1}
                  >
                    📁 Select Excel File
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {parsing && (
          <div className="alert alert-info mt-4" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
            <span>Parsing sheets and computing visual diff against existing records…</span>
          </div>
        )}

        {error && (
          <div className="alert alert-error mt-4" role="alert" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>⚠️</span>
              <span style={{ fontWeight: 600 }}>{error}</span>
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '4px' }}>
              <button
                type="button"
                className="btn btn-sm btn-secondary"
                onClick={() => setShowDiagnosticsModal(true)}
                style={{ fontSize: '0.82rem', padding: '6px 12px' }}
              >
                🔍 View Diagnostics & Detailed Logs
              </button>
              <button
                type="button"
                className="btn btn-sm btn-primary"
                onClick={() => fileInputRef.current?.click()}
                style={{ fontSize: '0.82rem', padding: '6px 12px' }}
              >
                🔄 Try Selecting File Again
              </button>
            </div>
          </div>
        )}

        {/* Upload Diagnostics & Mobile Helper Modal */}
        <UploadDiagnosticsModal
          isOpen={showDiagnosticsModal}
          onClose={() => setShowDiagnosticsModal(false)}
          currentFile={file}
          lastError={lastRawError || error}
          logs={uploadLogs}
          onFileSelect={(f) => processFile(f)}
        />

        {/* Editable Preview — replaces the old read-only FilePreview */}
        {parsedSheets && !results && (
          <EditablePreview
            parsedSheets={parsedSheets}
            onConfirm={handleConfirmImport}
            onCancel={handleCancelPreview}
            importing={loading}
            onSheetsChange={setParsedSheets}
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
                    {r.removedStudentsCount > 0 && (
                      <span style={{ color: '#dc2626', fontWeight: 600 }}>
                        🗑️ {r.removedStudentsCount} student{r.removedStudentsCount !== 1 ? 's' : ''} removed
                      </span>
                    )}
                  </div>
                  {r.removedStudents?.length > 0 && (
                    <div style={{ fontSize: '0.78rem', color: '#991b1b', marginTop: '4px' }}>
                      Removed: {r.removedStudents.join(', ')}
                    </div>
                  )}
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
}
