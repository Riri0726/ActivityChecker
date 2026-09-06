/**
 * FilePreview — shown after an Excel file is parsed but before import.
 * Displays per-sheet validation results, activity list, and a student data preview.
 */
export default function FilePreview({ parsedSheets, onConfirm, onCancel, importing }) {
  const totalErrors   = parsedSheets.reduce((n, s) => n + (s.validation?.errors?.length   ?? 0), 0);
  const totalWarnings = parsedSheets.reduce((n, s) => n + (s.validation?.warnings?.length ?? 0), 0);
  const hasBlockingErrors = totalErrors > 0;

  return (
    <div className="file-preview">
      {/* Summary bar */}
      <div className="preview-summary-bar">
        <div className="preview-summary-stat">
          <span className="preview-summary-num">{parsedSheets.length}</span>
          <span className="preview-summary-label">Section{parsedSheets.length !== 1 ? 's' : ''}</span>
        </div>
        <div className="preview-summary-stat">
          <span className="preview-summary-num">
            {parsedSheets.reduce((n, s) => n + s.students.length, 0)}
          </span>
          <span className="preview-summary-label">Students</span>
        </div>
        <div className="preview-summary-stat">
          <span className="preview-summary-num">
            {parsedSheets.reduce((n, s) => n + s.activities.length, 0)}
          </span>
          <span className="preview-summary-label">Activities</span>
        </div>
        <div className={`preview-summary-stat ${totalErrors > 0 ? 'stat-error' : totalWarnings > 0 ? 'stat-warn' : 'stat-ok'}`}>
          <span className="preview-summary-num">
            {totalErrors > 0 ? `${totalErrors} error${totalErrors !== 1 ? 's' : ''}` :
             totalWarnings > 0 ? `${totalWarnings} warning${totalWarnings !== 1 ? 's' : ''}` :
             '✓ Ready'}
          </span>
          <span className="preview-summary-label">Status</span>
        </div>
      </div>

      {/* Per-sheet panels */}
      {parsedSheets.map((sheet, si) => {
        const { errors, warnings, info, previewRows } = sheet.validation;

        return (
          <div key={si} className="preview-sheet-panel">
            {/* Sheet header */}
            <div className="preview-sheet-header">
              <div className="preview-sheet-name">
                <span aria-hidden="true">📂</span> {sheet.sectionName}
              </div>
              <div className="preview-sheet-badges">
                {errors.length > 0 && (
                  <span className="badge badge-rejected">🔴 {errors.length} error{errors.length !== 1 ? 's' : ''}</span>
                )}
                {warnings.length > 0 && (
                  <span className="badge badge-missing">⚠ {warnings.length} warning{warnings.length !== 1 ? 's' : ''}</span>
                )}
                {errors.length === 0 && warnings.length === 0 && (
                  <span className="badge badge-done">✓ All good</span>
                )}
              </div>
            </div>

            {/* Info pills */}
            {info.length > 0 && (
              <div className="preview-info-pills">
                {info.map((msg, i) => (
                  <span key={i} className="preview-info-pill">{msg}</span>
                ))}
              </div>
            )}

            {/* Errors */}
            {errors.length > 0 && (
              <div className="alert alert-error" style={{ marginBottom: 'var(--sp-3)' }}>
                <div>
                  <strong>🔴 Critical issues — fix before importing:</strong>
                  <ul style={{ paddingLeft: 20, marginTop: 6, fontSize: '0.88rem' }}>
                    {errors.map((e, i) => <li key={i}>{e}</li>)}
                  </ul>
                </div>
              </div>
            )}

            {/* Warnings */}
            {warnings.length > 0 && (
              <div className="alert alert-warning" style={{ marginBottom: 'var(--sp-3)' }}>
                <div>
                  <strong>⚠ Warnings — recommended to fix:</strong>
                  <ul style={{ paddingLeft: 20, marginTop: 6, fontSize: '0.88rem' }}>
                    {warnings.map((w, i) => <li key={i}>{w}</li>)}
                  </ul>
                </div>
              </div>
            )}

            {/* Activity columns checklist */}
            {sheet.activities.length > 0 && (
              <div className="preview-activities">
                <div className="preview-subsection-title">Activity Columns Detected</div>
                <div className="preview-activity-list">
                  {sheet.activities.map((act, ai) => (
                    <div key={ai} className={`preview-activity-chip ${act.hasMaxScore ? 'chip-ok' : 'chip-warn'}`}>
                      <span>{act.hasMaxScore ? '✅' : '⚠️'}</span>
                      <span className="chip-title">{act.title}</span>
                      {act.hasMaxScore
                        ? <span className="chip-max">/ {act.maxScore}</span>
                        : <span className="chip-no-max">no max score</span>
                      }
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Student preview table */}
            {previewRows.length > 0 && (
              <div className="preview-table-wrap">
                <div className="preview-subsection-title">
                  Student Preview (first {previewRows.length} of {sheet.students.length})
                </div>
                <div className="table-wrap" style={{ marginTop: 'var(--sp-2)' }}>
                  <table aria-label={`Preview of ${sheet.sectionName}`}>
                    <thead>
                      <tr>
                        <th>Surname</th>
                        <th>First Name</th>
                        <th>Student No.</th>
                        <th>Login Key</th>
                        {sheet.activities.slice(0, 6).map((act, ai) => (
                          <th key={ai} title={act.rawHeader}>
                            {act.title.length > 12 ? act.title.slice(0, 12) + '…' : act.title}
                            {act.hasMaxScore && <span className="text-muted"> /{act.maxScore}</span>}
                            {!act.hasMaxScore && <span style={{ color: 'var(--color-warning)', marginLeft: 4 }}>⚠</span>}
                          </th>
                        ))}
                        {sheet.activities.length > 6 && (
                          <th className="text-muted">+{sheet.activities.length - 6} more</th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {previewRows.map((row, ri) => (
                        <tr key={ri}>
                          <td style={{ fontWeight: 600 }}>{row.surname}</td>
                          <td>{row.firstName}</td>
                          <td className="text-muted">{row.studentNo ?? <em>none</em>}</td>
                          <td>
                            <code style={{ fontSize: '0.78rem', background: 'var(--bg-card-alt)', padding: '2px 6px', borderRadius: 4 }}>
                              {row.accessKey}
                            </code>
                          </td>
                          {row.scores.slice(0, 6).map((sc, sci) => (
                            <td key={sci}>
                              {sc.isBlank
                                ? <span className="badge badge-missing" style={{ fontSize: '0.7rem' }}>—</span>
                                : sc.isNonNumeric
                                  ? <span className="badge badge-rejected" style={{ fontSize: '0.7rem' }}>?{sc.rawValue}</span>
                                  : <span style={{ fontWeight: 500 }}>{sc.score}</span>
                              }
                            </td>
                          ))}
                          {sheet.activities.length > 6 && <td className="text-muted">…</td>}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {sheet.students.length > 5 && (
                  <p className="text-muted" style={{ fontSize: '0.78rem', marginTop: 'var(--sp-2)' }}>
                    … and {sheet.students.length - 5} more student{sheet.students.length - 5 !== 1 ? 's' : ''}
                  </p>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* Action buttons */}
      <div className="preview-actions">
        <button className="btn btn-ghost" onClick={onCancel} disabled={importing}>
          ← Change File
        </button>
        <button
          id="confirm-import-btn"
          className={`btn ${hasBlockingErrors ? 'btn-ghost' : 'btn-primary'}`}
          onClick={!hasBlockingErrors ? onConfirm : undefined}
          disabled={hasBlockingErrors || importing}
          title={hasBlockingErrors ? 'Fix the errors above before importing' : 'Import this data to Supabase'}
        >
          {importing
            ? <><span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> Importing…</>
            : hasBlockingErrors
              ? '🔴 Fix errors to import'
              : `✅ Confirm & Import ${parsedSheets.reduce((n, s) => n + s.students.length, 0)} students`
          }
        </button>
      </div>

      <style>{`
        .file-preview {
          margin-top: var(--sp-6);
          display: flex;
          flex-direction: column;
          gap: var(--sp-5);
        }

        /* Summary bar */
        .preview-summary-bar {
          display: flex;
          gap: var(--sp-4);
          background: var(--bg-card);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-lg);
          padding: var(--sp-4) var(--sp-6);
          flex-wrap: wrap;
        }
        .preview-summary-stat {
          display: flex;
          flex-direction: column;
          align-items: center;
          min-width: 80px;
          padding: var(--sp-2) var(--sp-4);
          border-radius: var(--radius-md);
        }
        .preview-summary-num {
          font-size: 1.4rem;
          font-weight: 700;
          color: var(--text-primary);
          line-height: 1;
        }
        .preview-summary-label {
          font-size: 0.72rem;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin-top: 4px;
        }
        .stat-error { background: var(--color-danger-light); }
        .stat-error .preview-summary-num { color: var(--color-danger); font-size: 1rem; }
        .stat-warn { background: var(--color-warning-light); }
        .stat-warn .preview-summary-num { color: var(--color-warning); font-size: 1rem; }
        .stat-ok { background: #f0fdf4; }
        .stat-ok .preview-summary-num { color: var(--color-accent); font-size: 1rem; }
        @media (prefers-color-scheme: dark) {
          .stat-error { background: #450a0a; }
          .stat-warn  { background: #451a03; }
          .stat-ok    { background: #14532d22; }
        }

        /* Sheet panel */
        .preview-sheet-panel {
          background: var(--bg-card);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-lg);
          padding: var(--sp-5) var(--sp-6);
          box-shadow: var(--shadow-sm);
        }
        .preview-sheet-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: var(--sp-4);
          flex-wrap: wrap;
          gap: var(--sp-3);
        }
        .preview-sheet-name {
          font-size: 1.1rem;
          font-weight: 700;
          color: var(--color-primary);
          display: flex;
          align-items: center;
          gap: var(--sp-2);
        }
        .preview-sheet-badges { display: flex; gap: var(--sp-2); flex-wrap: wrap; }

        /* Info pills */
        .preview-info-pills {
          display: flex;
          gap: var(--sp-2);
          flex-wrap: wrap;
          margin-bottom: var(--sp-4);
        }
        .preview-info-pill {
          background: var(--bg-card-alt);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-full);
          padding: 3px 12px;
          font-size: 0.78rem;
          color: var(--text-secondary);
        }

        /* Activity chips */
        .preview-subsection-title {
          font-size: 0.78rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: var(--text-muted);
          margin-bottom: var(--sp-3);
        }
        .preview-activities { margin-bottom: var(--sp-5); }
        .preview-activity-list {
          display: flex;
          flex-wrap: wrap;
          gap: var(--sp-2);
        }
        .preview-activity-chip {
          display: flex;
          align-items: center;
          gap: 5px;
          padding: 4px 12px;
          border-radius: var(--radius-full);
          font-size: 0.82rem;
          border: 1px solid;
        }
        .chip-ok {
          background: #f0fdf4;
          border-color: #86efac;
          color: #15803d;
        }
        .chip-warn {
          background: var(--color-warning-light);
          border-color: #fcd34d;
          color: #92400e;
        }
        @media (prefers-color-scheme: dark) {
          .chip-ok   { background: #14532d22; border-color: #166534; color: #86efac; }
          .chip-warn { background: #451a0322; border-color: #92400e; color: #fcd34d; }
        }
        .chip-title { font-weight: 500; }
        .chip-max { opacity: 0.7; font-size: 0.75rem; }
        .chip-no-max { font-size: 0.72rem; font-style: italic; }

        /* Preview table */
        .preview-table-wrap { overflow-x: auto; }

        /* Actions */
        .preview-actions {
          display: flex;
          gap: var(--sp-3);
          align-items: center;
          justify-content: flex-end;
          padding-top: var(--sp-4);
          border-top: 1px solid var(--border-color);
          flex-wrap: wrap;
        }

        @media (max-width: 600px) {
          .preview-actions { flex-direction: column-reverse; }
          .preview-actions .btn { width: 100%; justify-content: center; }
        }
      `}</style>
    </div>
  );
}
