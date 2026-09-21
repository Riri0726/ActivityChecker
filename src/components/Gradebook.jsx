import { useState, useEffect, useCallback } from 'react';
import { getSections, getGradebook, updateScoreInline, updateActivitySettings, getSectionDeleteSummary, deleteSection, updateStudent, deleteStudent, addStudentToSection } from '../services/adminService.js';
import { exportSectionToExcel, exportSectionToPdf } from '../services/exportService.js';
import { useAuth } from '../context/AuthContext.jsx';

export default function Gradebook() {
  const { selectedSubjectId, subjects, adminProfile, effectiveAdminId } = useAuth();
  const [sections, setSections] = useState([]);
  const [selectedSection, setSelectedSection] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [savingCell, setSavingCell] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [exporting, setExporting] = useState(false);

  // Delete workbook modal state
  const [deleteModal, setDeleteModal] = useState(null); // { sectionId, sectionName, summary }
  const [deleteConfirmName, setDeleteConfirmName] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Inline student editing state
  const [editingStudent, setEditingStudent] = useState(null); // { studentId, field, value }
  const [savingStudent, setSavingStudent] = useState(null);

  // Add student modal state
  const [addStudentModal, setAddStudentModal] = useState(false);
  const [newStudentData, setNewStudentData] = useState({ surname: '', firstName: '', studentNo: '' });
  const [addingStudent, setAddingStudent] = useState(false);

  // Delete student modal state
  const [deleteStudentModal, setDeleteStudentModal] = useState(null); // { studentId, name }
  const [deletingStudent, setDeletingStudent] = useState(false);

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
      const secList = await getSections(selectedSubjectId || null, effectiveAdminId);
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
  }, [selectedSubjectId, selectedSection, loadGradebook, effectiveAdminId]);

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

  // ---- Delete Workbook Handlers ----
  const handleDeleteWorkbookClick = async () => {
    if (!selectedSection || !activeSectionObj) return;
    setDeleteLoading(true);
    try {
      const summary = await getSectionDeleteSummary(selectedSection);
      setDeleteModal({ sectionId: selectedSection, sectionName: activeSectionObj.name, summary });
      setDeleteConfirmName('');
    } catch (e) {
      setError('Failed to load deletion summary: ' + e.message);
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleDeleteWorkbookConfirm = async () => {
    if (!deleteModal || deleteConfirmName !== deleteModal.sectionName) return;
    setDeleteLoading(true);
    try {
      await deleteSection(deleteModal.sectionId);
      setSuccess(`Workbook "${deleteModal.sectionName}" has been permanently deleted.`);
      setDeleteModal(null);
      setDeleteConfirmName('');
      setSelectedSection('');
      setData(null);
      await loadSectionsList();
    } catch (e) {
      setError('Failed to delete workbook: ' + e.message);
    } finally {
      setDeleteLoading(false);
    }
  };

  // ---- Inline Student Edit Handlers ----
  const handleStudentEditStart = (studentId, field, currentValue) => {
    setEditingStudent({ studentId, field, value: currentValue || '' });
  };

  const handleStudentEditSave = async () => {
    if (!editingStudent) return;
    const { studentId, field, value } = editingStudent;
    setSavingStudent(studentId);
    try {
      const payload = {};
      if (field === 'name') {
        // Parse "SURNAME, FIRSTNAME" format
        const parts = value.split(',').map((s) => s.trim());
        payload.surname = parts[0] || '';
        payload.firstName = parts[1] || '';
        if (!payload.surname) {
          setError('Surname cannot be empty.');
          setSavingStudent(null);
          return;
        }
      } else if (field === 'studentNo') {
        payload.studentNo = value;
      }

      const updated = await updateStudent(studentId, payload);
      setData((prev) => ({
        ...prev,
        students: prev.students.map((s) =>
          s.id === studentId
            ? { ...s, surname: updated.surname, first_name: updated.first_name, student_no: updated.student_no }
            : s
        ),
      }));
      setEditingStudent(null);
      setSuccess('Student details updated.');
    } catch (e) {
      setError('Failed to update student: ' + e.message);
    } finally {
      setSavingStudent(null);
    }
  };

  const handleStudentEditCancel = () => {
    setEditingStudent(null);
  };

  // ---- Add Student Handler ----
  const handleAddStudentSubmit = async () => {
    if (!newStudentData.surname.trim() || !newStudentData.firstName.trim()) {
      setError('Surname and First Name are required.');
      return;
    }
    setAddingStudent(true);
    try {
      await addStudentToSection(selectedSection, {
        surname: newStudentData.surname,
        firstName: newStudentData.firstName,
        studentNo: newStudentData.studentNo,
      });
      setSuccess(`Student "${newStudentData.surname}, ${newStudentData.firstName}" added successfully.`);
      setAddStudentModal(false);
      setNewStudentData({ surname: '', firstName: '', studentNo: '' });
      await loadGradebook(selectedSection);
    } catch (e) {
      setError('Failed to add student: ' + e.message);
    } finally {
      setAddingStudent(false);
    }
  };

  // ---- Delete Student Handler ----
  const handleDeleteStudentConfirm = async () => {
    if (!deleteStudentModal) return;
    setDeletingStudent(true);
    try {
      await deleteStudent(deleteStudentModal.studentId);
      setSuccess(`Student "${deleteStudentModal.name}" has been permanently removed.`);
      setDeleteStudentModal(null);
      await loadGradebook(selectedSection);
    } catch (e) {
      setError('Failed to delete student: ' + e.message);
    } finally {
      setDeletingStudent(false);
    }
  };

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

        {/* Delete Workbook Button */}
        {data && (
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => setAddStudentModal(true)}
              style={{ fontSize: '0.82rem', minHeight: '44px' }}
            >
              ➕ Add Student
            </button>
            <button
              className="btn btn-danger btn-sm"
              onClick={handleDeleteWorkbookClick}
              disabled={deleteLoading}
              style={{ fontSize: '0.82rem', minHeight: '44px' }}
            >
              🗑️ Delete Workbook
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
                <th style={{ padding: '10px 12px', width: '50px' }}>Del</th>
              </tr>
            </thead>
            <tbody>
              {data.students.map((student, sIdx) => (
                <tr key={student.id} style={{ borderBottom: '1px solid var(--color-border)', background: sIdx % 2 === 1 ? '#fafafa' : '#fff' }}>
                  <td
                    style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, cursor: 'pointer', position: 'relative' }}
                    onClick={() => {
                      if (editingStudent?.studentId !== student.id || editingStudent?.field !== 'name') {
                        handleStudentEditStart(student.id, 'name', `${student.surname}, ${student.first_name}`);
                      }
                    }}
                    title="Click to edit student name"
                  >
                    {editingStudent?.studentId === student.id && editingStudent?.field === 'name' ? (
                      <input
                        type="text"
                        autoFocus
                        style={{
                          width: '100%',
                          padding: '4px 8px',
                          border: '1.5px solid var(--color-primary)',
                          borderRadius: '4px',
                          fontSize: '0.85rem',
                          fontWeight: 600,
                          background: 'var(--bg-card)',
                          color: 'var(--text-primary)',
                          outline: 'none',
                          boxShadow: '0 0 0 3px rgba(79,110,247,0.12)',
                        }}
                        value={editingStudent.value}
                        onChange={(e) => setEditingStudent((prev) => ({ ...prev, value: e.target.value }))}
                        onBlur={handleStudentEditSave}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleStudentEditSave();
                          if (e.key === 'Escape') handleStudentEditCancel();
                        }}
                        onClick={(e) => e.stopPropagation()}
                        disabled={savingStudent === student.id}
                        placeholder="SURNAME, First Name"
                      />
                    ) : (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        {student.surname}, {student.first_name}
                        <span style={{ fontSize: '0.7rem', opacity: 0.4 }} title="Click to edit">✏️</span>
                      </span>
                    )}
                  </td>
                  <td
                    style={{ padding: '10px 12px', color: 'var(--color-text-muted)', cursor: 'pointer' }}
                    onClick={() => {
                      if (editingStudent?.studentId !== student.id || editingStudent?.field !== 'studentNo') {
                        handleStudentEditStart(student.id, 'studentNo', student.student_no || '');
                      }
                    }}
                    title="Click to edit student number"
                  >
                    {editingStudent?.studentId === student.id && editingStudent?.field === 'studentNo' ? (
                      <input
                        type="text"
                        autoFocus
                        style={{
                          width: '80px',
                          padding: '4px 6px',
                          border: '1.5px solid var(--color-primary)',
                          borderRadius: '4px',
                          fontSize: '0.85rem',
                          textAlign: 'center',
                          background: 'var(--bg-card)',
                          color: 'var(--text-primary)',
                          outline: 'none',
                          boxShadow: '0 0 0 3px rgba(79,110,247,0.12)',
                        }}
                        value={editingStudent.value}
                        onChange={(e) => setEditingStudent((prev) => ({ ...prev, value: e.target.value }))}
                        onBlur={handleStudentEditSave}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleStudentEditSave();
                          if (e.key === 'Escape') handleStudentEditCancel();
                        }}
                        onClick={(e) => e.stopPropagation()}
                        disabled={savingStudent === student.id}
                        placeholder="—"
                      />
                    ) : (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        {student.student_no || '—'}
                        <span style={{ fontSize: '0.7rem', opacity: 0.4 }} title="Click to edit">✏️</span>
                      </span>
                    )}
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
                  <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      style={{ color: '#dc2626', fontSize: '0.9rem', minWidth: '36px', minHeight: '36px', padding: '4px' }}
                      onClick={() => setDeleteStudentModal({
                        studentId: student.id,
                        name: `${student.surname}, ${student.first_name}`,
                      })}
                      title="Delete this student"
                    >
                      🗑️
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Delete Workbook Confirmation Modal */}
      {deleteModal && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal" style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#dc2626', display: 'flex', alignItems: 'center', gap: '8px' }}>
                ⚠️ Permanently Delete Workbook
              </h2>
              <button className="modal-close" onClick={() => { setDeleteModal(null); setDeleteConfirmName(''); }}>✕</button>
            </div>

            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '16px', marginBottom: '16px' }}>
              <div style={{ fontWeight: 700, color: '#991b1b', marginBottom: '8px' }}>
                This action is irreversible!
              </div>
              <div style={{ fontSize: '0.88rem', color: '#7f1d1d' }}>
                You are about to permanently delete section <strong>"{deleteModal.sectionName}"</strong> and all associated data:
              </div>
              <ul style={{ margin: '12px 0 0 20px', fontSize: '0.88rem', color: '#991b1b', lineHeight: 1.8 }}>
                <li><strong>{deleteModal.summary.students}</strong> student records</li>
                <li><strong>{deleteModal.summary.activities}</strong> activities</li>
                <li><strong>{deleteModal.summary.scores}</strong> score entries</li>
              </ul>
            </div>

            <div className="form-group" style={{ marginBottom: '16px' }}>
              <label className="form-label" style={{ fontSize: '0.85rem' }}>
                Type <strong>"{deleteModal.sectionName}"</strong> to confirm:
              </label>
              <input
                type="text"
                className="form-input"
                value={deleteConfirmName}
                onChange={(e) => setDeleteConfirmName(e.target.value)}
                placeholder={deleteModal.sectionName}
                autoFocus
                style={{ minHeight: '44px' }}
              />
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                className="btn btn-secondary"
                onClick={() => { setDeleteModal(null); setDeleteConfirmName(''); }}
                disabled={deleteLoading}
                style={{ minHeight: '44px' }}
              >
                Cancel
              </button>
              <button
                className="btn btn-danger"
                onClick={handleDeleteWorkbookConfirm}
                disabled={deleteConfirmName !== deleteModal.sectionName || deleteLoading}
                style={{ minHeight: '44px' }}
              >
                {deleteLoading ? 'Deleting…' : '🗑️ Delete Permanently'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Student Modal */}
      {addStudentModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center',
          justifyContent: 'center', zIndex: 1000, padding: '20px',
        }}>
          <div className="card" style={{ maxWidth: '440px', width: '100%', padding: '24px' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: '1.15rem', fontWeight: 600 }}>
              ➕ Add Student to {activeSectionObj?.name}
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
              <div>
                <label className="form-label" style={{ display: 'block', marginBottom: '4px', fontSize: '0.85rem', fontWeight: 600 }}>Surname *</label>
                <input
                  type="text"
                  className="form-input"
                  value={newStudentData.surname}
                  onChange={(e) => setNewStudentData({ ...newStudentData, surname: e.target.value })}
                  placeholder="e.g. DELA CRUZ"
                  autoFocus
                  style={{ minHeight: '44px' }}
                />
              </div>
              <div>
                <label className="form-label" style={{ display: 'block', marginBottom: '4px', fontSize: '0.85rem', fontWeight: 600 }}>First Name *</label>
                <input
                  type="text"
                  className="form-input"
                  value={newStudentData.firstName}
                  onChange={(e) => setNewStudentData({ ...newStudentData, firstName: e.target.value })}
                  placeholder="e.g. Juan"
                  style={{ minHeight: '44px' }}
                />
              </div>
              <div>
                <label className="form-label" style={{ display: 'block', marginBottom: '4px', fontSize: '0.85rem', fontWeight: 600 }}>Student No. (optional)</label>
                <input
                  type="text"
                  className="form-input"
                  value={newStudentData.studentNo}
                  onChange={(e) => setNewStudentData({ ...newStudentData, studentNo: e.target.value })}
                  placeholder="e.g. 2024-00001"
                  style={{ minHeight: '44px' }}
                />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" style={{ minHeight: '44px' }} onClick={() => { setAddStudentModal(false); setNewStudentData({ surname: '', firstName: '', studentNo: '' }); }}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                style={{ minHeight: '44px' }}
                onClick={handleAddStudentSubmit}
                disabled={addingStudent || !newStudentData.surname.trim() || !newStudentData.firstName.trim()}
              >
                {addingStudent ? 'Adding…' : '➕ Add Student'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Student Confirmation Modal */}
      {deleteStudentModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center',
          justifyContent: 'center', zIndex: 1000, padding: '20px',
        }}>
          <div className="card" style={{ maxWidth: '440px', width: '100%', padding: '24px' }}>
            <h3 style={{ margin: '0 0 12px', fontSize: '1.15rem', fontWeight: 600, color: '#dc2626' }}>
              🗑️ Delete Student
            </h3>
            <p style={{ margin: '0 0 16px', fontSize: '0.9rem', color: 'var(--color-text-muted)' }}>
              Permanently delete <strong>{deleteStudentModal.name}</strong> from this section?
              <br /><br />
              This will also delete all their scores, appeals, and makeup requests. This action cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" style={{ minHeight: '44px' }} onClick={() => setDeleteStudentModal(null)}>
                Cancel
              </button>
              <button
                className="btn"
                style={{ background: '#dc2626', color: '#fff', border: 'none', minHeight: '44px' }}
                onClick={handleDeleteStudentConfirm}
                disabled={deletingStudent}
              >
                {deletingStudent ? 'Deleting…' : '🗑️ Delete Permanently'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
