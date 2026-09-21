import { useState } from 'react';
import { deriveAccessKey } from '../services/studentService.js';

/**
 * EditablePreview — inline table editor for parsed Excel data.
 * Allows editing student details & scores, adding/deleting rows,
 * and shows diff indicators before committing to import.
 */
export default function EditablePreview({ parsedSheets, onConfirm, onCancel, importing, onSheetsChange }) {
  const [activeSheetIdx, setActiveSheetIdx] = useState(0);

  if (!parsedSheets || parsedSheets.length === 0) {
    return (
      <div className="card" style={{ padding: '24px', textAlign: 'center' }}>
        <p>No sheets parsed.</p>
      </div>
    );
  }

  const sheet = parsedSheets[activeSheetIdx];
  const { sectionName, students, activities, scores, validation, diff } = sheet;

  const updateSheet = (updatedFields) => {
    const updatedSheets = [...parsedSheets];
    updatedSheets[activeSheetIdx] = { ...updatedSheets[activeSheetIdx], ...updatedFields };
    onSheetsChange(updatedSheets);
  };

  const handleStudentChange = (studentIdx, field, value) => {
    const updatedStudents = [...students];
    updatedStudents[studentIdx] = { ...updatedStudents[studentIdx], [field]: value };

    // Regenerate access key when surname or studentNo changes
    if (field === 'surname' || field === 'studentNo') {
      const s = updatedStudents[studentIdx];
      updatedStudents[studentIdx].accessKey = deriveAccessKey(s.surname, s.studentNo);
    }

    updateSheet({ students: updatedStudents });
  };

  const handleScoreChange = (studentIdx, activityIdx, value) => {
    const updatedScores = [...scores];
    if (!updatedScores[studentIdx]) {
      updatedScores[studentIdx] = { accessKey: students[studentIdx]?.accessKey, studentScores: [] };
    }
    const studentScores = [...(updatedScores[studentIdx].studentScores || [])];

    const MISSING_KEYWORDS = ['missing', 'n/a', 'na', '-', '--', 'none', 'absent', 'inc', 'inc.', 'null', 'undefined'];
    const rawStr = value !== null && value !== undefined ? String(value).trim() : '';
    const isExplicitlyMissing = MISSING_KEYWORDS.includes(rawStr.toLowerCase());
    const isBlank = rawStr === '' || isExplicitlyMissing;
    const numVal = isBlank ? null : parseFloat(rawStr);
    const parsedScore = isBlank || isNaN(numVal) ? null : numVal;
    const status = parsedScore === null ? 'missing' : 'done';

    studentScores[activityIdx] = {
      ...studentScores[activityIdx],
      activityTitle: activities[activityIdx]?.title,
      score: parsedScore,
      status: status,
      isBlank: isBlank || parsedScore === null,
      rawValue: rawStr,
    };

    updatedScores[studentIdx] = { ...updatedScores[studentIdx], studentScores };
    updateSheet({ scores: updatedScores });
  };

  const handleAddStudent = () => {
    const newStudent = { surname: '', firstName: '', studentNo: '', accessKey: '' };
    const newScores = {
      accessKey: '',
      studentScores: activities.map((act) => ({
        activityTitle: act.title,
        score: null,
        status: 'missing',
        isBlank: true,
        rawValue: '',
      })),
    };
    updateSheet({
      students: [...students, newStudent],
      scores: [...scores, newScores],
    });
  };

  const handleDeleteStudent = (studentIdx) => {
    const updatedStudents = students.filter((_, i) => i !== studentIdx);
    const updatedScores = scores.filter((_, i) => i !== studentIdx);
    updateSheet({ students: updatedStudents, scores: updatedScores });
  };

  // Count diff stats
  const addedCount = diff?.addedStudents?.length || 0;
  const modifiedCount = diff?.modifiedScores?.length || 0;
  const removedCount = diff?.removedStudents?.length || 0;
  const unchangedCount = diff?.unchangedCount || 0;

  return (
    <div className="card" style={{ padding: '20px', marginTop: '16px' }}>
      {/* Sheet tabs */}
      {parsedSheets.length > 1 && (
        <div style={{ display: 'flex', gap: '6px', marginBottom: '16px', flexWrap: 'wrap' }}>
          {parsedSheets.map((s, i) => (
            <button
              key={i}
              className={`btn ${i === activeSheetIdx ? 'btn-primary' : 'btn-secondary'}`}
              style={{ fontSize: '0.82rem', padding: '6px 14px', borderRadius: '6px' }}
              onClick={() => setActiveSheetIdx(i)}
            >
              📂 {s.sectionName}
            </button>
          ))}
        </div>
      )}

      {/* Section header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700 }}>
            📂 {sectionName}
          </h3>
          <div style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)', marginTop: '4px' }}>
            {students.length} students · {activities.length} activities
          </div>
        </div>
        <button
          className="btn btn-primary"
          style={{ fontSize: '0.82rem', padding: '8px 16px', minHeight: '44px' }}
          onClick={handleAddStudent}
        >
          ➕ Add Student
        </button>
      </div>

      {/* Validation messages */}
      {validation?.errors?.length > 0 && (
        <div style={{ padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', marginBottom: '12px' }}>
          {validation.errors.map((e, i) => (
            <div key={i} style={{ fontSize: '0.85rem', color: '#991b1b' }}>⚠️ {e}</div>
          ))}
        </div>
      )}

      {validation?.warnings?.length > 0 && (
        <div style={{ padding: '10px 14px', background: '#fef3c7', border: '1px solid #fde68a', borderRadius: '6px', marginBottom: '12px' }}>
          {validation.warnings.map((w, i) => (
            <div key={i} style={{ fontSize: '0.82rem', color: '#b45309' }}>⚡ {w}</div>
          ))}
        </div>
      )}

      {/* Diff summary */}
      {diff && (
        <div style={{ display: 'flex', gap: '12px', marginBottom: '14px', flexWrap: 'wrap' }}>
          {addedCount > 0 && (
            <span style={{ fontSize: '0.8rem', background: '#dcfce7', color: '#166534', padding: '4px 10px', borderRadius: '4px', fontWeight: 600 }}>
              ➕ {addedCount} new student{addedCount !== 1 ? 's' : ''}
            </span>
          )}
          {modifiedCount > 0 && (
            <span style={{ fontSize: '0.8rem', background: '#fef3c7', color: '#b45309', padding: '4px 10px', borderRadius: '4px', fontWeight: 600 }}>
              ✏️ {modifiedCount} modified score{modifiedCount !== 1 ? 's' : ''}
            </span>
          )}
          {removedCount > 0 && (
            <span style={{ fontSize: '0.8rem', background: '#fee2e2', color: '#991b1b', padding: '4px 10px', borderRadius: '4px', fontWeight: 600 }}>
              🗑️ {removedCount} student{removedCount !== 1 ? 's' : ''} will be removed
            </span>
          )}
          {unchangedCount > 0 && (
            <span style={{ fontSize: '0.8rem', background: '#f1f5f9', color: '#64748b', padding: '4px 10px', borderRadius: '4px', fontWeight: 600 }}>
              ✓ {unchangedCount} unchanged
            </span>
          )}
          {diff?.archivedActivities?.length > 0 && (
            <span style={{ fontSize: '0.8rem', background: '#fef3c7', color: '#b45309', padding: '4px 10px', borderRadius: '4px', fontWeight: 600 }}>
              📦 {diff.archivedActivities.length} activit{diff.archivedActivities.length !== 1 ? 'ies' : 'y'} will be archived
            </span>
          )}
        </div>
      )}

      {/* Removed students list */}
      {diff?.removedStudents?.length > 0 && (
        <div style={{ padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', marginBottom: '14px' }}>
          <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#991b1b', textTransform: 'uppercase', marginBottom: '4px' }}>
            Students that will be removed from database:
          </div>
          {diff.removedStudents.map((s, i) => (
            <div key={i} style={{ fontSize: '0.85rem', color: '#991b1b' }}>
              🗑️ {s.surname} {s.first_name} {s.student_no ? `(#${s.student_no})` : ''}
            </div>
          ))}
          <div style={{ fontSize: '0.75rem', color: '#991b1b', marginTop: '6px', fontStyle: 'italic' }}>
            Their scores, appeals, and makeup requests will also be permanently deleted.
          </div>
        </div>
      )}

      {/* Editable table */}
      <div style={{ overflowX: 'auto', marginBottom: '16px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
          <thead>
            <tr style={{ background: 'var(--color-bg-muted, #f8fafc)' }}>
              <th style={{ padding: '8px 6px', textAlign: 'left', borderBottom: '2px solid var(--color-border)', width: '40px' }}>#</th>
              <th style={{ padding: '8px 6px', textAlign: 'left', borderBottom: '2px solid var(--color-border)', minWidth: '120px' }}>Surname</th>
              <th style={{ padding: '8px 6px', textAlign: 'left', borderBottom: '2px solid var(--color-border)', minWidth: '120px' }}>First Name</th>
              <th style={{ padding: '8px 6px', textAlign: 'left', borderBottom: '2px solid var(--color-border)', minWidth: '100px' }}>Student No.</th>
              {activities.map((act, j) => (
                <th key={j} style={{ padding: '8px 6px', textAlign: 'center', borderBottom: '2px solid var(--color-border)', minWidth: '70px', fontSize: '0.75rem' }}>
                  {act.title}
                  {act.maxScore > 0 && (
                    <div style={{ fontSize: '0.68rem', color: '#94a3b8', fontWeight: 400 }}>[{act.maxScore}]</div>
                  )}
                </th>
              ))}
              <th style={{ padding: '8px 6px', textAlign: 'center', borderBottom: '2px solid var(--color-border)', width: '50px' }}>Del</th>
            </tr>
          </thead>
          <tbody>
            {students.map((st, i) => {
              const isNew = diff?.addedStudents?.some((a) => a.accessKey === st.accessKey);
              const rowBg = isNew ? 'rgba(34,197,94,0.06)' : 'transparent';
              const studentScores = scores[i]?.studentScores || [];

              return (
                <tr key={i} style={{ background: rowBg, borderBottom: '1px solid var(--color-border)' }}>
                  <td style={{ padding: '4px 6px', color: '#94a3b8' }}>{i + 1}</td>
                  <td style={{ padding: '4px 6px' }}>
                    <input
                      type="text"
                      value={st.surname}
                      onChange={(e) => handleStudentChange(i, 'surname', e.target.value)}
                      className="form-input"
                      style={{ padding: '4px 6px', fontSize: '0.82rem', width: '100%', minHeight: '36px' }}
                    />
                  </td>
                  <td style={{ padding: '4px 6px' }}>
                    <input
                      type="text"
                      value={st.firstName}
                      onChange={(e) => handleStudentChange(i, 'firstName', e.target.value)}
                      className="form-input"
                      style={{ padding: '4px 6px', fontSize: '0.82rem', width: '100%', minHeight: '36px' }}
                    />
                  </td>
                  <td style={{ padding: '4px 6px' }}>
                    <input
                      type="text"
                      value={st.studentNo || ''}
                      onChange={(e) => handleStudentChange(i, 'studentNo', e.target.value)}
                      className="form-input"
                      style={{ padding: '4px 6px', fontSize: '0.82rem', width: '100%', minHeight: '36px' }}
                    />
                  </td>
                  {activities.map((act, j) => {
                    const sc = studentScores[j];
                    const rawVal = sc?.rawValue ?? (sc?.score !== null && sc?.score !== undefined ? String(sc.score) : '');
                    const isModified = diff?.modifiedScores?.some(
                      (m) => m.accessKey === st.accessKey && m.activityTitle === act.title
                    );
                    return (
                      <td key={j} style={{ padding: '4px 6px' }}>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={rawVal}
                          onChange={(e) => handleScoreChange(i, j, e.target.value)}
                          className="form-input"
                          style={{
                            padding: '4px 6px',
                            fontSize: '0.82rem',
                            width: '60px',
                            textAlign: 'center',
                            minHeight: '36px',
                            background: isModified ? '#fef9c3' : undefined,
                            borderColor: isModified ? '#f59e0b' : undefined,
                          }}
                          placeholder="—"
                        />
                      </td>
                    );
                  })}
                  <td style={{ padding: '4px 6px', textAlign: 'center' }}>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      style={{ color: '#dc2626', fontSize: '1rem', minWidth: '36px', minHeight: '36px', padding: '4px' }}
                      onClick={() => handleDeleteStudent(i)}
                      title="Remove student from import"
                    >
                      🗑️
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
        <button
          className="btn btn-secondary"
          style={{ minHeight: '44px' }}
          onClick={onCancel}
          disabled={importing}
        >
          Cancel
        </button>
        <button
          className="btn btn-primary"
          style={{ minHeight: '44px', fontWeight: 600 }}
          onClick={onConfirm}
          disabled={importing || students.length === 0 || validation?.errors?.length > 0}
        >
          {importing ? (
            <>
              <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2, marginRight: '6px' }} />
              Importing…
            </>
          ) : (
            '💾 Save & Import to Database'
          )}
        </button>
      </div>
    </div>
  );
}
