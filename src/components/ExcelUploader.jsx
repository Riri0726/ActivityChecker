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

  /**
   * Compute live diff against Supabase for visual preview before import
   */
  const computeWorkbookDiff = async (sheets) => {
    for (const sheet of sheets) {
      const { sectionName, students, activities, scores } = sheet;

      const { data: section } = await supabase
        .from('sections')
        .select('id')
        .eq('name', sectionName)
        .maybeSingle();

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
      const { data: dbStudents } = await supabase
        .from('students')
        .select('id, access_key')
        .eq('section_id', section.id);

      const dbStudentMap = new Map();
      (dbStudents || []).forEach((s) => dbStudentMap.set(s.access_key, s.id));

      // Fetch existing activities in DB
      const { data: dbActivities } = await supabase
        .from('activities')
        .select('id, title')
        .eq('section_id', section.id)
        .eq('archived', false);

      const dbActMap = new Map();
      (dbActivities || []).forEach((a) => dbActMap.set(a.title.toLowerCase().trim(), a.id));

      const uploadedTitlesSet = new Set(activities.map((a) => a.title.toLowerCase().trim()));
      const archivedActs = (dbActivities || []).filter((a) => !uploadedTitlesSet.has(a.title.toLowerCase().trim()));

      // Fetch existing scores in DB
      const studentIds = Array.from(dbStudentMap.values());
      const dbScoresMap = new Map();
      if (studentIds.length > 0) {
        const { data: dbScores } = await supabase
          .from('scores')
          .select('student_id, activity_id, score, status')
          .in('student_id', studentIds);

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
  };

  const processFile = async (f) => {
    if (!f) return;
    setFile(f);
    setResults(null);
    setError('');
    setParsing(true);
    setParsedSheets(null);

    try {
      const parsed = await parseWorkbook(f);
      if (!parsed || parsed.length === 0) {
        setError('No valid sheets found in the uploaded file. Ensure sheets have student columns.');
        setFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
      } else {
        await computeWorkbookDiff(parsed);
        setParsedSheets(parsed);
      }
    } catch (err) {
      setError(err.message || 'Failed to read Excel file.');
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } finally {
      setParsing(false);
    }
  };

  const handleFileChange = (e) => {
    const f = e.target.files?.[0];
    if (f) processFile(f);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f && (f.name.endsWith('.xlsx') || f.name.endsWith('.csv'))) {
      processFile(f);
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

  const activeSubject = subjects.find((s) => s.id === selectedSubjectId);

  return (
    <div className="uploader-wrap">
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
                  {(file.size / 1024).toFixed(1)} KB — Comparing against database…
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
    </div>
  );
}
