import React, { useState, useEffect } from 'react';
import ExcelJS from 'exceljs';

export default function UploadDiagnosticsModal({
  isOpen,
  onClose,
  currentFile,
  lastError,
  logs = [],
  onFileSelect,
  parsing = false,
  parsedSheets = null,
}) {
  const [copied, setCopied] = useState(false);
  const [testingExcelJS, setTestingExcelJS] = useState(false);
  const [excelJsStatus, setExcelJsStatus] = useState(null); // 'pass' | 'fail' | null
  const [envInfo, setEnvInfo] = useState({});

  useEffect(() => {
    if (!isOpen) return;

    // Detect browser, device, OS, and API support
    const ua = navigator.userAgent || '';
    const isAndroid = /Android/i.test(ua);
    const isIOS = /iPhone|iPad|iPod/i.test(ua);
    const isBrave = !!navigator.brave || ua.includes('Brave');
    const isTablet = /(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua);
    const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

    const info = {
      userAgent: ua,
      deviceType: isTablet ? 'Tablet' : isAndroid ? 'Android Phone/Tablet' : isIOS ? 'iOS Device' : 'Desktop/Laptop',
      isBrave: isBrave ? 'Yes (Brave Browser)' : 'Standard Browser',
      touchSupported: isTouch ? 'Yes' : 'No',
      screenResolution: `${window.screen.width}x${window.screen.height} (Viewport: ${window.innerWidth}x${window.innerHeight})`,
      fileApi: typeof window.File !== 'undefined' ? 'Supported ✅' : 'Missing ❌',
      fileReaderApi: typeof window.FileReader !== 'undefined' ? 'Supported ✅' : 'Missing ❌',
      arrayBufferApi: typeof window.ArrayBuffer !== 'undefined' ? 'Supported ✅' : 'Missing ❌',
      blobApi: typeof window.Blob !== 'undefined' ? 'Supported ✅' : 'Missing ❌',
    };
    setEnvInfo(info);

    // Test ExcelJS in-memory initialization
    testExcelJsEngine();
  }, [isOpen]);

  const testExcelJsEngine = async () => {
    setTestingExcelJS(true);
    try {
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet('Test');
      ws.addRow(['Surname', 'First Name', 'Student No.', 'Quiz 1 [50]']);
      ws.addRow(['TEST', 'USER', '123', 50]);
      const buf = await wb.xlsx.writeBuffer();
      if (buf && buf.byteLength > 0) {
        setExcelJsStatus({ ok: true, message: `ExcelJS engine is fully operational (${buf.byteLength} bytes test passed) ✅` });
      } else {
        setExcelJsStatus({ ok: false, message: 'ExcelJS wrote an empty test buffer ❌' });
      }
    } catch (e) {
      setExcelJsStatus({ ok: false, message: `ExcelJS test failed: ${e.message} ❌` });
    } finally {
      setTestingExcelJS(false);
    }
  };

  if (!isOpen) return null;

  const buildDiagnosticReport = () => {
    const lines = [
      '=== ACTIVITY CHECKER UPLOAD DIAGNOSTIC REPORT ===',
      `Date/Time: ${new Date().toISOString()}`,
      `Device Type: ${envInfo.deviceType}`,
      `Brave Browser: ${envInfo.isBrave}`,
      `Touch Support: ${envInfo.touchSupported}`,
      `Screen: ${envInfo.screenResolution}`,
      `User Agent: ${envInfo.userAgent}`,
      '',
      '--- Browser APIs ---',
      `File API: ${envInfo.fileApi}`,
      `FileReader: ${envInfo.fileReaderApi}`,
      `ArrayBuffer: ${envInfo.arrayBufferApi}`,
      `Blob API: ${envInfo.blobApi}`,
      `ExcelJS Engine: ${excelJsStatus?.ok ? 'PASS' : 'FAIL'} (${excelJsStatus?.message || 'Testing...'})`,
      '',
      '--- Selected File Info ---',
      currentFile
        ? `Name: ${currentFile.name}\nSize: ${currentFile.size} bytes (${(currentFile.size / 1024).toFixed(1)} KB)\nType: ${currentFile.type || 'none/unknown'}\nLast Modified: ${new Date(currentFile.lastModified).toISOString()}`
        : 'No file currently selected',
      '',
      '--- Last Error Encountered ---',
      lastError
        ? typeof lastError === 'string'
          ? lastError
          : `${lastError.message || lastError.toString()}\n${lastError.stack || ''}`
        : 'None recorded',
      '',
      '--- Session Upload Logs ---',
      logs.length > 0 ? logs.join('\n') : 'No logs recorded for this session',
      '=================================================',
    ];
    return lines.join('\n');
  };

  const handleCopyReport = async () => {
    try {
      const report = buildDiagnosticReport();
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(report);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = report;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch (err) {
      alert('Could not copy automatically. You can manually copy the logs below.');
    }
  };

  const handleDirectNativeFileChange = (e) => {
    const f = e.target.files?.[0];
    if (f) {
      onFileSelect?.(f);
      // Keep modal open so the user sees live feedback and parsing result!
    }
  };

  const totalStudentsParsed = (parsedSheets || []).reduce((sum, s) => sum + (s.students?.length || 0), 0);

  return (
    <div
      className="modal-overlay"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(4px)',
        zIndex: 100000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
      onClick={onClose}
    >
      <div
        className="modal-card"
        style={{
          background: 'var(--color-surface, #ffffff)',
          color: 'var(--color-text, #1e293b)',
          borderRadius: '16px',
          maxWidth: '680px',
          width: '100%',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 40px rgba(0,0,0,0.25)',
          overflow: 'hidden',
          border: '1px solid var(--color-border, #e2e8f0)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '18px 24px',
            borderBottom: '1px solid var(--color-border, #e2e8f0)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--color-surface-hover, #f8fafc)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '1.4rem' }}>🛠️</span>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700 }}>
                Upload Diagnostics & Mobile Helper
              </h3>
              <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--color-text-muted, #64748b)' }}>
                Inspect file parsing step-by-step & fix mobile/tablet upload issues
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="btn btn-ghost"
            style={{ padding: '6px 10px', fontSize: '1.1rem', cursor: 'pointer', borderRadius: '8px' }}
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>

        {/* Content Body */}
        <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          {/* Live Parsing Spinner */}
          {parsing && (
            <div
              style={{
                padding: '16px',
                borderRadius: '12px',
                background: '#eff6ff',
                border: '1px solid #bfdbfe',
                color: '#1d4ed8',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
              }}
            >
              <span className="spinner" style={{ width: 22, height: 22, borderWidth: 3 }} />
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>Reading & Parsing Excel File...</div>
                <div style={{ fontSize: '0.82rem', color: '#3b82f6' }}>
                  Testing worksheet structure, column headers, and student score rows.
                </div>
              </div>
            </div>
          )}

          {/* Success Banner if parsedSheets is ready */}
          {!parsing && parsedSheets && parsedSheets.length > 0 && totalStudentsParsed > 0 && (
            <div
              style={{
                padding: '16px',
                borderRadius: '12px',
                background: '#f0fdf4',
                border: '1.5px solid #86efac',
                color: '#15803d',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, fontSize: '1.05rem', marginBottom: '4px' }}>
                <span>🎉</span> File Parsed Successfully!
              </div>
              <p style={{ margin: '0 0 12px 0', fontSize: '0.86rem', color: '#166534' }}>
                Found <strong>{parsedSheets.length} Section(s)</strong> with a total of <strong>{totalStudentsParsed} Students</strong>.
              </p>
              <button
                type="button"
                className="btn btn-success"
                onClick={onClose}
                style={{ width: '100%', padding: '10px 16px', fontWeight: 700, fontSize: '0.95rem' }}
              >
                👉 Continue to Spreadsheet Preview & Editor
              </button>
            </div>
          )}

          {/* Error Banner if error exists */}
          {!parsing && lastError && (
            <div
              style={{
                padding: '14px 16px',
                borderRadius: '10px',
                background: '#fef2f2',
                border: '1.5px solid #fca5a5',
                color: '#991b1b',
              }}
            >
              <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <span>⚠️</span> Issue Detected During Upload / Parse
              </div>
              <div style={{ fontSize: '0.88rem', wordBreak: 'break-word', fontFamily: 'monospace', background: '#fff', padding: '10px 12px', borderRadius: '6px', border: '1px solid #fca5a5', lineHeight: 1.4 }}>
                {typeof lastError === 'string' ? lastError : lastError.message || String(lastError)}
              </div>
            </div>
          )}

          {/* Direct Simple File Input for Mobile / Tablet */}
          <div
            style={{
              padding: '16px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.08), rgba(99, 102, 241, 0.08))',
              border: '1.5px dashed var(--color-primary, #3b82f6)',
              textAlign: 'center',
            }}
          >
            <div style={{ fontWeight: 700, fontSize: '0.98rem', marginBottom: '4px', color: 'var(--color-primary, #2563eb)' }}>
              📱 Direct Mobile / Tablet File Picker
            </div>
            <p style={{ fontSize: '0.82rem', color: 'var(--color-text-muted, #64748b)', margin: '0 0 12px 0' }}>
              Tap below to choose your <code>.xlsx</code> file directly from your device storage:
            </p>
            <label
              className="btn btn-primary"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                cursor: 'pointer',
                padding: '10px 20px',
                fontSize: '0.92rem',
                fontWeight: 600,
                borderRadius: '8px',
              }}
            >
              <span>📂</span> {parsing ? 'Reading File...' : 'Choose File from Device (*.xlsx)'}
              <input
                type="file"
                accept="*/*"
                onChange={handleDirectNativeFileChange}
                style={{ display: 'none' }}
                disabled={parsing}
              />
            </label>
          </div>

          {/* System & Environment Check */}
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '8px', color: 'var(--color-text, #334155)' }}>
              🔍 Environment & Engine Health
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '8px',
                fontSize: '0.82rem',
              }}
            >
              <div style={{ padding: '8px 12px', background: 'var(--color-surface-hover, #f8fafc)', borderRadius: '8px', border: '1px solid var(--color-border, #e2e8f0)' }}>
                <span style={{ color: 'var(--color-text-muted, #64748b)' }}>Device: </span>
                <strong>{envInfo.deviceType}</strong>
              </div>
              <div style={{ padding: '8px 12px', background: 'var(--color-surface-hover, #f8fafc)', borderRadius: '8px', border: '1px solid var(--color-border, #e2e8f0)' }}>
                <span style={{ color: 'var(--color-text-muted, #64748b)' }}>Browser: </span>
                <strong>{envInfo.isBrave}</strong>
              </div>
              <div style={{ padding: '8px 12px', background: 'var(--color-surface-hover, #f8fafc)', borderRadius: '8px', border: '1px solid var(--color-border, #e2e8f0)' }}>
                <span style={{ color: 'var(--color-text-muted, #64748b)' }}>FileReader API: </span>
                <strong>{envInfo.fileReaderApi}</strong>
              </div>
              <div style={{ padding: '8px 12px', background: 'var(--color-surface-hover, #f8fafc)', borderRadius: '8px', border: '1px solid var(--color-border, #e2e8f0)' }}>
                <span style={{ color: 'var(--color-text-muted, #64748b)' }}>ArrayBuffer API: </span>
                <strong>{envInfo.arrayBufferApi}</strong>
              </div>
              <div style={{ gridColumn: '1 / -1', padding: '8px 12px', background: excelJsStatus?.ok ? '#f0fdf4' : '#fef2f2', borderRadius: '8px', border: `1px solid ${excelJsStatus?.ok ? '#bbf7d0' : '#fecaca'}` }}>
                <span style={{ color: 'var(--color-text-muted, #64748b)' }}>ExcelJS Parser Engine: </span>
                <strong>{testingExcelJS ? 'Testing ExcelJS engine...' : excelJsStatus?.message || 'Ready'}</strong>
              </div>
            </div>
          </div>

          {/* Troubleshooting Advice */}
          <div
            style={{
              padding: '12px 16px',
              borderRadius: '10px',
              background: '#f8fafc',
              border: '1px solid var(--color-border, #e2e8f0)',
              fontSize: '0.82rem',
              lineHeight: 1.5,
            }}
          >
            <div style={{ fontWeight: 700, marginBottom: '6px', color: '#1e293b' }}>
              💡 Common Mobile / Tablet Solutions:
            </div>
            <ul style={{ margin: 0, paddingLeft: '18px', color: '#475569' }}>
              <li><strong>Brave on Android:</strong> Brave Shields can occasionally block file storage access. Try disabling Shields for this site if file picking fails.</li>
              <li><strong>Storage Location:</strong> Select the file directly from your local <em>"Downloads"</em> or <em>"Documents"</em> folder rather than an unsaved cloud link.</li>
              <li><strong>File Format:</strong> Only <code>.xlsx</code> (Excel Workbook) format is supported. Old <code>.xls</code> or <code>.csv</code> files must be re-saved as <code>.xlsx</code>.</li>
            </ul>
          </div>

          {/* Live Debug Logs */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
              <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--color-text, #334155)' }}>
                📋 Diagnostic Activity Log ({logs.length} events)
              </div>
              <button
                type="button"
                onClick={handleCopyReport}
                className="btn btn-sm btn-secondary"
                style={{ padding: '4px 10px', fontSize: '0.78rem' }}
              >
                {copied ? '✅ Copied to Clipboard!' : '📋 Copy Full Report'}
              </button>
            </div>
            <pre
              style={{
                margin: 0,
                padding: '10px 14px',
                borderRadius: '8px',
                background: '#0f172a',
                color: '#38bdf8',
                fontSize: '0.75rem',
                lineHeight: 1.45,
                maxHeight: '140px',
                overflowY: 'auto',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
              }}
            >
              {logs.length > 0 ? logs.join('\n') : '[00:00.000] Diagnostics initialized. Ready for file upload.'}
            </pre>
          </div>

        </div>

        {/* Footer */}
        <div
          style={{
            padding: '14px 24px',
            borderTop: '1px solid var(--color-border, #e2e8f0)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--color-surface-hover, #f8fafc)',
          }}
        >
          <button
            type="button"
            onClick={handleCopyReport}
            className="btn btn-secondary"
            style={{ fontSize: '0.85rem' }}
          >
            {copied ? '✅ Diagnostic Report Copied!' : '📋 Copy Diagnostic Report'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="btn btn-primary"
            style={{ fontSize: '0.85rem' }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
