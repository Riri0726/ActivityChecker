import { useState, useEffect } from 'react';
import {
  getMakeupActivities,
  getAllActivitiesForLinking,
  createMakeupActivity,
  updateMakeupActivity,
  toggleArchiveMakeupActivity,
} from '../services/adminService.js';

export default function MakeupManager() {
  const [tasks, setTasks] = useState([]);
  const [availableActivities, setAvailableActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    instructions: '',
    linkedActivityIds: [],
  });
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [allTasks, allActs] = await Promise.all([
        getMakeupActivities(),
        getAllActivitiesForLinking(),
      ]);
      setTasks(allTasks);
      setAvailableActivities(allActs);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreate = () => {
    setEditingTask(null);
    setFormData({
      title: '',
      description: '',
      instructions: '',
      linkedActivityIds: [],
    });
    setModalError('');
    setModalOpen(true);
  };

  const handleOpenEdit = (task) => {
    setEditingTask(task);
    setFormData({
      title: task.title,
      description: task.description || '',
      instructions: task.instructions,
      linkedActivityIds: task.linkedActivities.map((a) => a.id),
    });
    setModalError('');
    setModalOpen(true);
  };

  const handleToggleArchive = async (task) => {
    try {
      await toggleArchiveMakeupActivity(task.id, !task.archived);
      await loadData();
    } catch (e) {
      setError(e.message);
    }
  };

  const handleToggleLink = (activityId) => {
    setFormData((prev) => {
      const exists = prev.linkedActivityIds.includes(activityId);
      return {
        ...prev,
        linkedActivityIds: exists
          ? prev.linkedActivityIds.filter((id) => id !== activityId)
          : [...prev.linkedActivityIds, activityId],
      };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      setModalError('Please enter a title for the makeup activity.');
      return;
    }
    if (!formData.instructions.trim()) {
      setModalError('Please provide instructions/submission details for the student.');
      return;
    }

    setSaving(true);
    setModalError('');

    try {
      if (editingTask) {
        await updateMakeupActivity(editingTask.id, {
          title: formData.title,
          description: formData.description,
          instructions: formData.instructions,
          linkedActivityIds: formData.linkedActivityIds,
        });
      } else {
        await createMakeupActivity({
          title: formData.title,
          description: formData.description,
          instructions: formData.instructions,
          linkedActivityIds: formData.linkedActivityIds,
        });
      }
      setModalOpen(false);
      await loadData();
    } catch (e) {
      setModalError(e.message);
    } finally {
      setSaving(false);
    }
  };

  // Group available activities by section for easy checklist selection
  const activitiesBySection = availableActivities.reduce((acc, act) => {
    const secName = act.sections?.name || 'Unassigned';
    if (!acc[secName]) acc[secName] = [];
    acc[secName].push(act);
    return acc;
  }, {});

  return (
    <div className="makeup-bank-wrap">
      <div className="admin-section-header flex justify-between items-center flex-wrap gap-4">
        <div>
          <h2>📦 Makeup Activity Bank</h2>
          <p>
            Create alternative tasks and link them to the specific missing activities they substitute for.
          </p>
        </div>
        <button
          id="create-makeup-btn"
          className="btn btn-primary"
          onClick={handleOpenCreate}
        >
          + Create Makeup Activity
        </button>
      </div>

      {error && (
        <div className="alert alert-error mb-4">
          <span>⚠️</span> {error}
        </div>
      )}

      {loading ? (
        <div className="loading-center">
          <div className="spinner" />
          <span>Loading makeup activities…</span>
        </div>
      ) : tasks.length === 0 ? (
        <div className="empty-state">
          <span aria-hidden="true">📦</span>
          <p>No makeup activities in the bank yet.</p>
          <button className="btn btn-secondary mt-3" onClick={handleOpenCreate}>
            Create your first alternative task
          </button>
        </div>
      ) : (
        <div className="makeup-list">
          {tasks.map((task) => (
            <div
              key={task.id}
              className={`makeup-card ${task.archived ? 'makeup-card--archived' : ''}`}
            >
              <div className="makeup-card-header">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="makeup-card-title">{task.title}</h3>
                    <span className={`badge ${task.archived ? 'badge-rejected' : 'badge-done'}`}>
                      {task.archived ? 'Archived' : 'Active'}
                    </span>
                  </div>
                  {task.description && (
                    <p className="makeup-card-desc">{task.description}</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    className="btn btn-sm btn-ghost"
                    onClick={() => handleOpenEdit(task)}
                  >
                    ✏️ Edit
                  </button>
                  <button
                    className={`btn btn-sm ${task.archived ? 'btn-ghost' : 'btn-danger'}`}
                    onClick={() => handleToggleArchive(task)}
                  >
                    {task.archived ? 'Unarchive' : 'Archive'}
                  </button>
                </div>
              </div>

              {/* Instructions preview */}
              <div className="makeup-instructions-box">
                <span className="text-muted" style={{ fontSize: '0.75rem', fontWeight: 600 }}>
                  STUDENT INSTRUCTIONS & SUBMISSION LINK:
                </span>
                <p style={{ whiteSpace: 'pre-wrap', marginTop: 4, fontSize: '0.88rem' }}>
                  {task.instructions}
                </p>
              </div>

              {/* Linked activities */}
              <div className="makeup-linked-section">
                <span className="text-muted" style={{ fontSize: '0.75rem', fontWeight: 600 }}>
                  APPLIES TO SPECIFIC ACTIVITIES:
                </span>
                {task.linkedActivities.length === 0 ? (
                  <span className="text-muted" style={{ fontSize: '0.82rem', marginLeft: 8 }}>
                    None selected (not currently offered to students)
                  </span>
                ) : (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {task.linkedActivities.map((act) => (
                      <span key={act.id} className="badge badge-pending">
                        {act.sections?.name} → {act.title}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit Modal */}
      {modalOpen && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal" style={{ maxWidth: 640 }}>
            <div className="modal-header">
              <h2>{editingTask ? '✏️ Edit Makeup Activity' : '✨ New Makeup Activity'}</h2>
              <button className="modal-close" onClick={() => setModalOpen(false)}>×</button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="form-group mb-3">
                <label className="form-label">
                  Activity Title <span style={{ color: 'var(--color-danger)' }}>*</span>
                </label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Alternative Quiz 1 (Case Study)"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  required
                />
              </div>

              <div className="form-group mb-3">
                <label className="form-label">
                  Short Description <span className="text-muted">(optional context)</span>
                </label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Covers Database Normalization & ERDs"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>

              <div className="form-group mb-4">
                <label className="form-label">
                  Instructions & Submission Details <span style={{ color: 'var(--color-danger)' }}>*</span>
                </label>
                <textarea
                  className="form-textarea"
                  style={{ minHeight: 95 }}
                  placeholder="Paste submission link (e.g. Google Drive folder, Form), deadlines, and specific directions for the student…"
                  value={formData.instructions}
                  onChange={(e) => setFormData({ ...formData, instructions: e.target.value })}
                  required
                />
              </div>

              {/* Linked Activities Checklist */}
              <div className="form-group mb-4">
                <label className="form-label">
                  Link to Missing Activity Options
                </label>
                <p className="text-muted" style={{ fontSize: '0.8rem', marginTop: -4, marginBottom: 8 }}>
                  Check which specific activities this task is a valid make-up for across sections:
                </p>

                <div className="activity-links-picker">
                  {Object.keys(activitiesBySection).length === 0 ? (
                    <p className="text-muted" style={{ fontSize: '0.82rem', padding: 8 }}>
                      No activities found. Upload an Excel gradebook first.
                    </p>
                  ) : (
                    Object.entries(activitiesBySection).map(([sectionName, acts]) => (
                      <div key={sectionName} className="picker-section-group">
                        <div className="picker-section-title">{sectionName}</div>
                        <div className="picker-grid">
                          {acts.map((act) => {
                            const isChecked = formData.linkedActivityIds.includes(act.id);
                            return (
                              <label key={act.id} className="picker-label">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => handleToggleLink(act.id)}
                                />
                                <span className="picker-label-text">
                                  {act.title} {act.max_score > 0 ? `[${act.max_score}]` : ''}
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {modalError && (
                <div className="alert alert-error mb-4">
                  <span>⚠️</span> {modalError}
                </div>
              )}

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={saving}
                >
                  {saving ? 'Saving…' : editingTask ? 'Save Changes' : 'Create Task'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style>{`
        .makeup-bank-wrap {
          max-width: 900px;
        }
        .makeup-list {
          display: flex;
          flex-direction: column;
          gap: var(--sp-4);
        }
        .makeup-card {
          background: var(--bg-card);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-lg);
          padding: var(--sp-5);
          display: flex;
          flex-direction: column;
          gap: var(--sp-3);
          transition: box-shadow var(--transition-fast);
        }
        .makeup-card--archived {
          opacity: 0.65;
          background: var(--bg-card-alt);
        }
        .makeup-card-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: var(--sp-4);
          flex-wrap: wrap;
        }
        .makeup-card-title {
          font-size: 1.05rem;
          font-weight: 600;
          color: var(--text-primary);
        }
        .makeup-card-desc {
          font-size: 0.88rem;
          color: var(--text-secondary);
          margin-top: 2px;
        }
        .makeup-instructions-box {
          background: var(--bg-card-alt);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-md);
          padding: var(--sp-3) var(--sp-4);
        }
        .makeup-linked-section {
          padding-top: var(--sp-2);
          border-top: 1px dashed var(--border-color);
        }
        .activity-links-picker {
          max-height: 220px;
          overflow-y: auto;
          border: 1px solid var(--border-color);
          border-radius: var(--radius-md);
          padding: var(--sp-3);
          background: var(--bg-card-alt);
          display: flex;
          flex-direction: column;
          gap: var(--sp-3);
        }
        .picker-section-group {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .picker-section-title {
          font-size: 0.78rem;
          font-weight: 700;
          color: var(--color-primary);
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }
        .picker-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
          gap: 6px;
        }
        .picker-label {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 0.85rem;
          cursor: pointer;
          user-select: none;
        }
        .picker-label-text {
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
      `}</style>
    </div>
  );
}
