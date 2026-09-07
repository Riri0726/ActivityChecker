/**
 * FilePreview — shown after an Excel file is parsed and diffed against existing DB data.
 * Displays per-sheet validation results, visual diff breakdown, and student preview with Old -> New changes.
 */
export default function FilePreview({ parsedSheets, onConfirm, onCancel, importing }) {
  const totalErrors = parsedSheets.reduce((n, s) => n + (s.validation?.errors?.length ?? 0), 0);
  const totalWarnings = parsedSheets.reduce((n, s) => n + (s.validation?.warnings?.length ?? 0), 0);
  const hasBlockingErrors = totalErrors > 0;

  // Aggregate diff statistics
  const totalNewStudents = parsedSheets.reduce((n, s) => n + (s.diff?.addedStudents?.length ?? 0), 0);
  const totalScoreChanges = parsedSheets.reduce((n, s) => n + (s.diff?.modifiedScores?.length ?? 0), 0);
  const totalArchivedActs = parsedSheets.reduce((n, s) => n + (s.diff?.archivedActivities?.length ?? 0), 0);

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
          <span className="preview-summary-label">Total Students</span>
        </div>
        <div className="preview-summary-stat" style={{ background: '#f0fdf4' }}>
          <span className="preview-summary-num" style={{ color: '#16a34a' }}>
            +{totalNewStudents}
          </span>
          <span className="preview-summary-label" style={{ color: '#166534' }}>New Students</span>
        </div>
        <div className="preview-summary-stat" style={{ background: '#fefce8' }}>
          <span className="preview-summary-num" style={{ color: '#ca8a04' }}>
            ~{totalScoreChanges}
          </span>
          <span className="preview-summary-label" style={{ color: '#854d0e' }}>Score Updates</span>
        </div>
        {totalArchivedActs > 0 && (
          <div className="preview-summary-stat" style={{ background: '#fef2f2' }}>
            <span className="preview-summary-num" style={{ color: '#dc2626' }}>
              -{totalArchivedActs}
            </span>
            <span className="preview-summary-label" style={{ color: '#991b1b' }}>To Archive</span>
          </div>
        )}
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
        const { errors, warnings, previewRows } = sheet.validation;
        const diff = sheet.diff || {};
        const addedSet = new Set((diff.addedStudents || []).map((s) => s.accessKey));
        const modifiedScoreMap = new Map();
        (diff.modifiedScores || []).forEach((m) => {
          modifiedScoreMap.set(`${m.accessKey}_${m.activityTitle}`, m);
        });

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
                  <span className="badge badge-done">✓ Verified</span>
                )}
              </div>
            </div>

            {/* Diff Breakdown Tags */}
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '14px' }}>
              <span style={{ fontSize: '0.78rem', background: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0', padding: '3px 10px', borderRadius: '4px', fontWeight: 600 }}>
                🟢 {diff.addedStudents?.length || 0} New Student(s)
              </span>
              <span style={{ fontSize: '0.78rem', background: '#fefce8', color: '#854d0e', border: '1px solid #fef08a', padding: '3px 10px', borderRadius: '4px', fontWeight: 600 }}>
                🟡 {diff.modifiedScores?.length || 0} Score Change(s)
              </span>
              <span style={{ fontSize: '0.78rem', background: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0', padding: '3px 10px', borderRadius: '4px' }}>
                ⚪ {diff.unchangedCount || 0} Unchanged Score(s)
              </span>
              {diff.archivedActivities?.length > 0 && (
                <span style={{ fontSize: '0.78rem', background: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca', padding: '3px 10px', borderRadius: '4px', fontWeight: 600 }}>
                  🔴 {diff.archivedActivities.length} Activity Removed (Will Archive)
                </span>
              )}
            </div>

            {/* Activities to be archived warning */}
            {diff.archivedActivities?.length > 0 && (
              <div style={{ background: '#fff1f2', border: '1px solid #fecdd3', borderRadius: '6px', padding: '10px 14px', marginBottom: '12px', fontSize: '0.82rem', color: '#9f1239' }}>
                <strong>Notice:</strong> The following activities exist in the database but are missing from this sheet and will be archived: <em>{diff.archivedActivities.map((a) => a.title).join(', ')}</em>.
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
                  <strong>⚠ Warnings:</strong>
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

            {/* Student preview table with diff badges */}
            {previewRows.length > 0 && (
              <div className="preview-table-wrap">
                <div className="preview-subsection-title">
                  Student Data Diff Preview (first {previewRows.length} of {sheet.students.length})
                </div>
                <div className="table-wrap" style={{ marginTop: 'var(--sp-2)' }}>
                  <table aria-label={`Preview of ${sheet.sectionName}`}>
                    <thead>
                      <tr>
                        <th>Status</th>
                        <th>Surname</th>
                        <th>First Name</th>
                        <th>Student No.</th>
                        {sheet.activities.slice(0, 6).map((act, ai) => (
                          <th key={ai} title={act.rawHeader}>
                            {act.title.length > 12 ? act.title.slice(0, 12) + '…' : act.title}
                            {act.hasMaxScore && <span className="text-muted"> /{act.maxScore}</span>}
                          </th>
                        ))}
                        {sheet.activities.length > 6 && (
                          <th className="text-muted">+{sheet.activities.length - 6} more</th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {previewRows.map((row, ri) => {
                        const isNew = addedSet.has(row.accessKey);
                        return (
                          <tr key={ri} style={{ background: isNew ? '#f0fdf4' : 'transparent' }}>
                            <td>
                              {isNew ? (
                                <span style={{ background: '#dcfce7', color: '#166534', padding: '2px 6px', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 700 }}>
                                  + NEW
                                </span>
                              ) : (
                                <span style={{ color: '#94a3b8', fontSize: '0.72rem' }}>EXISTING</span>
                              )}
                            </td>
                            <td style={{ fontWeight: 600 }}>{row.surname}</td>
                            <td>{row.firstName}</td>
                            <td className="text-muted">{row.studentNo ?? <em>none</em>}</td>
                            {row.scores.slice(0, 6).map((sc, sci) => {
                              const actTitle = sheet.activities[sci]?.title;
                              const mod = modifiedScoreMap.get(`${row.accessKey}_${actTitle}`);
                              return (
                                <td key={sci}>
                                  {mod ? (
                                    <span style={{ background: '#fef9c3', color: '#854d0e', padding: '2px 6px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600 }} title={`Changed from ${mod.oldScore ?? 'missing'}`}>
                                      {mod.oldScore ?? '—'} ➔ {sc.score ?? '—'}
                                    </span>
                                  ) : sc.isBlank ? (
                                    <span className="badge badge-missing" style={{ fontSize: '0.7rem' }}>—</span>
                                  ) : (
                                    <span style={{ fontWeight: 500 }}>{sc.score}</span>
                                  )}
                                </td>
                              );
                            })}
                            {sheet.activities.length > 6 && <td className="text-muted">…</td>}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* Explicit Confirm / Cancel Actions */}
      <div className="preview-actions">
        <button className="btn btn-secondary" onClick={onCancel} disabled={importing}>
          ✕ Cancel & Discard
        </button>
        <button
          id="confirm-import-btn"
          className={`btn ${hasBlockingErrors ? 'btn-ghost' : 'btn-primary'}`}
          onClick={!hasBlockingErrors ? onConfirm : undefined}
          disabled={hasBlockingErrors || importing}
        >
          {importing
            ? <><span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> Committing Changes…</>
            : hasBlockingErrors
              ? '🔴 Fix errors to import'
              : `✅ Confirm & Apply Changes (${totalNewStudents} new, ${totalScoreChanges} updates)`
          }
        </button>
      </div>
    </div>
  );
}
