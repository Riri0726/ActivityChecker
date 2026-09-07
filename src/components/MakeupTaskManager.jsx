import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { getMakeupTasks, createMakeupTask, updateMakeupTask, deleteMakeupTask } from '../services/adminService.js';

export default function MakeupTaskManager() {
  const { adminProfile, selectedSubjectId } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form states
  const [isAdding, setIsAdding] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [form, setForm] = useState({
    title: '',
    submission_mode: 'gdrive_link',
    instructions: '',
    submission_url: '',
  });

  const loadTasks = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getMakeupTasks(selectedSubjectId || null);
      setTasks(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [selectedSubjectId]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  const handleStartAdd = () => {
    setEditingTask(null);
    setForm({
      title: '',
      submission_mode: 'gdrive_link',
      instructions: '',
      submission_url: '',
    });
    setIsAdding(true);
    setError('');
    setSuccess('');
  };

  const handleStartEdit = (task) => {
    setIsAdding(false);
    setEditingTask(task);
    setForm({
      title: task.title,
      submission_mode: task.submission_mode || 'gdrive_link',
      instructions: task.instructions || '',
      submission_url: task.submission_url || '',
    });
    setError('');
    setSuccess('');
  };

  const handleCancel = () => {
    setIsAdding(false);
    setEditingTask(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.instructions.trim()) {
      setError('Title and instructions are required.');
      return;
    }

    try {
      if (editingTask) {
        await updateMakeupTask(editingTask.id, {
          title: form.title,
          submission_mode: form.submission_mode,
          instructions: form.instructions,
          submission_url: form.submission_url,
        });
        setSuccess('Make-up task updated.');
      } else {
        await createMakeupTask({
          adminId: adminProfile?.id,
          subjectId: selectedSubjectId || null,
          title: form.title,
          submission_mode: form.submission_mode,
          instructions: form.instructions,
          submission_url: form.submission_url,
        });
        setSuccess('New make-up task template added to repository.');
      }
      handleCancel();
      await loadTasks();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDelete = async (task) => {
    if (!window.confirm(`Archive make-up task "${task.title}"?`)) return;
    try {
      await deleteMakeupTask(task.id);
      setSuccess('Task archived.');
      await loadTasks();
    } catch (err) {
      setError(err.message);
    }
  };

  const modeBadge = (mode) => {
    switch (mode) {
      case 'gdrive_link':
        return <span style={{ background: '#eff6ff', color: '#1d4ed8', padding: '3px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600 }}>📁 Google Drive</span>;
      case 'physical_submission':
        return <span style={{ background: '#fef3c7', color: '#b45309', padding: '3px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600 }}>🏢 Physical Turn-In</span>;
      default:
        return <span style={{ background: '#f1f5f9', color: '#475569', padding: '3px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600 }}>📝 Custom</span>;
    }
  };

  return (
    <div style={{ padding: 'var(--sp-4)', maxWidth: '960px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--sp-6)' }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 700, margin: 0, color: 'var(--color-heading)' }}>
            Make-Up Task Repository
          </h2>
          <p style={{ margin: '4px 0 0', color: 'var(--color-text-muted)', fontSize: '0.88rem' }}>
            Predefined alternative assignments and instructions assigned to approved student make-up requests.
          </p>
        </div>
        {!isAdding && !editingTask && (
          <button className="btn btn-primary" onClick={handleStartAdd} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>+</span> New Make-Up Task
          </button>
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

      {/* Form */}
      {(isAdding || editingTask) && (
        <div className="card" style={{ padding: 'var(--sp-5)', marginBottom: 'var(--sp-6)', border: '1px solid var(--color-border)' }}>
          <h3 style={{ margin: '0 0 var(--sp-4)', fontSize: '1.1rem', fontWeight: 600 }}>
            {editingTask ? `Edit Task: ${editingTask.title}` : 'Define New Make-Up Task'}
          </h3>
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 'var(--sp-4)', marginBottom: 'var(--sp-4)' }}>
              <div>
                <label className="form-label" style={{ display: 'block', marginBottom: '6px', fontWeight: 500, fontSize: '0.85rem' }}>
                  Task Title *
                </label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Alternative Set B: Case Analysis Paper"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="form-label" style={{ display: 'block', marginBottom: '6px', fontWeight: 500, fontSize: '0.85rem' }}>
                  Submission Mode *
                </label>
                <select
                  className="form-input"
                  value={form.submission_mode}
                  onChange={(e) => setForm({ ...form, submission_mode: e.target.value })}
                >
                  <option value="gdrive_link">Google Drive Link / Form</option>
                  <option value="physical_submission">Physical Hand-In</option>
                  <option value="custom_instructions">Custom Instructions</option>
                </select>
              </div>
            </div>

            {form.submission_mode === 'gdrive_link' && (
              <div style={{ marginBottom: 'var(--sp-4)' }}>
                <label className="form-label" style={{ display: 'block', marginBottom: '6px', fontWeight: 500, fontSize: '0.85rem' }}>
                  Google Drive Folder Link / Submission URL
                </label>
                <input
                  type="url"
                  className="form-input"
                  placeholder="https://drive.google.com/drive/folders/..."
                  value={form.submission_url}
                  onChange={(e) => setForm({ ...form, submission_url: e.target.value })}
                />
                <p style={{ margin: '4px 0 0', fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
                  This URL will ONLY be revealed to students after their make-up justification is approved.
                </p>
              </div>
            )}

            <div style={{ marginBottom: 'var(--sp-5)' }}>
              <label className="form-label" style={{ display: 'block', marginBottom: '6px', fontWeight: 500, fontSize: '0.85rem' }}>
                Detailed Instructions & Guidelines *
              </label>
              <textarea
                className="form-input"
                rows="4"
                placeholder="Write step-by-step requirements, rubric, formatting guidelines, or physical drop-off location/room..."
                value={form.instructions}
                onChange={(e) => setForm({ ...form, instructions: e.target.value })}
                required
              />
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-secondary" onClick={handleCancel}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary">
                {editingTask ? 'Update Task' : 'Save Make-Up Task'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Tasks List */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--color-text-muted)' }}>
          Loading make-up repository...
        </div>
      ) : tasks.length === 0 ? (
        <div className="card text-center" style={{ padding: '40px', border: '1px dashed var(--color-border)' }}>
          <div style={{ fontSize: '2rem', marginBottom: '8px' }}>📂</div>
          <h3 style={{ margin: '0 0 6px', fontSize: '1.1rem' }}>No make-up tasks defined yet</h3>
          <p style={{ margin: '0 0 16px', color: 'var(--color-text-muted)', fontSize: '0.88rem' }}>
            Create reusable make-up tasks so you can assign them to missing activities or approve them in the review queue.
          </p>
          <button className="btn btn-primary" onClick={handleStartAdd}>
            + Create Make-Up Task
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {tasks.map((task) => (
            <div
              key={task.id}
              className="card"
              style={{
                padding: 'var(--sp-4)',
                border: '1px solid var(--color-border)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                gap: '16px',
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                  <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 600, color: 'var(--color-heading)' }}>
                    {task.title}
                  </h3>
                  {modeBadge(task.submission_mode)}
                </div>

                <p style={{ margin: '0 0 8px', fontSize: '0.85rem', color: 'var(--color-text)', whiteSpace: 'pre-wrap' }}>
                  {task.instructions}
                </p>

                {task.submission_url && (
                  <div style={{ fontSize: '0.8rem', color: 'var(--color-primary)' }}>
                    Submission Link: <a href={task.submission_url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'underline' }}>{task.submission_url}</a>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                <button
                  className="btn btn-secondary"
                  style={{ fontSize: '0.78rem', padding: '4px 8px' }}
                  onClick={() => handleStartEdit(task)}
                >
                  ✏️ Edit
                </button>
                <button
                  className="btn btn-secondary"
                  style={{ fontSize: '0.78rem', padding: '4px 8px', color: '#dc2626' }}
                  onClick={() => handleDelete(task)}
                >
                  🗑️
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
