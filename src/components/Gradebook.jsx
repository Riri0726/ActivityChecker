import { useState, useEffect, useCallback } from 'react';
import { getSections, getGradebook, updateScoreInline } from '../services/adminService.js';

export default function Gradebook() {
  const [sections, setSections] = useState([]);
  const [selectedSection, setSelectedSection] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [savingCell, setSavingCell] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    getSections()
      .then(setSections)
      .catch((e) => setError(e.message));
  }, []);

  const loadGradebook = async (sectionId) => {
    if (!sectionId) return;
    setLoading(true);
    setError('');
    try {
      const result = await getGradebook(sectionId);
      setData(result);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSectionChange = (e) => {
    const id = e.target.value;
    setSelectedSection(id);
    setData(null);
    loadGradebook(id);
  };

  const getScore = useCallback((studentId, actId, scores) => {
    return scores.find((s) => s.student_id === studentId && s.activity_id === actId);
  }, []);

  const handleScoreEdit = async (scoreId, newValue, studentId, actId) => {
    const cellKey = `${studentId}-${actId}`;
    setSavingCell(cellKey);
    try {
      await updateScoreInline(scoreId, newValue === '' ? null : newValue);
      // Update local state
      setData((prev) => ({
        ...prev,
        scores: prev.scores.map((s) =>
          s.id === scoreId
            ? {
                ...s,
                score:  newValue === '' ? null : parseFloat(newValue),
                status: newValue === '' ? 'missing' : 'done',
              }
            : s
        ),
      }));
    } catch (e) {
      setError(e.message);
    } finally {
      setSavingCell(null);
    }
  };

  return (
    <div>
      <div className="admin-section-header">
        <h2>📊 Gradebook</h2>
        <p>View and edit student scores directly. Changes are saved immediately. Note: re-uploading the Excel sheet will overwrite any inline edits.</p>
      </div>

      <div className="form-group" style={{ maxWidth: 320, marginBottom: 'var(--sp-6)' }}>
        <label htmlFor="gradebook-section-select" className="form-label">Select Section</label>
        <select
          id="gradebook-section-select"
          className="form-select"
          value={selectedSection}
          onChange={handleSectionChange}
        >
          <option value="">— Choose a section —</option>
          {sections.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </div>

      {error && <div className="alert alert-error mb-4"><span>⚠️</span> {error}</div>}

      {loading && (
        <div className="loading-center">
          <div className="spinner" />
          <span>Loading gradebook…</span>
        </div>
      )}

      {!loading && data && (
        <div className="table-wrap">
          <table aria-label="Gradebook">
            <thead>
              <tr>
                <th style={{ minWidth: 180 }}>Student</th>
                {data.activities.map((act) => (
                  <th key={act.id} style={{ minWidth: 120 }}>
                    <div>{act.title}</div>
                    {act.max_score > 0 && (
                      <div className="text-muted" style={{ fontSize: '0.72rem', fontWeight: 400 }}>
                        / {act.max_score}
                      </div>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.students.map((student) => (
                <tr key={student.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>
                      {student.surname}, {student.first_name}
                    </div>
                    {student.student_no && (
                      <div className="text-muted" style={{ fontSize: '0.78rem' }}>
                        #{student.student_no}
                      </div>
                    )}
                  </td>
                  {data.activities.map((act) => {
                    const sc = getScore(student.id, act.id, data.scores);
                    const cellKey = `${student.id}-${act.id}`;
                    const isSaving = savingCell === cellKey;

                    return (
                      <td key={act.id}>
                        <GradebookCell
                          scoreObj={sc}
                          isSaving={isSaving}
                          onSave={(newVal) => sc && handleScoreEdit(sc.id, newVal, student.id, act.id)}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && !data && selectedSection && !error && (
        <div className="alert alert-info">No data loaded yet.</div>
      )}

      <style>{`
        .admin-section-header { margin-bottom: var(--sp-6); }
        .admin-section-header h2 { margin-bottom: var(--sp-2); }
        .admin-section-header p { font-size: 0.9rem; max-width: 600px; }
      `}</style>
    </div>
  );
}

function GradebookCell({ scoreObj, isSaving, onSave }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState('');

  const startEdit = () => {
    setValue(scoreObj?.score !== null && scoreObj?.score !== undefined ? String(scoreObj.score) : '');
    setEditing(true);
  };

  const handleBlur = () => {
    setEditing(false);
    onSave(value);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') { e.target.blur(); }
    if (e.key === 'Escape') { setEditing(false); }
  };

  if (isSaving) {
    return <span className="text-muted" style={{ fontSize: '0.8rem' }}>saving…</span>;
  }

  if (editing) {
    return (
      <input
        type="number"
        className="form-input"
        style={{ width: 80, padding: '4px 8px', fontSize: '0.9rem' }}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        autoFocus
        min={0}
      />
    );
  }

  const isMissing = !scoreObj || scoreObj.status === 'missing';

  return (
    <button
      className="gradebook-cell-btn"
      onClick={startEdit}
      title="Click to edit"
      aria-label={`Score: ${isMissing ? 'Missing' : scoreObj.score}. Click to edit.`}
    >
      {isMissing
        ? <span className="badge badge-missing" style={{ fontSize: '0.72rem' }}>—</span>
        : <span style={{ fontWeight: 600 }}>{scoreObj.score}</span>
      }
      <style>{`
        .gradebook-cell-btn {
          background: none;
          border: 1px solid transparent;
          border-radius: var(--radius-sm);
          padding: 4px 8px;
          cursor: pointer;
          color: inherit;
          transition: border-color var(--transition-fast), background var(--transition-fast);
          min-width: 50px;
          text-align: center;
        }
        .gradebook-cell-btn:hover {
          border-color: var(--color-primary);
          background: var(--color-primary-light);
        }
      `}</style>
    </button>
  );
}
