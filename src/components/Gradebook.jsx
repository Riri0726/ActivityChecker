import { useState, useEffect, useCallback } from 'react';
import { getSections, getGradebook, updateScoreInline, updateActivitySettings } from '../services/adminService.js';
import { exportSectionToExcel, exportSectionToPdf } from '../services/exportService.js';
import { useAuth } from '../context/AuthContext.jsx';

export default function Gradebook() {
  const { selectedSubjectId, subjects, adminProfile } = useAuth();
  const [sections, setSections] = useState([]);
  const [selectedSection, setSelectedSection] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [savingCell, setSavingCell] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [exporting, setExporting] = useState(false);

  const loadGradebook = useCallback(async (sectionId) => {
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
  }, []);

  // Load sections
  const loadSectionsList = useCallback(async () => {
    try {
      const secList = await getSections(selectedSubjectId || null);
      setSections(secList);
      if (secList.length > 0) {
        if (!secList.some((s) => s.id === selectedSection)) {
          setSelectedSection(secList[0].id);
          loadGradebook(secList[0].id);
        }
      } else {
        setSelectedSection('');
        setData(null);
      }
    } catch (e) {
      setError(e.message);
    }
  }, [selectedSubjectId, selectedSection, loadGradebook]);

  useEffect(() => {
    loadSectionsList();
  }, [loadSectionsList]);

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
      setData((prev) => ({
        ...prev,
        scores: prev.scores.map((s) =>
          s.id === scoreId
            ? {
                ...s,
                score: newValue === '' ? null : parseFloat(newValue),
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

  const handleToggleRequests = async (activity) => {
    const nextState = !activity.accepting_requests;
    try {
      await updateActivitySettings(activity.id, {
        acceptingRequests: nextState,
      });
      setData((prev) => ({
        ...prev,
        activities: prev.activities.map((a) =>
          a.id === activity.id ? { ...a, accepting_requests: nextState } : a
        ),
      }));
      setSuccess(`Make-up requests for "${activity.title}" are now ${nextState ? 'OPEN' : 'LOCKED'}.`);
    } catch (err) {
      setError(err.message);
    }
  };

  const activeSectionObj = sections.find((s) => s.id === selectedSection);
  const activeSubjectObj = subjects.find((s) => s.id === selectedSubjectId);

  const handleExportExcel = async () => {
    if (!data || !activeSectionObj) return;
    setExporting(true);
    try {
      await exportSectionToExcel({
        sectionName: activeSectionObj.name,
        subjectCode: activeSubjectObj?.code || '',
        students: data.students,
        activities: data.activities,
        scores: data.scores,
      });
      setSuccess('Excel gradebook exported successfully!');
    } catch (err) {
      setError('Export failed: ' + err.message);
    } finally {
      setExporting(false);
    }
  };

  const handleExportPdf = async () => {
    if (!data || !activeSectionObj) return;
    setExporting(true);
    try {
      await exportSectionToPdf({
        sectionName: activeSectionObj.name,
        subjectCode: activeSubjectObj?.code || '',
        teacherName: adminProfile?.full_name || '',
        students: data.students,
        activities: data.activities,
        scores: data.scores,
      });
      setSuccess('PDF report exported successfully!');
    } catch (err) {
      setError('Export failed: ' + err.message);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div>
      <div className="admin-section-header" style={{ marginBottom: 'var(--sp-4)' }}>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 700, margin: 0, color: 'var(--color-heading)' }}>
          📊 Section Gradebook
        </h2>
        <p style={{ margin: '4px 0 0', color: 'var(--color-text-muted)', fontSize: '0.88rem' }}>
          Real-time score ledger, deadline toggles, and Excel & PDF report generation.
        </p>
      </div>

      {/* Control Bar: Section Selection & Export Buttons */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '16px', marginBottom: 'var(--sp-5)' }}>
        <div style={{ minWidth: '260px' }}>
          <label htmlFor="gradebook-section-select" className="form-label" style={{ display: 'block', marginBottom: '6px', fontWeight: 600, fontSize: '0.85rem' }}>
            Choose Section {activeSubjectObj && <span style={{ color: 'var(--color-primary)' }}>({activeSubjectObj.code})</span>}
          </label>
          <select
            id="gradebook-section-select"
            className="form-input"
            value={selectedSection}
            onChange={handleSectionChange}
          >
            <option value="">— Select a section —</option>
            {sections.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>

        {data && (
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              className="btn btn-secondary"
              onClick={handleExportExcel}
              disabled={exporting}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem' }}
            >
              📊 Export to Excel (.xlsx)
            </button>
            <button
              className="btn btn-primary"
              onClick={handleExportPdf}
              disabled={exporting}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem' }}
            >
              📄 Export to PDF (.pdf)
            </button>
          </div>
        )}
      </div>

      {error && (
        <div style={{ padding: '12px 16px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', color: '#991b1b', marginBottom: '16px', fontSize: '0.9rem' }}>
          {error}
        </div>
      )}

      {success && (
        <div style={{ padding: '12px 16px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', color: '#166534', marginBottom: '16px', fontSize: '0.9rem' }}>
          {success}
        </div>
      )}

      {loading && (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--color-text-muted)' }}>
          Loading section ledger…
        </div>
      )}

      {!loading && !selectedSection && (
        <div className="card text-center" style={{ padding: '40px', border: '1px dashed var(--color-border)' }}>
          <div style={{ fontSize: '2rem', marginBottom: '8px' }}>📂</div>
          <p style={{ margin: 0, color: 'var(--color-text-muted)' }}>
            Please select a section above to view students and record scores.
          </p>
        </div>
      )}

      {!loading && data && (
        <div className="card" style={{ padding: 0, border: '1px solid var(--color-border)', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', textAlign: 'center' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '2px solid var(--color-border)' }}>
                <th style={{ padding: '10px 12px', textAlign: 'left' }}>Student Name</th>
                <th style={{ padding: '10px 12px' }}>Student No.</th>
                {data.activities.map((act) => (
                  <th key={act.id} style={{ padding: '10px 12px', minWidth: '120px' }}>
                    <div style={{ fontWeight: 600, color: 'var(--color-heading)' }}>{act.title}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Max: {act.max_score}</div>
                    <button
                      type="button"
                      onClick={() => handleToggleRequests(act)}
                      style={{
                        background: act.accepting_requests ? '#dcfce7' : '#fee2e2',
                        color: act.accepting_requests ? '#166534' : '#991b1b',
                        border: 'none',
                        borderRadius: '3px',
                        padding: '1px 5px',
                        fontSize: '0.68rem',
                        cursor: 'pointer',
                        marginTop: '4px',
                      }}
                      title="Click to toggle whether students can submit make-up requests"
                    >
                      {act.accepting_requests ? '🔓 Open' : '🔒 Locked'}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.students.map((student, sIdx) => (
                <tr key={student.id} style={{ borderBottom: '1px solid var(--color-border)', background: sIdx % 2 === 1 ? '#fafafa' : '#fff' }}>
                  <td style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600 }}>
                    {student.surname}, {student.first_name}
                  </td>
                  <td style={{ padding: '10px 12px', color: 'var(--color-text-muted)' }}>
                    {student.student_no || '—'}
                  </td>
                  {data.activities.map((act) => {
                    const sc = getScore(student.id, act.id, data.scores);
                    const isSaving = savingCell === `${student.id}-${act.id}`;
                    return (
                      <td key={act.id} style={{ padding: '6px 8px' }}>
                        <input
                          type="number"
                          step="0.5"
                          min="0"
                          max={act.max_score}
                          style={{
                            width: '72px',
                            textAlign: 'center',
                            padding: '4px',
                            borderRadius: '4px',
                            border: '1px solid var(--color-border)',
                            background: sc?.status === 'missing' ? '#fef2f2' : '#fff',
                            color: sc?.status === 'missing' ? '#dc2626' : '#1e293b',
                            fontWeight: 600,
                            fontSize: '0.85rem',
                          }}
                          defaultValue={sc?.score ?? ''}
                          placeholder="—"
                          onBlur={(e) => {
                            if (e.target.value !== (sc?.score ?? '').toString()) {
                              handleScoreEdit(sc?.id, e.target.value, student.id, act.id);
                            }
                          }}
                          disabled={isSaving}
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
    </div>
  );
}
